import React, { useState, useEffect } from 'react';
import Vapi from '@vapi-ai/web';

const MockInterview = () => {
    const [jd, setJd] = useState('');
    const [fileName, setFileName] = useState('');
    const [loading, setLoading] = useState(false);
    const [interviewActive, setInterviewActive] = useState(false);
    const [vapi, setVapi] = useState(null);
    const [callStatus, setCallStatus] = useState('disconnected'); // disconnected, connecting, active

    // Initialize Vapi
    useEffect(() => {
        const vapiInstance = new Vapi(process.env.REACT_APP_VAPI_PUBLIC_KEY || process.env.VAPI_PUBLIC_KEY);
        setVapi(vapiInstance);
        return () => {
            vapiInstance.stop();
        };
    }, []);

    // Vapi Event Listeners
    useEffect(() => {
        if (!vapi) return;

        const handleCallStart = () => {
            console.log('Call has started');
            setCallStatus('active');
            setInterviewActive(true);
            setLoading(false);
        };

        const handleCallEnd = () => {
            console.log('Call has ended');
            setCallStatus('disconnected');
            setInterviewActive(false);
            setLoading(false);
        };

        const handleMessage = (message) => {
            // Placeholder: Future implementation can store conversation history here
            // console.log("Message received:", message);
        };

        const handleError = (error) => {
            console.error("Vapi error:", error);
            setLoading(false);
            setInterviewActive(false);
            setCallStatus('disconnected');
        };

        vapi.on('call-start', handleCallStart);
        vapi.on('call-end', handleCallEnd);
        vapi.on('message', handleMessage);
        vapi.on('error', handleError);

        return () => {
            vapi.off('call-start', handleCallStart);
            vapi.off('call-end', handleCallEnd);
            vapi.off('message', handleMessage);
            vapi.off('error', handleError);
        };
    }, [vapi]);

    const handleStartInterview = async () => {
        if (!jd.trim()) {
            alert("Please provide a Job Description first.");
            return;
        }
        if (!vapi) {
            alert("Vapi SDK not initialized. Check your internet connection.");
            return;
        }

        setLoading(true);

        try {
            // 1. Create Assistant on Backend (Secure)
            const token = localStorage.getItem('auth_token') || localStorage.getItem('session_token');
            const response = await fetch('http://localhost:5000/api/vapi/assistant', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ jd })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to create assistant');
            }

            const assistant = await response.json();

            // 2. Start Call with the Assistant ID
            if (assistant.id) {
                await vapi.start(assistant.id);
            } else {
                throw new Error("Backend did not return an Assistant ID");
            }

        } catch (err) {
            console.error("Failed to start Vapi call:", err);
            setCallStatus('disconnected'); // fallback
            setLoading(false);
            alert(`Failed to start interview: ${err.message}`);
        }
    };

    const handleStopInterview = () => {
        if (vapi) {
            vapi.stop();
            // 'call-end' event will handle state updates
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFileName(file.name);
            const reader = new FileReader();
            reader.onload = (ev) => {
                setJd(ev.target.result);
            };
            reader.readAsText(file);
        }
    };

    return (
        <div
            className="mock-interview-page"
            style={{
                height: '89vh',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'stretch',
                justifyContent: 'space-between',
                padding: '2rem',
                width: '100%',
                margin: 0,
                gap: '2rem',
                overflow: 'hidden',
            }}
        >
            {/* Left Column: Instructions/Help */}
            <aside
                className="instructions-column"
                style={{
                    flex: 1,
                    background: '#fff',
                    borderRadius: '16px',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
                    padding: '2rem',
                    overflow: 'auto',
                }}
            >
                <h2 style={{ color: '#23408e', fontWeight: 700, fontSize: '1.5rem', marginBottom: '1rem' }}>
                    How it works
                </h2>
                <ul style={{ color: '#23408e', fontSize: '1rem', lineHeight: '1.6' }}>
                    <li>Paste or upload a Job Description (JD) to start your mock interview.</li>
                    <li>Click <b>Start Interview</b> to begin the voice session.</li>
                    <li>The AI Interviewer will review your JD and start asking questions.</li>
                    <li>Speak clearly into your microphone.</li>
                </ul>
                <div style={{ marginTop: '1rem', fontSize: '0.97em', color: '#23408e' }}>
                    <span role="img" aria-label="info">ℹ️</span>{' '}
                    <b>Status:</b> {callStatus === 'active' ? <span style={{ color: 'green', fontWeight: 'bold' }}>Live Interview in Progress</span> : 'Ready to Start'}
                </div>
            </aside>

            {/* Right Column: JD Input and Controls */}
            <main
                className="interaction-column"
                style={{
                    flex: 2,
                    background: '#fff',
                    borderRadius: '16px',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
                    padding: '2rem',
                    overflow: 'auto',
                }}
            >
                <form className="mock-form" onSubmit={e => { e.preventDefault(); handleStartInterview(); }} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                    <label htmlFor="jd-input" className="jd-label" style={{ fontWeight: 600, marginBottom: 4 }}>
                        Job Description (JD)
                    </label>
                    <textarea
                        id="jd-input"
                        value={jd}
                        onChange={e => setJd(e.target.value)}
                        placeholder="Paste Job Description (JD) here or upload a file..."
                        rows={8}
                        className="jd-textarea enhanced-textarea"
                        disabled={interviewActive}
                        style={{ resize: 'vertical', padding: '0.75rem', borderRadius: 8, border: '1px solid #bfc8e6', fontSize: '1rem', marginBottom: 0 }}
                    />

                    <div className="upload-group" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: 0 }}>
                        <input
                            type="file"
                            accept=".txt,.pdf,.doc,.docx"
                            id="jd-upload"
                            style={{ display: 'none' }}
                            onChange={handleFileUpload}
                            disabled={interviewActive}
                        />
                        <label htmlFor="jd-upload" className="upload-btn" tabIndex={0} style={{ cursor: interviewActive ? 'not-allowed' : 'pointer', background: interviewActive ? '#ccc' : '#23408e', color: '#fff', padding: '0.5rem 1.2rem', borderRadius: 8, fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 2px 8px rgba(35,64,142,0.08)' }}>
                            <span role="img" aria-label="upload">📤</span> <span>Upload JD</span>
                        </label>
                        {fileName && <span className="file-name" title={fileName} style={{ color: '#23408e', fontWeight: 500, fontSize: '0.98rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><span role="img" aria-label="file">📄</span> {fileName}</span>}
                    </div>

                    <div className="button-group" style={{ marginTop: '1.2rem', display: 'flex', gap: '1rem' }}>
                        {!interviewActive ? (
                            <button
                                className="start-button enhanced-btn"
                                type="submit"
                                disabled={loading || !jd.trim()}
                                style={{ flex: 1, background: '#23408e', color: '#fff', padding: '0.8rem', borderRadius: 8, fontWeight: 600, fontSize: '1.1rem', border: 'none', boxShadow: '0 2px 8px rgba(35,64,142,0.08)', cursor: loading || !jd.trim() ? 'not-allowed' : 'pointer', opacity: loading || !jd.trim() ? 0.6 : 1 }}
                            >
                                <span>{loading ? 'Connecting...' : '▶️ Start Interview'}</span>
                            </button>
                        ) : (
                            <button
                                className="stop-button enhanced-btn"
                                type="button"
                                onClick={handleStopInterview}
                                style={{ flex: 1, background: '#d32f2f', color: '#fff', padding: '0.8rem', borderRadius: 8, fontWeight: 600, fontSize: '1.1rem', border: 'none', boxShadow: '0 2px 8px rgba(211,47,47,0.08)', cursor: 'pointer' }}
                            >
                                <span role="img" aria-label="stop">⏹️</span> Stop Interview
                            </button>
                        )}
                    </div>
                </form>

                {interviewActive && (
                    <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '3rem', animation: 'pulse 2s infinite' }}>🎙️</div>
                        <p style={{ color: '#666', marginTop: '1rem' }}>AI Interviewer is listening...</p>
                    </div>
                )}
            </main>

            <style>{`
                @keyframes pulse {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.1); opacity: 0.8; }
                    100% { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default MockInterview;

