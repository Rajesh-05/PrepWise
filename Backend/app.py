"""
PrepWise Flask Backend - Production Ready for Render Deployment
Cleaned, structured, and optimized for cloud deployment
"""

# ===========================
# IMPORTS (Consolidated)
# ===========================
import os
import asyncio
import logging
import threading
import json
from datetime import datetime, timedelta, timezone
from queue import Queue
import tempfile
import requests
import re
import math
import time
from typing import Dict, TypedDict
from urllib.parse import urlencode

from flask import Flask, request, jsonify, redirect
from flask_cors import CORS
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
from pymongo import MongoClient, ASCENDING
from pymongo.errors import DuplicateKeyError
from itsdangerous import URLSafeTimedSerializer, SignatureExpired
import pdfplumber
from langgraph.graph import StateGraph, END, START
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, trim_messages
from langchain_community.tools import DuckDuckGoSearchResults

# Import utilities
from auth_utils import (
    require_auth, verify_token, revoke_token, log_activity,
    log_question_bank_activity, log_resume_activity, log_mock_interview,
    log_job_search, get_user_stats
)
from models import get_collections, create_indexes, serialize_doc

# ===========================
# ENVIRONMENT VARIABLES
# ===========================
load_dotenv()

# Logging configuration
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('app.log')
    ]
)
logger = logging.getLogger(__name__)
logger.info(f"PrepWise API starting up (Log Level: {LOG_LEVEL})")

# Frontend URLs and OAuth Configuration
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:5000")

# Secret keys
SECRET_KEY = os.getenv("FLASK_SECRET_KEY", "dev-secret-key")
JWT_SECRET = os.getenv("JWT_SECRET")
JWT_EXPIRES_MIN = int(os.getenv("JWT_EXPIRES_MIN", "1440"))  # 24 hours default

# Google OAuth
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_OAUTH_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_OAUTH_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv(
    "GOOGLE_REDIRECT_URI",
    f"{BACKEND_URL}/auth/google/callback"
)
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

# MongoDB Configuration
MONGODB_URI = os.getenv("MONGODB_URI")
MONGODB_DBNAME = os.getenv("MONGODB_DBNAME", "prepwise")

# API Keys
API_KEY = os.getenv("GEMINI_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
VAPI_PRIVATE_KEY = os.getenv("VAPI_PRIVATE_KEY")

# ===========================
# FLASK APP INITIALIZATION
# ===========================
app = Flask(__name__)
app.secret_key = SECRET_KEY

# Configure CORS
CORS(app, resources={
    r"/api/*": {
        "origins": [FRONTEND_URL, "http://localhost:3000"],
        "methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True,
        "max_age": 3600
    },
    r"/auth/*": {
        "origins": [FRONTEND_URL, "http://localhost:3000"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"],
        "supports_credentials": True,
        "max_age": 3600
    },
    r"/generate*": {
        "origins": [FRONTEND_URL, "http://localhost:3000"],
        "methods": ["POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True,
        "max_age": 3600
    },
    r"/improve*": {
        "origins": [FRONTEND_URL, "http://localhost:3000"],
        "methods": ["POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True,
        "max_age": 3600
    },
    r"/evaluate*": {
        "origins": [FRONTEND_URL, "http://localhost:3000"],
        "methods": ["POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True,
        "max_age": 3600
    }
})

# ===========================
# MONGODB INITIALIZATION (Global)
# ===========================
mongo_client = None
mongo_db = None
users_col = None
collections = None

try:
    if not MONGODB_URI:
        raise ValueError("MONGODB_URI environment variable is missing")

    mongo_client = MongoClient(
        MONGODB_URI,
        serverSelectionTimeoutMS=5000
    )
    
    mongo_db = mongo_client[MONGODB_DBNAME]
    
    # Verify connection with ping
    mongo_client.admin.command("ping")
    logger.info(f"MongoDB connected to database: {MONGODB_DBNAME}")
    
    users_col = mongo_db["users"]
    users_col.create_index([("email", ASCENDING)], unique=True)
    
    # Attach to app for global access
    app.mongo_db = mongo_db
    app.users_col = users_col
    
    # Get all collections and create indexes
    collections = get_collections(mongo_db)
    create_indexes(mongo_db)
    logger.info("MongoDB indexes created successfully")

except Exception as e:
    logger.exception(f"MongoDB initialization failed: {e}")
    app.mongo_db = None
    app.users_col = None

# ===========================
# UTILITY FUNCTIONS
# ===========================

def extract_pdf_text(pdf_path):
    """Extract text from a PDF file using pdfplumber."""
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

def get_gemini_resume_improvements(resume_text):
    """Get resume improvement suggestions from Gemini AI."""
    prompt = f"""
        You are an expert resume reviewer. Given the following resume, provide actionable suggestions to improve it for job applications. Respond ONLY with a JSON object:
        {{
        "suggestions": "Your suggestions here as a paragraph or bullet points."
        }}
        Resume: {resume_text}
        """
    data = {
        "contents": [{"parts": [{"text": prompt}]}]
    }

    model1 = "gemini-2.5-flash"
    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model1}:generateContent?key={API_KEY}",
        json=data,
        timeout=30
    )

    try:
        resp_json = response.json()
    except Exception:
        return {"error": "Invalid JSON response from Gemini API", "raw_response": response.text}

    if not response.ok:
        logger.error(f"Gemini API error status: {response.status_code}, response: {response.text}")
        return {"error": f"Gemini API returned status {response.status_code}", "details": resp_json}

    try:
        candidates = resp_json.get("candidates", [])
        if not candidates or len(candidates) == 0:
            return {"error": "Gemini response missing 'candidates' field"}
        content = candidates[0].get("content", {})
        parts = content.get("parts", [])
        if not parts:
            return {"error": "Gemini response missing 'parts' in content"}
        text = parts[0].get("text")
        if not text:
            return {"error": "Gemini response missing 'text' in first part"}
    except Exception as e:
        return {"error": f"Failed to extract text from Gemini response: {e}"}

    try:
        if text.strip().startswith('```'):
            text = text.strip().split('```')[-2] if '```' in text.strip() else text.strip()
            if text.strip().startswith('json'):
                text = text.strip()[4:].strip()
        return json.loads(text)
    except Exception as e:
        return {"error": f"Failed to parse JSON suggestions: {e}", "extracted_text": text}

def get_gemini_ats_score(resume_text, job_description):
    """Calculate ATS score for resume using Gemini AI."""
    prompt = f"""
    You are an ATS (Applicant Tracking System) resume evaluator. 
    Given the following resume and job description, return a JSON object with:
    - match_score (0-100 integer)
    - summary (a detailed 2–3 line summary)
    - missing_keywords (list of important keywords from job description not in resume)

    Resume:
    {resume_text}

    Job Description:
    {job_description}

    Respond ONLY with the JSON object.
    """

    data = {
        "contents": [{"parts": [{"text": prompt}]}]
    }

    model1 = "gemini-2.5-flash"
    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model1}:generateContent?key={API_KEY}",
        json=data,
        timeout=30
    )

    try:
        resp_json = response.json()
    except Exception:
        logger.error(f"Gemini API raw response: {response.text}")
        return {"error": "Invalid JSON response from Gemini API"}

    if not response.ok:
        logger.error(f"Gemini API returned non-200: {response.status_code}")
        return {"error": f"Gemini API returned status {response.status_code}"}

    try:
        candidates = resp_json.get("candidates", [])
        if not candidates or len(candidates) == 0:
            return {"error": "Gemini response missing 'candidates'"}
        content = candidates[0].get("content", {})
        parts = content.get("parts", [])
        if not parts:
            return {"error": "Gemini response missing 'parts'"}
        text = parts[0].get("text")
        if not text:
            return {"error": "Gemini response missing 'text'"}
    except Exception as e:
        logger.error(f"Error extracting text: {e}")
        return {"error": f"Error extracting text: {e}"}

    try:
        if text.strip().startswith('```'):
            text = text.strip().split('```')[-2] if '```' in text.strip() else text.strip()
            if text.strip().startswith('json'):
                text = text.strip()[4:].strip()
        return json.loads(text)
    except Exception as e:
        logger.error(f"Error parsing response: {e}")
        return {"error": f"Error parsing response: {e}"}

def issue_jwt(user_id, email):
    """Issue a JWT token for user."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "email": email,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=JWT_EXPIRES_MIN)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def require_db():
    """Check if database is available."""
    return app.users_col is not None and JWT_SECRET is not None

# ===========================
# HEALTH CHECK
# ===========================

@app.route('/healthz', methods=['GET'])
def healthz():
    """Health check endpoint for Render."""
    try:
        if app.mongo_db:
            app.mongo_db.command('ping')
        return jsonify({"status": "ok"}), 200
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({"status": "degraded", "error": str(e)}), 200

# ===========================
# GOOGLE OAUTH ROUTES
# ===========================

@app.route('/auth/google/login', methods=['GET'])
def google_login():
    """Google OAuth login - Step 1: Redirect to Google"""
    if not GOOGLE_CLIENT_ID:
        return jsonify({"error": "Google OAuth not configured"}), 500

    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "scope": "openid email profile",
        "response_type": "code",
        "access_type": "offline",
        "prompt": "consent"
    }

    auth_url = f"{GOOGLE_AUTH_URL}?{urlencode(params)}"
    return redirect(auth_url)

@app.route('/auth/google/callback', methods=['GET'])
def google_callback():
    """Google OAuth callback - Step 2: Handle Google's redirect"""
    code = request.args.get('code')
    error = request.args.get('error')

    if error:
        logger.warning(f"OAuth error from Google: {error}")
        return redirect(f"{FRONTEND_URL}/login?error=access_denied")

    if not code:
        logger.warning("No authorization code received")
        return redirect(f"{FRONTEND_URL}/login?error=no_code")

    token_data = {
        "code": code,
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code"
    }

    try:
        logger.debug("Exchanging authorization code for access token...")
        token_response = requests.post(GOOGLE_TOKEN_URL, data=token_data, timeout=10)

        if token_response.status_code != 200:
            logger.error(f"Token exchange failed: {token_response.text}")
            return redirect(f"{FRONTEND_URL}/login?error=token_exchange_failed")

        tokens = token_response.json()
        access_token = tokens.get("access_token")

        if not access_token:
            logger.warning("No access token in OAuth response")
            return redirect(f"{FRONTEND_URL}/login?error=no_token")

        logger.debug("Fetching user info from Google...")
        headers = {"Authorization": f"Bearer {access_token}"}
        user_response = requests.get(GOOGLE_USERINFO_URL, headers=headers, timeout=10)

        if user_response.status_code != 200:
            logger.error(f"Failed to fetch user info: {user_response.text}")
            return redirect(f"{FRONTEND_URL}/login?error=user_info_failed")

        user_info = user_response.json()
        logger.info(f"User authenticated via Google: {user_info.get('email')}")

        # Store user in MongoDB if available
        if mongo_db and users_col:
            try:
                existing_user = users_col.find_one({"email": user_info.get("email")})

                user_doc = {
                    "google_id": user_info.get("id"),
                    "email": user_info.get("email"),
                    "firstName": user_info.get("given_name", ""),
                    "lastName": user_info.get("family_name", ""),
                    "name": user_info.get("name"),
                    "picture": user_info.get("picture"),
                    "last_login": datetime.now(timezone.utc),
                }

                if existing_user:
                    users_col.update_one(
                        {"email": user_info.get("email")},
                        {
                            "$set": user_doc,
                            "$inc": {"total_login_count": 1}
                        }
                    )
                    user_id = existing_user['_id']
                else:
                    user_doc.update({
                        "createdAt": datetime.now(timezone.utc),
                        "subscription_tier": "free",
                        "total_login_count": 1
                    })
                    result = users_col.insert_one(user_doc)
                    user_id = result.inserted_id

                log_activity(mongo_db, user_info.get("email"), "login", "Google OAuth Login")
                logger.info(f"User stored in database: {user_info.get('email')}")

            except Exception as e:
                logger.error(f"MongoDB storage failed: {e}")

        # Generate JWT session token
        try:
            session_payload = {
                "sub": user_info.get("id"),
                "email": user_info.get("email"),
                "name": user_info.get("name"),
                "exp": datetime.now(timezone.utc) + timedelta(days=7),
                "iat": datetime.now(timezone.utc),
            }
            session_token = jwt.encode(session_payload, JWT_SECRET, algorithm="HS256")
            logger.debug("JWT token generated successfully for OAuth user")

            return redirect(f"{FRONTEND_URL}/#session_token={session_token}")
        except Exception as e:
            logger.error(f"JWT generation failed: {e}")
            return redirect(f"{FRONTEND_URL}/login?error=token_generation_failed")

    except requests.exceptions.RequestException as e:
        logger.error(f"OAuth request failed: {e}")
        return redirect(f"{FRONTEND_URL}/login?error=oauth_failed")
    except Exception as e:
        logger.error(f"Unexpected error in OAuth callback: {e}", exc_info=True)
        return redirect(f"{FRONTEND_URL}/login?error=server_error")

# ===========================
# EMAIL/PASSWORD AUTHENTICATION
# ===========================

@app.route('/auth/signup', methods=['POST'])
def auth_signup():
    """User signup with email/password"""
    if not require_db():
        return jsonify({"error": "Auth not configured on server"}), 503

    try:
        data = request.get_json() or {}
        first_name = (data.get('firstName') or '').strip()
        last_name = (data.get('lastName') or '').strip()
        email = (data.get('email') or '').strip().lower()
        password = data.get('password') or ''

        if not first_name or not last_name or not email or not password:
            return jsonify({"error": "All fields are required"}), 400

        if len(password) < 8:
            return jsonify({"error": "Password must be at least 8 characters"}), 400

        hashed_password = generate_password_hash(password)
        
        user_doc = {
            "email": email,
            "password": hashed_password,
            "firstName": first_name,
            "lastName": last_name,
            "name": f"{first_name} {last_name}",
            "picture": "",
            "subscription_tier": "free",
            "createdAt": datetime.now(timezone.utc),
            "last_login": datetime.now(timezone.utc),
            "total_login_count": 0,
            "auth_provider": "email"
        }

        result = users_col.insert_one(user_doc)
        logger.info(f"New user created: {email}")

        return jsonify({
            'message': 'Account created successfully',
            'userId': str(result.inserted_id)
        }), 201

    except DuplicateKeyError:
        return jsonify({"error": "An account with this email already exists"}), 409
    except Exception as e:
        logger.error(f"Signup error: {e}", exc_info=True)
        return jsonify({"error": "Failed to create account"}), 500

@app.route('/auth/login', methods=['POST'])
def auth_login():
    """User login with email/password"""
    if not require_db():
        return jsonify({"error": "Auth not configured on server"}), 503

    try:
        data = request.get_json() or {}
        email = (data.get('email') or '').strip().lower()
        password = data.get('password') or ''

        if not email or not password:
            return jsonify({"error": "Email and password are required"}), 400

        user = users_col.find_one({"email": email})

        if not user or not check_password_hash(user.get('password', ''), password):
            return jsonify({"error": "Invalid email or password"}), 401

        # Update last login
        users_col.update_one(
            {"email": email},
            {
                "$set": {"last_login": datetime.now(timezone.utc)},
                "$inc": {"total_login_count": 1}
            }
        )

        log_activity(mongo_db, email, "login", "Email/Password Login")

        token = issue_jwt(user.get('_id'), email)

        user_data = {
            "email": user['email'],
            "name": user.get('name', ''),
            "firstName": user.get('firstName', ''),
            "lastName": user.get('lastName', ''),
            "picture": user.get('picture', ''),
            "subscription_tier": user.get('subscription_tier', 'free')
        }

        logger.info(f"User logged in: {email}")

        return jsonify({
            'token': token,
            'user': user_data
        }), 200

    except Exception as e:
        logger.error(f"Login error: {e}", exc_info=True)
        return jsonify({"error": "Failed to sign in"}), 500

@app.route('/auth/me', methods=['GET'])
@require_auth
def auth_me():
    """Get current user profile"""
    if not require_db():
        return jsonify({"error": "Auth not configured on server"}), 503

    try:
        email = getattr(request, 'user_email', None)
        if not email:
            return jsonify({"error": "User not found"}), 404

        user = users_col.find_one({"email": email}, {"password": 0})
        if not user:
            return jsonify({"error": "User not found"}), 404

        return jsonify({"user": serialize_doc(user)})
    except Exception as e:
        logger.error(f"Error fetching user: {e}")
        return jsonify({"error": "Server error"}), 500

@app.route('/auth/logout', methods=['POST'])
@require_auth
def auth_logout():
    """User logout"""
    if not require_db():
        return jsonify({"message": "No token provided"}), 200

    try:
        email = getattr(request, 'user_email', None)
        if email:
            log_activity(mongo_db, email, "logout", "User Logout")

        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ', 1)[1]
            revoke_token(token)

        return jsonify({"message": "Logged out successfully"}), 200
    except Exception as e:
        logger.error(f"Logout error: {e}")
        return jsonify({"message": "Logged out"}), 200

# ===========================
# CHAT SESSIONS API
# ===========================

@app.route('/api/chat-sessions', methods=['GET', 'DELETE'])
@require_auth
def handle_chat_sessions():
    """Get or delete all chat sessions for user"""
    db = getattr(app, 'mongo_db', None)
    email = getattr(request, 'user_email', None)

    if db is None or email is None:
        return jsonify({'error': 'Database or user not found'}), 503

    try:
        user = db['users'].find_one({'email': email})
        if not user:
            return jsonify({'error': 'User not found'}), 404

        if request.method == 'DELETE':
            db['chat_sessions'].delete_many({'user_id': user['_id']})
            return jsonify({'message': 'All sessions deleted'})

        sessions = list(db['chat_sessions'].find({'user_id': user['_id']}).sort('last_message_at', -1))
        return jsonify({'sessions': serialize_doc(sessions)})
    except Exception as e:
        logger.error(f"Error handling chat sessions: {e}")
        return jsonify({'error': 'Server error'}), 500

@app.route('/api/chat-sessions/<session_id>', methods=['DELETE'])
@require_auth
def delete_chat_session(session_id):
    """Delete a specific chat session"""
    from bson import ObjectId

    db = getattr(app, 'mongo_db', None)
    email = getattr(request, 'user_email', None)

    if db is None or email is None:
        return jsonify({'error': 'Database or user not found'}), 503

    try:
        user = db['users'].find_one({'email': email})
        if not user:
            return jsonify({'error': 'User not found'}), 404

        result = db['chat_sessions'].delete_one({'_id': ObjectId(session_id), 'user_id': user['_id']})
        if result.deleted_count == 1:
            return jsonify({'message': 'Chat session deleted'})
        else:
            return jsonify({'error': 'Chat session not found'}), 404
    except Exception as e:
        logger.error(f"Error deleting chat session: {e}")
        return jsonify({'error': 'Server error'}), 500

@app.route('/api/chat-sessions/<session_id>', methods=['PATCH'])
@require_auth
def update_chat_session(session_id):
    """Update a chat session topic"""
    from bson import ObjectId

    db = getattr(app, 'mongo_db', None)
    email = getattr(request, 'user_email', None)

    if db is None or email is None:
        return jsonify({'error': 'Database or user not found'}), 503

    try:
        user = db['users'].find_one({'email': email})
        if not user:
            return jsonify({'error': 'User not found'}), 404

        data = request.get_json()
        new_topic = (data.get('topic') or '').strip()

        if not new_topic:
            return jsonify({'error': 'Topic cannot be empty'}), 400

        result = db['chat_sessions'].update_one(
            {'_id': ObjectId(session_id), 'user_id': user['_id']},
            {'$set': {'topic': new_topic}}
        )

        if result.matched_count == 1:
            return jsonify({'message': 'Session updated'})
        else:
            return jsonify({'error': 'Session not found'}), 404
    except Exception as e:
        logger.error(f"Error updating chat session: {e}")
        return jsonify({'error': 'Server error'}), 500

# ===========================
# RESUME OPERATIONS
# ===========================

@app.route('/improve-resume', methods=['POST'])
@require_auth
def improve_resume():
    """Get resume improvement suggestions"""
    if 'file' not in request.files:
        return jsonify({"error": "Missing resume file"}), 400

    file = request.files['file']
    filename = file.filename

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        file.save(tmp.name)
        tmp_path = tmp.name

    try:
        resume_text = extract_pdf_text(tmp_path)
        result = get_gemini_resume_improvements(resume_text)

        if mongo_db and not result.get("error"):
            log_resume_activity(
                mongo_db, request.user_email, "improvement",
                resume_filename=filename,
                suggestions=result.get("suggestions")
            )
            log_activity(mongo_db, request.user_email, "resume_builder", "Resume Improvement Request")

        if "error" in result:
            return jsonify(result), 500
        return jsonify(result)

    except Exception as e:
        logger.error(f"Error improving resume: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

@app.route('/generate-resume', methods=['POST'])
@require_auth
def generate_resume():
    """Generate an ATS-optimized resume"""
    if not API_KEY:
        return jsonify({"error": "Gemini API not configured"}), 500

    data = request.get_json() or {}
    job_description = data.get('jobDescription')
    template = data.get('template', 'modern')
    user_data = data.get('userData', {})

    if not job_description:
        return jsonify({"error": "Job description is required"}), 400

    prompt = f"""You are an expert ATS resume writer. Generate an ATS-optimized resume.

JOB DESCRIPTION:
{job_description}

USER DATA:
{json.dumps(user_data, indent=2)}

INSTRUCTIONS:
1. Analyze the job description and identify key requirements and keywords
2. Match the user's experience and skills to the job requirements
3. Use action verbs and quantifiable achievements
4. Incorporate relevant keywords from the job description naturally
5. Format for ATS compatibility (simple formatting, no tables, standard headers)
6. Fill in the template with optimized content
7. Ensure all content is truthful but optimized for impact
8. Keep to 1 page worth of content

Generate ONLY the resume text, no explanations or metadata."""

    try:
        model_name = "gemini-2.5-flash"
        response = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={API_KEY}",
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0.7,
                    "maxOutputTokens": 2048,
                }
            },
            timeout=30
        )

        if not response.ok:
            logger.error(f"Gemini API error: {response.status_code}")
            return jsonify({"error": "Failed to generate resume"}), 500

        resp_json = response.json()
        candidates = resp_json.get("candidates", [])
        if not candidates:
            return jsonify({"error": "Gemini response missing candidates"}), 500

        content = candidates[0].get("content", {})
        parts = content.get("parts", [])
        if not parts:
            return jsonify({"error": "Gemini response missing parts"}), 500

        resume_text = parts[0].get("text")
        if not resume_text:
            return jsonify({"error": "Gemini response missing text"}), 500

        if mongo_db:
            log_resume_activity(
                mongo_db, request.user_email, "generation",
                job_description=job_description[:500],
                suggestions=f"Generated resume using {template} template"
            )
            log_activity(mongo_db, request.user_email, "resume_builder", "Resume Generation Request")

        return jsonify({"resume": resume_text})

    except Exception as e:
        logger.error(f"Error generating resume: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/evaluate-resume', methods=['POST'])
@require_auth
def evaluate_resume():
    """Evaluate resume against job description"""
    if 'file' not in request.files:
        return jsonify({"error": "Missing resume file"}), 400

    file = request.files['file']
    filename = file.filename

    jd_text = request.form.get('job_description')
    if not jd_text:
        return jsonify({"error": "Missing job description"}), 400

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        file.save(tmp.name)
        tmp_path = tmp.name

    try:
        resume_text = extract_pdf_text(tmp_path)
        result = get_gemini_ats_score(resume_text, jd_text)

        if mongo_db and not result.get("error"):
            log_resume_activity(
                mongo_db, request.user_email, "evaluation",
                resume_filename=filename,
                job_description=jd_text[:500],
                ats_score=result.get("match_score")
            )
            log_activity(mongo_db, request.user_email, "resume_evaluator",
                        f"ATS Evaluation - Score: {result.get('match_score', 0)}")

        if "error" in result:
            return jsonify(result), 500
        return jsonify(result)

    except Exception as e:
        logger.error(f"Error evaluating resume: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

# ===========================
# JOB FINDER API
# ===========================

@app.route('/scrape-review', methods=['POST'])
def scrape_review():
    """Generate Glassdoor review URL for company"""
    data = request.get_json() or {}
    company_name = data.get('companyName')

    if not company_name:
        return jsonify({'error': 'Company name is required'}), 400

    name_hyphens = company_name.strip().replace(' ', '-')
    length_no_spaces = len(company_name.replace(' ', ''))
    url = f"https://www.glassdoor.com/Reviews/{name_hyphens}-reviews-SRCH_KE0,{length_no_spaces}.htm"

    return jsonify({'glassdoor_link': url})

@app.route('/api/jobs', methods=['GET'])
@require_auth
def get_jobs():
    """Search for jobs"""
    try:
        from jobspy import scrape_jobs
    except ImportError:
        return jsonify({"error": "Job scraping not available"}), 500

    query = request.args.get('query', '')
    location = request.args.get('location', '')
    num_jobs = int(request.args.get('num_jobs', 10))

    if not query:
        return jsonify({"error": "Search query required"}), 400

    try:
        jobs_df = scrape_jobs(
            site_name=["indeed"],
            search_term=query,
            location=location or "USA",
            results_wanted=num_jobs
        )

        if jobs_df is None or len(jobs_df) == 0:
            return jsonify({"error": "No jobs found", "jobs": []})

        jobs_list = jobs_df.to_dict("records")

        # Replace NaN with None
        for job in jobs_list:
            for key, value in job.items():
                if isinstance(value, float) and math.isnan(value):
                    job[key] = None

        if mongo_db:
            log_job_search(mongo_db, request.user_email, query, location, num_jobs, len(jobs_list))
            log_activity(mongo_db, request.user_email, "job_finder", f"Searched: {query}")

        return jsonify({"jobs": jobs_list})

    except Exception as e:
        logger.error(f"Job search error: {e}")
        return jsonify({"error": str(e), "jobs": []})

# ===========================
# QUESTION BANK
# ===========================

@app.route('/generate-questions', methods=['POST'])
@require_auth
def generate_questions():
    """Generate interview questions"""
    if not API_KEY:
        return jsonify({"error": "Gemini API not configured"}), 500

    data = request.get_json() or {}
    company = data.get('company_name')
    role = data.get('role')
    domain = data.get('domain')
    experience = data.get('experience_level')
    qtype = data.get('question_type')
    difficulty = data.get('difficulty')
    num_q = data.get('num_questions', 15)

    if not all([company, role, domain, experience, qtype, difficulty]):
        return jsonify({"error": "Missing required fields"}), 400

    prompt = f"""
    You are an expert interviewer. Generate {num_q} unique interview questions.

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

    Return ONLY a valid JSON array.
    """

    try:
        model_name = "gemini-2.5-flash"
        response = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={API_KEY}",
            json={"contents": [{"parts": [{"text": prompt}]}]},
            timeout=60
        )

        if not response.ok:
            logger.error(f"Gemini API error: {response.status_code}")
            return jsonify({"error": "Failed to generate questions"}), 500

        resp_json = response.json()
        candidates = resp_json.get("candidates", [])
        if not candidates:
            return jsonify({"error": "Gemini response missing candidates"}), 500

        content = candidates[0].get("content", {})
        parts = content.get("parts", [])
        if not parts:
            return jsonify({"error": "Gemini response missing parts"}), 500

        text = parts[0].get("text")
        if not text:
            return jsonify({"error": "Gemini response missing text"}), 500

        # Clean markdown
        text = text.strip()
        if text.startswith('```'):
            text = re.sub(r'^```[a-zA-Z]*', '', text)
            text = text.replace('```', '').strip()

        questions_list = json.loads(text)

        if mongo_db:
            log_question_bank_activity(
                mongo_db, request.user_email, company, role, domain,
                experience, qtype, difficulty, num_q, questions_list
            )
            log_activity(mongo_db, request.user_email, "question_bank",
                        f"Generated {num_q} questions for {company}")

        return jsonify({"questions": questions_list})

    except json.JSONDecodeError as e:
        logger.error(f"JSON parsing error: {e}")
        return jsonify({"error": "Failed to parse AI response"}), 500
    except Exception as e:
        logger.error(f"Error generating questions: {e}")
        return jsonify({"error": str(e)}), 500

# ===========================
# MOCK INTERVIEW (Vapi)
# ===========================

@app.route('/api/vapi/assistant', methods=['POST'])
@require_auth
def create_vapi_assistant():
    """Create a Vapi AI mock interview assistant"""
    if not VAPI_PRIVATE_KEY:
        return jsonify({"error": "Vapi not configured"}), 500

    data = request.get_json() or {}
    job_description = data.get('jd')

    if not job_description:
        return jsonify({"error": "No JD provided"}), 400

    jd_text = job_description[:1500] + "..." if len(job_description) > 1500 else job_description

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
            "firstMessage": "Hello! I'm your AI interviewer. Let's begin the mock interview. Can you start by telling me about yourself?",
            "model": {
                "provider": "openai",
                "model": "gpt-3.5-turbo",
                "messages": [
                    {
                        "role": "system",
                        "content": system_prompt
                    }
                ]
            },
            "voice": {
                "provider": "azure",
                "voiceId": "en-US-JennyNeural"
            }
        }

        response = requests.post(
            "https://api.vapi.ai/assistant",
            headers={
                "Authorization": f"Bearer {VAPI_PRIVATE_KEY}",
                "Content-Type": "application/json"
            },
            json=payload,
            timeout=10
        )

        if response.status_code != 201:
            logger.error(f"Vapi API error: {response.status_code}")
            return jsonify({"error": "Failed to create Vapi assistant"}), 500

        assistant_id = response.json().get("id")

        if mongo_db:
            log_mock_interview(
                mongo_db, request.user_email, "technical",
                job_description[:500],
                duration_minutes=0,
                vapi_assistant_id=assistant_id
            )
            log_activity(mongo_db, request.user_email, "mock_interview", "Started Mock Interview")

        return jsonify({"id": assistant_id})

    except Exception as e:
        logger.error(f"Error creating Vapi assistant: {e}")
        return jsonify({"error": str(e)}), 500

# ===========================
# ERROR HANDLERS
# ===========================

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Not found"}), 404

@app.errorhandler(500)
def server_error(error):
    logger.error(f"Server error: {error}")
    return jsonify({"error": "Server error"}), 500

@app.route("/", methods=["GET"])
def health_check():
    return jsonify({
        "status": "ok",
        "message": "PrepWise Backend is running"
    }), 200

# ===========================
# MAIN ENTRY POINT (Gunicorn compatible)
# ===========================

if __name__ == "__main__":
    # This block is ONLY for local development
    # Gunicorn will NOT use this - it imports app directly
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
