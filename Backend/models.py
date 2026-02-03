"""
MongoDB Collections Schema for User Activity Tracking

Collections:
1. users - User profiles and authentication
2. user_activities - General activity logs
3. question_bank_activities - Question bank interactions
4. quiz_attempts - Quiz scores and attempts
5. mock_interviews - Interview sessions and scores
6. resume_activities - Resume evaluations and builds
7. chat_sessions - AI chat interactions
8. job_searches - Job finder activities
9. subscription_info - Pricing and subscription details
"""

from datetime import datetime, timezone
from typing import Optional, Dict, List, Any

# MongoDB Schema Definitions (for documentation)

USERS_SCHEMA = {
    "_id": "ObjectId",  # MongoDB auto-generated
    "email": "string (unique, required)",
    "google_id": "string (optional, for OAuth users)",
    "firstName": "string",
    "lastName": "string",
    "name": "string (full name)",
    "picture": "string (profile picture URL)",
    "passwordHash": "string (for email/password users)",
    "createdAt": "datetime",
    "last_login": "datetime",
    "subscription_tier": "string (free, pro, enterprise)",
    "total_login_count": "int",
}

USER_ACTIVITIES_SCHEMA = {
    "_id": "ObjectId",
    "user_id": "ObjectId (ref: users._id)",
    "email": "string",
    "activity_type": "string (login, logout, page_view, feature_use)",
    "activity_name": "string (specific activity)",
    "metadata": "object (additional data)",
    "timestamp": "datetime",
}

QUESTION_BANK_ACTIVITIES_SCHEMA = {
    "_id": "ObjectId",
    "user_id": "ObjectId (ref: users._id)",
    "email": "string",
    "company": "string",
    "role": "string",
    "domain": "string",
    "experience_level": "string",
    "question_type": "string",
    "difficulty": "string",
    "num_questions": "int",
    "questions_generated": "array of objects",
    "timestamp": "datetime",
}

QUIZ_ATTEMPTS_SCHEMA = {
    "_id": "ObjectId",
    "user_id": "ObjectId (ref: users._id)",
    "email": "string",
    "quiz_type": "string",
    "company": "string",
    "role": "string",
    "total_questions": "int",
    "questions_answered": "int",
    "correct_answers": "int",
    "score_percentage": "float",
    "time_taken_seconds": "int",
    "quiz_data": "object",
    "timestamp": "datetime",
}

MOCK_INTERVIEWS_SCHEMA = {
    "_id": "ObjectId",
    "user_id": "ObjectId (ref: users._id)",
    "email": "string",
    "interview_type": "string (behavioral, technical, mixed)",
    "job_description": "string",
    "duration_minutes": "float",
    "vapi_assistant_id": "string",
    "vapi_call_id": "string",
    "overall_rating": "float (1-10)",
    "communication_score": "float",
    "technical_score": "float",
    "confidence_score": "float",
    "feedback": "string",
    "transcript": "string",
    "timestamp": "datetime",
}

RESUME_ACTIVITIES_SCHEMA = {
    "_id": "ObjectId",
    "user_id": "ObjectId (ref: users._id)",
    "email": "string",
    "activity_type": "string (evaluation, improvement, build)",
    "resume_filename": "string",
    "job_description": "string",
    "ats_score": "int",
    "missing_keywords": "array of strings",
    "suggestions": "string",
    "resume_data": "string",
    "timestamp": "datetime",
}

INTERVIEW_FEEDBACK_SCHEMA = {
    "_id": "ObjectId",
    "user_id": "ObjectId (ref: users._id)",
    "email": "string",
    "job_description": "string",
    "transcript": "string",
    "duration_minutes": "float",
    "feedback": {
        "overall_score": "int (1-10)",
        "communication_score": "int (1-10)",
        "technical_score": "int (1-10)",
        "confidence_score": "int (1-10)",
        "strengths": "array of strings",
        "weaknesses": "array of strings",
        "improvement_areas": "array of strings",
        "summary": "string",
        "detailed_feedback": "string",
        "recommended_actions": "array of strings"
    },
    "timestamp": "datetime",
}

CHAT_SESSIONS_SCHEMA = {
    "_id": "ObjectId",
    "user_id": "ObjectId (ref: users._id)",
    "email": "string",
    "session_id": "string (unique per chat session)",
    "message_count": "int",
    "topic": "string",
    "messages": "array of {role, content, timestamp}",
    "started_at": "datetime",
    "last_message_at": "datetime",
}

JOB_SEARCHES_SCHEMA = {
    "_id": "ObjectId",
    "user_id": "ObjectId (ref: users._id)",
    "email": "string",
    "search_query": "string",
    "location": "string",
    "num_jobs_requested": "int",
    "num_jobs_found": "int",
    "saved_jobs": "array of job objects",
    "applied_jobs": "array of job IDs",
    "timestamp": "datetime",
}

SUBSCRIPTION_INFO_SCHEMA = {
    "_id": "ObjectId",
    "user_id": "ObjectId (ref: users._id)",
    "email": "string",
    "subscription_tier": "string (free, pro, enterprise)",
    "payment_status": "string (active, expired, cancelled)",
    "start_date": "datetime",
    "end_date": "datetime",
    "payment_method": "string",
    "amount_paid": "float",
    "transaction_id": "string",
    "auto_renew": "boolean",
    "features_accessed": "array of strings",
    "usage_count": "object {feature_name: count}",
    "timestamp": "datetime",
}


def get_collections(db):
    """
    Get all collection references
    """
    return {
        'users': db['users'],
        'user_activities': db['user_activities'],
        'question_bank_activities': db['question_bank_activities'],
        'quiz_attempts': db['quiz_attempts'],
        'mock_interviews': db['mock_interviews'],
        'resume_activities': db['resume_activities'],
        'chat_sessions': db['chat_sessions'],
        'job_searches': db['job_searches'],
        'subscription_info': db['subscription_info'],
    }


def create_indexes(db):
    """
    Create necessary indexes for performance
    """
    collections = get_collections(db)
    
    # Users collection
    collections['users'].create_index([("email", 1)], unique=True)
    collections['users'].create_index([("google_id", 1)])
    
    # User activities
    collections['user_activities'].create_index([("user_id", 1), ("timestamp", -1)])
    collections['user_activities'].create_index([("email", 1), ("timestamp", -1)])
    
    # Question bank activities
    collections['question_bank_activities'].create_index([("user_id", 1), ("timestamp", -1)])
    collections['question_bank_activities'].create_index([("company", 1)])
    
    # Quiz attempts
    collections['quiz_attempts'].create_index([("user_id", 1), ("timestamp", -1)])
    
    # Mock interviews
    collections['mock_interviews'].create_index([("user_id", 1), ("timestamp", -1)])
    
    # Resume activities
    collections['resume_activities'].create_index([("user_id", 1), ("timestamp", -1)])
    
    # Chat sessions
    collections['chat_sessions'].create_index([("user_id", 1), ("session_id", 1)])
    collections['chat_sessions'].create_index([("user_id", 1), ("last_message_at", -1)])
    
    # Job searches
    collections['job_searches'].create_index([("user_id", 1), ("timestamp", -1)])
    
    # Subscription info
    collections['subscription_info'].create_index([("user_id", 1)])
    collections['subscription_info'].create_index([("email", 1)])
    
    print("✅ All indexes created successfully")
