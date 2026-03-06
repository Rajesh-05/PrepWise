import React, { useState, useEffect, useRef } from 'react';
import Vapi from '@vapi-ai/web';
import '../styles/MockInterview.css';

const MockInterview = () => {
    const [jd, setJd] = useState('');
    const [fileName, setFileName] = useState('');
    const [loading, setLoading] = useState(false);
    const [interviewActive, setInterviewActive] = useState(false);
    const [vapi, setVapi] = useState(null);
    const [callStatus, setCallStatus] = useState('disconnected');
    const [interviewData, setInterviewData] = useState({ messages: [], startTime: null, endTime: null });
    const [feedback, setFeedback] = useState(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const [loadingFeedback, setLoadingFeedback] = useState(false);
    const generateFeedbackRef = useRef(null);

    useEffect(() => {
        const vapiInstance = new Vapi(process.env.REACT_APP_VAPI_PUBLIC_KEY);
        setVapi(vapiInstance);
        return () => { vapiInstance.stop(); };
    }, []);

    useEffect(() => {
        if (!vapi) return;
        const handleCallStart = () => {
            setCallStatus('active');
            setInterviewActive(true);
            setLoading(false);
            setInterviewData({ messages: [], startTime: new Date(), endTime: null });
            setFeedback(null);
            setShowFeedback(false);
        };
        const handleCallEnd = () => {
            setCallStatus('disconnected');
            setInterviewActive(false);
            setLoading(false);
            setInterviewData(prev => ({ ...prev, endTime: new Date() }));
            setTimeout(() => { if (generateFeedbackRef.current) generateFeedbackRef.current(); }, 1000);
        };
        const handleMessage = (message) => {
            setInterviewData(prev => ({ ...prev, messages: [...prev.messages, message] }));
        };
        const handleError = (error) => {
            console.error('Vapi error:', error);
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
        if (!jd.trim()) { alert('Please provide a Job Description first.'); return; }
        if (!vapi) { alert('Vapi SDK not initialized. Check your internet connection.'); return; }
        setLoading(true);
        try {
            const token = localStorage.getItem('auth_token') || localStorage.getItem('session_token');
            const response = await fetch('http://localhost:5000/api/vapi/assistant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ jd })
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to create assistant');
            }
            const assistant = await response.json();
            if (assistant.id) { await vapi.start(assistant.id); }
            else throw new Error('Backend did not return an Assistant ID');
        } catch (err) {
            console.error('Failed to start Vapi call:', err);
            setCallStatus('disconnected');
            setLoading(false);
            alert(`Failed to start interview: ${err.message}`);
        }
    };

    const handleStopInterview = () => { if (vapi) vapi.stop(); };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFileName(file.name);
            const reader = new FileReader();
            reader.onload = (ev) => setJd(ev.target.result);
            reader.readAsText(file);
        }
    };

    const generateFeedback = async () => {
        if (interviewData.messages.length === 0) return;
        setLoadingFeedback(true);
        setShowFeedback(true);
        try {
            const transcript = interviewData.messages
                .map(msg => {
                    const role = msg.type === 'transcript' ? (msg.role === 'assistant' ? 'Interviewer' : 'Candidate') : msg.type;
                    const text = msg.transcript || msg.content || JSON.stringify(msg);
                    return `${role}: ${text}`;
                })
                .join('\n\n');
            const duration = interviewData.endTime && interviewData.startTime
                ? (interviewData.endTime - interviewData.startTime) / 1000 / 60 : 0;
            const token = localStorage.getItem('auth_token') || localStorage.getItem('session_token');
            const response = await fetch('/api/vapi/generate-feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ jobDescription: jd, transcript, duration: Math.round(duration) })
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

    useEffect(() => { generateFeedbackRef.current = generateFeedback; });

    const statusIsActive = callStatus === 'active';

    return (
        <div className="mock-interview-page">

            {/* Two-column layout */}
            <div className="mi-body">
                {/* Left: How it works */}
                <aside className="mi-instructions">
                    <h2 className="mi-panel-title">How it works</h2>
                    <div className="mi-steps">
                        <div className="mi-step">
                            <span className="step-num">1</span>
                            <div>
                                <strong>Paste or upload a Job Description</strong>
                                <p>The interviewer tailors questions to the role requirements.</p>
                            </div>
                        </div>
                        <div className="mi-step">
                            <span className="step-num">2</span>
                            <div>
                                <strong>Click Start Interview</strong>
                                <p>A voice session begins. Speak clearly into your microphone.</p>
                            </div>
                        </div>
                        <div className="mi-step">
                            <span className="step-num">3</span>
                            <div>
                                <strong>Finish & get feedback</strong>
                                <p>After the session, receive detailed scores and improvement tips.</p>
                            </div>
                        </div>
                    </div>

                    <div className="mi-tips">
                        <h3 className="mi-tips-title">💡 Tips for best results</h3>
                        <ul>
                            <li>Use a quiet room with no background noise</li>
                            <li>Speak at a natural, clear pace</li>
                            <li>Have the full JD ready — more detail = better questions</li>
                        </ul>
                    </div>
                </aside>

                {/* Right: Interaction */}
                <main className="mi-interaction">
                    {/* Active session indicator */}
                    {interviewActive && (
                        <div className="mi-live-banner">
                            <div className="live-mic">🎙️</div>
                            <p>Interviewer is listening... Speak when ready.</p>
                        </div>
                    )}

                    <form className="mi-form" onSubmit={e => { e.preventDefault(); handleStartInterview(); }}>
                        <label htmlFor="jd-input" className="mi-label">
                            Job Description (JD)
                        </label>
                        <textarea
                            id="jd-input"
                            className="mi-textarea"
                            value={jd}
                            onChange={e => setJd(e.target.value)}
                            placeholder="Paste the Job Description here, or upload a file below..."
                            rows={9}
                            disabled={interviewActive}
                        />

                        <div className="mi-upload-group">
                            <input
                                type="file"
                                accept=".txt,.pdf,.doc,.docx"
                                id="jd-upload"
                                className="sr-only"
                                onChange={handleFileUpload}
                                disabled={interviewActive}
                            />
                            <label htmlFor="jd-upload" className={`mi-upload-btn${interviewActive ? ' disabled' : ''}`}>
                                📤 Upload JD
                            </label>
                            {fileName && (
                                <span className="mi-filename">
                                    📄 {fileName}
                                </span>
                            )}
                        </div>

                        <div className="mi-btn-group">
                            {!interviewActive ? (
                                <button
                                    className="mi-btn primary"
                                    type="submit"
                                    disabled={loading || !jd.trim()}
                                >
                                    {loading ? (
                                        <><span className="mi-spinner"></span> Connecting...</>
                                    ) : (
                                        <>▶ Start Interview</>
                                    )}
                                </button>
                            ) : (
                                <button
                                    className="mi-btn danger"
                                    type="button"
                                    onClick={handleStopInterview}
                                >
                                    ⏹ Stop Interview
                                </button>
                            )}

                            {!interviewActive && interviewData.messages.length > 0 && (
                                <button
                                    className="mi-btn secondary"
                                    type="button"
                                    onClick={generateFeedback}
                                    disabled={loadingFeedback}
                                >
                                    {loadingFeedback ? '⏳ Analyzing...' : '📊 Get Feedback'}
                                </button>
                            )}
                        </div>
                    </form>
                </main>
            </div>

            {/* Feedback Modal */}
            {showFeedback && (
                <div className="mi-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowFeedback(false); }}>
                    <div className="mi-modal">
                        <button className="mi-modal-close" onClick={() => setShowFeedback(false)}>✕</button>
                        <h2 className="mi-modal-title">📊 Interview Feedback</h2>

                        {loadingFeedback ? (
                            <div className="mi-modal-loading">
                                <div className="mi-spinner large"></div>
                                <p>Analyzing your interview performance...</p>
                            </div>
                        ) : feedback ? (
                            <div className="mi-feedback">
                                {/* Score cards */}
                                <div className="mi-score-grid">
                                    {[
                                        { label: 'Overall', value: feedback.overall_score, icon: '🏆' },
                                        { label: 'Communication', value: feedback.communication_score, icon: '🗣️' },
                                        { label: 'Technical', value: feedback.technical_score, icon: '💻' },
                                        { label: 'Confidence', value: feedback.confidence_score, icon: '🎯' },
                                    ].map(s => (
                                        <div key={s.label} className="score-card">
                                            <div className="score-icon">{s.icon}</div>
                                            <div className="score-value">{s.value}<span>/10</span></div>
                                            <div className="score-label">{s.label}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Summary */}
                                <div className="mi-feedback-block">
                                    <h3>Summary</h3>
                                    <p>{feedback.summary}</p>
                                </div>

                                {/* Detailed */}
                                <div className="mi-feedback-block">
                                    <h3>Detailed Analysis</h3>
                                    <p>{feedback.detailed_feedback}</p>
                                </div>

                                {/* Strengths */}
                                {feedback.strengths?.length > 0 && (
                                    <div className="mi-feedback-block strengths">
                                        <h3>✅ Strengths</h3>
                                        <ul>
                                            {feedback.strengths.map((s, i) => <li key={i}>{s}</li>)}
                                        </ul>
                                    </div>
                                )}

                                {/* Weaknesses */}
                                {feedback.weaknesses?.length > 0 && (
                                    <div className="mi-feedback-block weaknesses">
                                        <h3>⚠️ Areas for Improvement</h3>
                                        <ul>
                                            {feedback.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                                        </ul>
                                    </div>
                                )}

                                {/* Actions */}
                                {feedback.recommended_actions?.length > 0 && (
                                    <div className="mi-feedback-block actions">
                                        <h3>🎯 Recommended Actions</h3>
                                        <ul>
                                            {feedback.recommended_actions.map((a, i) => <li key={i}>{a}</li>)}
                                        </ul>
                                    </div>
                                )}

                                <div className="mi-modal-footer">
                                    <button
                                        className="mi-btn primary"
                                        onClick={() => {
                                            setShowFeedback(false);
                                            setJd('');
                                            setInterviewData({ messages: [], startTime: null, endTime: null });
                                        }}
                                    >
                                        Start New Interview
                                    </button>
                                    <button
                                        className="mi-btn outline"
                                        onClick={() => window.location.href = '/dashboard'}
                                    >
                                        View Dashboard
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <p className="mi-modal-empty">No feedback available yet.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MockInterview;
