CLEAN_IMPORTS = True
import os
import asyncio
import logging
import threading
from dotenv import load_dotenv
import json
from flask import Flask, request, jsonify, redirect, send_from_directory
import os
import threading
import json
from queue import Queue
import numpy as np
from dotenv import load_dotenv
from langgraph.graph import StateGraph, END, START
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, trim_messages
from langchain_community.tools import DuckDuckGoSearchResults
from langchain.agents import create_agent
from langchain.tools import tool as langchain_tool
from typing import Dict, TypedDict
import requests
import re
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
from auth_utils import (
    require_auth, verify_token, revoke_token, log_activity,
    log_question_bank_activity, log_resume_activity, log_mock_interview,
    log_job_search, get_user_stats
)
import auth_utils
from models import get_collections, create_indexes, serialize_doc

# Load .env file FIRST before accessing environment variables
load_dotenv()

# Configure logging
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
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

app = Flask(__name__)

# Configure CORS to only allow frontend URLs
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
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

# --- Chat Sessions API ---
@app.route('/api/chat-sessions/<session_id>', methods=['DELETE'])
@require_auth
def delete_chat_session(session_id):
    db = getattr(app, 'mongo_db', None)
    email = getattr(request, 'user_email', None)
    if db is None or email is None:
        return jsonify({'error': 'Database or user not found'}), 500
    user = db['users'].find_one({'email': email})
    if not user:
        return jsonify({'error': 'User not found'}), 404
    from bson import ObjectId
    result = db['chat_sessions'].delete_one({'_id': ObjectId(session_id), 'user_id': user['_id']})
    if result.deleted_count == 1:
        return jsonify({'message': 'Chat session deleted'})
    else:
        return jsonify({'error': 'Chat session not found or not authorized'}), 404

@app.route('/api/chat-sessions/<session_id>', methods=['PATCH'])
@require_auth
def update_chat_session(session_id):
    db = getattr(app, 'mongo_db', None)
    email = getattr(request, 'user_email', None)
    if db is None or email is None:
        return jsonify({'error': 'Database or user not found'}), 500
    user = db['users'].find_one({'email': email})
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    new_topic = data.get('topic', '').strip()
    

    # --- Chat Sessions API ---
    @app.route('/api/chat-sessions/<session_id>', methods=['DELETE'])
    @require_auth
    def delete_chat_session(session_id):
        db = getattr(app, 'mongo_db', None)
        email = getattr(request, 'user_email', None)
        if db is None or email is None:
            return jsonify({'error': 'Database or user not found'}), 503
        user = db['users'].find_one({'email': email})
        if not user:
            return jsonify({'error': 'User not found'}), 404
        from bson import ObjectId
        result = db['chat_sessions'].delete_one({'_id': ObjectId(session_id), 'user_id': user['_id']})
        if result.deleted_count == 1:
            return jsonify({'message': 'Session deleted'})
        else:
            return jsonify({'error': 'Session not found'}), 404

    @app.route('/api/chat-sessions/<session_id>', methods=['PATCH'])
    @require_auth
    def update_chat_session(session_id):
        db = getattr(app, 'mongo_db', None)
        email = getattr(request, 'user_email', None)
        if db is None or email is None:
            return jsonify({'error': 'Database or user not found'}), 503
        user = db['users'].find_one({'email': email})
        if not user:
            return jsonify({'error': 'User not found'}), 404
        data = request.get_json()
        new_topic = data.get('topic', '').strip()
        if not new_topic:
            return jsonify({'error': 'Topic cannot be empty'}), 400
        from bson import ObjectId
        result = db['chat_sessions'].update_one(
            {'_id': ObjectId(session_id), 'user_id': user['_id']},
            {'$set': {'topic': new_topic}}
        )
        if result.matched_count == 1:
            return jsonify({'message': 'Session updated'})
        else:
            return jsonify({'error': 'Session not found'}), 404

    @app.route('/api/chat-sessions', methods=['GET', 'DELETE'])
    @require_auth
    def handle_chat_sessions():
        db = getattr(app, 'mongo_db', None)
        email = getattr(request, 'user_email', None)
        if db is None or email is None:
            return jsonify({'error': 'Database or user not found'}), 503
        user = db['users'].find_one({'email': email})
        if not user:
            return jsonify({'error': 'User not found'}), 404
        if request.method == 'DELETE':
            db['chat_sessions'].delete_many({'user_id': user['_id']})
            return jsonify({'message': 'All sessions deleted'})
        sessions = list(db['chat_sessions'].find({'user_id': user['_id']}).sort('last_message_at', -1))
        return jsonify({'sessions': serialize_doc(sessions)})
    db = getattr(app, 'mongo_db', None)
    email = getattr(request, 'user_email', None)
    if db is None or email is None:
        return jsonify({'error': 'Database or user not found'}), 500
    user = db['users'].find_one({'email': email})
    if not user:
        return jsonify({'error': 'User not found'}), 404
    evals = list(db['v2v_evaluations'].find({'user_id': user['_id']}))
    return jsonify({'evaluations': serialize_doc(evals)})

# Import datetime, timedelta, timezone for subsequent route usage
from datetime import datetime, timedelta, timezone
from itsdangerous import URLSafeTimedSerializer, SignatureExpired

from typing import Dict, TypedDict
from langgraph.graph import StateGraph, END, START
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, trim_messages
from langchain_community.tools import DuckDuckGoSearchResults
from langchain.agents import create_agent
from langchain.tools import tool as langchain_tool
from bson import ObjectId


# Frontend & Google OAuth Configuration
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
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
        logger.warning(f"OAuth error from Google: {error}")
        return redirect(f"{FRONTEND_URL}/login?error=access_denied")
    
    if not code:
        logger.warning("No authorization code received")
        return redirect(f"{FRONTEND_URL}/login?error=no_code")
    
    # Exchange code for access token
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
        logger.debug(f"Token response status: {token_response.status_code}")
        
        if token_response.status_code != 200:
            logger.error(f"Token exchange failed: {token_response.text}")
            return redirect(f"{FRONTEND_URL}/login?error=token_exchange_failed")
        
        tokens = token_response.json()
        access_token = tokens.get("access_token")
        
        if not access_token:
            logger.warning("No access token in OAuth response")
            return redirect(f"{FRONTEND_URL}/login?error=no_token")
        
        # Get user info from Google
        logger.debug("Fetching user info from Google...")
        headers = {"Authorization": f"Bearer {access_token}"}
        user_response = requests.get(GOOGLE_USERINFO_URL, headers=headers, timeout=10)
        
        if user_response.status_code != 200:
            logger.error(f"Failed to fetch user info: {user_response.text}")
            return redirect(f"{FRONTEND_URL}/login?error=user_info_failed")
        
        user_info = user_response.json()
        logger.info(f"User authenticated via Google: {user_info.get('email')}")
        
        # Store user in MongoDB if available
        mongo_uri = os.environ.get("MONGODB_URI")
        logger.debug(f"MongoDB availability - URI: {bool(mongo_uri)}, db: {db is not None}, users_col: {users_col is not None}")
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
                logger.info(f"User stored in database: {user_info.get('email')}")
                
            except Exception as e:
                logger.error(f"MongoDB storage failed: {e}")
                # Continue even if MongoDB fails
        
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
            logger.debug(f"JWT token generated successfully for OAuth user")
            
            # Redirect to frontend with token
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
        
        logger.info(f"New user created: {email}")
        
        return jsonify({
            'message': 'Account created successfully',
            'userId': user_id
        }), 201
        
    except Exception as e:
        logger.error(f"Signup error: {e}", exc_info=True)
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
        token_payload = {
            "sub": str(user['_id']),  # Use MongoDB _id as subject
            "email": email,
            "name": user.get('name', ''),
            "exp": datetime.now(timezone.utc) + timedelta(days=7),
            "iat": datetime.now(timezone.utc),
        }
        token = jwt.encode(token_payload, JWT_SECRET, algorithm="HS256")
        
        # Return user data (exclude password)
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
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
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
			# Format activity name based on whether location is specified
			if location and location.lower() not in ['any', '', 'none']:
				activity_name = f"{query} in {location}"
			else:
				activity_name = query
			log_activity(db, request.user_email, "job_finder", activity_name)
		
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
			# Format activity name based on whether location is specified
			if location and location.lower() not in ['any', '', 'none']:
				activity_name = f"{query} in {location}"
			else:
				activity_name = query
			log_activity(db, request.user_email, "job_finder", activity_name)
		
		return jsonify({"jobs": jobs_list})
	except Exception as e:
		return jsonify({"error": str(e), "jobs": []})
  
# Load .env file
load_dotenv()

# Use environment variable for API key - NO HARDCODED KEY
API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    raise ValueError("GEMINI_API_KEY not found in environment variables")

# Initialize Groq for multi-agent
GROQ_API_KEY = os.getenv('GROQ_API_KEY')
if not GROQ_API_KEY:
    print("Warning: GROQ_API_KEY not found. Multi-agent endpoints will not work.")

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
        logger.info("MongoDB connected and indexes created")
    except Exception as e:
        logger.error(f"Failed to initialize MongoDB: {e}")
else:
    logger.warning("MONGODB_URI not set. Auth endpoints will return 503.")


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
    logging.debug(f"Calling Gemini API with model: {model1}")
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
        logger.error(f"Gemini API error status: {response.status_code}, response: {response.text}")
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
        logger.error(f"Gemini API raw response: {response.text}")
        return {"error": "Invalid JSON response from Gemini API", "raw_response": response.text}

    if not response.ok:
        logger.error(f"Gemini API returned non-200: {response.status_code} - {resp_json}")
        return {"error": f"Gemini API returned status {response.status_code}", "details": resp_json}

    # Defensive extraction
    try:
        candidates = resp_json.get("candidates")
        if not candidates or not isinstance(candidates, list) or len(candidates) == 0:
            logger.warning(f"Gemini response missing 'candidates': {resp_json}")
            return {"error": "Gemini response missing 'candidates' field", "raw": resp_json}
        
        content = candidates[0].get("content")
        if not content or not isinstance(content, dict):
            logger.warning(f"Gemini response missing 'content': {resp_json}")
            return {"error": "Gemini response missing or invalid 'content' in first candidate", "raw": resp_json}
        
        parts = content.get("parts")
        if not parts or not isinstance(parts, list) or len(parts) == 0:
            logger.warning(f"Gemini response missing 'parts': {resp_json}")
            return {"error": "Gemini response missing or empty 'parts' in content", "raw": resp_json}
        
        text = parts[0].get("text")
        if text is None:
            logger.warning(f"Gemini response missing 'text': {resp_json}")
            return {"error": "Gemini response missing 'text' in first part", "raw": resp_json}
    except Exception as e:
        logger.error(f"Error extracting candidate text: {e}", exc_info=True)
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
        logger.error(f"Error parsing Gemini API response: {e}", exc_info=True)
        return {"error": f"Error parsing Gemini API response: {e}", "extracted_text": text}




# Vapi Private Key
VAPI_PRIVATE_KEY = os.getenv("VAPI_PRIVATE_KEY")

@app.route('/api/vapi/assistant', methods=['POST'])
@require_auth  # Add authentication
def create_vapi_assistant():
    if not VAPI_PRIVATE_KEY:
        return jsonify({"error": "VAPI_PRIVATE_KEY not configured on server"}), 500

    data = request.get_json()
    job_description = data.get('jd')
    if not job_description:
        return jsonify({"error": "No JD provided"}), 400

    # Truncate JD to avoid hitting token limits
    jd_text = job_description[:1500] + "..." if len(job_description) > 1500 else job_description
    
    system_prompt = (
        "You are an expert AI Interviewer acting as a Hiring Manager. "
        "Your goal is to conduct a professional mock interview based on this Job Description:\n\n"
        f"{jd_text}\n\n"
        "Instructions:\n"
        "1. Welcome the candidate and mention the role.\n"
        "2. Ask ONE question at a time. Wait for response.\n"
        "3. Keep questions relevant to the JD.\n"
        "4. Adjust difficulty based on candidate's answers.\n"
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
        
        logger.debug("Vapi API Request Payload:")
        logger.debug(json.dumps(payload, indent=2))
        
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
            logger.error(f"Vapi API error: status {response.status_code}, response: {response.text}")
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


@app.route('/api/vapi/generate-feedback', methods=['POST'])
@require_auth
def generate_interview_feedback():
    """Generate AI-powered feedback for completed mock interview"""
    try:
        data = request.get_json()
        job_description = data.get('jobDescription', '')
        transcript = data.get('transcript', '')
        duration_minutes = data.get('duration', 0)
        
        if not transcript:
            return jsonify({"error": "No interview transcript provided"}), 400
        
        # Create comprehensive feedback prompt for Gemini
        prompt = f"""
You are an expert interview coach analyzing a mock interview performance.

Job Description:
{job_description}

Interview Transcript:
{transcript}

Interview Duration: {duration_minutes} minutes

Analyze this interview and provide detailed feedback in the following JSON format:
{{
  "overall_score": <number 1-10>,
  "communication_score": <number 1-10>,
  "technical_score": <number 1-10>,
  "confidence_score": <number 1-10>,
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1", "weakness 2", "weakness 3"],
  "improvement_areas": ["area 1", "area 2", "area 3"],
  "summary": "A comprehensive 2-3 sentence summary of the interview performance",
  "detailed_feedback": "Detailed paragraph analyzing the candidate's responses, communication style, and technical knowledge",
  "recommended_actions": ["action 1", "action 2", "action 3"]
}}

Evaluate based on:
1. Communication clarity and professionalism
2. Technical knowledge and accuracy of answers
3. Confidence and composure
4. Relevance of answers to questions asked
5. Use of examples and specific details

Provide constructive, actionable feedback. Be encouraging but honest.
"""
        
        # Call Gemini API
        model_name = "gemini-2.5-flash"
        response = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={API_KEY}",
            json={
                "contents": [{"parts": [{"text": prompt + "\n\nIMPORTANT: Return PURE JSON only. Do not use markdown code blocks (```json). Do not add any conversational text."}]}],
                "generationConfig": {
                    "temperature": 0.5,
                    "maxOutputTokens": 2048,
                    "responseMimeType": "application/json"
                }
            },
            timeout=30
        )
        
        if not response.ok:
            logger.error(f"Gemini API error in feedback: status {response.status_code}, response: {response.text}")
            return jsonify({"error": "Failed to generate feedback"}), 500
        
        resp_json = response.json()
        candidates = resp_json.get("candidates")
        if not candidates or not isinstance(candidates, list) or len(candidates) == 0:
            return jsonify({"error": "Gemini response missing or empty 'candidates' field"}), 500
        
        content = candidates[0].get("content")
        if not content or not isinstance(content, dict):
            return jsonify({"error": "Gemini response missing or invalid 'content' in first candidate"}), 500
        
        parts = content.get("parts")
        if not parts or not isinstance(parts, list) or len(parts) == 0:
            return jsonify({"error": "Gemini response missing or empty 'parts' in content"}), 500
        
        feedback_text = parts[0].get("text")
        if feedback_text is None:
            return jsonify({"error": "Gemini response missing 'text' in first part"}), 500
        
        # Log the raw text for debugging
        logger.debug(f"Raw Gemini feedback text: {feedback_text}")

        # Robust JSON extraction
        try:
            # First try direct parse
            feedback_data = json.loads(feedback_text)
        except json.JSONDecodeError:
            # Try to find JSON block using regex
            import re
            json_match = re.search(r'\{.*\}', feedback_text, re.DOTALL)
            if json_match:
                try:
                    feedback_data = json.loads(json_match.group(0))
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse extracted JSON block: {e}")
                    raise e
            else:
                logger.error("No JSON object found in feedback text")
                raise json.JSONDecodeError("No JSON object found", feedback_text, 0)
        
        # Save feedback to database
        if db is not None:
            user = db['users'].find_one({"email": request.user_email})
            if user:
                feedback_doc = {
                    "user_id": user['_id'],
                    "email": request.user_email,
                    "job_description": job_description[:500],
                    "transcript": transcript,
                    "duration_minutes": duration_minutes,
                    "feedback": feedback_data,
                    "timestamp": datetime.now(timezone.utc)
                }
                db['interview_feedback'].insert_one(feedback_doc)
                
                # Log activity
                log_activity(db, request.user_email, "mock_interview", 
                           f"Interview Feedback - Score: {feedback_data.get('overall_score', 0)}/10")
        
        return jsonify(feedback_data)
        
    except json.JSONDecodeError as e:
        logger.error(f"JSON parsing error: {e}")
        return jsonify({"error": "Failed to parse AI response", "details": str(e)}), 500
    except Exception as e:
        logger.error(f"Error generating feedback: {e}", exc_info=True)
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
        logging.debug(f"Calling Gemini API with model: {model1} for resume generation")
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
            logger.error(f"Gemini API error in resume generation: status {response.status_code}, response: {response.text}")
            try:
                resp_json = response.json()
                return jsonify({"error": f"Gemini API returned status {response.status_code}", "details": resp_json}), 500
            except:
                return jsonify({"error": "Failed to generate resume", "raw_response": response.text}), 500
        
        resp_json = response.json()
        candidates = resp_json.get("candidates")
        if not candidates or not isinstance(candidates, list) or len(candidates) == 0:
            return jsonify({"error": "Gemini response missing or empty 'candidates' field", "raw": resp_json}), 500
        
        content = candidates[0].get("content")
        if not content or not isinstance(content, dict):
            return jsonify({"error": "Gemini response missing or invalid 'content' in first candidate", "raw": resp_json}), 500
        
        parts = content.get("parts")
        if not parts or not isinstance(parts, list) or len(parts) == 0:
            return jsonify({"error": "Gemini response missing or empty 'parts' in content", "raw": resp_json}), 500
        
        resume_text = parts[0].get("text")
        if resume_text is None:
            return jsonify({"error": "Gemini response missing 'text' in first part", "raw": resp_json}), 500
        
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
        logger.error(f"Error generating resume: {e}", exc_info=True)
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
        logger.debug(f"Gemini raw response: {repr(text)}")
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
        logger.error(f"Failed to parse Gemini response: {e}", exc_info=True)
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
        
        return jsonify({"user": serialize_doc(user)})
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
    reset_url = f"{FRONTEND_URL}/reset-password?token={token}"

    # Simulate sending email (replace with actual email service)
    logger.debug(f"Password reset link: {reset_url}")

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
        
        return jsonify(serialize_doc(stats))
    except Exception as e:
        logger.error(f"Error in dashboard: {e}", exc_info=True)
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
        
        return jsonify({"activities": serialize_doc(activities)})
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



SYSTEM_PROMPT = "You are an AI Interview Coach. Help the user prepare for interviews, answer questions, and provide feedback."

def get_gemini_chat_response(message, history=[]):
    """
    Get response from Gemini for chat with history and config
    """
    try:
        model_name = "gemini-2.5-flash" 
        # Strip newline/spaces just in case
        api_key = API_KEY.strip() if API_KEY else ""
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        
        # Build contents from history + current message
        contents = []
        

        formatted_history = []
        
        # Add system prompt
        formatted_history.append({
            "role": "user",
            "parts": [{"text": SYSTEM_PROMPT}]
        })
        formatted_history.append({
            "role": "model",
            "parts": [{"text": "Understood. I am read to help as an AI Interview Coach."}]
        })

        # Add conversation history
        for msg in history:
            role = "user" if msg.get("role") == "user" else "model"
            content = msg.get("content", "")
            formatted_history.append({
                "role": role,
                "parts": [{"text": content}]
            })
            
        # Add current message
        formatted_history.append({
            "role": "user",
            "parts": [{"text": message}]
        })

        payload = {
            "contents": formatted_history,
            "generationConfig": {
                "temperature": 0.7,
                "topK": 40,
                "topP": 0.95,
                "maxOutputTokens": 2048,
            },
            "safetySettings": [
                {
                    "category": "HARM_CATEGORY_HARASSMENT",
                    "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    "category": "HARM_CATEGORY_HATE_SPEECH",
                    "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                }
            ]
        }
        
        response = requests.post(url, json=payload, timeout=30)
        
        if response.status_code != 200:
            logging.error(f"Gemini API error: {response.text}")
            return "I'm having trouble connecting to my brain right now. Please try again later."
            
        data = response.json()
        try:
            return data["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError):
            logging.error(f"Unexpected Gemini response format: {data}")
            return "I received an unexpected response. Please try again."
            
    except Exception as e:
        logging.error(f"Error calling Gemini: {e}")
        return "Sorry, I encountered an error processing your request."


# --- Multi-Agent Chat Integration ---
from multi_agent_reference_app import (
    multi_agent_app, get_agent_by_name, GROQ_API_KEY
)

@app.route('/api/user/chat-message', methods=['POST'])
@require_auth
def save_chat_message():
    """
    Multi-agent chat endpoint (replaces Gemini single-agent logic).
    """
    if not GROQ_API_KEY:
        return jsonify({"error": "Multi-agent chat is not configured. GROQ_API_KEY is missing."}), 503
    if multi_agent_app is None:
        return jsonify({"error": "Multi-agent workflow failed to initialize."}), 503

    try:
        data = request.get_json() or {}
        session_id = data.get('session_id', 'default')
        message = data.get('message', '')
        role = data.get('role', 'user')
        messages = data.get('messages', [])
        current_agent_name = data.get('current_agent')

        if not message:
            return jsonify({"error": "Message cannot be empty"}), 400

        # Compose conversation history for multi-agent
        # If frontend does not send history, try to fetch from DB (optional, for compatibility)
        if not messages:
            # Optionally, fetch from DB if needed
            messages = []

        # Multi-agent workflow expects 'query', 'messages', 'current_agent'
        query = message
        try:
            # Try to continue with current agent if provided
            if current_agent_name:
                agent = get_agent_by_name(current_agent_name)
                if agent:
                    result = agent.check_and_respond(query, messages)
                    if result["should_handle"]:
                        return jsonify({
                            "query": query,
                            "response": result["response"],
                            "current_agent": current_agent_name,
                            "should_continue": True,
                            "status": "success"
                        })
            # Otherwise, route via workflow
            results = multi_agent_app.invoke({
                "query": query,
                "messages": messages,
                "current_agent": current_agent_name or "",
                "category": "",
                "response": "",
                "should_reroute": False
            })
            final_agent = results.get("current_agent", "unknown")
            return jsonify({
                "query": query,
                "category": results.get("category", "Unknown"),
                "response": results.get("response", "No response generated"),
                "current_agent": final_agent,
                "should_continue": True,
                "status": "success"
            })
        except Exception as e:
            import traceback
            traceback.print_exc()
            return jsonify({"error": f"Error processing query: {str(e)}"}), 500
    except Exception as e:
        import traceback
        logging.error(f"Error in save_chat_message: {e}")
        traceback.print_exc()
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

    # Serialize all ObjectId fields to strings
    user = serialize_doc(user) if user else None
    sub_details = serialize_doc(sub_details) if sub_details else None
    recent_activities = serialize_doc(recent_activities)
    
    # Normalize subscription fields for frontend
    if sub_details and isinstance(sub_details, dict):
        sub_details['tier'] = sub_details.get('subscription_tier', sub_details.get('tier', 'free'))
        sub_details['status'] = sub_details.get('payment_status', sub_details.get('subscription_status', 'active'))
        sub_details['start_date'] = sub_details.get('start_date', sub_details.get('subscription_start'))
        sub_details['end_date'] = sub_details.get('end_date', sub_details.get('subscription_end'))

    # Calculate chat sessions and messages (from chat_sessions collection)
    chat_sessions_col = db['chat_sessions']
    user_obj = users_col.find_one({'email': email})
    chat_sessions = list(chat_sessions_col.find({'user_id': user_obj['_id']})) if user_obj else []
    chat_sessions = serialize_doc(chat_sessions)
    
    total_chat_sessions = len(chat_sessions)
    total_chat_messages = sum(s.get('message_count', 0) for s in chat_sessions)
    
    # V2V evaluations
    v2v_evals = list(db['v2v_evaluations'].find({'user_id': user_obj['_id']})) if user_obj else []
    v2v_evals = serialize_doc(v2v_evals)

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

    # Add all login and logout activities for the frontend
    login_activities = [a for a in all_activities if a.get('activity_type') == 'login']
    logout_activities = [a for a in all_activities if a.get('activity_type') == 'logout']
    # Serialize ObjectId fields for login/logout activities
    login_activities = serialize_doc(login_activities)
    logout_activities = serialize_doc(logout_activities)

    response = {
        'user': user,
        'subscription': sub_details,
        'activities': recent_activities,
        'login_activities': login_activities,
        'logout_activities': logout_activities,
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
        'timeline': activity_timeline
    }

    return jsonify(response)

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


class MultiAgentState(TypedDict):
    """State structure for the LangGraph workflow."""
    query: str
    category: str
    response: str
    messages: list  # Conversation history
    current_agent: str  # Current active agent
    should_reroute: bool  # Whether to reroute to new agent

def trim_conversation_history(messages, max_messages=10):
    """Trim conversation history to retain only the latest messages."""
    return trim_messages(
        messages,
        max_tokens=max_messages,
        strategy="last",
        token_counter=len,
        start_on="human",
        include_system=True,
        allow_partial=False,
    )

def save_agent_output(data, filename):
    """Save data to a timestamped markdown file."""
    folder_name = "Agent_output"
    os.makedirs(folder_name, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    filename = f"{filename}_{timestamp}.md"
    file_path = os.path.join(folder_name, filename)
    
    with open(file_path, "w", encoding="utf-8") as file:
        file.write(data)
    
    return file_path

def parse_agent_continuity_response(content, agent_name="Agent"):
    """Shared robust JSON parser for agent continuity checks."""
    import re
    
    # Remove markdown code blocks if present
    content = re.sub(r'```json\s*', '', content)
    content = re.sub(r'```\s*$', '', content)
    content = content.strip()
    
    try:
        # Strategy 1: JSON at the start
        if content.startswith('{'):
            json_end = content.find('}')
            if json_end != -1:
                json_part = content[:json_end + 1]
                remaining_content = content[json_end + 1:].strip()
                
                try:
                    check_result = json.loads(json_part)
                    should_handle = check_result.get('should_handle', False)
                    reason = check_result.get('reason', '')
                    
                    if should_handle:
                        # Must have response content if should_handle is true
                        if remaining_content:
                            return {
                                "should_handle": True,
                                "response": remaining_content,
                                "reason": reason
                            }
                        else:
                            # No content provided, reroute
                            return {
                                "should_handle": False,
                                "response": None,
                                "reason": "No response content"
                            }
                    else:
                        return {
                            "should_handle": False,
                            "response": None,
                            "reason": reason
                        }
                except json.JSONDecodeError:
                    pass  # Try next strategy
        
        # Strategy 2: Find JSON pattern anywhere in text
        json_pattern = r'\{\s*"should_handle"\s*:\s*(true|false)\s*,\s*"reason"\s*:\s*"([^"]+)"\s*\}'
        match = re.search(json_pattern, content, re.IGNORECASE)
        
        if match:
            should_handle = match.group(1).lower() == 'true'
            reason = match.group(2)
            
            # Extract response after JSON
            json_end_pos = match.end()
            remaining_content = content[json_end_pos:].strip()
            
            if should_handle:
                if remaining_content:
                    return {
                        "should_handle": True,
                        "response": remaining_content,
                        "reason": reason
                    }
                else:
                    return {
                        "should_handle": False,
                        "response": None,
                        "reason": "No response after JSON"
                    }
            else:
                return {
                    "should_handle": False,
                    "response": None,
                    "reason": reason
                }
        
        # Strategy 3: Look for explicit rejection signals
        content_lower = content.lower()
        if any(phrase in content_lower for phrase in [
            '"should_handle": false',
            "cannot handle",
            "not my domain",
            "not related to",
            "outside my expertise"
        ]):
            return {
                "should_handle": False,
                "response": None,
                "reason": "Explicit rejection detected"
            }
        
        # Fallback: No valid JSON found - safer to reroute
        print(f"WARNING [{agent_name}]: No valid JSON found. Content: {content[:150]}...")
        return {
            "should_handle": False,
            "response": None,
            "reason": "No valid continuity check format"
        }
        
    except Exception as e:
        print(f"ERROR [{agent_name}]: Parse error - {str(e)}")
        return {
            "should_handle": False,
            "response": None,
            "reason": f"Parse error: {str(e)}"
        }

class LearningResourceAgent:
    """Agent for handling learning resources and Q&A sessions."""
    
    AGENT_NAME = "learning_resource"
    
    def __init__(self, system_message):
        self.model = ChatGroq(
            model="llama-3.3-70b-versatile",
            groq_api_key=GROQ_API_KEY,
            temperature=0.5
        )
        self.system_message = system_message
        
        # Create search tool using @tool decorator
        @langchain_tool
        def search_web(query: str) -> str:
            """Search the web for information."""
            search = DuckDuckGoSearchResults(max_results=5)
            results = search.invoke(query)
            return str(results)
        
        self.tools = [search_web]
    
    def check_and_respond(self, user_input, conversation_history):
        """Check if query should be handled by this agent and respond in single LLM call."""
        # Build conversation with history
        messages_list = [SystemMessage(content=self.system_message)]
        
        # Add history (trimmed to last 10 messages)
        if conversation_history:
            history_trimmed = conversation_history[-20:]  # Last 10 pairs (20 messages)
            for msg in history_trimmed:
                if msg.get('role') == 'user':
                    messages_list.append(HumanMessage(content=msg['content']))
                elif msg.get('role') == 'assistant':
                    messages_list.append(AIMessage(content=msg['content']))
        
        # Improved continuity check prompt
        continuity_prompt = f"""User Query: {user_input}

---
BEFORE RESPONDING: Analyze if this query is about learning Generative AI, tutorials, technical questions, or coding help.

You SHOULD HANDLE queries like:
- "Teach me about LangChain"
- "How does RAG work?"
- "Create a tutorial on..."
- "Explain the concept of..."
- Technical Q&A about AI/ML

You should NOT HANDLE queries about:
- Resume writing/building (route to Resume Builder)
- Interview preparation/questions (route to Interview Coach)
- Job searching (route to Job Search Agent)
- General greetings only (route to General Agent)

Respond with JSON ONLY followed by your answer:
{{
  "should_handle": true/false,
  "reason": "1-2 word reason"
}}

If should_handle is true, write your detailed response AFTER the JSON.
If should_handle is false, write ONLY the JSON, nothing else.
"""
        messages_list.append(HumanMessage(content=continuity_prompt))
        
        response = self.model.invoke(messages_list)
        content = response.content.strip()
        
        # Use shared parsing function
        return parse_agent_continuity_response(content, "LearningResourceAgent")
    
    def TutorialAgent(self, user_input):
        """Create a comprehensive tutorial using web search and AI."""
        # Create agent using the NEW API
        agent = create_agent(
            model=self.model,
            tools=self.tools,
            system_prompt=self.system_message
        )
        
        response = agent.invoke({"messages": [{"role": "user", "content": user_input}]})
        final_response = response['messages'][-1].content
        
        # Clean and save
        final_response = final_response.replace("```markdown", "").replace("```", "").strip()
        path = save_agent_output(final_response, 'Tutorial')
        return {"content": final_response, "file_path": path}
    
    def QueryBot(self, user_input):
        """Handle Q&A - single turn for REST API."""
        # Use direct model invocation for Q&A
        conversation = [SystemMessage(content=self.system_message)]
        conversation.append(HumanMessage(content=user_input))
        
        response = self.model.invoke(conversation)
        return {"content": response.content}

class InterviewAgentClass:
    """Agent for interview preparation and mock interviews."""
    
    AGENT_NAME = "interview_preparation"
    
    def __init__(self, system_message):
        self.model = ChatGroq(
            model="llama-3.1-8b-instant",
            groq_api_key=GROQ_API_KEY,
            temperature=0.5
        )
        self.system_message = system_message
        
        # Create search tool
        @langchain_tool
        def search_interview_topics(query: str) -> str:
            """Search for interview topics and questions."""
            search = DuckDuckGoSearchResults(max_results=5)
            results = search.invoke(query)
            return str(results)
        
        self.tools = [search_interview_topics]
    
    def check_and_respond(self, user_input, conversation_history):
        """Check if query should be handled by this agent and respond in single LLM call."""
        # Build conversation with history
        messages_list = [SystemMessage(content=self.system_message)]
        
        # Add history (trimmed to last 10 messages)
        if conversation_history:
            history_trimmed = conversation_history[-20:]  # Last 10 pairs (20 messages)
            for msg in history_trimmed:
                if msg.get('role') == 'user':
                    messages_list.append(HumanMessage(content=msg['content']))
                elif msg.get('role') == 'assistant':
                    messages_list.append(AIMessage(content=msg['content']))
        
        # Improved continuity check prompt
        continuity_prompt = f"""User Query: {user_input}

---
BEFORE RESPONDING: Analyze if this query is about interview preparation, mock interviews, or interview questions for job hunting.

You SHOULD HANDLE queries like:
- "Help me prepare for interviews"
- "Mock interview for data scientist"
- "Common interview questions for..."
- "Practice interviewing"
- "Interview tips" or "behavioral questions"

You should NOT HANDLE queries about:
- Learning/tutorials (route to Learning Assistant)
- Resume writing (route to Resume Builder)
- Job searching/finding jobs (route to Job Search Agent)
- Simple greetings (route to General Agent)

Respond with JSON ONLY followed by your answer:
{{
  "should_handle": true/false,
  "reason": "1-2 word reason"
}}

If should_handle is true, write your detailed response AFTER the JSON.
If should_handle is false, write ONLY the JSON, nothing else.
"""
        messages_list.append(HumanMessage(content=continuity_prompt))
        
        response = self.model.invoke(messages_list)
        content = response.content.strip()
        
        # Use shared parsing function
        return parse_agent_continuity_response(content, "InterviewAgent")
    
    def Interview_questions(self, user_input):
        """Generate curated interview questions."""
        agent = create_agent(
            model=self.model,
            tools=self.tools,
            system_prompt=self.system_message
        )
        
        messages = [{"role": "user", "content": user_input}]
        response = agent.invoke({"messages": messages})
        
        final_response = response['messages'][-1].content
        final_response = final_response.replace("```markdown", "").replace("```", "").strip()
        
        path = save_agent_output(final_response, 'Interview_Questions')
        return {"content": final_response, "file_path": path}
    
    def Mock_Interview(self, user_input):
        """Conduct a mock interview session - single turn for REST API."""
        model = self.model
        conversation = [SystemMessage(content=self.system_message)]
        
        # Add user's initial query
        conversation.append(HumanMessage(content=user_input))
        
        response = model.invoke(conversation)
        
        return {"content": response.content}

class ResumeMakerAgent:
    """Agent for creating personalized resumes."""
    
    AGENT_NAME = "resume_making"
    
    def __init__(self, system_message):
        self.model = ChatGroq(
            model="llama-3.3-70b-versatile",
            groq_api_key=GROQ_API_KEY,
            temperature=0.5
        )
        self.system_message = system_message
        
        # Create search tool for trending keywords
        @langchain_tool
        def search_resume_trends(query: str) -> str:
            """Search for trending resume keywords and job requirements."""
            search = DuckDuckGoSearchResults(max_results=3)
            results = search.invoke(query)
            return str(results)
        
        self.tools = [search_resume_trends]
    
    def check_and_respond(self, user_input, conversation_history):
        """Check if query should be handled by this agent and respond in single LLM call."""
        # Build conversation with history
        messages_list = [SystemMessage(content=self.system_message)]
        
        # Add history (trimmed to last 10 messages)
        if conversation_history:
            history_trimmed = conversation_history[-20:]  # Last 10 pairs (20 messages)
            for msg in history_trimmed:
                if msg.get('role') == 'user':
                    messages_list.append(HumanMessage(content=msg['content']))
                elif msg.get('role') == 'assistant':
                    messages_list.append(AIMessage(content=msg['content']))
        
        # Improved continuity check prompt
        continuity_prompt = f"""User Query: {user_input}

---
BEFORE RESPONDING: Analyze if this query is about resume creation, resume improvement, CV editing, or career profile building.

You SHOULD HANDLE queries like:
- "Help me build a resume"
- "Create a resume for..."
- "Improve my CV"
- "What should I include in my resume?"
- "Resume tips" or "ATS optimization"

You should NOT HANDLE queries about:
- Learning/tutorials (route to Learning Assistant)
- Interview prep (route to Interview Coach)
- Job searching/finding (route to Job Search Agent)
- Simple greetings (route to General Agent)

Respond with JSON ONLY followed by your answer:
{{
  "should_handle": true/false,
  "reason": "1-2 word reason"
}}

If should_handle is true, write your detailed response AFTER the JSON.
If should_handle is false, write ONLY the JSON, nothing else.
"""
        messages_list.append(HumanMessage(content=continuity_prompt))
        
        response = self.model.invoke(messages_list)
        content = response.content.strip()
        
        # Use shared parsing function
        return parse_agent_continuity_response(content, "ResumeAgent")
    
    def Create_Resume(self, user_input):
        """Create a resume through AI - single turn for REST API."""
        agent = create_agent(
            model=self.model,
            tools=self.tools,
            system_prompt=self.system_message
        )
        
        messages = [{"role": "user", "content": user_input}]
        response = agent.invoke({"messages": messages})
        
        final_output = response['messages'][-1].content
        final_output = final_output.replace("```markdown", "").replace("```", "").strip()
        path = save_agent_output(final_output, 'Resume')
        
        return {"content": final_output, "file_path": path}

class GeneralAgent:
    """Agent for handling general queries, greetings, and introductions."""
    
    AGENT_NAME = "general"
    
    def __init__(self, system_message):
        self.model = ChatGroq(
            model="llama-3.1-8b-instant",
            groq_api_key=GROQ_API_KEY,
            temperature=0.7
        )
        self.system_message = system_message
    
    def check_and_respond(self, user_input, conversation_history):
        """Check if query should be handled by this agent and respond in single LLM call."""
        # Build conversation with history
        messages_list = [SystemMessage(content=self.system_message)]
        
        # Add history (trimmed to last 10 messages)
        if conversation_history:
            history_trimmed = conversation_history[-20:]  # Last 10 pairs (20 messages)
            for msg in history_trimmed:
                if msg.get('role') == 'user':
                    messages_list.append(HumanMessage(content=msg['content']))
                elif msg.get('role') == 'assistant':
                    messages_list.append(AIMessage(content=msg['content']))
        
        # Add current query with improved continuity check prompt
        continuity_prompt = f"""User Query: {user_input}

---
BEFORE RESPONDING: Analyze if this query is a general greeting, introduction, small talk, or asking what you can do.

You SHOULD HANDLE queries like:
- Greetings: "hi", "hello", "hey"
- Introduction requests: "who are you?", "what are you?"
- Capability questions: "what can you do?", "how can you help?"
- Small talk: "how are you?", "nice to meet you"

You should NOT HANDLE queries about:
- Learning/tutorials (route to Learning Assistant)
- Resume writing (route to Resume Builder)
- Interview prep (route to Interview Coach)
- Job searching (route to Job Search Agent)

Respond with JSON ONLY followed by your answer:
{{
  "should_handle": true/false,
  "reason": "1-2 word reason"
}}

If should_handle is true, write your helpful response AFTER the JSON.
If should_handle is false, write ONLY the JSON, nothing else.
"""
        messages_list.append(HumanMessage(content=continuity_prompt))
        
        response = self.model.invoke(messages_list)
        content = response.content.strip()
        
        # Use shared parsing function
        return parse_agent_continuity_response(content, "GeneralAgent")

class JobSearchAgent:
    """Agent for job search assistance."""
    
    AGENT_NAME = "job_search"
    
    def __init__(self):
        self.model = ChatGroq(
            model="llama-3.3-70b-versatile",
            groq_api_key=GROQ_API_KEY,
            temperature=0.3
        )
        self.search_tool = DuckDuckGoSearchResults(max_results=10)
    
    def check_and_respond(self, user_input, conversation_history):
        """Check if query should be handled by this agent and respond in single LLM call."""
        # Build conversation with history
        messages_list = []
        
        # Add history (trimmed to last 10 messages)
        if conversation_history:
            history_trimmed = conversation_history[-20:]  # Last 10 pairs (20 messages)
            for msg in history_trimmed:
                if msg.get('role') == 'user':
                    messages_list.append(HumanMessage(content=msg['content']))
                elif msg.get('role') == 'assistant':
                    messages_list.append(AIMessage(content=msg['content']))
        
        # Improved continuity check prompt
        continuity_prompt = f"""User Query: {user_input}

---
BEFORE RESPONDING: Analyze if this query is about job search, job listings, finding employment opportunities, or job market research.

You SHOULD HANDLE queries like:
- "Find jobs for me"
- "Search for data scientist positions"
- "Job openings in..."
- "Available jobs for..."
- "Job market for..."

You should NOT HANDLE queries about:
- Learning/tutorials (route to Learning Assistant)
- Interview prep (route to Interview Coach)
- Resume building (route to Resume Builder)
- Simple greetings (route to General Agent)

Respond with JSON ONLY followed by your answer:
{{
  "should_handle": true/false,
  "reason": "1-2 word reason"
}}

If should_handle is true, I will perform the job search and provide results.
If should_handle is false, write ONLY the JSON, nothing else.
"""
        messages_list.append(HumanMessage(content=continuity_prompt))
        
        response = self.model.invoke(messages_list)
        content = response.content.strip()
        
        # Use shared parsing function
        result = parse_agent_continuity_response(content, "JobSearchAgent")
        
        # If should handle, actually perform job search
        if result["should_handle"]:
            try:
                print(f"JobSearchAgent: Performing search for: {user_input}")
                search_results = self.search_tool.invoke(user_input)
                prompt = ChatPromptTemplate.from_template(
                    "Refactor the following job search results into a well-structured response. "
                    "Include job titles, companies, links, and brief descriptions.\n\n"
                    "Search Results: {results}"
                )
                chain = prompt | self.model
                jobs_response = chain.invoke({"results": search_results}).content
                
                return {
                    "should_handle": True,
                    "response": jobs_response,
                    "reason": result["reason"]
                }
            except Exception as e:
                print(f"ERROR in job search: {str(e)}")
                return {
                    "should_handle": True,
                    "response": f"I can help you search for jobs. Please provide more details like job role and location.",
                    "reason": result["reason"]
                }
        else:
            return result
    
    def find_jobs(self, user_input):
        """Search for jobs and format results."""
        results = self.search_tool.invoke(user_input)
        
        prompt = ChatPromptTemplate.from_template(
            "Refactor the following job search results into a well-structured markdown file. "
            "Include job titles, companies, links, and brief descriptions.\n\n"
            "Search Results: {results}"
        )
        
        chain = prompt | self.model
        jobs = chain.invoke({"results": results}).content
        
        jobs = jobs.replace("```markdown", "").replace("```", "").strip()
        path = save_agent_output(jobs, 'Job_Search')
        return {"content": jobs, "file_path": path}

# Helper function to get agent instance by name
def get_agent_by_name(agent_name):
    """Get agent instance and system message by agent name."""
    agent_configs = {
        "general": {
            "class": GeneralAgent,
            "system_message": (
                "You are PrepWise AI, a personalized AI career coach dedicated to helping users crack their dream job offers. "
                "You are friendly, supportive, and motivating. When users greet you or ask general questions, "
                "respond warmly and introduce your capabilities: learning resources, interview preparation, resume building, and job search assistance. "
                "Keep your responses concise, engaging, and encouraging. Guide users to explore your specialized features."
            )
        },
        "learning_resource": {
            "class": LearningResourceAgent,
            "system_message": (
                "You are an expert Generative AI Engineer with extensive training and problem-solving experience. "
                "Provide insightful, detailed solutions through interactive conversation."
            )
        },
        "tutorial": {
            "class": LearningResourceAgent,
            "system_message": (
                "You are a Senior Generative AI Developer and experienced technical blogger. "
                "Create comprehensive tutorials with clear explanations, well-commented code examples, "
                "and reference links. Output in markdown format."
            )
        },
        "interview_preparation": {
            "class": InterviewAgentClass,
            "system_message": (
                "You are an expert in Generative AI interview preparation. "
                "Provide curated interview questions with explanations, references, and links. "
                "Conduct mock interviews with realistic scenarios."
            )
        },
        "resume_making": {
            "class": ResumeMakerAgent,
            "system_message": (
                "You are an expert resume consultant specializing in AI and tech roles. "
                "Based on the user's request, create a comprehensive ATS-optimized resume "
                "with trending keywords in markdown format. Ask for any missing details if needed."
            )
        },
        "job_search": {
            "class": JobSearchAgent,
            "system_message": None  # JobSearchAgent doesn't use system_message in __init__
        }
    }
    
    config = agent_configs.get(agent_name)
    if not config:
        return None
    
    if config["system_message"]:
        return config["class"](config["system_message"])
    else:
        return config["class"]()

# Workflow Node Functions
def categorize_query(state: MultiAgentState) -> MultiAgentState:
    """Categorize user query into main categories."""
    if not GROQ_API_KEY:
        return {"category": "error"}
    
    llm_groq = ChatGroq(
        model="llama-3.1-8b-instant",
        groq_api_key=GROQ_API_KEY,
        temperature=0.5
    )
    
    prompt = ChatPromptTemplate.from_template(
        "Categorize the following query into ONE category (respond with number only):\n"
        "0: General greeting, introduction, or casual conversation (hi, hello, who are you, what can you do)\n"
        "1: Learn Generative AI Technology\n"
        "2: Resume Making\n"
        "3: Interview Preparation\n"
        "4: Job Search\n\n"
        "Examples:\n"
        "'Hi there!' -> 0\n"
        "'Who are you?' -> 0\n"
        "'What can you help me with?' -> 0\n"
        "'Teach me about LangChain' -> 1\n"
        "'Help with my resume' -> 2\n"
        "'Practice interview questions' -> 3\n"
        "'Find AI jobs' -> 4\n\n"
        "Query: {query}\n\n"
        "Category (number only):"
    )
    
    chain = prompt | llm_groq
    category = chain.invoke({"query": state["query"]}).content.strip()
    return {"category": category}

def handle_learning_resource_node(state: MultiAgentState) -> MultiAgentState:
    """Sub-categorize learning queries."""
    if not GROQ_API_KEY:
        return {"category": "error"}
    
    llm_groq = ChatGroq(
        model="llama-3.1-8b-instant",
        groq_api_key=GROQ_API_KEY,
        temperature=0.5
    )
    
    prompt = ChatPromptTemplate.from_template(
        "Categorize this learning query (respond with one word only):\n"
        "- Tutorial: Create blog/documentation\n"
        "- Question: General Q&A\n\n"
        "Examples:\n"
        "'Create a LangChain tutorial' -> Tutorial\n"
        "'What is RAG?' -> Question\n\n"
        "Query: {query}\n\n"
        "Sub-category:"
    )
    
    chain = prompt | llm_groq
    response = chain.invoke({"query": state["query"]}).content.strip()
    return {"category": response}

def handle_interview_preparation_node(state: MultiAgentState) -> MultiAgentState:
    """Sub-categorize interview queries."""
    if not GROQ_API_KEY:
        return {"category": "error"}
    
    llm_groq = ChatGroq(
        model="llama-3.1-8b-instant",
        groq_api_key=GROQ_API_KEY,
        temperature=0.5
    )
    
    prompt = ChatPromptTemplate.from_template(
        "Categorize this interview query (respond with one word only):\n"
        "- Question: Interview topic questions\n\n"
        "Query: {query}\n\n"
        "Sub-category:"
    )
    
    chain = prompt | llm_groq
    response = chain.invoke({"query": state["query"]}).content.strip()
    return {"category": response}

# Response Generation Functions
def general_agent_node(state: MultiAgentState) -> MultiAgentState:
    """Handle general queries, greetings, and introductions."""
    agent = get_agent_by_name("general")
    messages = state.get("messages", [])
    
    result = agent.check_and_respond(state["query"], messages)
    
    return {
        "response": result["response"],
        "current_agent": "general",
        "should_reroute": not result["should_handle"]
    }

def tutorial_agent_node(state: MultiAgentState) -> MultiAgentState:
    """Generate tutorials for learning."""
    agent = get_agent_by_name("tutorial")
    messages = state.get("messages", [])
    
    result = agent.check_and_respond(state["query"], messages)
    
    return {
        "response": result["response"],
        "current_agent": "tutorial",
        "should_reroute": not result["should_handle"]
    }

def ask_query_bot_node(state: MultiAgentState) -> MultiAgentState:
    """Handle Q&A sessions."""
    agent = get_agent_by_name("learning_resource")
    messages = state.get("messages", [])
    
    result = agent.check_and_respond(state["query"], messages)
    
    return {
        "response": result["response"],
        "current_agent": "learning_resource",
        "should_reroute": not result["should_handle"]
    }

def interview_topics_questions_node(state: MultiAgentState) -> MultiAgentState:
    """Generate interview questions."""
    agent = get_agent_by_name("interview_preparation")
    messages = state.get("messages", [])
    
    result = agent.check_and_respond(state["query"], messages)
    
    return {
        "response": result["response"],
        "current_agent": "interview_preparation",
        "should_reroute": not result["should_handle"]
    }

def mock_interview_node(state: MultiAgentState) -> MultiAgentState:
    """Conduct mock interview."""
    agent = get_agent_by_name("interview_preparation")
    messages = state.get("messages", [])
    
    result = agent.check_and_respond(state["query"], messages)
    
    return {
        "response": result["response"],
        "current_agent": "interview_preparation",
        "should_reroute": not result["should_handle"]
    }

def handle_resume_making_node(state: MultiAgentState) -> MultiAgentState:
    """Create customized resumes."""
    agent = get_agent_by_name("resume_making")
    messages = state.get("messages", [])
    
    result = agent.check_and_respond(state["query"], messages)
    
    return {
        "response": result["response"],
        "current_agent": "resume_making",
        "should_reroute": not result["should_handle"]
    }

def job_search_node(state: MultiAgentState) -> MultiAgentState:
    """Search for jobs."""
    agent = get_agent_by_name("job_search")
    messages = state.get("messages", [])
    
    result = agent.check_and_respond(state["query"], messages)
    
    return {
        "response": result["response"],
        "current_agent": "job_search",
        "should_reroute": not result["should_handle"]
    }

# Routing Functions
def route_query(state: MultiAgentState) -> str:
    """Route based on main category."""
    category = state["category"].strip()
    
    if '0' in category:
        return "general_agent"
    elif '1' in category:
        return "handle_learning_resource"
    elif '2' in category:
        return "handle_resume_making"
    elif '3' in category:
        return "handle_interview_preparation"
    elif '4' in category:
        return "job_search"
    else:
        return "general_agent"

def route_learning(state: MultiAgentState) -> str:
    """Route learning sub-category."""
    category = state["category"].lower()
    
    if 'question' in category:
        return "ask_query_bot"
    elif 'tutorial' in category:
        return "tutorial_agent"
    else:
        return "ask_query_bot"

def route_interview(state: MultiAgentState) -> str:
    """Route interview sub-category."""
    category = state["category"].lower()
    
    if 'question' in category:
        return "interview_topics_questions"
    elif 'mock' in category:
        return "mock_interview"
    else:
        return "interview_topics_questions"

# Build LangGraph Workflow
def build_multi_agent_workflow():
    """Build and compile the multi-agent workflow."""
    if not GROQ_API_KEY:
        return None
    
    workflow = StateGraph(MultiAgentState)

    # Add all nodes
    workflow.add_node("categorize", categorize_query)
    workflow.add_node("general_agent", general_agent_node)
    workflow.add_node("handle_learning_resource", handle_learning_resource_node)
    workflow.add_node("handle_resume_making", handle_resume_making_node)
    workflow.add_node("handle_interview_preparation", handle_interview_preparation_node)
    workflow.add_node("job_search", job_search_node)
    workflow.add_node("interview_topics_questions", interview_topics_questions_node)
    workflow.add_node("mock_interview", mock_interview_node)
    workflow.add_node("tutorial_agent", tutorial_agent_node)
    workflow.add_node("ask_query_bot", ask_query_bot_node)

    # Set entry point
    workflow.add_edge(START, "categorize")

    # Add conditional edges from categorize
    workflow.add_conditional_edges(
        "categorize",
        route_query,
        {
            "general_agent": "general_agent",
            "handle_learning_resource": "handle_learning_resource",
            "handle_resume_making": "handle_resume_making",
            "handle_interview_preparation": "handle_interview_preparation",
            "job_search": "job_search"
        }
    )

    # Add conditional edges for learning
    workflow.add_conditional_edges(
        "handle_learning_resource",
        route_learning,
        {
            "tutorial_agent": "tutorial_agent",
            "ask_query_bot": "ask_query_bot",
        }
    )

    # Add conditional edges for interview
    workflow.add_conditional_edges(
        "handle_interview_preparation",
        route_interview,
        {
            "interview_topics_questions": "interview_topics_questions",
            "mock_interview": "mock_interview",
        }
    )

    # Add edges to END
    workflow.add_edge("general_agent", END)
    workflow.add_edge("handle_resume_making", END)
    workflow.add_edge("job_search", END)
    workflow.add_edge("interview_topics_questions", END)
    workflow.add_edge("mock_interview", END)
    workflow.add_edge("ask_query_bot", END)
    workflow.add_edge("tutorial_agent", END)

    # Compile the workflow
    return workflow.compile()

# Initialize the multi-agent workflow
multi_agent_app = build_multi_agent_workflow()

@app.route('/multi-agent/chat', methods=['POST'])
def multi_agent_chat():
    """Process user query through the multi-agent workflow with conversation history."""
    if not GROQ_API_KEY:
        return jsonify({"error": "Multi-agent chat is not configured. GROQ_API_KEY is missing."}), 503
    
    if multi_agent_app is None:
        return jsonify({"error": "Multi-agent workflow failed to initialize."}), 503
    
    data = request.get_json()
    query = data.get('query')
    messages = data.get('messages', [])  # Conversation history from frontend
    current_agent_name = data.get('current_agent')  # Current active agent

    print("Received query:", query)
    print("Current agent:", current_agent_name)
    
    if not query:
        return jsonify({"error": "Query is required"}), 400
    
    try:
        # Check if we have a current agent and should try to continue with it
        if current_agent_name:
            agent = get_agent_by_name(current_agent_name)
            
            if agent:
                # Ask agent if it should handle this query
                result = agent.check_and_respond(query, messages)

                print("final response :", {
                    "query": query,
                    "category": result.get("category", "Unknown"),
                    "response": result.get("response", "No response generated"),
                    "current_agent": current_agent_name,
                    "should_continue": True,
                    "status": "success"
                })
                
                # If agent can handle the query
                if result["should_handle"]:
                    return jsonify({
                        "query": query,
                        "response": result["response"],
                        "current_agent": current_agent_name,
                        "should_continue": True,
                        "status": "success"
                    })
                else:
                    # Agent says it cannot handle, need to reroute
                    print(f"Agent '{current_agent_name}' cannot handle query. Reason: {result.get('reason', 'N/A')}")
                    # Fall through to routing workflow
        
        # No current agent or agent cannot handle - go through routing workflow
        results = multi_agent_app.invoke({
            "query": query,
            "messages": messages,
            "current_agent": current_agent_name or "",
            "category": "",
            "response": "",
            "should_reroute": False
        })
        
        # Extract the agent that handled the request
        final_agent = results.get("current_agent", "unknown")

        print("final response :", {
            "query": query,
            "category": results.get("category", "Unknown"),
            "response": results.get("response", "No response generated"),
            "current_agent": final_agent,
            "should_continue": True,
            "status": "success"
        })
        
        return jsonify({
            "query": query,
            "category": results.get("category", "Unknown"),
            "response": results.get("response", "No response generated"),
            "current_agent": final_agent,
            "should_continue": True,
            "status": "success"
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Error processing query: {str(e)}"}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)