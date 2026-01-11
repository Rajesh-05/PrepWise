import os
import asyncio
import logging
import threading
from dotenv import load_dotenv
import json
from flask import Flask, request, jsonify, redirect, send_from_directory
import logging
from flask_cors import CORS
import time
import math
import tempfile
import requests
import pdfplumber
from pymongo import MongoClient, ASCENDING
from pymongo.errors import DuplicateKeyError
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
# Import require_auth decorator
from auth_utils import require_auth
# ...existing code...

import os
import asyncio
import logging
import threading
from dotenv import load_dotenv
import json
from flask import Flask, request, jsonify, redirect, send_from_directory
import logging
from flask_cors import CORS
import time
import math
import tempfile
import requests
import pdfplumber
from pymongo import MongoClient, ASCENDING
from pymongo.errors import DuplicateKeyError
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
# ...existing code...

# --- Place new API routes after app = Flask(__name__) ---

# ...existing code...

# Load .env file FIRST before accessing environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# --- Chat Sessions API ---
@app.route('/api/chat-sessions', methods=['GET'])
@require_auth
def get_chat_sessions():
    db = getattr(app, 'mongo_db', None)
    email = getattr(request, 'user_email', None)
    if db is None or email is None:
        return jsonify({'error': 'Database or user not found'}), 500
    user = db['users'].find_one({'email': email})
    if not user:
        return jsonify({'error': 'User not found'}), 404
    sessions = list(db['chat_sessions'].find({'user_id': user['_id']}))
    for s in sessions:
        s['_id'] = str(s['_id'])
        s['user_id'] = str(s['user_id'])
        for m in s.get('messages', []):
            if '_id' in m:
                m['_id'] = str(m['_id'])
    return jsonify({'sessions': sessions})

# --- V2V Agent Evaluation API ---
@app.route('/api/v2v-evaluation', methods=['POST'])
@require_auth
def save_v2v_evaluation():
    db = getattr(app, 'mongo_db', None)
    email = getattr(request, 'user_email', None)
    if db is None or email is None:
        return jsonify({'error': 'Database or user not found'}), 500
    data = request.get_json()
    score = data.get('score')
    suggestions = data.get('suggestions')
    details = data.get('details')
    timestamp = datetime.now(timezone.utc)
    user = db['users'].find_one({'email': email})
    if not user:
        return jsonify({'error': 'User not found'}), 404
    eval_doc = {
        'user_id': user['_id'],
        'email': email,
        'score': score,
        'suggestions': suggestions,
        'details': details,
        'timestamp': timestamp
    }
    db['v2v_evaluations'].insert_one(eval_doc)
    return jsonify({'message': 'Evaluation saved'})

@app.route('/api/v2v-evaluations', methods=['GET'])
@require_auth
def get_v2v_evaluations():
    db = getattr(app, 'mongo_db', None)
    email = getattr(request, 'user_email', None)
    if db is None or email is None:
        return jsonify({'error': 'Database or user not found'}), 500
    user = db['users'].find_one({'email': email})
    if not user:
        return jsonify({'error': 'User not found'}), 404
    evals = list(db['v2v_evaluations'].find({'user_id': user['_id']}))
    for e in evals:
        e['_id'] = str(e['_id'])
        e['user_id'] = str(e['user_id'])
    return jsonify({'evaluations': evals})
import os
import asyncio
import logging
import threading
from dotenv import load_dotenv
import json
from flask import Flask, request, jsonify, redirect, send_from_directory
import logging
from flask_cors import CORS
import time
import math
import tempfile
import requests
import pdfplumber
from pymongo import MongoClient, ASCENDING
from pymongo.errors import DuplicateKeyError
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
from datetime import datetime, timedelta, timezone
from itsdangerous import URLSafeTimedSerializer, SignatureExpired
from google import genai
from bson import ObjectId
from auth_utils import (
    require_auth, verify_token, revoke_token, log_activity,
    log_question_bank_activity, log_resume_activity, log_mock_interview,
    log_job_search, update_chat_session, get_user_stats
)
from models import get_collections, create_indexes


# Load .env file FIRST before accessing environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)


# Google OAuth Configuration
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_OAUTH_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = "http://localhost:5000/auth/google/callback"
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

app.secret_key = os.environ.get("FLASK_SECRET_KEY", "supersekrit")

# Google OAuth Login - Step 1: Redirect to Google
@app.route('/auth/google/login')
def google_login():
    if not GOOGLE_CLIENT_ID:
        return jsonify({"error": "Google OAuth not configured"}), 500
    
    # Build the Google OAuth URL
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "scope": "openid email profile",
        "response_type": "code",
        "access_type": "offline",
        "prompt": "consent"
    }
    
    from urllib.parse import urlencode
    auth_url = f"{GOOGLE_AUTH_URL}?{urlencode(params)}"
    return redirect(auth_url)

# Google OAuth Callback - Step 2: Handle Google's redirect
@app.route('/auth/google/callback')
def google_callback():
    code = request.args.get('code')
    error = request.args.get('error')
    
    # Check if user denied access
    if error:
        print(f"OAuth error from Google: {error}")
        return redirect("http://localhost:3000/login?error=access_denied")
    
    if not code:
        print("No authorization code received")
        return redirect("http://localhost:3000/login?error=no_code")
    
    # Exchange code for access token
    token_data = {
        "code": code,
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code"
    }
    
    try:
        print("Exchanging code for token...")
        token_response = requests.post(GOOGLE_TOKEN_URL, data=token_data, timeout=10)
        print(f"Token response status: {token_response.status_code}")
        
        if token_response.status_code != 200:
            print(f"Token error response: {token_response.text}")
            return redirect("http://localhost:3000/login?error=token_exchange_failed")
        
        tokens = token_response.json()
        access_token = tokens.get("access_token")
        
        if not access_token:
            print("No access token in response")
            return redirect("http://localhost:3000/login?error=no_token")
        
        # Get user info from Google
        print("Fetching user info...")
        headers = {"Authorization": f"Bearer {access_token}"}
        user_response = requests.get(GOOGLE_USERINFO_URL, headers=headers, timeout=10)
        
        if user_response.status_code != 200:
            print(f"User info error: {user_response.text}")
            return redirect("http://localhost:3000/login?error=user_info_failed")
        
        user_info = user_response.json()
        print(f"User info received: {user_info.get('email')}")
        
        # Store user in MongoDB if available
        mongo_uri = os.environ.get("MONGODB_URI")
        print(f"Checking MongoDB: mongo_uri={mongo_uri is not None}, db={db is not None}, users_col={users_col is not None}")
        if mongo_uri is not None and db is not None and users_col is not None:
            try:
                # Check if user exists
                existing_user = users_col.find_one({"email": user_info.get("email")})
                
                user_doc = {
                    "google_id": user_info.get("id"),
                    "email": user_info.get("email"),
                    "firstName": user_info.get("given_name", ""),
                    "lastName": user_info.get("family_name", ""),
                    "name": user_info.get("name"),
                    "picture": user_info.get("picture"),  # Store Google profile picture
                    "last_login": datetime.now(timezone.utc),
                }
                
                if existing_user:
                    # Update existing user
                    users_col.update_one(
                        {"email": user_info.get("email")},
                        {
                            "$set": user_doc,
                            "$inc": {"total_login_count": 1}
                        }
                    )
                    user_id = existing_user['_id']
                else:
                    # Create new user
                    user_doc.update({
                        "createdAt": datetime.now(timezone.utc),
                        "subscription_tier": "free",
                        "total_login_count": 1
                    })
                    result = users_col.insert_one(user_doc)
                    user_id = result.inserted_id
                
                # Log login activity
                log_activity(db, user_info.get("email"), "login", "Google OAuth Login")
                print(f"User logged and activity logged for {user_info.get('email')}")
                
            except Exception as e:
                print(f"MongoDB error: {e}")
                # Continue even if MongoDB fails
        
        # Generate JWT session token
        try:
            jwt_secret = os.environ.get("JWT_SECRET") or "jwtsecret"
            session_payload = {
                "sub": user_info.get("id"),
                "email": user_info.get("email"),
                "name": user_info.get("name"),
                "exp": datetime.now(timezone.utc) + timedelta(days=7),
                "iat": datetime.now(timezone.utc),
            }
            session_token = jwt.encode(session_payload, jwt_secret, algorithm="HS256")
            print(f"JWT token generated successfully")
            
            # Redirect to frontend with token
            return redirect(f"http://localhost:3000/#session_token={session_token}")
        except Exception as e:
            print(f"JWT generation error: {e}")
            return redirect("http://localhost:3000/login?error=token_generation_failed")
        
    except requests.exceptions.RequestException as e:
        print(f"OAuth request error: {e}")
        return redirect(f"http://localhost:3000/login?error=oauth_failed")
    except Exception as e:
        print(f"Unexpected error in OAuth callback: {e}")
        import traceback
        traceback.print_exc()
        return redirect(f"http://localhost:3000/login?error=server_error")


# ==================== EMAIL/PASSWORD AUTHENTICATION ====================

# Signup endpoint - Create new user account with email/password
@app.route('/auth/signup', methods=['POST'])
def signup():
    try:
        data = request.get_json()
        first_name = data.get('firstName', '').strip()
        last_name = data.get('lastName', '').strip()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        accept_marketing = data.get('acceptMarketing', False)
        
        # Validate required fields
        if not first_name or not last_name or not email or not password:
            return jsonify({'error': 'All fields are required'}), 400
        
        # Validate email format
        import re
        email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_regex, email):
            return jsonify({'error': 'Invalid email format'}), 400
        
        # Validate password length
        if len(password) < 8:
            return jsonify({'error': 'Password must be at least 8 characters long'}), 400
        
        # Check if MongoDB is available
        mongo_uri = os.environ.get("MONGODB_URI")
        if not mongo_uri:
            return jsonify({'error': 'Database not configured'}), 500
        
        # Connect to MongoDB
        client = MongoClient(mongo_uri)
        db_name = os.environ.get("MONGODB_DBNAME") or "prepwise"
        db = client[db_name]
        users_col = db['users']
        
        # Check if user already exists
        existing_user = users_col.find_one({"email": email})
        if existing_user:
            return jsonify({'error': 'An account with this email already exists'}), 409
        
        # Hash password
        hashed_password = generate_password_hash(password)
        
        # Create user document
        user_doc = {
            "email": email,
            "password": hashed_password,
            "firstName": first_name,
            "lastName": last_name,
            "name": f"{first_name} {last_name}",
            "picture": "",  # No picture initially
            "accept_marketing": accept_marketing,
            "subscription_tier": "free",
            "createdAt": datetime.now(timezone.utc),
            "last_login": datetime.now(timezone.utc),
            "total_login_count": 0,
            "auth_provider": "email"  # Track auth method
        }
        
        # Insert user into database
        result = users_col.insert_one(user_doc)
        user_id = str(result.inserted_id)
        
        print(f"New user created: {email}")
        
        return jsonify({
            'message': 'Account created successfully',
            'userId': user_id
        }), 201
        
    except Exception as e:
        print(f"Signup error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Failed to create account. Please try again.'}), 500


# Login endpoint - Authenticate user with email/password
@app.route('/auth/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        
        # Validate required fields
        if not email or not password:
            return jsonify({'error': 'Email and password are required'}), 400
        
        # Check if MongoDB is available
        mongo_uri = os.environ.get("MONGODB_URI")
        if not mongo_uri:
            return jsonify({'error': 'Database not configured'}), 500
        
        # Connect to MongoDB
        client = MongoClient(mongo_uri)
        db_name = os.environ.get("MONGODB_DBNAME") or "prepwise"
        db = client[db_name]
        users_col = db['users']
        
        # Find user by email
        user = users_col.find_one({"email": email})
        
        if not user:
            return jsonify({'error': 'Invalid email or password'}), 401
        
        # Check if user registered with email/password
        if not user.get('password'):
            return jsonify({'error': 'This account uses Google login. Please sign in with Google.'}), 401
        
        # Verify password
        if not check_password_hash(user['password'], password):
            return jsonify({'error': 'Invalid email or password'}), 401
        
        # Update last login and increment login count
        users_col.update_one(
            {"email": email},
            {
                "$set": {"last_login": datetime.now(timezone.utc)},
                "$inc": {"total_login_count": 1}
            }
        )
        
        # Log login activity
        log_activity(db, email, "login", "Email/Password Login")
        
        # Generate JWT token
        jwt_secret = os.environ.get("JWT_SECRET") or "jwtsecret"
        token_payload = {
            "sub": str(user['_id']),  # Use MongoDB _id as subject
            "email": email,
            "name": user.get('name', ''),
            "exp": datetime.now(timezone.utc) + timedelta(days=7),
            "iat": datetime.now(timezone.utc),
        }
        token = jwt.encode(token_payload, jwt_secret, algorithm="HS256")
        
        # Return user data (exclude password)
        user_data = {
            "email": user['email'],
            "name": user.get('name', ''),
            "firstName": user.get('firstName', ''),
            "lastName": user.get('lastName', ''),
            "picture": user.get('picture', ''),
            "subscription_tier": user.get('subscription_tier', 'free')
        }
        
        print(f"User logged in: {email}")
        
        return jsonify({
            'token': token,
            'user': user_data
        }), 200
        
    except Exception as e:
        print(f"Login error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Failed to sign in. Please try again.'}), 500


# Endpoint for auto-login using JWT session token
@app.route("/auto-login", methods=["POST"])
def auto_login():
    data = request.get_json()
    token = data.get("session_token")
    if not token:
        return jsonify({"error": "Session token required"}), 400
    import jwt
    jwt_secret = os.environ.get("JWT_SECRET_KEY", "jwtsecret")
    try:
        payload = jwt.decode(token, jwt_secret, algorithms=["HS256"])
        email = payload.get("email")
        if not email:
            return jsonify({"error": "Invalid token"}), 401
        from pymongo import MongoClient
        mongo_uri = os.environ.get("MONGO_URI", "mongodb://localhost:27017/")
        client = MongoClient(mongo_uri)
        db = client[os.environ.get("MONGO_DB", "prepwise")]
        users_col = db[os.environ.get("MONGO_USER_COLLECTION", "users")]
        user = users_col.find_one({"email": email}, {"_id": 0})
        if not user:
            return jsonify({"error": "User not found"}), 404
        return jsonify({"user": user})
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Session expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid token"}), 401
    
try:
    from jobspy import scrape_jobs
except ImportError:
    scrape_jobs = None
job_cache = {}
cache_expiry = 300 

# Simple Glassdoor review URL generator
def get_glassdoor_review_url(company_name):
	name_cleaned = company_name.strip()
	name_hyphens = name_cleaned.replace(' ', '-')
	length_no_spaces = len(name_cleaned.replace(' ', ''))
	url = f"https://www.glassdoor.com/Reviews/{name_hyphens}-reviews-SRCH_KE0,{length_no_spaces}.htm"
	return url

@app.route('/scrape-review', methods=['POST'])
def scrape_review():
	data = request.get_json()
	company_name = data.get('companyName')
	if not company_name:
		return jsonify({'error': 'Company name is required.'}), 400
	url = get_glassdoor_review_url(company_name)
	return jsonify({'glassdoor_link': url})

@app.route('/api/jobs', methods=['GET'])
@require_auth  # Add authentication
def get_jobs():
	query = request.args.get('query', '')
	location = request.args.get('location', '')
	num_jobs = int(request.args.get('num_jobs', 10))
	cache_key = f"{query}:{location}:{num_jobs}"
	now = time.time()
	# Return cached if not expired
	if cache_key in job_cache and now - job_cache[cache_key]["timestamp"] < cache_expiry:
		jobs_list = job_cache[cache_key]["data"]
		
		# Log the search activity
		if db is not None:
			log_job_search(db, request.user_email, query, location, num_jobs, len(jobs_list))
			log_activity(db, request.user_email, "job_finder", f"Job search: {query} in {location}")
		
		return jsonify({"jobs": jobs_list})
	# Map location/country to valid JobSpy country code
	location_to_country = {
		"india": "india", "in": "india", "bengaluru": "india", "bangalore": "india",
		"usa": "usa", "us": "usa", "united states": "usa", "new york": "usa", "san francisco": "usa",
		"uk": "united kingdom", "united kingdom": "united kingdom", "london": "united kingdom",
		"canada": "canada", "toronto": "canada",
		"australia": "australia", "sydney": "australia",
		"germany": "germany", "berlin": "germany",
		"france": "france", "paris": "france",
		"japan": "japan", "tokyo": "japan",
		"remote": "worldwide",  # Add remote support
		# Add more mappings as needed
	}
	country = "india"  # default
	loc_lower = location.strip().lower()
	if loc_lower in location_to_country:
		country = location_to_country[loc_lower]
	elif loc_lower in [c.lower() for c in [
		"argentina", "australia", "austria", "bahrain", "bangladesh", "belgium", "bulgaria", "brazil", "canada", "chile", "china", "colombia", "costa rica", "croatia", "cyprus", "czech republic", "czechia", "denmark", "ecuador", "egypt", "estonia", "finland", "france", "germany", "greece", "hong kong", "hungary", "india", "indonesia", "ireland", "israel", "italy", "japan", "kuwait", "latvia", "lithuania", "luxembourg", "malaysia", "malta", "mexico", "morocco", "netherlands", "new zealand", "nigeria", "norway", "oman", "pakistan", "panama", "peru", "philippines", "poland", "portugal", "qatar", "romania", "saudi arabia", "singapore", "slovakia", "slovenia", "south africa", "south korea", "spain", "sweden", "switzerland", "taiwan", "thailand", "türkiye", "turkey", "ukraine", "united arab emirates", "uk", "united kingdom", "usa", "us", "united states", "uruguay", "venezuela", "vietnam", "usa/ca", "worldwide"]]:
		country = loc_lower
	try:
		if scrape_jobs is None:
			raise ImportError("jobspy is not installed")
		
		# Try scraping with Indeed first (more reliable), then LinkedIn
		jobs_df = None
		error_messages = []
		
		# Try Indeed first
		try:
			jobs_df = scrape_jobs(
				site_name=["indeed"],
				search_term=query,
				location=location,
				results_wanted=num_jobs,
				country_indeed=country
			)
		except Exception as e:
			error_messages.append(f"Indeed: {str(e)}")
		
		# If Indeed failed or returned no results, try LinkedIn
		if jobs_df is None or len(jobs_df) == 0:
			try:
				jobs_df = scrape_jobs(
					site_name=["linkedin"],
					search_term=query,
					location=location,
					results_wanted=num_jobs
				)
			except Exception as e:
				error_messages.append(f"LinkedIn: {str(e)}")
		
		if jobs_df is None or len(jobs_df) == 0:
			error_msg = "No jobs found. " + "; ".join(error_messages) if error_messages else "Try different search terms or location."
			return jsonify({"error": error_msg, "jobs": []})
		
		jobs_list = jobs_df.to_dict("records")
		# Replace NaN values with None
		for job in jobs_list:
			for key, value in job.items():
				if isinstance(value, float) and math.isnan(value):
					job[key] = None
		job_cache[cache_key] = {"data": jobs_list, "timestamp": now}
		
		# Log the search activity
		if db is not None:
			log_job_search(db, request.user_email, query, location, num_jobs, len(jobs_list))
			log_activity(db, request.user_email, "job_finder", f"Job search: {query} in {location}")
		
		return jsonify({"jobs": jobs_list})
	except Exception as e:
		return jsonify({"error": str(e), "jobs": []})
  
# Load .env file
load_dotenv()

# Use environment variable for API key - NO HARDCODED KEY
API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    raise ValueError("GEMINI_API_KEY not found in environment variables")

# MongoDB + JWT config
MONGODB_URI = os.getenv("MONGODB_URI")
MONGODB_DBNAME = os.getenv("MONGODB_DBNAME", "prepwise")
JWT_SECRET = os.getenv("JWT_SECRET") or os.getenv("SECRET_KEY")
JWT_EXPIRES_MIN = int(os.getenv("JWT_EXPIRES_MIN", "60"))

mongo_client = None
db = None
users_col = None
collections = None
if MONGODB_URI:
    try:
        mongo_client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
        db = mongo_client[MONGODB_DBNAME]
        users_col = db["users"]
        users_col.create_index([("email", ASCENDING)], unique=True)
        # Attach db and users_col to app for global access
        app.mongo_db = db
        app.users_col = users_col
        # Get all collections and create indexes
        collections = get_collections(db)
        create_indexes(db)
        print("✅ MongoDB connected and indexes created")
    except Exception as e:
        print(f"Warning: Failed to initialize MongoDB: {e}")
else:
    print("Warning: MONGODB_URI not set. Auth endpoints will return 503.")


# ---------------------------------------------------------------------------
# NOTE: Real-time interview logic (SoundDevice/Gemini Live) has been removed
# as we have migrated to Vapi AI (Frontend SDK).
# ---------------------------------------------------------------------------

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
        logging.error(f"Error extracting PDF text: {e}")
    return text.strip()

def get_gemini_resume_improvements(resume_text):
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
    print("[DEBUG] GEMINI_API_KEY used for Gemini API call:", API_KEY)
    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model1}:generateContent?key={API_KEY}",
        json=data,
        timeout=30
    )

    # Defensive parsing: check HTTP status and expected keys, return helpful debug info on failure
    try:
        resp_json = response.json()
    except Exception:
        return {"error": "Invalid JSON response from Gemini API", "raw_response": response.text}

    # If API returned an error structure or missing expected keys, return that for debugging
    if not response.ok:
        print("Gemini API error status:", response.status_code)
        print("Gemini API error response:", response.text)
        return {"error": f"Gemini API returned status {response.status_code}", "details": resp_json}

    # Try to extract text candidate safely
    try:
        candidates = resp_json.get("candidates")
        if not candidates or not isinstance(candidates, list) or len(candidates) == 0:
            return {"error": "Gemini response missing or empty 'candidates' field", "raw": resp_json}
        content = candidates[0].get("content")
        if not content or not isinstance(content, dict):
            return {"error": "Gemini response missing or invalid 'content' in first candidate", "raw": resp_json}
        parts = content.get("parts")
        if not parts or not isinstance(parts, list) or len(parts) == 0:
            return {"error": "Gemini response missing or empty 'parts' in content", "raw": resp_json}
        text = parts[0].get("text")
        if text is None:
            return {"error": "Gemini response missing 'text' in first part", "raw": resp_json}
    except Exception as e:
        return {"error": f"Failed to extract text from Gemini response: {e}", "raw": resp_json}

    # Clean markdown fences if present
    try:
        if text.strip().startswith('```'):
            text = text.strip().split('```')[-2] if '```' in text.strip() else text.strip()
            if text.strip().startswith('json'):
                text = text.strip()[4:].strip()
        import json
        return json.loads(text)
    except Exception as e:
        return {"error": f"Failed to parse JSON suggestions from Gemini text: {e}", "extracted_text": text}
    
def get_gemini_ats_score(resume_text, job_description):
    prompt = f"""
    You are an ATS (Applicant Tracking System) resume evaluator. 
    Given the following resume and job description, return a JSON object with:
    - match_score (0-100 integer)
    - summary (a detailed 2–3 line summary describing how well the resume matches the job, key strengths, and improvement areas)
    - missing_keywords (list of important keywords or skills from the job description that are not found in the resume)

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
        print("Gemini API raw response:", response.text)
        return {"error": "Invalid JSON response from Gemini API", "raw_response": response.text}

    if not response.ok:
        print("Gemini API returned non-200:", response.status_code, resp_json)
        return {"error": f"Gemini API returned status {response.status_code}", "details": resp_json}

    # Defensive extraction
    try:
        candidates = resp_json.get("candidates")
        if not candidates or not isinstance(candidates, list):
            print("Gemini response missing 'candidates':", resp_json)
            return {"error": "Gemini response missing 'candidates' field", "raw": resp_json}
        text = candidates[0]["content"]["parts"][0]["text"]
    except Exception as e:
        print("Error extracting candidate text:", e)
        return {"error": f"Error extracting candidate text: {e}", "raw": resp_json}

    # Clean and parse JSON from text
    try:
        if text.strip().startswith('```'):
            text = text.strip().split('```')[-2] if '```' in text.strip() else text.strip()
            if text.strip().startswith('json'):
                text = text.strip()[4:].strip()
        import json
        return json.loads(text)
    except Exception as e:
        print("Error parsing Gemini API response:", str(e))
        return {"error": f"Error parsing Gemini API response: {e}", "extracted_text": text}




# Vapi API Key
VAPI_API_KEY = os.getenv("VAPI_API_KEY")

@app.route('/api/vapi/assistant', methods=['POST'])
@require_auth  # Add authentication
def create_vapi_assistant():
    if not VAPI_API_KEY:
        return jsonify({"error": "VAPI_API_KEY not configured on server"}), 500

    data = request.get_json()
    job_description = data.get('jd')
    if not job_description:
        return jsonify({"error": "No JD provided"}), 400

    system_prompt = f"""
    You are an expert AI Interviewer acting as a Hiring Manager.
    Your goal is to conduct a professional yet friendly mock interview based on the following Job Description (JD).
    
    Job Description:
    {job_description}

    Instructions:
    1. Start by welcoming the candidate and mentioning the role they are applying for based on the JD.
    2. Ask one question at a time. Wait for the candidate's response.
    3. Keep your questions relevant to the skills and requirements mentioned in the JD.
    4. If the candidate answers well, move to a slightly harder or different topic. If they struggle, offer a small hint or move to a simpler question.
    5. Be encouraging but professional.
    6. Close the interview politely when you feel you have enough information or if the candidate asks to stop.
    """

    try:
        response = requests.post(
            "https://api.vapi.ai/assistant",
            headers={
                "Authorization": f"Bearer {VAPI_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "name": "Generic AI Interviewer", 
                "model": {
                    "provider": "openai",
                    "model": "gpt-3.5-turbo",
                    "messages": [{"role": "system", "content": system_prompt}]
                },
                "voice": {
                    "provider": "openai",
                    "voiceId": "alloy"
                },
                "transcriber": {
                    "provider": "deepgram",
                    "model": "nova-2",
                    "language": "en-US"
                }
            },
            timeout=10
        )
        if response.status_code != 201:
            print("Vapi API error status:", response.status_code)
            print("Vapi API error response:", response.text)
            return jsonify({"error": "Failed to create Vapi assistant", "details": response.json()}), response.status_code
        
        assistant_id = response.json().get("id")
        
        # Log the activity
        if db is not None:
            log_mock_interview(
                db, request.user_email, "technical", job_description[:500],
                duration_minutes=0, vapi_assistant_id=assistant_id
            )
            log_activity(db, request.user_email, "mock_interview", "Started Mock Interview Session")
        
        # Return only the ID to the frontend to keep the prompt hidden and strict
        return jsonify({"id": assistant_id})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/improve-resume', methods=['POST'])
@require_auth  # Add authentication
def improve_resume():
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
        
        # Log the activity
        if db is not None and not result.get("error"):
            log_resume_activity(
                db, request.user_email, "improvement", 
                resume_filename=filename,
                suggestions=result.get("suggestions"),
                resume_data=result.get("improved_resume") or result.get("improved_text") or result.get("resume_text")
            )
            log_activity(db, request.user_email, "resume_builder", "Resume Improvement Request")
            
    except Exception as e:
        result = {"error": str(e)}
    finally:
        os.remove(tmp_path)
    if "error" in result:
        return jsonify(result), 500
    return jsonify(result)

@app.route('/generate-resume', methods=['POST'])
@require_auth
def generate_resume():
    """Generate an ATS-optimized resume using Gemini AI"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing request data"}), 400
    
    job_description = data.get('jobDescription')
    template = data.get('template', 'modern')
    user_data = data.get('userData', {})
    
    if not job_description:
        return jsonify({"error": "Job description is required"}), 400
    
    # Build the prompt for Gemini
    prompt = f"""You are an expert ATS (Applicant Tracking System) resume writer. Your task is to create a highly optimized resume that will pass ATS screening and appeal to hiring managers.

JOB DESCRIPTION:
{job_description}

USER DATA:
{json.dumps(user_data, indent=2)}

INSTRUCTIONS:
1. Analyze the job description and identify key requirements, skills, and keywords
2. Match the user's experience and skills to the job requirements
3. Use action verbs and quantifiable achievements
4. Incorporate relevant keywords from the job description naturally
5. Format the resume to be ATS-friendly (simple formatting, no tables, standard section headers)
6. Fill in the template with optimized content
7. Ensure all content is truthful to the user's data but optimized for impact
8. Keep the resume to 1 page worth of content

Generate the complete, ATS-optimized resume. Output ONLY the resume text, no explanations or metadata."""

    try:
        model1 = "gemini-2.5-flash"
        print("[DEBUG] GEMINI_API_KEY used for resume generation:", API_KEY)
        response = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model1}:generateContent?key={API_KEY}",
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
            print("Gemini API error status:", response.status_code)
            print("Gemini API error response:", response.text)
            try:
                resp_json = response.json()
                return jsonify({"error": f"Gemini API returned status {response.status_code}", "details": resp_json}), 500
            except:
                return jsonify({"error": "Failed to generate resume", "raw_response": response.text}), 500
        
        resp_json = response.json()
        candidates = resp_json.get("candidates")
        if not candidates or not isinstance(candidates, list):
            return jsonify({"error": "Gemini response missing 'candidates' field", "raw": resp_json}), 500
        
        resume_text = candidates[0]["content"]["parts"][0]["text"]
        
        # Log the activity
        if db is not None:
            log_resume_activity(
                db, request.user_email, "generation",
                job_description=job_description[:500],
                suggestions=f"Generated resume using {template} template",
                resume_data=resume_text
            )
            log_activity(db, request.user_email, "resume_builder", "Resume Generation Request")
        
        return jsonify({"resume": resume_text})
        
    except Exception as e:
        print(f"Error generating resume: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/evaluate-resume', methods=['POST'])
@require_auth  # Add authentication
def evaluate_resume():
    if 'file' not in request.files:
        return jsonify({"error": "Missing resume file"}), 400
    file = request.files['file']
    filename = file.filename
    jd_text = None
    # Accept job_description as either text or file
    if 'job_description' in request.form:
        jd_text = request.form['job_description']
    elif 'job_description' in request.files:
        jd_file = request.files['job_description']
        jd_filename = jd_file.filename.lower()
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{jd_filename.split('.')[-1]}") as jd_tmp:
            jd_file.save(jd_tmp.name)
            jd_tmp_path = jd_tmp.name
        try:
            if jd_filename.endswith('.pdf'):
                jd_text = extract_pdf_text(jd_tmp_path)
            elif jd_filename.endswith('.docx') or jd_filename.endswith('.doc'):
                jd_text = None  # DOC/DOCX not supported without extract_docx_text
            else:
                jd_text = None
        finally:
            if os.path.exists(jd_tmp_path):
                os.remove(jd_tmp_path)
    if not jd_text:
        return jsonify({"error": "Missing or unsupported job description"}), 400
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        file.save(tmp.name)
        tmp_path = tmp.name
    try:
        resume_text = extract_pdf_text(tmp_path)
        result = get_gemini_ats_score(resume_text, jd_text)
        
        # Log the activity
        if db is not None and not result.get("error"):
            log_resume_activity(
                db, request.user_email, "evaluation",
                resume_filename=filename,
                job_description=jd_text[:500],  # Store first 500 chars
                ats_score=result.get("match_score"),
                missing_keywords=result.get("missing_keywords"),
                suggestions=result.get("summary")
            )
            log_activity(db, request.user_email, "resume_evaluator", 
                        f"ATS Evaluation - Score: {result.get('match_score', 0)}")
            
    except Exception as e:
        result = {"error": str(e)}
    finally:
        os.remove(tmp_path)
    if "error" in result:
        return jsonify(result), 500
    return jsonify(result)

@app.route('/generate-questions', methods=['POST'])
@require_auth  # Add authentication
def generate_questions():
    data = request.get_json()
    company = data.get('company_name')
    role = data.get('role')
    domain = data.get('domain')
    experience = data.get('experience_level')
    qtype = data.get('question_type')
    difficulty = data.get('difficulty')
    num_q = data.get('num_questions', 15)

    if not (company and role and domain and experience and qtype and difficulty):
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
    - id: a unique number
    - question: the actual question text
    - answer: a clear and concise correct answer
    - explanation: a short explanation or reasoning behind the answer

    Return ONLY a valid JSON array like:
    [
      {{
        "id": 1,
        "question": "What is React?",
        "answer": "A JavaScript library for building user interfaces.",
        "explanation": "React allows building reusable UI components efficiently."
      }}
    ]
    """

    data = {"contents": [{"parts": [{"text": prompt}]}]}
    model_name = "gemini-2.5-flash"
    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={API_KEY}",
        json=data,
        timeout=60
    )
    try:
        resp_json = response.json()
        candidates = resp_json.get("candidates", [])
        if not candidates or not isinstance(candidates, list) or len(candidates) == 0:
            return jsonify({"error": "Gemini response missing or empty 'candidates' field", "raw": resp_json}), 500
        content = candidates[0].get("content")
        if not content or not isinstance(content, dict):
            return jsonify({"error": "Gemini response missing or invalid 'content' in first candidate", "raw": resp_json}), 500
        parts = content.get("parts")
        if not parts or not isinstance(parts, list) or len(parts) == 0:
            return jsonify({"error": "Gemini response missing or empty 'parts' in content", "raw": resp_json}), 500
        text = parts[0].get("text")
        if text is None:
            return jsonify({"error": "Gemini response missing 'text' in first part", "raw": resp_json}), 500

        # Clean Gemini's markdown fences and control characters
        import re
        text = text.strip()
        if text.startswith('```'):
            # Remove markdown fences
            text = re.sub(r'^```[a-zA-Z]*', '', text)
            text = text.replace('```', '').strip()
        # Remove any control characters
        text = re.sub(r'[\x00-\x1F]+', '', text)
        # Log raw text for debugging
        print('Gemini raw response:', repr(text))
        import json
        questions_list = json.loads(text)

        # Log the activity to database
        if db is not None:
            log_question_bank_activity(
                db, request.user_email, company, role, domain, 
                experience, qtype, difficulty, num_q, questions_list
            )
            log_activity(db, request.user_email, "question_bank", 
                        f"Generated {num_q} questions for {company}")
        return jsonify({"questions": questions_list})
    except Exception as e:
        print("Failed to parse Gemini response:", e)
        return jsonify({"error": f"Failed to parse Gemini response: {e}"}), 500

# ---------------------------
# Auth helpers and endpoints
# ---------------------------

def issue_jwt(user_id, email):
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "email": email,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=JWT_EXPIRES_MIN)).timestamp()),
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
    return token

def require_db():
    if users_col is None or JWT_SECRET is None:
        return False
    return True

@app.route('/auth/signup', methods=['POST'])
def auth_signup():
    if not require_db():
        return jsonify({"error": "Auth not configured on server"}), 503
    data = request.get_json() or {}
    first_name = (data.get('firstName') or '').strip()
    last_name = (data.get('lastName') or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    if not first_name or not last_name or not email or not password:
        return jsonify({"error": "Missing required fields"}), 400
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400
    try:
        hashed = generate_password_hash(password)
        doc = {
            "firstName": first_name,
            "lastName": last_name,
            "email": email,
            "passwordHash": hashed,
            "marketingOptIn": bool(data.get('acceptMarketing', False)),
            "createdAt": datetime.now(timezone.utc),
        }
        users_col.insert_one(doc)
        return jsonify({"message": "Signup successful"}), 201
    except DuplicateKeyError:
        return jsonify({"error": "An account with this email already exists"}), 409
    except Exception as e:
        return jsonify({"error": f"Server error: {e}"}), 500

@app.route('/auth/login', methods=['POST'])
def auth_login():
    if not require_db():
        return jsonify({"error": "Auth not configured on server"}), 503
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    if not email or not password:
        return jsonify({"error": "Missing email or password"}), 400
    user = users_col.find_one({"email": email})
    if not user or not check_password_hash(user.get('passwordHash', ''), password):
        return jsonify({"error": "Invalid email or password"}), 401
    
    # Update login info
    users_col.update_one(
        {"email": email},
        {
            "$set": {"last_login": datetime.now(timezone.utc)},
            "$inc": {"total_login_count": 1}
        }
    )
    
    # Log login activity
    log_activity(db, email, "login", "Email/Password Login")
    
    token = issue_jwt(user.get('_id'), email)
    profile = {
        "firstName": user.get('firstName'),
        "lastName": user.get('lastName'),
        "email": user.get('email'),
        "picture": user.get('picture'),
    }
    return jsonify({"token": token, "user": profile})

@app.route('/auth/me', methods=['GET'])
def auth_me():
    if not require_db():
        return jsonify({"error": "Auth not configured on server"}), 503
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return jsonify({"error": "Missing token"}), 401
    token = auth_header.split(' ', 1)[1]
    
    payload, error = verify_token(token)
    if error:
        return jsonify({"error": error}), 401
    
    try:
        email = payload.get('email')
        user = users_col.find_one({"email": email}, {"passwordHash": 0})
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        # Convert ObjectId to string
        user["_id"] = str(user["_id"])
        
        return jsonify({"user": user})
    except Exception as e:
        return jsonify({"error": f"Server error: {e}"}), 500

@app.route('/auth/logout', methods=['POST'])
def auth_logout():
    """
    Logout endpoint - revokes the token and logs the activity
    """
    if not require_db():
        return jsonify({"error": "Auth not configured on server"}), 503
    
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return jsonify({"message": "No token provided"}), 200
    
    token = auth_header.split(' ', 1)[1]
    payload, error = verify_token(token)
    
    if not error and payload:
        # Log logout activity
        email = payload.get('email')
        log_activity(db, email, "logout", "User Logout")
    
    # Revoke the token
    revoke_token(token)
    
    return jsonify({"message": "Logged out successfully"}), 200

# Initialize serializer for generating and verifying tokens
serializer = URLSafeTimedSerializer(JWT_SECRET)

@app.route('/auth/forgot-password', methods=['POST'])
def forgot_password():
    if not require_db():
        return jsonify({"error": "Auth not configured on server"}), 503

    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    if not email:
        return jsonify({"error": "Email is required"}), 400

    user = users_col.find_one({"email": email})
    if not user:
        return jsonify({"error": "No account found with this email"}), 404

    # Generate a password reset token
    token = serializer.dumps(email, salt='password-reset-salt')
    reset_url = f"http://localhost:3000/reset-password?token={token}"

    # Simulate sending email (replace with actual email service)
    print(f"Password reset link: {reset_url}")

    return jsonify({"message": "Password reset link sent to your email"})

@app.route('/auth/reset-password', methods=['POST'])
def reset_password():
    if not require_db():
        return jsonify({"error": "Auth not configured on server"}), 503

    data = request.get_json() or {}
    token = data.get('token')
    new_password = data.get('password')

    if not token or not new_password:
        return jsonify({"error": "Token and new password are required"}), 400

    try:
        email = serializer.loads(token, salt='password-reset-salt', max_age=3600)  # Token valid for 1 hour
    except SignatureExpired:
        return jsonify({"error": "Token has expired"}), 400
    except Exception as e:
        return jsonify({"error": f"Invalid token: {e}"}), 400

    # Update the user's password
    hashed_password = generate_password_hash(new_password)
    result = users_col.update_one({"email": email}, {"$set": {"passwordHash": hashed_password}})

    if result.modified_count == 0:
        return jsonify({"error": "Failed to reset password"}), 500

    return jsonify({"message": "Password reset successful"})


# ==================== USER DASHBOARD & ANALYTICS ====================

@app.route('/api/user/dashboard', methods=['GET'])
@require_auth
def user_dashboard():
    """
    Get comprehensive user statistics for the progress analytics dashboard
    """
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    
    try:
        stats = get_user_stats(db, request.user_email)
        if not stats:
            return jsonify({"error": "Failed to retrieve user statistics"}), 500
        
        # Convert ObjectIds to strings for JSON serialization
        def serialize_doc(doc):
            if isinstance(doc, list):
                return [serialize_doc(d) for d in doc]
            if isinstance(doc, dict):
                return {k: str(v) if isinstance(v, ObjectId) else serialize_doc(v) if isinstance(v, (dict, list)) else v 
                       for k, v in doc.items()}
            return doc
        
        stats = serialize_doc(stats)
        return jsonify(stats)
    except Exception as e:
        print(f"Error in dashboard: {e}")
        return jsonify({"error": f"Server error: {e}"}), 500


@app.route('/api/user/activity-log', methods=['GET'])
@require_auth
def get_activity_log():
    """
    Get user's recent activity log with optional filtering
    """
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    
    try:
        limit = int(request.args.get('limit', 50))
        activity_type = request.args.get('type')  # Optional filter
        
        user = users_col.find_one({"email": request.user_email})
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        query = {"user_id": user['_id']}
        if activity_type:
            query["activity_type"] = activity_type
        
        activities = list(db['user_activities'].find(query).sort("timestamp", -1).limit(limit))
        

        return jsonify({"activities": activities})
    except Exception as e:
        return jsonify({"error": f"Server error: {e}"}), 500


@app.route('/api/user/mock-interview-score', methods=['POST'])
@require_auth
def save_mock_interview_score():
    """
    Save mock interview scores and feedback
    """
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    
    try:
        data = request.get_json()
        
        log_mock_interview(
            db, request.user_email,
            interview_type=data.get('interview_type', 'technical'),
            job_description=data.get('job_description', ''),
            duration_minutes=data.get('duration_minutes', 0),
            vapi_assistant_id=data.get('assistant_id'),
            vapi_call_id=data.get('call_id'),
            overall_rating=data.get('overall_rating'),
            communication_score=data.get('communication_score'),
            technical_score=data.get('technical_score'),
            confidence_score=data.get('confidence_score'),
            feedback=data.get('feedback'),
            transcript=data.get('transcript')
        )
        
        return jsonify({"message": "Interview score saved successfully"})
    except Exception as e:
        return jsonify({"error": f"Server error: {e}"}), 500


@app.route('/api/user/chat-message', methods=['POST'])
@require_auth
def save_chat_message():
    """
    Save chat messages for session tracking
    """
    if db is None:
        return jsonify({"error": "Database not configured"}), 503
    
    try:
        data = request.get_json()
        session_id = data.get('session_id', 'default')
        message = data.get('message', '')
        role = data.get('role', 'user')
        
        update_chat_session(db, request.user_email, session_id, message, role)
        
        return jsonify({"message": "Chat message saved"})
    except Exception as e:
        return jsonify({"error": f"Server error: {e}"}), 500

# Dashboard subscription/activity endpoint
@app.route('/api/dashboard-info', methods=['GET'])
@require_auth
def dashboard_info():
    email = getattr(request, 'user_email', None)
    db = getattr(app, 'mongo_db', None)
    if db is None:
        db = globals().get('db', None)
    if db is None or email is None:
        return jsonify({'error': 'Database or user not found'}), 500

    users_col = getattr(app, 'users_col', None)
    if users_col is None:
        users_col = db['users']
    subs_col = db['subscription_info']
    activities_col = db['user_activities']

    user = users_col.find_one({'email': email}, {
        'subscription_tier': 1,
        'subscription_status': 1,
        'subscription_start': 1,
        'subscription_end': 1,
        'name': 1,
        'email': 1,
        'picture': 1,
        'firstName': 1,
        'total_login_count': 1,
        'last_login': 1
    })
    latest_sub = subs_col.find({'email': email}).sort('timestamp', -1).limit(1)
    sub_details = next(latest_sub, None)
    recent_activities = list(activities_col.find({'email': email}).sort('timestamp', -1).limit(10))
    all_activities = list(activities_col.find({'email': email}))

    # Convert ObjectId fields to strings for user
    if user and '_id' in user:
        user['_id'] = str(user['_id'])
    # Convert ObjectId fields to strings for subscription and normalize keys for frontend
    if sub_details and isinstance(sub_details, dict):
        if '_id' in sub_details:
            sub_details['_id'] = str(sub_details['_id'])
        if 'user_id' in sub_details:
            sub_details['user_id'] = str(sub_details['user_id'])
        # Normalize subscription fields for frontend
        sub_details['tier'] = sub_details.get('subscription_tier', sub_details.get('tier', 'free'))
        sub_details['status'] = sub_details.get('payment_status', sub_details.get('subscription_status', 'active'))
        sub_details['start_date'] = sub_details.get('start_date', sub_details.get('subscription_start'))
        sub_details['end_date'] = sub_details.get('end_date', sub_details.get('subscription_end'))
    # Convert ObjectId fields to strings for activities
    for activity in recent_activities:
        if '_id' in activity:
            activity['_id'] = str(activity['_id'])
        if 'user_id' in activity:
            activity['user_id'] = str(activity['user_id'])

    # Calculate chat sessions and messages (from chat_sessions collection)
    chat_sessions_col = db['chat_sessions']
    user_obj = users_col.find_one({'email': email})
    chat_sessions = list(chat_sessions_col.find({'user_id': user_obj['_id']})) if user_obj else []
    # Convert ObjectId fields in chat_sessions to strings
    for s in chat_sessions:
        if '_id' in s:
            s['_id'] = str(s['_id'])
        if 'user_id' in s:
            s['user_id'] = str(s['user_id'])
        for m in s.get('messages', []):
            if '_id' in m:
                m['_id'] = str(m['_id'])
    total_chat_sessions = len(chat_sessions)
    total_chat_messages = sum(s.get('message_count', 0) for s in chat_sessions)
    # V2V evaluations
    v2v_evals = list(db['v2v_evaluations'].find({'user_id': user_obj['_id']})) if user_obj else []
    for e in v2v_evals:
        e['_id'] = str(e['_id'])
        e['user_id'] = str(e['user_id'])

    # Calculate job searches and details
    job_searches = [a for a in all_activities if a.get('activity_type') == 'job_finder']
    total_job_searches = len(job_searches)
    # Show recent 5 unique job search queries (by query string, most recent first)
    seen_queries = set()
    recent_jobs = []
    for job in sorted(job_searches, key=lambda x: x.get('timestamp', ''), reverse=True):
        query = job.get('query', '').strip()
        if query and query.lower() not in seen_queries:
            recent_jobs.append({
                'query': query,
                'timestamp': job.get('timestamp')
            })
            seen_queries.add(query.lower())
        if len(recent_jobs) >= 5:
            break
    job_opened_details = recent_jobs
    for a in job_searches:
        job_info = {
            'timestamp': a.get('timestamp'),
            'query': a.get('activity_name'),
            'details': a.get('job_details', {})
        }
        job_opened_details.append(job_info)

    # Calculate login info
    total_logins = user.get('total_login_count', 0) if user else 0
    last_login = user.get('last_login') if user else None

    # Calculate question bank sessions and details
    qb_col = db['question_bank_activities']
    qb_sessions = list(qb_col.find({'user_id': user_obj['_id']}).sort('timestamp', -1).limit(5)) if user_obj else []
    total_qb_sessions = qb_col.count_documents({'user_id': user_obj['_id']}) if user_obj else 0
    qb_recent_sessions = []
    for a in qb_sessions:
        qb_recent_sessions.append({
            'timestamp': a.get('timestamp'),
            'company': a.get('company', ''),
            'role': a.get('role', ''),
            'domain': a.get('domain', ''),
            'experience_level': a.get('experience_level', ''),
            'difficulty': a.get('difficulty', ''),
            'question_type': a.get('question_type', ''),
            'num_questions': a.get('num_questions', 0),
        })

    # Calculate mock interviews and details
    mock_interviews = [a for a in all_activities if a.get('activity_type') == 'mock_interview']
    total_mock_interviews = len(mock_interviews)
    mock_recent_interviews = []
    for a in mock_interviews[-5:]:
        mock_recent_interviews.append({
            'timestamp': a.get('timestamp'),
            'interview_type': a.get('interview_type'),
            'overall_rating': a.get('overall_rating'),
            'communication_score': a.get('communication_score'),
            'technical_score': a.get('technical_score'),
            'confidence_score': a.get('confidence_score'),
            'feedback': a.get('feedback'),
        })

    # Calculate resume activities and details
    resume_activities = [a for a in all_activities if a.get('activity_type') in ['resume_evaluator', 'resume_builder', 'improvement', 'generation', 'evaluation']]
    total_resume_activities = len(resume_activities)
    resume_recent_activities = []
    for a in resume_activities:
        resume_recent_activities.append({
            'timestamp': a.get('timestamp'),
            'activity_type': a.get('activity_type'),
            'ats_score': a.get('ats_score'),
            'missing_keywords': a.get('missing_keywords'),
            'suggestions': a.get('suggestions'),
            'resume_filename': a.get('resume_filename'),
            'resume_data': a.get('resume_data'),
            'job_description': a.get('job_description'),
        })

    # Timeline (most recent 20 activities)
    activity_timeline = list(activities_col.find({'email': email}).sort('timestamp', -1).limit(20))
    for activity in activity_timeline:
        if '_id' in activity:
            activity['_id'] = str(activity['_id'])
        if 'user_id' in activity:
            activity['user_id'] = str(activity['user_id'])

    # Add all login activities for the frontend
    login_activities = [a for a in all_activities if a.get('activity_type') == 'login']
    # Convert ObjectId fields to strings for login_activities
    for activity in login_activities:
        if '_id' in activity:
            activity['_id'] = str(activity['_id'])
        if 'user_id' in activity:
            activity['user_id'] = str(activity['user_id'])

    response = {
        'user': user,
        'subscription': sub_details,
        'activities': recent_activities,
        'login_activities': login_activities,
        'chat_sessions': {
            'total_sessions': total_chat_sessions,
            'total_messages': total_chat_messages,
            'sessions': chat_sessions
        },
        'job_searches': {
            'total_searches': total_job_searches,
            'recent_jobs': job_opened_details
        },
        'user_info': {
            'total_logins': total_logins,
            'last_login': last_login
        },
        'question_bank': {
            'total_sessions': total_qb_sessions,
            'recent_sessions': qb_recent_sessions
        },
        'mock_interviews': {
            'total_interviews': total_mock_interviews,
            'recent_interviews': mock_recent_interviews
        },
        'resume_activities': {
            'total_activities': total_resume_activities,
            'recent_activities': resume_recent_activities
        },
        'v2v_evaluations': v2v_evals,
        'activity_timeline': activity_timeline
    }
    return jsonify(response)
# Subscription update endpoint
@app.route('/api/subscription', methods=['POST'])
@require_auth
def update_subscription():
    data = request.get_json()
    tier = data.get('tier')
    start_date = data.get('start_date')
    end_date = data.get('end_date')
    status = data.get('status', 'active')
    payment_method = data.get('payment_method', '')
    amount_paid = data.get('amount_paid', 0)
    transaction_id = data.get('transaction_id', '')
    auto_renew = data.get('auto_renew', False)

    email = getattr(request, 'user_email', None)
    db = getattr(app, 'mongo_db', None)
    if db is None:
        db = globals().get('db', None)
    if db is None or email is None:
        return jsonify({'error': 'Database or user not found'}), 500

    users_col = getattr(app, 'users_col', None)
    if users_col is None:
        users_col = db['users']
    subs_col = db['subscription_info']

    # Update user profile with current subscription tier
    users_col.update_one({'email': email}, {
        '$set': {
            'subscription_tier': tier,
            'subscription_status': status,
            'subscription_start': start_date,
            'subscription_end': end_date
        }
    })

    # Insert subscription history record
    subs_col.insert_one({
        'email': email,
        'user_id': users_col.find_one({'email': email})['_id'],
        'subscription_tier': tier,
        'payment_status': status,
        'start_date': start_date,
        'end_date': end_date,
        'payment_method': payment_method,
        'amount_paid': amount_paid,
        'transaction_id': transaction_id,
        'auto_renew': auto_renew,
        'timestamp': datetime.now(timezone.utc)
    })

    return jsonify({'success': True, 'tier': tier, 'status': status})

# ==================== USER CHAT & PROFILE IMAGE ====================
from werkzeug.utils import secure_filename
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'static', 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/api/user/upload-profile-pic', methods=['POST'])
@require_auth
def upload_profile_pic():
    if 'image' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        ext = filename.rsplit('.', 1)[1].lower()
        user_id = str(request.user_id)
        new_filename = f"{user_id}.{ext}"
        file_path = os.path.join(UPLOAD_FOLDER, new_filename)
        file.save(file_path)
        # Update user doc
        db = app.config.get('db')
        users_col = app.config.get('users_col')
        if db is None or users_col is None:
            from models import get_collections
            mongo_uri = os.environ.get("MONGODB_URI")
            client = MongoClient(mongo_uri)
            db_name = os.environ.get("MONGODB_DBNAME") or "prepwise"
            db = client[db_name]
            users_col = db['users']
            app.config['db'] = db
            app.config['users_col'] = users_col
        url = f"/static/uploads/{new_filename}"
        # Try to find user by google_id first (Google users), then by _id (email/password users)
        user = users_col.find_one({'google_id': request.user_id})
        if user:
            users_col.update_one({'google_id': request.user_id}, {'$set': {'picture': url}})
        else:
            # Email/password user - user_id is MongoDB _id
            from bson import ObjectId
            users_col.update_one({'_id': ObjectId(request.user_id)}, {'$set': {'picture': url}})
        return jsonify({'picture': url})
    return jsonify({'error': 'Invalid file type'}), 400

@app.route('/api/user/delete-profile-pic', methods=['DELETE'])
@require_auth
def delete_profile_pic():
    db = app.config.get('db')
    users_col = app.config.get('users_col')
    if db is None or users_col is None:
        from models import get_collections
        mongo_uri = os.environ.get("MONGODB_URI")
        client = MongoClient(mongo_uri)
        db_name = os.environ.get("MONGODB_DBNAME") or "prepwise"
        db = client[db_name]
        users_col = db['users']
        app.config['db'] = db
        app.config['users_col'] = users_col
    # Try to find user by google_id first (Google users), then by _id (email/password users)
    user = users_col.find_one({'google_id': request.user_id})
    if not user:
        # Email/password user - user_id is MongoDB _id
        from bson import ObjectId
        user = users_col.find_one({'_id': ObjectId(request.user_id)})
    
    if user and user.get('picture') and user['picture'].startswith('/static/uploads/'):
        file_path = os.path.join(os.path.dirname(__file__), user['picture'].lstrip('/'))
        if os.path.exists(file_path):
            os.remove(file_path)
    
    # Update the user document
    if users_col.find_one({'google_id': request.user_id}):
        users_col.update_one({'google_id': request.user_id}, {'$set': {'picture': ''}})
    else:
        from bson import ObjectId
        users_col.update_one({'_id': ObjectId(request.user_id)}, {'$set': {'picture': ''}})
    
    return jsonify({'success': True})


if __name__ == "__main__":
    app.run(debug=True)
