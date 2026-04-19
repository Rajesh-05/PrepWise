"""
PrepWise Flask Backend - Production Ready for Render Deployment
Fixed version addressing all deployment and auth issues.
"""

# ===========================
# IMPORTS (Consolidated)
# ===========================
import os
import logging
import json
import re
import math
import time
import tempfile
import threading
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import requests
from flask import Flask, request, jsonify, redirect
from flask_cors import CORS
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
from pymongo import MongoClient, ASCENDING
from pymongo.errors import DuplicateKeyError
import pdfplumber

# ===========================
# ENVIRONMENT VARIABLES
# ===========================
load_dotenv()

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

# FIX 1: Removed FileHandler('app.log') — Render is read-only filesystem.
# Writing log files will cause a crash on Render. Use StreamHandler only.
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)
logger.info(f"PrepWise API starting up (Log Level: {LOG_LEVEL})")

# URLs
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")
BACKEND_URL  = os.getenv("BACKEND_URL",  "http://localhost:5000").rstrip("/")

# Secrets
SECRET_KEY     = os.getenv("FLASK_SECRET_KEY", "dev-secret-key-change-in-prod")
JWT_SECRET     = os.getenv("JWT_SECRET")
JWT_EXPIRES_MIN = int(os.getenv("JWT_EXPIRES_MIN", "1440"))  # 24 hours

# Google OAuth
# FIX 2: Accept both GOOGLE_CLIENT_ID and GOOGLE_OAUTH_CLIENT_ID so the env
#         variable name works regardless of which convention the user chose in Render.
GOOGLE_CLIENT_ID     = os.getenv("GOOGLE_CLIENT_ID") or os.getenv("GOOGLE_OAUTH_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET") or os.getenv("GOOGLE_OAUTH_CLIENT_SECRET")
GOOGLE_REDIRECT_URI  = os.getenv("GOOGLE_REDIRECT_URI", f"{BACKEND_URL}/auth/google/callback")

GOOGLE_AUTH_URL     = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL    = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

# MongoDB
MONGODB_URI    = os.getenv("MONGODB_URI")
MONGODB_DBNAME = os.getenv("MONGODB_DBNAME", "prepwise")

# API Keys
API_KEY         = os.getenv("GEMINI_API_KEY")
GROQ_API_KEY    = os.getenv("GROQ_API_KEY")
VAPI_PRIVATE_KEY = os.getenv("VAPI_PRIVATE_KEY")

# Log configuration state (never log secrets themselves)
logger.info(f"FRONTEND_URL      : {FRONTEND_URL}")
logger.info(f"BACKEND_URL       : {BACKEND_URL}")
logger.info(f"GOOGLE_REDIRECT_URI: {GOOGLE_REDIRECT_URI}")
logger.info(f"GOOGLE_CLIENT_ID  : {'SET' if GOOGLE_CLIENT_ID else 'MISSING'}")
logger.info(f"GOOGLE_CLIENT_SECRET: {'SET' if GOOGLE_CLIENT_SECRET else 'MISSING'}")
logger.info(f"JWT_SECRET        : {'SET' if JWT_SECRET else 'MISSING'}")
logger.info(f"MONGODB_URI       : {'SET' if MONGODB_URI else 'MISSING'}")
logger.info(f"GEMINI_API_KEY    : {'SET' if API_KEY else 'MISSING'}")

# ===========================
# FLASK APP INITIALIZATION
# ===========================
app = Flask(__name__)
app.secret_key = SECRET_KEY

# FIX 3: CORS was too restrictive — /scrape-review and some auth routes were not
#         covered. Use a single broad CORS config that covers ALL routes.
#         Also added the deployed frontend URL explicitly.
CORS(app,
     origins=[FRONTEND_URL, "http://localhost:3000"],
     methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
     allow_headers=["Content-Type", "Authorization"],
     supports_credentials=True,
     max_age=3600
)

# ===========================
# MONGODB INITIALIZATION
# ===========================
mongo_client = None
mongo_db     = None
users_col    = None

try:
    if not MONGODB_URI:
        raise ValueError("MONGODB_URI environment variable is missing")

    mongo_client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=8000)
    mongo_db     = mongo_client[MONGODB_DBNAME]
    mongo_client.admin.command("ping")
    logger.info(f"MongoDB connected to database: {MONGODB_DBNAME}")

    users_col = mongo_db["users"]
    users_col.create_index([("email", ASCENDING)], unique=True)

    app.mongo_db  = mongo_db
    app.users_col = users_col
    logger.info("MongoDB indexes created successfully")

except Exception as e:
    logger.error(f"MongoDB initialization failed: {e}")
    app.mongo_db  = None
    app.users_col = None

# ===========================
# UTILITY FUNCTIONS
# ===========================

def extract_pdf_text(pdf_path: str) -> str:
    text = ""
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
    except Exception as e:
        logger.error(f"Error extracting PDF text: {e}")
    return text.strip()


def _clean_gemini_json(text: str):
    """Strip markdown fences and parse JSON from Gemini response."""
    text = text.strip()
    if text.startswith("```"):
        # Remove opening fence (```json or ```)
        text = re.sub(r'^```[a-zA-Z]*\n?', '', text)
        # Remove closing fence
        text = re.sub(r'```$', '', text).strip()
    return json.loads(text)


def _call_gemini(prompt: str, timeout: int = 30) -> str | None:
    """
    Call Gemini API and return the raw text. Returns None on failure.
    """
    if not API_KEY:
        logger.error("Gemini API key not configured")
        return None
    model = "gemini-2.5-flash"
    url   = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={API_KEY}"
    try:
        resp = requests.post(
            url,
            json={"contents": [{"parts": [{"text": prompt}]}]},
            timeout=timeout
        )
        if not resp.ok:
            logger.error(f"Gemini error {resp.status_code}: {resp.text[:200]}")
            return None
        candidates = resp.json().get("candidates", [])
        if not candidates:
            return None
        return candidates[0].get("content", {}).get("parts", [{}])[0].get("text")
    except Exception as e:
        logger.error(f"Gemini request failed: {e}")
        return None


def get_gemini_resume_improvements(resume_text: str) -> dict:
    prompt = f"""You are an expert resume reviewer. Given the following resume, provide actionable suggestions to improve it.
Respond ONLY with a JSON object:
{{"suggestions": "Your suggestions here as a paragraph or bullet points."}}
Resume: {resume_text}"""
    text = _call_gemini(prompt)
    if text is None:
        return {"error": "Failed to get suggestions from AI"}
    try:
        return _clean_gemini_json(text)
    except Exception as e:
        return {"error": f"Failed to parse AI response: {e}", "raw": text[:300]}


def get_gemini_ats_score(resume_text: str, job_description: str) -> dict:
    prompt = f"""You are an ATS (Applicant Tracking System) resume evaluator.
Given the following resume and job description, return a JSON object with:
- match_score (0-100 integer)
- summary (a detailed 2-3 line summary)
- missing_keywords (list of important keywords from job description not in resume)

Resume:
{resume_text}

Job Description:
{job_description}

Respond ONLY with the JSON object."""
    text = _call_gemini(prompt)
    if text is None:
        return {"error": "Failed to evaluate resume"}
    try:
        return _clean_gemini_json(text)
    except Exception as e:
        return {"error": f"Failed to parse AI response: {e}", "raw": text[:300]}


def issue_jwt(user_id, email: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub":   str(user_id),
        "email": email,
        "iat":   int(now.timestamp()),
        "exp":   int((now + timedelta(minutes=JWT_EXPIRES_MIN)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def require_db() -> bool:
    return app.users_col is not None and JWT_SECRET is not None


# ===========================
# FIX 4: require_auth decorator
# The original app imports require_auth from auth_utils.py which is a
# separate file not included here. We implement a self-contained version
# so the app works on Render without the missing module crashing at import.
# ===========================

# Token revocation set (in-memory; fine for single-instance Render free tier)
_revoked_tokens: set = set()

def revoke_token(token: str):
    _revoked_tokens.add(token)

def require_auth(f):
    """JWT auth decorator — attaches request.user_email on success."""
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Authorization header missing or malformed"}), 401
        token = auth_header.split(" ", 1)[1]
        if token in _revoked_tokens:
            return jsonify({"error": "Token has been revoked"}), 401
        if not JWT_SECRET:
            return jsonify({"error": "JWT not configured on server"}), 500
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            request.user_email = payload.get("email")
            request.user_id    = payload.get("sub")
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError as e:
            return jsonify({"error": f"Invalid token: {e}"}), 401
        return f(*args, **kwargs)
    return decorated


def log_activity(db, email, action_type, detail=""):
    """Best-effort activity log — never raises."""
    if db is None:
        return
    try:
        db["activity_logs"].insert_one({
            "email":      email,
            "type":       action_type,
            "detail":     detail,
            "created_at": datetime.now(timezone.utc)
        })
    except Exception:
        pass


def serialize_doc(doc):
    """Convert MongoDB ObjectId fields to strings for JSON serialisation."""
    from bson import ObjectId
    if isinstance(doc, list):
        return [serialize_doc(d) for d in doc]
    if isinstance(doc, dict):
        out = {}
        for k, v in doc.items():
            if isinstance(v, ObjectId):
                out[k] = str(v)
            elif isinstance(v, datetime):
                out[k] = v.isoformat()
            elif isinstance(v, dict):
                out[k] = serialize_doc(v)
            elif isinstance(v, list):
                out[k] = serialize_doc(v)
            else:
                out[k] = v
        return out
    return doc

# ===========================
# HEALTH CHECK
# ===========================

@app.route('/healthz', methods=['GET'])
@app.route('/', methods=['GET'])
def healthz():
    try:
        if app.mongo_db:
            app.mongo_db.command('ping')
        return jsonify({"status": "ok", "message": "PrepWise backend is running"}), 200
    except Exception as e:
        return jsonify({"status": "degraded", "error": str(e)}), 200

# ===========================
# GOOGLE OAUTH ROUTES
# ===========================

@app.route('/auth/google/login', methods=['GET'])
def google_login():
    """Step 1 — redirect the browser to Google's consent screen."""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        logger.error("Google OAuth env vars missing")
        return jsonify({"error": "Google OAuth not configured on server"}), 500

    params = {
        "client_id":     GOOGLE_CLIENT_ID,
        "redirect_uri":  GOOGLE_REDIRECT_URI,
        "scope":         "openid email profile",
        "response_type": "code",
        "access_type":   "offline",
        "prompt":        "consent",
    }
    auth_url = f"{GOOGLE_AUTH_URL}?{urlencode(params)}"
    logger.info(f"Redirecting to Google OAuth: {auth_url[:80]}…")
    return redirect(auth_url)


@app.route('/auth/google/callback', methods=['GET'])
def google_callback():
    """Step 2 — exchange code for token, create user, issue JWT, redirect to frontend."""
    code  = request.args.get('code')
    error = request.args.get('error')

    if error:
        logger.warning(f"Google OAuth error: {error}")
        return redirect(f"{FRONTEND_URL}/login?error=access_denied")

    if not code:
        logger.warning("No code in Google callback")
        return redirect(f"{FRONTEND_URL}/login?error=no_code")

    # Exchange code for tokens
    token_data = {
        "code":          code,
        "client_id":     GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uri":  GOOGLE_REDIRECT_URI,
        "grant_type":    "authorization_code",
    }

    try:
        token_resp = requests.post(GOOGLE_TOKEN_URL, data=token_data, timeout=15)
        if token_resp.status_code != 200:
            logger.error(f"Token exchange failed ({token_resp.status_code}): {token_resp.text[:200]}")
            return redirect(f"{FRONTEND_URL}/login?error=token_exchange_failed")

        access_token = token_resp.json().get("access_token")
        if not access_token:
            return redirect(f"{FRONTEND_URL}/login?error=no_access_token")

        # Fetch user info
        user_resp = requests.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10
        )
        if user_resp.status_code != 200:
            logger.error(f"User info fetch failed: {user_resp.text[:200]}")
            return redirect(f"{FRONTEND_URL}/login?error=user_info_failed")

        user_info = user_resp.json()
        email     = user_info.get("email")
        logger.info(f"Google OAuth success for: {email}")

        # Upsert user in MongoDB
        user_id = user_info.get("id")
        if mongo_db is not None and users_col is not None:
            try:
                existing = users_col.find_one({"email": email})
                user_doc = {
                    "google_id": user_info.get("id"),
                    "email":     email,
                    "firstName": user_info.get("given_name", ""),
                    "lastName":  user_info.get("family_name", ""),
                    "name":      user_info.get("name", ""),
                    "picture":   user_info.get("picture", ""),
                    "last_login": datetime.now(timezone.utc),
                    "auth_provider": "google",
                }
                if existing:
                    users_col.update_one(
                        {"email": email},
                        {"$set": user_doc, "$inc": {"total_login_count": 1}}
                    )
                    user_id = existing["_id"]
                else:
                    user_doc.update({
                        "createdAt":         datetime.now(timezone.utc),
                        "subscription_tier": "free",
                        "total_login_count": 1,
                    })
                    result  = users_col.insert_one(user_doc)
                    user_id = result.inserted_id
                log_activity(mongo_db, email, "login", "Google OAuth Login")
            except Exception as e:
                logger.error(f"MongoDB upsert failed: {e}")

        # Issue JWT
        if not JWT_SECRET:
            logger.error("JWT_SECRET is not set — cannot issue token")
            return redirect(f"{FRONTEND_URL}/login?error=server_config_error")

        session_payload = {
            "sub":   str(user_id),
            "email": email,
            "name":  user_info.get("name", ""),
            "exp":   datetime.now(timezone.utc) + timedelta(days=7),
            "iat":   datetime.now(timezone.utc),
        }
        token = jwt.encode(session_payload, JWT_SECRET, algorithm="HS256")

        # FIX 5: Redirect with token in query param, NOT hash fragment.
        # Hash fragments (#) are never sent to the server and are hard for
        # React Router to parse reliably. Use ?session_token= instead.
        # Your Login.jsx must read: new URLSearchParams(window.location.search).get('session_token')
        return redirect(f"{FRONTEND_URL}/login?session_token={token}")

    except requests.exceptions.RequestException as e:
        logger.error(f"OAuth HTTP error: {e}")
        return redirect(f"{FRONTEND_URL}/login?error=oauth_request_failed")
    except Exception as e:
        logger.error(f"Unexpected OAuth error: {e}", exc_info=True)
        return redirect(f"{FRONTEND_URL}/login?error=server_error")

# ===========================
# EMAIL / PASSWORD AUTH
# ===========================

@app.route('/auth/signup', methods=['POST'])
def auth_signup():
    if not require_db():
        return jsonify({"error": "Auth service not available — check server config"}), 503

    data       = request.get_json() or {}
    first_name = (data.get('firstName') or '').strip()
    last_name  = (data.get('lastName')  or '').strip()
    email      = (data.get('email')     or '').strip().lower()
    password   = data.get('password')   or ''

    if not all([first_name, last_name, email, password]):
        return jsonify({"error": "All fields are required"}), 400
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    try:
        user_doc = {
            "email":             email,
            "password":          generate_password_hash(password),
            "firstName":         first_name,
            "lastName":          last_name,
            "name":              f"{first_name} {last_name}",
            "picture":           "",
            "subscription_tier": "free",
            "createdAt":         datetime.now(timezone.utc),
            "last_login":        datetime.now(timezone.utc),
            "total_login_count": 0,
            "auth_provider":     "email",
        }
        result = users_col.insert_one(user_doc)
        logger.info(f"New user registered: {email}")

        # Auto-login: issue token immediately after signup
        token = issue_jwt(result.inserted_id, email)
        return jsonify({
            "message": "Account created successfully",
            "token":   token,
            "user": {
                "email":     email,
                "firstName": first_name,
                "lastName":  last_name,
                "name":      f"{first_name} {last_name}",
                "picture":   "",
                "subscription_tier": "free",
            }
        }), 201

    except DuplicateKeyError:
        return jsonify({"error": "An account with this email already exists"}), 409
    except Exception as e:
        logger.error(f"Signup error: {e}", exc_info=True)
        return jsonify({"error": "Failed to create account"}), 500


@app.route('/auth/login', methods=['POST'])
def auth_login():
    if not require_db():
        return jsonify({"error": "Auth service not available — check server config"}), 503

    data     = request.get_json() or {}
    email    = (data.get('email')    or '').strip().lower()
    password = data.get('password')  or ''

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    try:
        user = users_col.find_one({"email": email})
        if not user or not check_password_hash(user.get('password', ''), password):
            return jsonify({"error": "Invalid email or password"}), 401

        users_col.update_one(
            {"email": email},
            {"$set": {"last_login": datetime.now(timezone.utc)},
             "$inc": {"total_login_count": 1}}
        )
        log_activity(mongo_db, email, "login", "Email/Password Login")

        token = issue_jwt(user['_id'], email)

        return jsonify({
            "token": token,
            "user": {
                "email":             user['email'],
                "name":              user.get('name', ''),
                "firstName":         user.get('firstName', ''),
                "lastName":          user.get('lastName', ''),
                "picture":           user.get('picture', ''),
                "subscription_tier": user.get('subscription_tier', 'free'),
            }
        }), 200

    except Exception as e:
        logger.error(f"Login error: {e}", exc_info=True)
        return jsonify({"error": "Failed to sign in"}), 500


@app.route('/auth/me', methods=['GET'])
@require_auth
def auth_me():
    if not require_db():
        return jsonify({"error": "Auth service not available"}), 503
    email = getattr(request, 'user_email', None)
    if not email:
        return jsonify({"error": "User not found"}), 404
    user = users_col.find_one({"email": email}, {"password": 0})
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify({"user": serialize_doc(user)}), 200


@app.route('/auth/logout', methods=['POST'])
@require_auth
def auth_logout():
    email = getattr(request, 'user_email', None)
    if email:
        log_activity(mongo_db, email, "logout", "User Logout")
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        revoke_token(auth_header.split(' ', 1)[1])
    return jsonify({"message": "Logged out successfully"}), 200

# ===========================
# CHAT SESSIONS
# ===========================

@app.route('/api/chat-sessions', methods=['GET', 'DELETE'])
@require_auth
def handle_chat_sessions():
    db    = app.mongo_db
    email = getattr(request, 'user_email', None)
    if db is None or not email:
        return jsonify({'error': 'Service unavailable'}), 503

    user = db['users'].find_one({'email': email})
    if not user:
        return jsonify({'error': 'User not found'}), 404

    if request.method == 'DELETE':
        db['chat_sessions'].delete_many({'user_id': user['_id']})
        return jsonify({'message': 'All sessions deleted'}), 200

    sessions = list(
        db['chat_sessions'].find({'user_id': user['_id']}).sort('last_message_at', -1)
    )
    return jsonify({'sessions': serialize_doc(sessions)}), 200


@app.route('/api/chat-sessions/<session_id>', methods=['DELETE'])
@require_auth
def delete_chat_session(session_id):
    from bson import ObjectId
    db    = app.mongo_db
    email = getattr(request, 'user_email', None)
    if db is None or not email:
        return jsonify({'error': 'Service unavailable'}), 503

    user = db['users'].find_one({'email': email})
    if not user:
        return jsonify({'error': 'User not found'}), 404

    result = db['chat_sessions'].delete_one(
        {'_id': ObjectId(session_id), 'user_id': user['_id']}
    )
    if result.deleted_count:
        return jsonify({'message': 'Chat session deleted'}), 200
    return jsonify({'error': 'Chat session not found'}), 404


@app.route('/api/chat-sessions/<session_id>', methods=['PATCH'])
@require_auth
def update_chat_session(session_id):
    from bson import ObjectId
    db    = app.mongo_db
    email = getattr(request, 'user_email', None)
    if db is None or not email:
        return jsonify({'error': 'Service unavailable'}), 503

    user = db['users'].find_one({'email': email})
    if not user:
        return jsonify({'error': 'User not found'}), 404

    data      = request.get_json() or {}
    new_topic = (data.get('topic') or '').strip()
    if not new_topic:
        return jsonify({'error': 'Topic cannot be empty'}), 400

    result = db['chat_sessions'].update_one(
        {'_id': ObjectId(session_id), 'user_id': user['_id']},
        {'$set': {'topic': new_topic}}
    )
    if result.matched_count:
        return jsonify({'message': 'Session updated'}), 200
    return jsonify({'error': 'Session not found'}), 404

# ===========================
# RESUME OPERATIONS
# ===========================

@app.route('/improve-resume', methods=['POST'])
@require_auth
def improve_resume():
    if 'file' not in request.files:
        return jsonify({"error": "Missing resume file"}), 400

    file     = request.files['file']
    filename = file.filename

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        file.save(tmp.name)
        tmp_path = tmp.name

    try:
        resume_text = extract_pdf_text(tmp_path)
        result      = get_gemini_resume_improvements(resume_text)
        if "error" in result:
            return jsonify(result), 500
        if mongo_db:
            log_activity(mongo_db, request.user_email, "resume_builder", f"Improve: {filename}")
        return jsonify(result), 200
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


@app.route('/generate-resume', methods=['POST'])
@require_auth
def generate_resume():
    if not API_KEY:
        return jsonify({"error": "Gemini API not configured"}), 500

    data            = request.get_json() or {}
    job_description = data.get('jobDescription')
    template        = data.get('template', 'modern')
    user_data       = data.get('userData', {})

    if not job_description:
        return jsonify({"error": "Job description is required"}), 400

    prompt = f"""You are an expert ATS resume writer. Generate an ATS-optimized resume.

JOB DESCRIPTION:
{job_description}

USER DATA:
{json.dumps(user_data, indent=2)}

INSTRUCTIONS:
1. Analyze the job description and identify key requirements and keywords.
2. Match the user's experience and skills to the job requirements.
3. Use action verbs and quantifiable achievements.
4. Incorporate relevant keywords naturally.
5. Format for ATS compatibility (no tables, standard headers).
6. Keep to 1 page worth of content.

Generate ONLY the resume text, no explanations."""

    text = _call_gemini(prompt, timeout=45)
    if text is None:
        return jsonify({"error": "Failed to generate resume"}), 500
    if mongo_db:
        log_activity(mongo_db, request.user_email, "resume_builder", f"Generate ({template})")
    return jsonify({"resume": text}), 200


@app.route('/evaluate-resume', methods=['POST'])
@require_auth
def evaluate_resume():
    if 'file' not in request.files:
        return jsonify({"error": "Missing resume file"}), 400

    file     = request.files['file']
    filename = file.filename
    jd_text  = request.form.get('job_description')
    if not jd_text:
        return jsonify({"error": "Missing job description"}), 400

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        file.save(tmp.name)
        tmp_path = tmp.name

    try:
        resume_text = extract_pdf_text(tmp_path)
        result      = get_gemini_ats_score(resume_text, jd_text)
        if "error" in result:
            return jsonify(result), 500
        if mongo_db:
            log_activity(
                mongo_db, request.user_email, "resume_evaluator",
                f"ATS score {result.get('match_score', '?')} — {filename}"
            )
        return jsonify(result), 200
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

# ===========================
# JOB FINDER
# ===========================

@app.route('/scrape-review', methods=['POST'])
def scrape_review():
    data         = request.get_json() or {}
    company_name = data.get('companyName', '').strip()
    if not company_name:
        return jsonify({'error': 'Company name is required'}), 400

    slug   = company_name.replace(' ', '-')
    length = len(company_name.replace(' ', ''))
    url    = f"https://www.glassdoor.com/Reviews/{slug}-reviews-SRCH_KE0,{length}.htm"
    return jsonify({'glassdoor_link': url}), 200


@app.route('/api/jobs', methods=['GET'])
@require_auth
def get_jobs():
    try:
        from jobspy import scrape_jobs
    except ImportError:
        return jsonify({"error": "Job scraping library not installed"}), 500

    query    = request.args.get('query', '').strip()
    location = request.args.get('location', 'USA')
    num_jobs = int(request.args.get('num_jobs', 10))

    if not query:
        return jsonify({"error": "Search query required"}), 400

    try:
        jobs_df = scrape_jobs(
            site_name=["indeed"],
            search_term=query,
            location=location,
            results_wanted=num_jobs
        )
        if jobs_df is None or len(jobs_df) == 0:
            return jsonify({"jobs": []})

        jobs_list = jobs_df.to_dict("records")
        # Replace NaN with None for JSON serialisation
        for job in jobs_list:
            for k, v in job.items():
                if isinstance(v, float) and math.isnan(v):
                    job[k] = None

        if mongo_db:
            log_activity(mongo_db, request.user_email, "job_finder", f"Query: {query}")

        return jsonify({"jobs": jobs_list}), 200
    except Exception as e:
        logger.error(f"Job search error: {e}")
        return jsonify({"error": str(e), "jobs": []}), 500

# ===========================
# QUESTION BANK
# ===========================

@app.route('/generate-questions', methods=['POST'])
@require_auth
def generate_questions():
    if not API_KEY:
        return jsonify({"error": "Gemini API not configured"}), 500

    data       = request.get_json() or {}
    company    = data.get('company_name')
    role       = data.get('role')
    domain     = data.get('domain')
    experience = data.get('experience_level')
    qtype      = data.get('question_type')
    difficulty = data.get('difficulty')
    num_q      = int(data.get('num_questions', 15))

    if not all([company, role, domain, experience, qtype, difficulty]):
        return jsonify({"error": "Missing required fields"}), 400

    prompt = f"""You are an expert interviewer. Generate {num_q} unique interview questions.

Company: {company}
Role: {role}
Domain: {domain}
Experience Level: {experience}
Question Type: {qtype}
Difficulty: {difficulty}

For each question, return a JSON object with:
- id: unique number
- question: the question text
- answer: clear and concise correct answer
- explanation: short explanation or reasoning

Return ONLY a valid JSON array, no markdown fences."""

    text = _call_gemini(prompt, timeout=60)
    if text is None:
        return jsonify({"error": "Failed to generate questions"}), 500

    try:
        questions_list = _clean_gemini_json(text)
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {e} — raw: {text[:200]}")
        return jsonify({"error": "Failed to parse AI response"}), 500

    if mongo_db:
        log_activity(
            mongo_db, request.user_email, "question_bank",
            f"Generated {num_q} questions for {company} — {role}"
        )

    return jsonify({"questions": questions_list}), 200

# ===========================
# MOCK INTERVIEW (Vapi)
# ===========================

@app.route('/api/vapi/assistant', methods=['POST'])
@require_auth
def create_vapi_assistant():
    if not VAPI_PRIVATE_KEY:
        return jsonify({"error": "Vapi not configured"}), 500

    data            = request.get_json() or {}
    job_description = data.get('jd', '')
    if not job_description:
        return jsonify({"error": "No JD provided"}), 400

    jd_text = job_description[:1500] + ("..." if len(job_description) > 1500 else "")

    system_prompt = (
        "You are an expert AI Interviewer acting as a Hiring Manager. "
        "Your goal is to conduct a professional mock interview based on this Job Description:\n\n"
        f"{jd_text}\n\n"
        "Instructions:\n"
        "1. Welcome the candidate and mention the role.\n"
        "2. Ask ONE question at a time.\n"
        "3. Keep questions relevant to the JD.\n"
        "4. Adjust difficulty based on answers.\n"
        "5. Be encouraging but professional.\n"
        "6. Close politely when done."
    )

    try:
        payload = {
            "name": "AI Interviewer",
            "firstMessage": "Hello! I'm your AI interviewer. Let's begin. Could you start by telling me about yourself?",
            "model": {
                "provider": "openai",
                "model":    "gpt-3.5-turbo",
                "messages": [{"role": "system", "content": system_prompt}]
            },
            "voice": {"provider": "azure", "voiceId": "en-US-JennyNeural"}
        }

        resp = requests.post(
            "https://api.vapi.ai/assistant",
            headers={
                "Authorization": f"Bearer {VAPI_PRIVATE_KEY}",
                "Content-Type":  "application/json"
            },
            json=payload,
            timeout=15
        )

        if resp.status_code not in (200, 201):
            logger.error(f"Vapi error {resp.status_code}: {resp.text[:200]}")
            return jsonify({"error": "Failed to create Vapi assistant"}), 500

        assistant_id = resp.json().get("id")
        if mongo_db:
            log_activity(mongo_db, request.user_email, "mock_interview", "Started mock interview")

        return jsonify({"id": assistant_id}), 200

    except Exception as e:
        logger.error(f"Vapi error: {e}")
        return jsonify({"error": str(e)}), 500

# ===========================
# ERROR HANDLERS
# ===========================

@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Route not found"}), 404

@app.errorhandler(405)
def method_not_allowed(e):
    return jsonify({"error": "Method not allowed"}), 405

@app.errorhandler(500)
def server_error(e):
    logger.error(f"Unhandled server error: {e}")
    return jsonify({"error": "Internal server error"}), 500

# ===========================
# MAIN (local dev only)
# ===========================

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)