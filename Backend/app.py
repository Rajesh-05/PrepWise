"""
PrepWise Flask Backend - Complete Production Build
Merges: auth fixes, Google OAuth, multi-agent LangGraph, resume, jobs, question bank, Vapi.
Render-safe: no FileHandler, no sounddevice, no hardcoded URLs.
"""

# ============================================================
# IMPORTS
# ============================================================
import os
import logging
import json
import re
import math
import time
import tempfile
import threading
import asyncio
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode
from typing import TypedDict
from queue import Queue

import numpy as np
import requests
from flask import Flask, request, jsonify, redirect
from flask_cors import CORS
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
from pymongo import MongoClient, ASCENDING
from pymongo.errors import DuplicateKeyError
from itsdangerous import URLSafeTimedSerializer, SignatureExpired
import pdfplumber

# ============================================================
# ENVIRONMENT VARIABLES
# ============================================================
load_dotenv()

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

# RENDER FIX: Never use FileHandler — Render filesystem is read-only
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger(__name__)
logger.info(f"PrepWise API starting up (Log Level: {LOG_LEVEL})")

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")
BACKEND_URL  = os.getenv("BACKEND_URL",  "http://localhost:5000").rstrip("/")

SECRET_KEY      = os.getenv("FLASK_SECRET_KEY", "dev-secret-key-change-in-prod")
JWT_SECRET      = os.getenv("JWT_SECRET")
JWT_EXPIRES_MIN = int(os.getenv("JWT_EXPIRES_MIN", "1440"))

# Accept both naming conventions so neither breaks
GOOGLE_CLIENT_ID     = os.getenv("GOOGLE_CLIENT_ID") or os.getenv("GOOGLE_OAUTH_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET") or os.getenv("GOOGLE_OAUTH_CLIENT_SECRET")
GOOGLE_REDIRECT_URI  = os.getenv("GOOGLE_REDIRECT_URI", f"{BACKEND_URL}/auth/google/callback")
GOOGLE_AUTH_URL      = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL     = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL  = "https://www.googleapis.com/oauth2/v2/userinfo"

MONGODB_URI    = os.getenv("MONGODB_URI")
MONGODB_DBNAME = os.getenv("MONGODB_DBNAME", "prepwise")

API_KEY          = os.getenv("GEMINI_API_KEY")
GROQ_API_KEY     = os.getenv("GROQ_API_KEY")
VAPI_PRIVATE_KEY = os.getenv("VAPI_PRIVATE_KEY")

for _k, _v in [
    ("FRONTEND_URL", FRONTEND_URL), ("BACKEND_URL", BACKEND_URL),
    ("GOOGLE_REDIRECT_URI", GOOGLE_REDIRECT_URI),
    ("GOOGLE_CLIENT_ID",     "SET" if GOOGLE_CLIENT_ID     else "MISSING"),
    ("GOOGLE_CLIENT_SECRET", "SET" if GOOGLE_CLIENT_SECRET else "MISSING"),
    ("JWT_SECRET",           "SET" if JWT_SECRET           else "MISSING"),
    ("MONGODB_URI",          "SET" if MONGODB_URI          else "MISSING"),
    ("GEMINI_API_KEY",       "SET" if API_KEY              else "MISSING"),
    ("GROQ_API_KEY",         "SET" if GROQ_API_KEY         else "MISSING — chat disabled"),
]:
    logger.info(f"  {_k}: {_v}")

# ============================================================
# FLASK APP + CORS
# ============================================================
app = Flask(__name__)
app.secret_key = SECRET_KEY

CORS(
    app,
    origins=[FRONTEND_URL, "http://localhost:3000"],
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    supports_credentials=True,
    max_age=3600,
)

# ============================================================
# MONGODB
# ============================================================
mongo_db  = None
users_col = None

try:
    if not MONGODB_URI:
        raise ValueError("MONGODB_URI missing")
    _mc      = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=8000)
    mongo_db = _mc[MONGODB_DBNAME]
    _mc.admin.command("ping")
    logger.info(f"MongoDB connected: {MONGODB_DBNAME}")
    users_col = mongo_db["users"]
    users_col.create_index([("email", ASCENDING)], unique=True)
    app.mongo_db  = mongo_db
    app.users_col = users_col
    logger.info("MongoDB indexes ready")
except Exception as _e:
    logger.error(f"MongoDB init failed: {_e}")
    app.mongo_db  = None
    app.users_col = None

# ============================================================
# AUTH HELPERS
# ============================================================
_revoked_tokens: set = set()
_serializer = URLSafeTimedSerializer(JWT_SECRET or SECRET_KEY)


def revoke_token(token: str):
    _revoked_tokens.add(token)


def require_auth(f):
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
        except jwt.InvalidTokenError as exc:
            return jsonify({"error": f"Invalid token: {exc}"}), 401
        return f(*args, **kwargs)
    return decorated


def require_db() -> bool:
    return app.users_col is not None and JWT_SECRET is not None


def issue_jwt(user_id, email: str) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode({
        "sub":   str(user_id),
        "email": email,
        "iat":   int(now.timestamp()),
        "exp":   int((now + timedelta(minutes=JWT_EXPIRES_MIN)).timestamp()),
    }, JWT_SECRET, algorithm="HS256")


def log_activity(db, email: str, action_type: str, detail: str = ""):
    if db is None:
        return
    try:
        db["user_activities"].insert_one({
            "email": email, "type": action_type,
            "detail": detail, "created_at": datetime.now(timezone.utc),
        })
    except Exception:
        pass


def serialize_doc(doc):
    from bson import ObjectId
    if isinstance(doc, list):
        return [serialize_doc(d) for d in doc]
    if isinstance(doc, dict):
        out = {}
        for k, v in doc.items():
            if isinstance(v, ObjectId):        out[k] = str(v)
            elif isinstance(v, datetime):      out[k] = v.isoformat()
            elif isinstance(v, (dict, list)):  out[k] = serialize_doc(v)
            else:                              out[k] = v
        return out
    return doc

# ============================================================
# GEMINI HELPERS
# ============================================================

def _call_gemini(prompt: str, timeout: int = 30):
    if not API_KEY:
        return None
    url = ("https://generativelanguage.googleapis.com/v1beta/models/"
           f"gemini-2.5-flash:generateContent?key={API_KEY}")
    try:
        r = requests.post(url, json={"contents": [{"parts": [{"text": prompt}]}]}, timeout=timeout)
        if not r.ok:
            logger.error(f"Gemini {r.status_code}: {r.text[:200]}")
            return None
        cands = r.json().get("candidates", [])
        return cands[0].get("content", {}).get("parts", [{}])[0].get("text") if cands else None
    except Exception as exc:
        logger.error(f"Gemini error: {exc}")
        return None


def _clean_gemini_json(text: str):
    text = re.sub(r"^```[a-zA-Z]*\n?", "", text.strip())
    text = re.sub(r"```$", "", text).strip()
    text = re.sub(r"[\x00-\x1F]+", " ", text)
    return json.loads(text)


def extract_pdf_text(pdf_path: str) -> str:
    text = ""
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                pt = page.extract_text()
                if pt:
                    text += pt + "\n"
    except Exception as exc:
        logger.error(f"PDF error: {exc}")
    return text.strip()


def get_gemini_resume_improvements(resume_text: str) -> dict:
    text = _call_gemini(
        'You are an expert resume reviewer. Respond ONLY with JSON: {"suggestions": "..."}\n'
        f"Resume:\n{resume_text}"
    )
    if text is None:
        return {"error": "AI unavailable"}
    try:
        return _clean_gemini_json(text)
    except Exception as exc:
        return {"error": f"Parse error: {exc}"}


def get_gemini_ats_score(resume_text: str, jd: str) -> dict:
    text = _call_gemini(
        "ATS evaluator. Return ONLY JSON: {match_score (int), summary (str), missing_keywords (list)}\n"
        f"Resume:\n{resume_text}\nJob Description:\n{jd}"
    )
    if text is None:
        return {"error": "AI unavailable"}
    try:
        return _clean_gemini_json(text)
    except Exception as exc:
        return {"error": f"Parse error: {exc}"}

# ============================================================
# JOB CACHE
# ============================================================
_job_cache: dict = {}
_JOB_TTL = 300

# ============================================================
# MULTI-AGENT SYSTEM
# ============================================================
multi_agent_workflow = None
get_agent_by_name    = None   # filled below if Groq is available

if GROQ_API_KEY:
    try:
        from langgraph.graph import StateGraph, END, START
        from langchain_core.prompts import ChatPromptTemplate
        from langchain_groq import ChatGroq
        from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
        from langchain_community.tools import DuckDuckGoSearchResults

        class MultiAgentState(TypedDict):
            query: str; category: str; response: str
            messages: list; current_agent: str; should_reroute: bool

        def _parse_continuity(content: str, name: str = "Agent") -> dict:
            content = re.sub(r"```json\s*", "", content)
            content = re.sub(r"```\s*$", "", content).strip()
            try:
                if content.startswith("{"):
                    end = content.find("}")
                    if end != -1:
                        try:
                            p = json.loads(content[:end+1])
                            remaining = content[end+1:].strip()
                            should = p.get("should_handle", False)
                            reason = p.get("reason", "")
                            if should and remaining:
                                return {"should_handle": True,  "response": remaining, "reason": reason}
                            return {"should_handle": False, "response": None, "reason": reason}
                        except json.JSONDecodeError:
                            pass
                m = re.search(r'\{\s*"should_handle"\s*:\s*(true|false)\s*,\s*"reason"\s*:\s*"([^"]+)"\s*\}',
                              content, re.IGNORECASE)
                if m:
                    should = m.group(1).lower() == "true"
                    remaining = content[m.end():].strip()
                    if should and remaining:
                        return {"should_handle": True, "response": remaining, "reason": m.group(2)}
                    return {"should_handle": False, "response": None, "reason": m.group(2)}
                if any(p in content.lower() for p in
                       ['"should_handle": false', "cannot handle", "not my domain"]):
                    return {"should_handle": False, "response": None, "reason": "Explicit rejection"}
                return {"should_handle": False, "response": None, "reason": "No valid format"}
            except Exception as exc:
                return {"should_handle": False, "response": None, "reason": str(exc)}

        _SYS = {
            "general":              ("You are PrepWise AI, a friendly career coach. Handle greetings, "
                                     "introductions, and questions about your capabilities."),
            "learning_resource":    ("You are an expert Generative AI Engineer. Answer AI/ML questions, "
                                     "explain concepts, and help with coding."),
            "tutorial":             ("You are a Senior Generative AI Developer. Create comprehensive "
                                     "tutorials with code examples in markdown."),
            "interview_preparation":("You are an expert tech interviewer. Provide interview questions, "
                                     "model answers, and conduct mock interviews."),
            "resume_making":        ("You are an expert resume consultant. Create ATS-optimized resumes "
                                     "with trending keywords for AI/tech roles."),
            "job_search":           ("You are a job search assistant. Help users find relevant openings."),
        }

        _HINTS = {
            "general":              "HANDLE: greetings, 'who are you', 'what can you do', small talk.",
            "learning_resource":    "HANDLE: AI/ML questions, coding, 'explain X', 'how does Y work'.",
            "tutorial":             "HANDLE: 'create a tutorial', 'write a blog post about X'.",
            "interview_preparation":"HANDLE: interview questions, mock interview, 'prepare for X role'.",
            "resume_making":        "HANDLE: resume creation, CV improvement, ATS tips.",
            "job_search":           "HANDLE: 'find jobs', 'search for X positions', job market queries.",
        }

        _fast  = ChatGroq(model="llama-3.1-8b-instant",   groq_api_key=GROQ_API_KEY, temperature=0.5)
        _smart = ChatGroq(model="llama-3.3-70b-versatile", groq_api_key=GROQ_API_KEY, temperature=0.5)
        _job_m = ChatGroq(model="llama-3.3-70b-versatile", groq_api_key=GROQ_API_KEY, temperature=0.3)
        _ddg   = DuckDuckGoSearchResults(max_results=10)

        _MODEL_MAP = {
            "general": _fast, "learning_resource": _smart, "tutorial": _smart,
            "interview_preparation": _fast, "resume_making": _smart, "job_search": _job_m,
        }

        def _do_check(name: str, model, user_input: str, history: list) -> dict:
            msgs = [SystemMessage(content=_SYS[name])]
            for m in (history or [])[-20:]:
                if m.get("role") == "user":      msgs.append(HumanMessage(content=m["content"]))
                elif m.get("role") == "assistant": msgs.append(AIMessage(content=m["content"]))
            msgs.append(HumanMessage(content=(
                f"User Query: {user_input}\n\nDomain check:\n{_HINTS[name]}\n\n"
                'Respond with JSON first: {"should_handle": true/false, "reason": "..."}\n'
                "If true, write full response AFTER the JSON. If false, ONLY the JSON."
            )))
            return _parse_continuity(model.invoke(msgs).content.strip(), name)

        class _Agent:
            def __init__(self, name, model):
                self.name  = name
                self.model = model
            def check_and_respond(self, user_input, history):
                result = _do_check(self.name, self.model, user_input, history)
                if self.name == "job_search" and result["should_handle"]:
                    try:
                        sr = _ddg.invoke(user_input)
                        chain = (ChatPromptTemplate.from_template(
                            "Format these job results with titles, companies, links:\n\n{results}"
                        ) | self.model)
                        result["response"] = chain.invoke({"results": sr}).content
                    except Exception:
                        result["response"] = ("I can help find jobs! Please provide a specific "
                                              "role and location.")
                return result

        def get_agent_by_name(name: str):
            if name not in _MODEL_MAP:
                return None
            return _Agent(name, _MODEL_MAP[name])

        # Nodes
        def _categorize(state):
            r = (ChatPromptTemplate.from_template(
                "Categorize (NUMBER only):\n0:greeting/general\n1:learning/AI\n"
                "2:resume\n3:interview\n4:job search\nQuery:{query}\nCategory:"
            ) | _fast).invoke({"query": state["query"]})
            return {"category": r.content.strip()}

        def _sub_learn(state):
            r = (ChatPromptTemplate.from_template(
                "One word — Tutorial or Question:\nQuery:{query}\nSub-category:"
            ) | _fast).invoke({"query": state["query"]})
            return {"category": r.content.strip()}

        def _sub_interview(state):
            r = (ChatPromptTemplate.from_template(
                "One word — Mock or Question:\nQuery:{query}\nSub-category:"
            ) | _fast).invoke({"query": state["query"]})
            return {"category": r.content.strip()}

        def _make_node(agent_name):
            def node(state):
                result = _Agent(agent_name, _MODEL_MAP[agent_name]).check_and_respond(
                    state["query"], state.get("messages", [])
                )
                return {"response": result.get("response") or "Please try rephrasing.",
                        "current_agent": agent_name, "should_reroute": not result["should_handle"]}
            node.__name__ = agent_name + "_node"
            return node

        def _route_main(state):
            c = state["category"]
            if "0" in c: return "general_agent"
            if "1" in c: return "handle_learning"
            if "2" in c: return "handle_resume"
            if "3" in c: return "handle_interview"
            if "4" in c: return "job_search"
            return "general_agent"

        def _route_learn(state):
            return "tutorial_agent" if "tutorial" in state["category"].lower() else "ask_query_bot"

        def _route_interview(state):
            return "mock_interview" if "mock" in state["category"].lower() else "interview_questions"

        wf = StateGraph(MultiAgentState)
        wf.add_node("categorize",         _categorize)
        wf.add_node("general_agent",      _make_node("general"))
        wf.add_node("handle_learning",    _sub_learn)
        wf.add_node("handle_resume",      _make_node("resume_making"))
        wf.add_node("handle_interview",   _sub_interview)
        wf.add_node("job_search",         _make_node("job_search"))
        wf.add_node("tutorial_agent",     _make_node("tutorial"))
        wf.add_node("ask_query_bot",      _make_node("learning_resource"))
        wf.add_node("interview_questions",_make_node("interview_preparation"))
        wf.add_node("mock_interview",     _make_node("interview_preparation"))

        wf.add_edge(START, "categorize")
        wf.add_conditional_edges("categorize", _route_main, {
            "general_agent":"general_agent", "handle_learning":"handle_learning",
            "handle_resume":"handle_resume", "handle_interview":"handle_interview",
            "job_search":"job_search",
        })
        wf.add_conditional_edges("handle_learning",  _route_learn,     {"tutorial_agent":"tutorial_agent","ask_query_bot":"ask_query_bot"})
        wf.add_conditional_edges("handle_interview", _route_interview,  {"interview_questions":"interview_questions","mock_interview":"mock_interview"})
        for _n in ["general_agent","handle_resume","job_search","tutorial_agent",
                   "ask_query_bot","interview_questions","mock_interview"]:
            wf.add_edge(_n, END)

        multi_agent_workflow = wf.compile()
        logger.info("Multi-agent workflow compiled successfully")

    except Exception as _ma_err:
        logger.error(f"Multi-agent build failed: {_ma_err}")
        multi_agent_workflow = None

# ============================================================
# ROUTES — HEALTH
# ============================================================

@app.route("/healthz", methods=["GET"])
@app.route("/",        methods=["GET"])
def healthz():
    try:
        if app.mongo_db:
            app.mongo_db.command("ping")
        return jsonify({"status": "ok", "message": "PrepWise backend running"}), 200
    except Exception as exc:
        return jsonify({"status": "degraded", "error": str(exc)}), 200

# ============================================================
# ROUTES — GOOGLE OAUTH
# ============================================================

@app.route("/auth/google/login", methods=["GET"])
def google_login():
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        return jsonify({"error": "Google OAuth not configured"}), 500
    params = {"client_id": GOOGLE_CLIENT_ID, "redirect_uri": GOOGLE_REDIRECT_URI,
              "scope": "openid email profile", "response_type": "code",
              "access_type": "offline", "prompt": "consent"}
    return redirect(f"{GOOGLE_AUTH_URL}?{urlencode(params)}")


@app.route("/auth/google/callback", methods=["GET"])
def google_callback():
    code  = request.args.get("code")
    error = request.args.get("error")
    if error:
        return redirect(f"{FRONTEND_URL}/login?error=access_denied")
    if not code:
        return redirect(f"{FRONTEND_URL}/login?error=no_code")

    try:
        tr = requests.post(GOOGLE_TOKEN_URL, data={
            "code": code, "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": GOOGLE_REDIRECT_URI, "grant_type": "authorization_code",
        }, timeout=15)
        if tr.status_code != 200:
            return redirect(f"{FRONTEND_URL}/login?error=token_exchange_failed")

        access_token = tr.json().get("access_token")
        if not access_token:
            return redirect(f"{FRONTEND_URL}/login?error=no_access_token")

        ur = requests.get(GOOGLE_USERINFO_URL,
                          headers={"Authorization": f"Bearer {access_token}"}, timeout=10)
        if ur.status_code != 200:
            return redirect(f"{FRONTEND_URL}/login?error=user_info_failed")

        info  = ur.json()
        email = info.get("email")
        logger.info(f"Google OAuth: {email}")

        user_id = info.get("id")
        if mongo_db is not None and users_col is not None:
            try:
                existing = users_col.find_one({"email": email})
                doc = {"google_id": info.get("id"), "email": email,
                       "firstName": info.get("given_name", ""),
                       "lastName":  info.get("family_name", ""),
                       "name":      info.get("name", ""),
                       "picture":   info.get("picture", ""),
                       "last_login": datetime.now(timezone.utc),
                       "auth_provider": "google"}
                if existing:
                    users_col.update_one({"email": email},
                                         {"$set": doc, "$inc": {"total_login_count": 1}})
                    user_id = existing["_id"]
                else:
                    doc.update({"createdAt": datetime.now(timezone.utc),
                                "subscription_tier": "free", "total_login_count": 1})
                    user_id = users_col.insert_one(doc).inserted_id
                log_activity(mongo_db, email, "login", "Google OAuth")
            except Exception as exc:
                logger.error(f"MongoDB upsert: {exc}")

        if not JWT_SECRET:
            return redirect(f"{FRONTEND_URL}/login?error=server_config_error")

        token = jwt.encode({
            "sub": str(user_id), "email": email, "name": info.get("name", ""),
            "exp": datetime.now(timezone.utc) + timedelta(days=7),
            "iat": datetime.now(timezone.utc),
        }, JWT_SECRET, algorithm="HS256")

        # FIX: query param (not # hash fragment) — Login.jsx reads ?session_token=
        return redirect(f"{FRONTEND_URL}/login?session_token={token}")

    except requests.RequestException as exc:
        logger.error(f"OAuth HTTP: {exc}")
        return redirect(f"{FRONTEND_URL}/login?error=oauth_request_failed")
    except Exception as exc:
        logger.error(f"OAuth unexpected: {exc}", exc_info=True)
        return redirect(f"{FRONTEND_URL}/login?error=server_error")

# ============================================================
# ROUTES — EMAIL/PASSWORD AUTH
# ============================================================

@app.route("/auth/signup", methods=["POST"])
def auth_signup():
    if not require_db():
        return jsonify({"error": "Auth service not available"}), 503
    data = request.get_json() or {}
    fn   = (data.get("firstName") or "").strip()
    ln   = (data.get("lastName")  or "").strip()
    em   = (data.get("email")     or "").strip().lower()
    pw   = data.get("password")   or ""
    if not all([fn, ln, em, pw]):
        return jsonify({"error": "All fields are required"}), 400
    if len(pw) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400
    try:
        doc = {"email": em, "password": generate_password_hash(pw),
               "firstName": fn, "lastName": ln, "name": f"{fn} {ln}",
               "picture": "", "subscription_tier": "free",
               "createdAt": datetime.now(timezone.utc),
               "last_login": datetime.now(timezone.utc),
               "total_login_count": 0, "auth_provider": "email"}
        res   = users_col.insert_one(doc)
        token = issue_jwt(res.inserted_id, em)
        return jsonify({"message": "Account created", "token": token,
                        "user": {"email": em, "firstName": fn, "lastName": ln,
                                 "name": f"{fn} {ln}", "picture": "",
                                 "subscription_tier": "free"}}), 201
    except DuplicateKeyError:
        return jsonify({"error": "An account with this email already exists"}), 409
    except Exception as exc:
        logger.error(f"Signup: {exc}", exc_info=True)
        return jsonify({"error": "Failed to create account"}), 500


@app.route("/auth/login", methods=["POST"])
def auth_login():
    if not require_db():
        return jsonify({"error": "Auth service not available"}), 503
    data = request.get_json() or {}
    em   = (data.get("email")    or "").strip().lower()
    pw   = data.get("password")  or ""
    if not em or not pw:
        return jsonify({"error": "Email and password are required"}), 400
    try:
        user = users_col.find_one({"email": em})
        # Support both 'password' and legacy 'passwordHash' field names
        stored = (user.get("password") or user.get("passwordHash") or "") if user else ""
        if not user or not check_password_hash(stored, pw):
            return jsonify({"error": "Invalid email or password"}), 401
        users_col.update_one({"email": em},
                              {"$set": {"last_login": datetime.now(timezone.utc)},
                               "$inc": {"total_login_count": 1}})
        log_activity(mongo_db, em, "login", "Email/Password")
        token = issue_jwt(user["_id"], em)
        return jsonify({"token": token,
                        "user": {"email": user["email"], "name": user.get("name", ""),
                                 "firstName": user.get("firstName", ""),
                                 "lastName":  user.get("lastName", ""),
                                 "picture":   user.get("picture", ""),
                                 "subscription_tier": user.get("subscription_tier", "free")}}), 200
    except Exception as exc:
        logger.error(f"Login: {exc}", exc_info=True)
        return jsonify({"error": "Failed to sign in"}), 500


@app.route("/auth/me", methods=["GET"])
@require_auth
def auth_me():
    if not require_db():
        return jsonify({"error": "Auth service not available"}), 503
    em   = getattr(request, "user_email", None)
    user = users_col.find_one({"email": em}, {"password": 0, "passwordHash": 0}) if em else None
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify({"user": serialize_doc(user)}), 200


@app.route("/auth/logout", methods=["POST"])
@require_auth
def auth_logout():
    em = getattr(request, "user_email", None)
    if em:
        log_activity(mongo_db, em, "logout", "Logout")
    ah = request.headers.get("Authorization", "")
    if ah.startswith("Bearer "):
        revoke_token(ah.split(" ", 1)[1])
    return jsonify({"message": "Logged out successfully"}), 200


@app.route("/auth/forgot-password", methods=["POST"])
def forgot_password():
    if not require_db():
        return jsonify({"error": "Auth service not available"}), 503
    data = request.get_json() or {}
    em   = (data.get("email") or "").strip().lower()
    if not em:
        return jsonify({"error": "Email is required"}), 400
    user = users_col.find_one({"email": em})
    if user:
        tok       = _serializer.dumps(em, salt="password-reset-salt")
        reset_url = f"{FRONTEND_URL}/reset-password?token={tok}"
        logger.info(f"Password reset URL for {em}: {reset_url}")
        # TODO: send email via SendGrid/Mailgun
    # Always return same message to avoid email enumeration
    return jsonify({"message": "If an account exists, a reset link has been sent"}), 200


@app.route("/auth/reset-password", methods=["POST"])
def reset_password():
    if not require_db():
        return jsonify({"error": "Auth service not available"}), 503
    data  = request.get_json() or {}
    tok   = data.get("token")
    newpw = data.get("password")
    if not tok or not newpw:
        return jsonify({"error": "Token and new password are required"}), 400
    try:
        em = _serializer.loads(tok, salt="password-reset-salt", max_age=3600)
    except SignatureExpired:
        return jsonify({"error": "Reset link has expired"}), 400
    except Exception as exc:
        return jsonify({"error": f"Invalid token: {exc}"}), 400
    h = generate_password_hash(newpw)
    users_col.update_one({"email": em}, {"$set": {"password": h, "passwordHash": h}})
    return jsonify({"message": "Password reset successful"}), 200

# ============================================================
# ROUTES — CHAT SESSIONS
# ============================================================

@app.route("/api/chat-sessions", methods=["GET", "DELETE"])
@require_auth
def handle_chat_sessions():
    db = app.mongo_db; em = getattr(request, "user_email", None)
    if db is None or not em: return jsonify({"error": "Service unavailable"}), 503
    user = db["users"].find_one({"email": em})
    if not user: return jsonify({"error": "User not found"}), 404
    if request.method == "DELETE":
        db["chat_sessions"].delete_many({"user_id": user["_id"]})
        return jsonify({"message": "All sessions deleted"}), 200
    sessions = list(db["chat_sessions"].find({"user_id": user["_id"]}).sort("last_message_at", -1))
    return jsonify({"sessions": serialize_doc(sessions)}), 200


@app.route("/api/chat-sessions/<session_id>", methods=["DELETE"])
@require_auth
def delete_chat_session(session_id):
    from bson import ObjectId
    db = app.mongo_db; em = getattr(request, "user_email", None)
    if db is None or not em: return jsonify({"error": "Service unavailable"}), 503
    user = db["users"].find_one({"email": em})
    if not user: return jsonify({"error": "User not found"}), 404
    r = db["chat_sessions"].delete_one({"_id": ObjectId(session_id), "user_id": user["_id"]})
    return (jsonify({"message": "Deleted"}), 200) if r.deleted_count else (jsonify({"error": "Not found"}), 404)


@app.route("/api/chat-sessions/<session_id>", methods=["PATCH"])
@require_auth
def update_chat_session(session_id):
    from bson import ObjectId
    db = app.mongo_db; em = getattr(request, "user_email", None)
    if db is None or not em: return jsonify({"error": "Service unavailable"}), 503
    user = db["users"].find_one({"email": em})
    if not user: return jsonify({"error": "User not found"}), 404
    topic = (request.get_json() or {}).get("topic", "").strip()
    if not topic: return jsonify({"error": "Topic cannot be empty"}), 400
    r = db["chat_sessions"].update_one(
        {"_id": ObjectId(session_id), "user_id": user["_id"]}, {"$set": {"topic": topic}})
    return (jsonify({"message": "Updated"}), 200) if r.matched_count else (jsonify({"error": "Not found"}), 404)

# ============================================================
# ROUTES — MULTI-AGENT CHAT
# ============================================================

@app.route("/multi-agent/chat", methods=["POST"])
def multi_agent_chat():
    if not GROQ_API_KEY:
        return jsonify({"error": "Multi-agent chat not configured. GROQ_API_KEY is missing."}), 503
    if multi_agent_workflow is None:
        return jsonify({"error": "Multi-agent workflow failed to initialize."}), 503

    data   = request.get_json() or {}
    query  = (data.get("query") or "").strip()
    msgs   = data.get("messages", [])
    cur_ag = data.get("current_agent") or ""

    if not query:
        return jsonify({"error": "Query is required"}), 400

    logger.info(f"Chat: '{query[:60]}' | agent='{cur_ag}'")

    try:
        if cur_ag and get_agent_by_name:
            agent = get_agent_by_name(cur_ag)
            if agent:
                result = agent.check_and_respond(query, msgs)
                if result["should_handle"]:
                    return jsonify({"query": query, "response": result["response"],
                                    "current_agent": cur_ag, "should_continue": True,
                                    "status": "success"}), 200
                logger.info(f"Agent '{cur_ag}' declined — rerouting")

        r = multi_agent_workflow.invoke({
            "query": query, "messages": msgs, "current_agent": cur_ag,
            "category": "", "response": "", "should_reroute": False,
        })
        return jsonify({
            "query":    query,
            "category": r.get("category", ""),
            "response": r.get("response") or "Please try rephrasing.",
            "current_agent":  r.get("current_agent", "unknown"),
            "should_continue": True, "status": "success",
        }), 200

    except Exception as exc:
        import traceback; traceback.print_exc()
        return jsonify({"error": f"Error: {exc}"}), 500

# ============================================================
# ROUTES — RESUME
# ============================================================

@app.route("/improve-resume", methods=["POST"])
@require_auth
def improve_resume():
    if "file" not in request.files:
        return jsonify({"error": "Missing resume file"}), 400
    f = request.files["file"]
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        f.save(tmp.name); p = tmp.name
    try:
        result = get_gemini_resume_improvements(extract_pdf_text(p))
        if "error" in result: return jsonify(result), 500
        if mongo_db: log_activity(mongo_db, request.user_email, "resume_builder", f"Improve: {f.filename}")
        return jsonify(result), 200
    finally:
        os.path.exists(p) and os.remove(p)


@app.route("/generate-resume", methods=["POST"])
@require_auth
def generate_resume():
    if not API_KEY: return jsonify({"error": "Gemini not configured"}), 500
    data = request.get_json() or {}
    jd   = data.get("jobDescription")
    tmpl = data.get("template", "modern")
    ud   = data.get("userData", {})
    if not jd: return jsonify({"error": "Job description required"}), 400
    text = _call_gemini(
        f"Expert ATS resume writer.\n\nJD:\n{jd}\n\nUser Data:\n{json.dumps(ud,indent=2)}\n\n"
        "Generate ATS-optimized resume with action verbs and JD keywords. 1 page. ONLY resume text.",
        timeout=45,
    )
    if text is None: return jsonify({"error": "Failed to generate resume"}), 500
    if mongo_db: log_activity(mongo_db, request.user_email, "resume_builder", f"Generate ({tmpl})")
    return jsonify({"resume": text}), 200


@app.route("/evaluate-resume", methods=["POST"])
@require_auth
def evaluate_resume():
    if "file" not in request.files: return jsonify({"error": "Missing resume file"}), 400
    f  = request.files["file"]
    jd = request.form.get("job_description")
    if not jd: return jsonify({"error": "Missing job description"}), 400
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        f.save(tmp.name); p = tmp.name
    try:
        result = get_gemini_ats_score(extract_pdf_text(p), jd)
        if "error" in result: return jsonify(result), 500
        if mongo_db: log_activity(mongo_db, request.user_email, "resume_evaluator",
                                   f"Score {result.get('match_score','?')} — {f.filename}")
        return jsonify(result), 200
    finally:
        os.path.exists(p) and os.remove(p)

# ============================================================
# ROUTES — JOB FINDER
# ============================================================

@app.route("/scrape-review", methods=["POST"])
def scrape_review():
    name = (request.get_json() or {}).get("companyName", "").strip()
    if not name: return jsonify({"error": "Company name required"}), 400
    slug = name.replace(" ", "-")
    url  = f"https://www.glassdoor.com/Reviews/{slug}-reviews-SRCH_KE0,{len(name.replace(' ',''))}.htm"
    return jsonify({"glassdoor_link": url}), 200


@app.route("/api/jobs", methods=["GET"])
@require_auth
def get_jobs():
    try:
        from jobspy import scrape_jobs
    except ImportError:
        return jsonify({"error": "jobspy not installed"}), 500

    query    = request.args.get("query", "").strip()
    location = request.args.get("location", "india")
    num_jobs = int(request.args.get("num_jobs", 10))
    if not query: return jsonify({"error": "Query required"}), 400

    ck = f"{query}:{location}:{num_jobs}"
    if ck in _job_cache and time.time() - _job_cache[ck]["ts"] < _JOB_TTL:
        return jsonify({"jobs": _job_cache[ck]["data"]}), 200

    _LOC = {"india":"india","bengaluru":"india","hyderabad":"india","mumbai":"india",
            "pune":"india","chennai":"india","usa":"usa","us":"usa","united states":"usa",
            "new york, ny":"usa","san francisco, ca":"usa","seattle, wa":"usa",
            "uk":"united kingdom","london, uk":"united kingdom",
            "canada":"canada","toronto":"canada",
            "australia":"australia","sydney":"australia","remote":"usa"}
    country = _LOC.get(location.strip().lower(), "india")

    try:
        df = scrape_jobs(site_name=["indeed"], search_term=query,
                         location=location, results_wanted=num_jobs, country_indeed=country)
        if df is None or len(df) == 0: return jsonify({"jobs": []}), 200
        jobs = df.to_dict("records")
        for job in jobs:
            for k, v in job.items():
                if isinstance(v, float) and math.isnan(v): job[k] = None
        _job_cache[ck] = {"data": jobs, "ts": time.time()}
        if mongo_db: log_activity(mongo_db, request.user_email, "job_finder", f"Query: {query}")
        return jsonify({"jobs": jobs}), 200
    except Exception as exc:
        logger.error(f"Job search: {exc}")
        return jsonify({"error": str(exc), "jobs": []}), 500

# ============================================================
# ROUTES — QUESTION BANK
# ============================================================

@app.route("/generate-questions", methods=["POST"])
@require_auth
def generate_questions():
    if not API_KEY: return jsonify({"error": "Gemini not configured"}), 500
    d  = request.get_json() or {}
    co = d.get("company_name"); ro = d.get("role"); dom = d.get("domain")
    ex = d.get("experience_level"); qt = d.get("question_type"); di = d.get("difficulty")
    nq = int(d.get("num_questions", 15))
    if not all([co, ro, dom, ex, qt, di]):
        return jsonify({"error": "Missing required fields"}), 400

    text = _call_gemini(
        f"Expert interviewer. Generate {nq} interview questions.\n"
        f"Company:{co} Role:{ro} Domain:{dom} Experience:{ex} Type:{qt} Difficulty:{di}\n\n"
        "Each item: {id, question, answer, explanation}. Return ONLY a JSON array.", timeout=60)
    if text is None: return jsonify({"error": "Failed to generate questions"}), 500
    try:
        questions = _clean_gemini_json(text)
    except json.JSONDecodeError as exc:
        return jsonify({"error": f"Parse error: {exc}"}), 500
    if mongo_db: log_activity(mongo_db, request.user_email, "question_bank", f"{nq} q — {co} {ro}")
    return jsonify({"questions": questions}), 200

# ============================================================
# ROUTES — MOCK INTERVIEW (Vapi)
# ============================================================

@app.route("/api/vapi/assistant", methods=["POST"])
@require_auth
def create_vapi_assistant():
    if not VAPI_PRIVATE_KEY: return jsonify({"error": "Vapi not configured"}), 500
    d  = request.get_json() or {}
    jd = d.get("jd", "")
    if not jd: return jsonify({"error": "No JD provided"}), 400
    jd_short = jd[:1500] + ("..." if len(jd) > 1500 else "")
    try:
        r = requests.post("https://api.vapi.ai/assistant",
            headers={"Authorization": f"Bearer {VAPI_PRIVATE_KEY}",
                     "Content-Type": "application/json"},
            json={"name": "AI Interviewer",
                  "firstMessage": "Hello! I'm your AI interviewer. Tell me about yourself.",
                  "model": {"provider": "openai", "model": "gpt-3.5-turbo",
                             "messages": [{"role": "system", "content":
                                 f"You are a professional AI interviewer. JD:\n{jd_short}"}]},
                  "voice": {"provider": "azure", "voiceId": "en-US-JennyNeural"}},
            timeout=15)
        if r.status_code not in (200, 201):
            return jsonify({"error": "Failed to create Vapi assistant"}), 500
        if mongo_db: log_activity(mongo_db, request.user_email, "mock_interview", "Started")
        return jsonify({"id": r.json().get("id")}), 200
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500

# ============================================================
# ERROR HANDLERS
# ============================================================

@app.errorhandler(404)
def not_found(e):    return jsonify({"error": "Route not found"}), 404

@app.errorhandler(405)
def not_allowed(e):  return jsonify({"error": "Method not allowed"}), 405

@app.errorhandler(500)
def server_err(e):
    logger.error(f"Server error: {e}")
    return jsonify({"error": "Internal server error"}), 500

# ============================================================
# ENTRY POINT
# ============================================================
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)), debug=False)