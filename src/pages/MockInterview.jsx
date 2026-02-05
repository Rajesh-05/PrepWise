import React, { useState, useEffect, useRef } from 'react';
import Vapi from '@vapi-ai/web';
import '../styles/MockInterview.css';

const MockInterview = () => {
    const [jd, setJd] = useState('');
    const [fileName, setFileName] = useState('');
    const [loading, setLoading] = useState(false);
    const [interviewActive, setInterviewActive] = useState(false);
    const [vapi, setVapi] = useState(null);
    const [callStatus, setCallStatus] = useState('disconnected'); // disconnected, connecting, active
    const [interviewData, setInterviewData] = useState({ messages: [], startTime: null, endTime: null });
    const [feedback, setFeedback] = useState(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const [loadingFeedback, setLoadingFeedback] = useState(false);

    // Keep the latest generateFeedback function in a ref to avoid stale closures in event listeners
    // without causing the effect to re-run on every state change.
    const generateFeedbackRef = useRef(null);

    // Initialize Vapi
    useEffect(() => {
        const vapiInstance = new Vapi(process.env.REACT_APP_VAPI_PUBLIC_KEY);
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
            setInterviewData({ messages: [], startTime: new Date(), endTime: null });
            setFeedback(null);
            setShowFeedback(false);
        };

        const handleCallEnd = () => {
            console.log('Call has ended');
            setCallStatus('disconnected');
            setInterviewActive(false);
            setLoading(false);
            setInterviewData(prev => ({ ...prev, endTime: new Date() }));
            // Automatically trigger feedback generation using the latest function from ref
            setTimeout(() => {
                if (generateFeedbackRef.current) {
                    generateFeedbackRef.current();
                }
            }, 1000);
        };

        const handleMessage = (message) => {
            console.log("Message received:", message);
            // Capture all messages for transcript
            setInterviewData(prev => ({
                ...prev,
                messages: [...prev.messages, message]
            }));
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

    const generateFeedback = async () => {
        if (interviewData.messages.length === 0) {
            console.log('No interview data to analyze');
            return;
        }

        setLoadingFeedback(true);
        setShowFeedback(true);

        try {
            // Build transcript from messages
            const transcript = interviewData.messages
                .map(msg => {
                    const role = msg.type === 'transcript' ?
                        (msg.role === 'assistant' ? 'Interviewer' : 'Candidate') :
                        msg.type;
                    const text = msg.transcript || msg.content || JSON.stringify(msg);
                    return `${role}: ${text}`;
                })
                .join('\n\n');

            // Calculate duration
            const duration = interviewData.endTime && interviewData.startTime ?
                (interviewData.endTime - interviewData.startTime) / 1000 / 60 : 0;

            const token = localStorage.getItem('auth_token') || localStorage.getItem('session_token');
            const response = await fetch('/api/vapi/generate-feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    jobDescription: jd,
                    transcript: transcript,
                    duration: Math.round(duration)
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to generate feedback');
            }

            const feedbackData = await response.json();
            setFeedback(feedbackData);

        } catch (err) {
            console.error('Failed to generate feedback:', err);
            alert(`Failed to generate feedback: ${err.message}`);
            setShowFeedback(false);
        } finally {
            setLoadingFeedback(false);
        }
    };

    // Keep the ref updated with the latest function
    useEffect(() => {
        generateFeedbackRef.current = generateFeedback;
    });

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
                        {!interviewActive && interviewData.messages.length > 0 && (
                            <button
                                className="feedback-button enhanced-btn"
                                type="button"
                                onClick={generateFeedback}
                                disabled={loadingFeedback}
                                style={{ flex: 1, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff', padding: '0.8rem', borderRadius: 8, fontWeight: 600, fontSize: '1.1rem', border: 'none', boxShadow: '0 2px 8px rgba(102,126,234,0.3)', cursor: loadingFeedback ? 'not-allowed' : 'pointer', opacity: loadingFeedback ? 0.6 : 1 }}
                            >
                                <span>{loadingFeedback ? '⏳ Analyzing...' : '📊 Get Feedback'}</span>
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
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>

            {/* Feedback Modal/Panel */}
            {showFeedback && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '2rem',
                    overflowY: 'auto'
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '12px',
                        maxWidth: '800px',
                        width: '100%',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        padding: '2rem',
                        position: 'relative'
                    }}>
                        <button
                            onClick={() => setShowFeedback(false)}
                            style={{
                                position: 'absolute',
                                top: '1rem',
                                right: '1rem',
                                background: 'none',
                                border: 'none',
                                fontSize: '24px',
                                cursor: 'pointer',
                                color: '#666'
                            }}
                        >
                            ×
                        </button>

                        <h2 style={{ marginBottom: '1.5rem', color: '#333' }}>📊 Interview Feedback</h2>

                        {loadingFeedback ? (
                            <div style={{ textAlign: 'center', padding: '3rem' }}>
                                <div className="spinner" style={{
                                    border: '4px solid #f3f3f3',
                                    borderTop: '4px solid #667eea',
                                    borderRadius: '50%',
                                    width: '50px',
                                    height: '50px',
                                    animation: 'spin 1s linear infinite',
                                    margin: '0 auto 1rem'
                                }}></div>
                                <p>Analyzing your interview performance...</p>
                            </div>
                        ) : feedback ? (
                            <div>
                                {/* Score Cards */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                                    <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', padding: '1.5rem', borderRadius: '8px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{feedback.overall_score}/10</div>
                                        <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Overall Score</div>
                                    </div>
                                    <div style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white', padding: '1.5rem', borderRadius: '8px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{feedback.communication_score}/10</div>
                                        <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Communication</div>
                                    </div>
                                    <div style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white', padding: '1.5rem', borderRadius: '8px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{feedback.technical_score}/10</div>
                                        <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Technical</div>
                                    </div>
                                    <div style={{ background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', color: 'white', padding: '1.5rem', borderRadius: '8px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{feedback.confidence_score}/10</div>
                                        <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Confidence</div>
                                    </div>
                                </div>

                                {/* Summary */}
                                <div style={{ backgroundColor: '#f8f9fa', padding: '1.5rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                                    <h3 style={{ marginBottom: '0.5rem', color: '#333' }}>Summary</h3>
                                    <p style={{ color: '#666', lineHeight: '1.6' }}>{feedback.summary}</p>
                                </div>

                                {/* Detailed Feedback */}
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <h3 style={{ marginBottom: '0.5rem', color: '#333' }}>Detailed Analysis</h3>
                                    <p style={{ color: '#666', lineHeight: '1.6' }}>{feedback.detailed_feedback}</p>
                                </div>

                                {/* Strengths */}
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <h3 style={{ marginBottom: '0.5rem', color: '#333' }}>✅ Strengths</h3>
                                    <ul style={{ paddingLeft: '1.5rem' }}>
                                        {feedback.strengths?.map((strength, idx) => (
                                            <li key={idx} style={{ color: '#28a745', marginBottom: '0.5rem' }}>{strength}</li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Weaknesses */}
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <h3 style={{ marginBottom: '0.5rem', color: '#333' }}>⚠️ Areas for Improvement</h3>
                                    <ul style={{ paddingLeft: '1.5rem' }}>
                                        {feedback.weaknesses?.map((weakness, idx) => (
                                            <li key={idx} style={{ color: '#dc3545', marginBottom: '0.5rem' }}>{weakness}</li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Recommended Actions */}
                                <div style={{ backgroundColor: '#e7f3ff', padding: '1.5rem', borderRadius: '8px' }}>
                                    <h3 style={{ marginBottom: '0.5rem', color: '#0066cc' }}>🎯 Recommended Actions</h3>
                                    <ul style={{ paddingLeft: '1.5rem' }}>
                                        {feedback.recommended_actions?.map((action, idx) => (
                                            <li key={idx} style={{ color: '#0066cc', marginBottom: '0.5rem' }}>{action}</li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Action Buttons */}
                                <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                                    <button
                                        onClick={() => {
                                            setShowFeedback(false);
                                            setJd('');
                                            setInterviewData({ messages: [], startTime: null, endTime: null });
                                        }}
                                        style={{
                                            flex: 1,
                                            padding: '0.75rem 1.5rem',
                                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            fontWeight: '600'
                                        }}
                                    >
                                        Start New Interview
                                    </button>
                                    <button
                                        onClick={() => window.location.href = '/dashboard'}
                                        style={{
                                            flex: 1,
                                            padding: '0.75rem 1.5rem',
                                            background: '#f8f9fa',
                                            color: '#333',
                                            border: '1px solid #ddd',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            fontWeight: '600'
                                        }}
                                    >
                                        View Dashboard
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <p style={{ textAlign: 'center', color: '#666' }}>No feedback available</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MockInterview;

