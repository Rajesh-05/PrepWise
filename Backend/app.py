import asyncio
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


app = Flask(__name__)
CORS(app)
# Use the half-cascade model for stable production performance
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


# Load .env file
load_dotenv()

# Use environment variable for API key - NO HARDCODED KEY
API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    raise ValueError("GEMINI_API_KEY not found in environment variables")
client = genai.Client(api_key=API_KEY)

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

async def send_audio(session, stop_event):
    """Send audio from microphone to Gemini"""
    print("🎤 Listening... (Press Ctrl+C to stop)")
    try:
        while not stop_event.is_set():
            try:
                if stop_event.is_set():
                    break
                if not audio_input_queue.empty():
                    audio_chunk = audio_input_queue.get(timeout=0.01)
                    await session.send_realtime_input(
                        audio=types.Blob(
                            data=audio_chunk.tobytes(),
                            mime_type="audio/pcm;rate=16000"
                        )
                    )
                else:
                    await asyncio.sleep(0.01)
            except Exception as e:
                if stop_event.is_set():
                    break
                print(f"Error in send loop: {e}")
                await asyncio.sleep(0.1)
    except asyncio.CancelledError:
        print("Send task cancelled")
    except Exception as e:
        print(f"Fatal error sending audio: {e}")
        import traceback
        traceback.print_exc()

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


# Load .env file
load_dotenv()

# Use environment variable for API key - NO HARDCODED KEY
API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    raise ValueError("GEMINI_API_KEY not found in environment variables")
client = genai.Client(api_key=API_KEY)

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
                        print("🔍 Debug: server_content attributes:", dir(response.server_content))
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


import time
interview_lock = threading.Lock()
interview_thread_running = False
interview_stop_event = None

def run_interview_session(job_description):
    global interview_thread_running, interview_stop_event
    config["system_instruction"] = (
        "You are a professional mock interviewer. Conduct realistic, adaptive interview simulations. "
        "Ask challenging and relevant questions, provide feedback, and adjust difficulty based on responses. "
        "Keep the tone professional, constructive, and supportive. Use the following Job Description (JD) as context: \n"
        f"{job_description}"
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
                async with client.aio.live.connect(model=model, config=config) as session:
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

if __name__ == "__main__":
    app.run(debug=True)