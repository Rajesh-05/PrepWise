"""
Authentication middleware and helper functions for user activity tracking
"""

import jwt
from functools import wraps
from flask import request, jsonify
from datetime import datetime, timezone
import os
from bson import ObjectId

JWT_SECRET = os.getenv("JWT_SECRET") or "jwtsecret"

# Token blacklist (in production, use Redis)
token_blacklist = set()


def verify_token(token):
    """
    Verify JWT token and return payload
    """
    try:
        if token in token_blacklist:
            return None, "Token has been revoked"
        
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload, None
    except jwt.ExpiredSignatureError:
        return None, "Token has expired"
    except jwt.InvalidTokenError:
        return None, "Invalid token"


def require_auth(f):
    """
    Decorator to require authentication for routes
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        
        if not auth_header.startswith('Bearer '):
            return jsonify({"error": "Missing or invalid authorization header"}), 401
        
        token = auth_header.split(' ', 1)[1]
        payload, error = verify_token(token)
        
        if error:
            return jsonify({"error": error}), 401
        
        # Add user info to request context
        request.user = payload
        request.user_email = payload.get('email')
        request.user_id = payload.get('sub')
        
        return f(*args, **kwargs)
    
    return decorated_function


def revoke_token(token):
    """
    Add token to blacklist (logout)
    """
    token_blacklist.add(token)


def log_activity(db, user_email, activity_type, activity_name, metadata=None):
    """
    Log user activity to database
    """
    try:
        # Get user_id from email
        user = db['users'].find_one({"email": user_email})
        if not user:
            return False
        
        activity = {
            "user_id": user['_id'],
            "email": user_email,
            "activity_type": activity_type,
            "activity_name": activity_name,
            "metadata": metadata or {},
            "timestamp": datetime.now(timezone.utc)
        }
        
        db['user_activities'].insert_one(activity)
        return True
    except Exception as e:
        print(f"Error logging activity: {e}")
        return False


def log_question_bank_activity(db, user_email, company, role, domain, experience_level, 
                                question_type, difficulty, num_questions, questions_generated):
    """
    Log question bank activity
    """
    try:
        user = db['users'].find_one({"email": user_email})
        if not user:
            return False
        
        activity = {
            "user_id": user['_id'],
            "email": user_email,
            "company": company,
            "role": role,
            "domain": domain,
            "experience_level": experience_level,
            "question_type": question_type,
            "difficulty": difficulty,
            "num_questions": num_questions,
            "questions_generated": questions_generated,
            "timestamp": datetime.now(timezone.utc)
        }
        
        db['question_bank_activities'].insert_one(activity)
        return True
    except Exception as e:
        print(f"Error logging question bank activity: {e}")
        return False


def log_resume_activity(db, user_email, activity_type, resume_filename=None, 
                        job_description=None, ats_score=None, missing_keywords=None, 
                        suggestions=None, resume_data=None):
    """
    Log resume activity
    """
    try:
        user = db['users'].find_one({"email": user_email})
        if not user:
            return False
        
        activity = {
            "user_id": user['_id'],
            "email": user_email,
            "activity_type": activity_type,
            "resume_filename": resume_filename,
            "job_description": job_description,
            "ats_score": ats_score,
            "missing_keywords": missing_keywords or [],
            "suggestions": suggestions,
            "resume_data": resume_data,
            "timestamp": datetime.now(timezone.utc)
        }
        
        db['resume_activities'].insert_one(activity)
        return True
    except Exception as e:
        print(f"Error logging resume activity: {e}")
        return False


def log_mock_interview(db, user_email, interview_type, job_description, duration_minutes,
                       vapi_assistant_id=None, vapi_call_id=None, overall_rating=None,
                       communication_score=None, technical_score=None, confidence_score=None,
                       feedback=None, transcript=None):
    """
    Log mock interview session
    """
    try:
        user = db['users'].find_one({"email": user_email})
        if not user:
            return False
        
        interview = {
            "user_id": user['_id'],
            "email": user_email,
            "interview_type": interview_type,
            "job_description": job_description,
            "duration_minutes": duration_minutes,
            "vapi_assistant_id": vapi_assistant_id,
            "vapi_call_id": vapi_call_id,
            "overall_rating": overall_rating,
            "communication_score": communication_score,
            "technical_score": technical_score,
            "confidence_score": confidence_score,
            "feedback": feedback,
            "transcript": transcript,
            "timestamp": datetime.now(timezone.utc)
        }
        
        db['mock_interviews'].insert_one(interview)
        return True
    except Exception as e:
        print(f"Error logging mock interview: {e}")
        return False


def log_job_search(db, user_email, search_query, location, num_jobs_requested, 
                   num_jobs_found, saved_jobs=None):
    """
    Log job search activity
    """
    try:
        user = db['users'].find_one({"email": user_email})
        if not user:
            return False
        
        search = {
            "user_id": user['_id'],
            "email": user_email,
            "search_query": search_query,
            "location": location,
            "num_jobs_requested": num_jobs_requested,
            "num_jobs_found": num_jobs_found,
            "saved_jobs": saved_jobs or [],
            "applied_jobs": [],
            "timestamp": datetime.now(timezone.utc)
        }
        
        db['job_searches'].insert_one(search)
        return True
    except Exception as e:
        print(f"Error logging job search: {e}")
        return False


def update_chat_session(db, user_email, session_id, message, role='user'):
    """
    Update or create chat session
    """
    try:
        user = db['users'].find_one({"email": user_email})
        if not user:
            return False
        
        message_obj = {
            "role": role,
            "content": message,
            "timestamp": datetime.now(timezone.utc)
        }
        
        # Check if session exists
        session = db['chat_sessions'].find_one({
            "user_id": user['_id'],
            "session_id": session_id
        })
        
        if session:
            # Update existing session
            db['chat_sessions'].update_one(
                {"_id": session['_id']},
                {
                    "$push": {"messages": message_obj},
                    "$inc": {"message_count": 1},
                    "$set": {"last_message_at": datetime.now(timezone.utc)}
                }
            )
        else:
            # Create new session
            new_session = {
                "user_id": user['_id'],
                "email": user_email,
                "session_id": session_id,
                "message_count": 1,
                "topic": "General Chat",
                "messages": [message_obj],
                "started_at": datetime.now(timezone.utc),
                "last_message_at": datetime.now(timezone.utc)
            }
            db['chat_sessions'].insert_one(new_session)
        
        return True
    except Exception as e:
        print(f"Error updating chat session: {e}")
        return False


def get_user_stats(db, user_email):
    """
    Get comprehensive user statistics for dashboard
    """
    try:
        user = db['users'].find_one({"email": user_email})
        if not user:
            return None
        
        user_id = user['_id']
        
        stats = {
            "user_info": {
                "email": user.get('email'),
                "name": user.get('name'),
                "firstName": user.get('firstName'),
                "lastName": user.get('lastName'),
                "picture": user.get('picture'),
                "subscription_tier": user.get('subscription_tier', 'free'),
                "member_since": user.get('createdAt'),
                "last_login": user.get('last_login'),
                "total_logins": user.get('total_login_count', 0)
            },
            "question_bank": {
                "total_sessions": db['question_bank_activities'].count_documents({"user_id": user_id}),
                "recent_sessions": list(db['question_bank_activities'].find(
                    {"user_id": user_id}
                ).sort("timestamp", -1).limit(10))
            },
            "mock_interviews": {
                "total_interviews": db['mock_interviews'].count_documents({"user_id": user_id}),
                "average_rating": 0,
                "recent_interviews": list(db['mock_interviews'].find(
                    {"user_id": user_id}
                ).sort("timestamp", -1).limit(10))
            },
            "resume_activities": {
                "total_evaluations": db['resume_activities'].count_documents({
                    "user_id": user_id,
                    "activity_type": "evaluation"
                }),
                "average_ats_score": 0,
                "recent_activities": list(db['resume_activities'].find(
                    {"user_id": user_id}
                ).sort("timestamp", -1).limit(10))
            },
            "chat_sessions": {
                "total_sessions": db['chat_sessions'].count_documents({"user_id": user_id}),
                "total_messages": db['chat_sessions'].aggregate([
                    {"$match": {"user_id": user_id}},
                    {"$group": {"_id": None, "total": {"$sum": "$message_count"}}}
                ]).next().get('total', 0) if db['chat_sessions'].count_documents({"user_id": user_id}) > 0 else 0
            },
            "job_searches": {
                "total_searches": db['job_searches'].count_documents({"user_id": user_id}),
                "recent_searches": list(db['job_searches'].find(
                    {"user_id": user_id}
                ).sort("timestamp", -1).limit(10))
            },
            "activity_timeline": list(db['user_activities'].find(
                {"user_id": user_id}
            ).sort("timestamp", -1).limit(50))
        }
        
        # Calculate averages
        interviews = list(db['mock_interviews'].find({"user_id": user_id, "overall_rating": {"$exists": True}}))
        if interviews:
            ratings = [i.get('overall_rating', 0) for i in interviews if i.get('overall_rating')]
            stats['mock_interviews']['average_rating'] = sum(ratings) / len(ratings) if ratings else 0
        
        resume_evals = list(db['resume_activities'].find({
            "user_id": user_id,
            "activity_type": "evaluation",
            "ats_score": {"$exists": True}
        }))
        if resume_evals:
            scores = [r.get('ats_score', 0) for r in resume_evals if r.get('ats_score')]
            stats['resume_activities']['average_ats_score'] = sum(scores) / len(scores) if scores else 0
        
        return stats
    except Exception as e:
        print(f"Error getting user stats: {e}")
        return None
