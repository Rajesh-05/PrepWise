import asyncio
import logging
import sounddevice as sd
import numpy as np
from google import genai
from google.genai import types
import os
from queue import Queue
import threading
from dotenv import load_dotenv
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
import time
import math
import fitz  
import tempfile
import requests
import pdfplumber
from pymongo import MongoClient, ASCENDING
from pymongo.errors import DuplicateKeyError
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
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

app = Flask(__name__)
CORS(app)

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
def get_jobs():
	query = request.args.get('query', '')
	location = request.args.get('location', '')
	num_jobs = int(request.args.get('num_jobs', 10))
	cache_key = f"{query}:{location}:{num_jobs}"
	now = time.time()
	# Return cached if not expired
	if cache_key in job_cache and now - job_cache[cache_key]["timestamp"] < cache_expiry:
		return jsonify({"jobs": job_cache[cache_key]["data"]})
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
		jobs = scrape_jobs(
			site_name=["linkedin", "indeed"],
			search_term=query,
			location=location,
			num_jobs=num_jobs,
			country=country
		)
		jobs_list = jobs.to_dict("records")
		# Replace NaN values with None
		for job in jobs_list:
			for key, value in job.items():
				if isinstance(value, float) and math.isnan(value):
					job[key] = None
		job_cache[cache_key] = {"data": jobs_list, "timestamp": now}
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
if MONGODB_URI:
    try:
        mongo_client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
        db = mongo_client[MONGODB_DBNAME]
        users_col = db["users"]
        users_col.create_index([("email", ASCENDING)], unique=True)
    except Exception as e:
        print(f"Warning: Failed to initialize MongoDB: {e}")
else:
    print("Warning: MONGODB_URI not set. Auth endpoints will return 503.")
client = genai.Client(api_key=API_KEY)
model = "gemini-live-2.5-flash-preview"
config = {
    "response_modalities": ["AUDIO"],
    "speech_config": types.SpeechConfig(
        voice_config=types.VoiceConfig(
            prebuilt_voice_config=types.PrebuiltVoiceConfig(
                voice_name="LEDA"
            )
        )
    ),
   "system_instruction": "You are a professional mock interviewer. Conduct realistic, adaptive interview simulations. Ask challenging and relevant questions, provide feedback, and adjust difficulty based on responses. Keep the tone professional, constructive, and supportive."
}

# Keep the base system instruction separate so we don't accidentally append it multiple times
BASE_SYSTEM_INSTRUCTION = config.get("system_instruction", "You are a professional mock interviewer.")

# Audio buffer for continuous playback
audio_buffer = np.array([], dtype=np.int16)
buffer_lock = threading.Lock()

def audio_output_callback(outdata, frames, time, status):
    """Callback for playing audio output"""
    global audio_buffer
    if status:
        print(f"Output status: {status}")
    with buffer_lock:
        # Fill buffer from queue
        while not audio_output_queue.empty() and len(audio_buffer) < frames * 4:
            try:
                data = audio_output_queue.get_nowait()
                audio_buffer = np.append(audio_buffer, data)
            except:
                break
        # Play from buffer
        if len(audio_buffer) >= frames:
            outdata[:, 0] = audio_buffer[:frames]
            audio_buffer = audio_buffer[frames:]
        else:
            # Not enough data, pad with silence
            if len(audio_buffer) > 0:
                outdata[:len(audio_buffer), 0] = audio_buffer
                outdata[len(audio_buffer):, 0] = 0
                audio_buffer = np.array([], dtype=np.int16)
            else:
                outdata.fill(0)



# Audio queues for threading with larger max size
audio_input_queue = Queue(maxsize=100)
audio_output_queue = Queue(maxsize=200)

def audio_input_callback(indata, frames, time, status):
    """Callback for capturing microphone input"""
    if status:
        print(f"Input status: {status}")
    try:
        audio_input_queue.put(indata.copy(), block=False)
    except:
        pass  # Queue full, skip this chunk


async def send_audio(session, stop_event):
    """Send audio from microphone to Gemini"""
    print("🎤 Listening... (Press Ctrl+C to stop)")
    
    try:
        while not stop_event.is_set():
            try:
                if not audio_input_queue.empty():
                    audio_chunk = audio_input_queue.get(timeout=0.01)
                    
                    # Send audio to Gemini
                    await session.send_realtime_input(
                        audio=types.Blob(
                            data=audio_chunk.tobytes(),
                            mime_type="audio/pcm;rate=16000"
                        )
                    )
                else:
                    await asyncio.sleep(0.01)
            except Exception as e:
                if not stop_event.is_set():
                    print(f"Error in send loop: {e}")
                    await asyncio.sleep(0.1)
    except asyncio.CancelledError:
        print("Send task cancelled")
    except Exception as e:
        print(f"Fatal error sending audio: {e}")
        import traceback
        traceback.print_exc()

async def receive_audio(session, stop_event):
    """Receive audio responses from Gemini - TRULY CONTINUOUS"""
    turn_count = 0
    try:
        while not stop_event.is_set():
            async for response in session.receive():
                if stop_event.is_set():
                    break
                # Check if there's audio data
                if response.data is not None:
                    print(f"🔊 Audio chunk ({len(response.data)} bytes)")
                    audio_data = np.frombuffer(response.data, dtype=np.int16)
                    audio_output_queue.put(audio_data)
                # Handle server content
                if response.server_content:
                    if response.server_content.turn_complete:
                        turn_count += 1
                        print(f"✅ Turn {turn_count} complete - evaluating response...")
                        user_response = getattr(response.server_content, 'input_transcription', None)
                        feedback = "No feedback available."
                        if user_response:
                            feedback = evaluate_response(user_response)
                            print(f"📝 Feedback: {feedback}")
                        print("🔄 Preparing next question...")
                        adjust_difficulty(turn_count, feedback)
                        print(f"✅ Turn {turn_count} complete - ready for next input!")
            if stop_event.is_set():
                break
            print("⚠️  Session receive loop ended, waiting...")
            await asyncio.sleep(0.5)
    except asyncio.CancelledError:
        print("Receive task cancelled")
    except Exception as e:
        if not stop_event.is_set():
            print(f"Fatal error receiving audio: {e}")
            import traceback
            traceback.print_exc()

# Function to get the Job Description (JD) from the user
def get_job_description():
    print("📄 Please provide the Job Description (JD) for the interview:")
    jd = input("Enter JD or path to JD file: ").strip()

    # Check if JD is a file path
    if os.path.isfile(jd):
        try:
            with open(jd, 'r') as file:
                jd_content = file.read()
                print("✅ JD loaded from file.")
                return jd_content
        except Exception as e:
            print(f"❌ Error reading JD file: {e}")
            return None
    else:
        # Assume JD is directly provided as text
        print("✅ JD provided as text.")
        return jd

# Function to evaluate the user's response
def evaluate_response(user_response):
    """Evaluate the user's response and provide feedback."""
    # Placeholder logic for evaluation - replace with actual logic or API call
    if "good" in user_response.lower():
        return "Great response! Keep it up."
    elif "bad" in user_response.lower():
        return "Consider elaborating more on your answer."
    else:
        return "Good effort! Try to be more specific."

# Function to adjust difficulty dynamically
def adjust_difficulty(turn_count, feedback):
    """Adjust the difficulty of the next question based on feedback."""
    # Placeholder logic for adjusting difficulty
    if "Great" in feedback:
        print("🔼 Increasing difficulty for the next question.")
    elif "Consider" in feedback:
        print("🔽 Lowering difficulty for the next question.")
    else:
        print("➡️ Keeping difficulty the same.")


interview_lock = threading.Lock()
interview_thread_running = False
interview_stop_event = None

def run_interview_session(job_description):
    global interview_thread_running, interview_stop_event
    # Create a session-specific config to avoid mutating the global config and accidentally
    # appending the system instruction multiple times if sessions are started repeatedly.
    session_config = dict(config)
    session_config["system_instruction"] = (
        f"{BASE_SYSTEM_INSTRUCTION} Use the following Job Description (JD) as context:\n{job_description}"
    )

    def interview_thread():
        global interview_thread_running, interview_stop_event
        interview_stop_event = asyncio.Event()
        input_stream = None
        output_stream = None
        async def interview():
            global interview_stop_event, interview_thread_running
            nonlocal input_stream, output_stream
            try:
                async with client.aio.live.connect(model=model, config=session_config) as session:
                    print("✅ Connected to Gemini Live API")
                    input_stream = sd.InputStream(
                        channels=1,
                        samplerate=16000,
                        dtype=np.int16,
                        callback=audio_input_callback,
                        blocksize=1024
                    )
                    output_stream = sd.OutputStream(
                        channels=1,
                        samplerate=24000,
                        dtype=np.int16,
                        callback=audio_output_callback,
                        blocksize=2048
                    )
                    input_stream.start()
                    output_stream.start()
                    print("🎙️  Audio streams started\n")
                    send_task = asyncio.create_task(send_audio(session, interview_stop_event))
                    receive_task = asyncio.create_task(receive_audio(session, interview_stop_event))
                    while not interview_stop_event.is_set():
                        await asyncio.sleep(0.05)
                    # Stop audio streams immediately when stop event is set
                    if input_stream:
                        input_stream.stop()
                        input_stream.close()
                    if output_stream:
                        output_stream.stop()
                        output_stream.close()
                    print("Interview stopped by user.")
                    await asyncio.sleep(0.2)
                    # Optionally cancel tasks
                    send_task.cancel()
                    receive_task.cancel()
                    await asyncio.gather(send_task, receive_task, return_exceptions=True)
            except Exception as e:
                print(f"\n❌ Error: {e}")
                import traceback
                traceback.print_exc()
            finally:
                interview_stop_event.set()
        asyncio.run(interview())
        # Ensure state is reset after thread ends
        with interview_lock:
            interview_thread_running = False
            interview_stop_event = None

    with interview_lock:
        if interview_thread_running:
            return None 
        interview_thread_running = True

    thread = threading.Thread(target=interview_thread, daemon=True)
    thread.start()
    return "Interview session started in background."

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
        return {"error": f"Gemini API returned status {response.status_code}", "details": resp_json}

    # Try to extract text candidate safely
    try:
        candidates = resp_json.get("candidates")
        if not candidates or not isinstance(candidates, list):
            return {"error": "Gemini response missing 'candidates' field", "raw": resp_json}
        text = candidates[0]["content"]["parts"][0]["text"]
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

@app.route('/stop-interview', methods=['POST'])
def stop_interview_route():
    global interview_stop_event, interview_thread_running
    global audio_buffer
    with interview_lock:
        if interview_thread_running and interview_stop_event:
            interview_stop_event.set()
            # Clear queues and reset state
            while not audio_input_queue.empty():
                try:
                    audio_input_queue.get_nowait()
                except:
                    break
            while not audio_output_queue.empty():
                try:
                    audio_output_queue.get_nowait()
                except:
                    break
            # Reset audio buffer
            audio_buffer = np.array([], dtype=np.int16)
            # Optionally reset other globals here if needed
            return jsonify({"result": "Interview stopped and all state reset."})
        else:
            return jsonify({"error": "No interview session running."}), 409

@app.route('/interview', methods=['POST'])
def interview_route():
    data = request.get_json()
    job_description = data.get('jd')
    if not job_description:
        return jsonify({"error": "No JD provided."}), 400
    result = run_interview_session(job_description)
    if result is None:
        return jsonify({"error": "Interview session already running. Please wait for it to finish."}), 409
    return jsonify({"result": result})

@app.route('/improve-resume', methods=['POST'])
def improve_resume():
    if 'file' not in request.files:
        return jsonify({"error": "Missing resume file"}), 400
    file = request.files['file']
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        file.save(tmp.name)
        tmp_path = tmp.name
    try:
        resume_text = extract_pdf_text(tmp_path)
        result = get_gemini_resume_improvements(resume_text)
    except Exception as e:
        result = {"error": str(e)}
    finally:
        os.remove(tmp_path)
    if "error" in result:
        return jsonify(result), 500
    return jsonify(result)

@app.route('/evaluate-resume', methods=['POST'])
def evaluate_resume():
    if 'file' not in request.files:
        return jsonify({"error": "Missing resume file"}), 400
    file = request.files['file']
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
    except Exception as e:
        result = {"error": str(e)}
    finally:
        os.remove(tmp_path)
    if "error" in result:
        return jsonify(result), 500
    return jsonify(result)

@app.route('/generate-questions', methods=['POST'])
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
        text = candidates[0]["content"]["parts"][0]["text"]

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
    except Exception as e:
        return jsonify({"error": f"Failed to parse Gemini response: {e}", "raw": text if 'text' in locals() else response.text}), 500

    return jsonify({
        "company": company,
        "role": role,
        "domain": domain,
        "experience_level": experience,
        "question_type": qtype,
        "difficulty": difficulty,
        "questions": questions_list
    })

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
    token = issue_jwt(user.get('_id'), email)
    profile = {
        "firstName": user.get('firstName'),
        "lastName": user.get('lastName'),
        "email": user.get('email'),
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
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        email = payload.get('email')
        user = users_col.find_one({"email": email}, {"passwordHash": 0})
        if not user:
            return jsonify({"error": "User not found"}), 404
        user["_id"] = str(user["_id"]) if "_id" in user else None
        return jsonify({"user": user})
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Token expired"}), 401
    except Exception as e:
        return jsonify({"error": f"Invalid token: {e}"}), 401

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
    app.run(debug=True)
