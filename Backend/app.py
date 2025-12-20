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
# Use a supported Gemini model for the live API
model = "gemini-2.5-flash"
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


if __name__ == "__main__":
    app.run(debug=True)
