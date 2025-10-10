import React, { useState, useRef, useEffect } from 'react';

const MockInterview = () => {
    const [jd, setJd] = useState('');
    const [fileName, setFileName] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState('');
    const [error, setError] = useState('');
    const [interviewActive, setInterviewActive] = useState(false);
    // Timer state
    const [elapsed, setElapsed] = useState(0);
    const timerRef = useRef(null);
    // Help modal state
    const [showHelp, setShowHelp] = useState(false);
        // Stop Interview handler
    const handleStopInterview = async () => {
        try {
            const response = await fetch('http://localhost:5000/stop-interview', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            const data = await response.json();
            if (response.ok) {
                setInterviewActive(false);
                setLoading(false);
                setResult('Interview stopped.');
                setElapsed(0);
                if (timerRef.current) {
                    clearInterval(timerRef.current);
                }
            } else {
                setError(data.error || 'Failed to stop interview.');
            }
        } catch (err) {
            setError('Could not connect to backend.');
        }
    };

    const handleStartInterview = async () => {
        if (loading || interviewActive) return; // Prevent multiple sessions
        setLoading(true);
        setError('');
        setResult('');
        setInterviewActive(true);
        setElapsed(0);
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }
        timerRef.current = setInterval(() => {
            setElapsed(prev => prev + 1);
        }, 1000);
        try {
            const response = await fetch('http://localhost:5000/interview', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ jd }),
            });
            const data = await response.json();
            if (response.ok) {
                setResult(data.result);
            } else {
                setError(data.error || 'Failed to start interview.');
                setInterviewActive(false);
                if (timerRef.current) {
                    clearInterval(timerRef.current);
                }
            }
        } catch (err) {
            setError('Could not connect to backend.');
            setInterviewActive(false);
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        } finally {
            setLoading(false);
        }
    };

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, []);

    // Format elapsed seconds to HH:MM:SS
    const formatTime = (secs) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        return [h, m, s]
            .map(v => v < 10 ? '0' + v : v)
            .join(':');
    };

    // Handle file upload for JD
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
        <div className="mock-interview-page enhanced-bg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg, #f8fafc 0%, #e3eafc 100%)' }}>
            <div className="mock-interview-grid" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                <section className="mock-interview-card enhanced-card" style={{ maxWidth: 480, width: '100%', background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', padding: '2rem', margin: '2rem 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.1rem' }}>
                        <h2 className="mock-title" style={{ display: 'flex', alignItems: 'center', fontSize: '2rem', fontWeight: 700, color: '#23408e', margin: 0 }}>
                            <span role="img" aria-label="interview" style={{ marginRight: '12px', fontSize: '2.2rem' }}>🗣️</span>
                            Mock Interview
                        </h2>
                        <button
                            className="help-icon"
                            title="Help / FAQ"
                            aria-label="Help / FAQ"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.7rem', color: '#23408e', marginLeft: '0.5rem' }}
                            onClick={() => setShowHelp(true)}
                        >
                            <span role="img" aria-label="help">❓</span>
                        </button>
                    </div>
                    {/* Help Modal */}
                    {showHelp && (
                        <div className="help-modal" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(35,64,142,0.13)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
                            <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 4px 24px rgba(35,64,142,0.18)', padding: '2rem', maxWidth: 400, width: '90%', position: 'relative' }}>
                                <button
                                    onClick={() => setShowHelp(false)}
                                    style={{ position: 'absolute', top: 12, right: 16, background: 'none', border: 'none', fontSize: '1.5rem', color: '#d32f2f', cursor: 'pointer' }}
                                    aria-label="Close help"
                                >
                                    &times;
                                </button>
                                <h3 style={{ color: '#23408e', fontWeight: 700, marginBottom: '1rem', fontSize: '1.3rem' }}>Mock Interview Help & FAQ</h3>
                                <ul style={{ color: '#23408e', fontSize: '1rem', paddingLeft: '1.2em', marginBottom: '1.2em' }}>
                                    <li><b>What is this?</b> This page simulates a real interview using AI, based on your uploaded or pasted Job Description (JD).</li>
                                    <li><b>How do I start?</b> Paste or upload a JD, then click <b>Start Interview</b>.</li>
                                    <li><b>How do I stop?</b> Click <b>Stop Interview</b> to end the session instantly.</li>
                                    <li><b>What happens during the interview?</b> You'll receive questions and feedback. Respond as you would in a real interview.</li>
                                    <li><b>Is my data saved?</b> No, your interview data is not stored.</li>
                                    <li><b>Need help?</b> Contact support or check documentation for more info.</li>
                                </ul>
                                <div style={{ color: '#23408e', fontSize: '0.97em' }}>
                                    <span role="img" aria-label="info">ℹ️</span> <b>Tip:</b> Use a clear microphone and answer confidently!
                                </div>
                            </div>
                        </div>
                    )}
                    {/* Instructions/Guidance */}
                    <div className="interview-instructions" style={{ background: '#f4f8ff', borderRadius: 8, padding: '1rem', marginBottom: '1.2rem', color: '#23408e', fontSize: '1rem', boxShadow: '0 2px 8px rgba(35,64,142,0.06)' }}>
                        <strong>How it works:</strong>
                        <ul style={{ margin: '0.7em 0 0 1.2em', padding: 0 }}>
                            <li>Paste or upload a Job Description (JD) to start your mock interview.</li>
                            <li>Click <b>Start Interview</b> to begin. The system will simulate a real interview based on your JD.</li>
                            <li>You'll receive questions, feedback, and adaptive difficulty as you respond.</li>
                            <li>Make sure your microphone is enabled for voice interaction.</li>
                        </ul>
                        <div style={{ marginTop: '0.7em', fontSize: '0.97em', color: '#23408e' }}>
                            <span role="img" aria-label="info">ℹ️</span> <b>Tip:</b> Stay calm and answer as you would in a real interview!
                        </div>
                    </div>
                    {/* Progress/Status Indicator & Timer */}
                    {(loading || interviewActive) && (
                        <div className="interview-status" style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', marginBottom: '1.2rem' }}>
                            {loading && (
                                <>
                                    <div className="progress-bar" style={{ width: 32, height: 32, borderRadius: '50%', border: '4px solid #bfc8e6', borderTop: '4px solid #23408e', animation: 'spin 1s linear infinite' }}></div>
                                    <span style={{ color: '#23408e', fontWeight: 500 }}>Interview is starting...</span>
                                </>
                            )}
                            {interviewActive && !loading && (
                                <>
                                    <span className="live-indicator" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600, color: '#d32f2f', fontSize: '1.05rem' }}>
                                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#d32f2f', display: 'inline-block', boxShadow: '0 0 8px #d32f2f', animation: 'pulse 1s infinite alternate' }}></span>
                                        LIVE
                                    </span>
                                    <span className="session-timer" style={{ marginLeft: '1.2rem', color: '#23408e', fontWeight: 500, fontSize: '1.05rem', background: '#e3eafc', borderRadius: 8, padding: '0.3rem 0.8rem' }}>
                                        Interview Time: {formatTime(elapsed)}
                                    </span>
                                </>
                            )}
                        </div>
                    )}
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
                            aria-describedby="jd-helper"
                            style={{ resize: 'vertical', padding: '0.75rem', borderRadius: 8, border: '1px solid #bfc8e6', fontSize: '1rem', marginBottom: 0 }}
                        />
                        <div id="jd-helper" className="helper-text" style={{ fontSize: '0.95rem', color: '#23408e', marginBottom: 0 }}>
                            You can paste the JD or upload a file (.txt, .pdf, .doc, .docx).
                        </div>
                        <div className="upload-group" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: 0 }}>
                            <input
                                type="file"
                                accept=".txt,.pdf,.doc,.docx"
                                id="jd-upload"
                                style={{ display: 'none' }}
                                onChange={handleFileUpload}
                            />
                            <label htmlFor="jd-upload" className="upload-btn" tabIndex={0} style={{ cursor: 'pointer', background: '#23408e', color: '#fff', padding: '0.5rem 1.2rem', borderRadius: 8, fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 2px 8px rgba(35,64,142,0.08)' }}>
                                <span role="img" aria-label="upload">📤</span> <span>Upload JD</span>
                            </label>
                            {fileName && <span className="file-name" title={fileName} style={{ color: '#23408e', fontWeight: 500, fontSize: '0.98rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><span role="img" aria-label="file">📄</span> {fileName}</span>}
                        </div>
                        <div className="button-group" style={{ marginTop: '1.2rem', display: 'flex', gap: '1rem' }}>
                            <button
                                className="start-button enhanced-btn"
                                type="submit"
                                disabled={loading || !jd.trim() || interviewActive}
                                aria-busy={loading}
                                style={{ flex: 1, background: '#23408e', color: '#fff', padding: '0.8rem', borderRadius: 8, fontWeight: 600, fontSize: '1.1rem', border: 'none', boxShadow: '0 2px 8px rgba(35,64,142,0.08)', cursor: loading || !jd.trim() || interviewActive ? 'not-allowed' : 'pointer', opacity: loading || !jd.trim() || interviewActive ? 0.6 : 1 }}
                            >
                                {loading ? (
                                    <span className="loading-spinner" aria-label="Loading"></span>
                                ) : (
                                    <span><span role="img" aria-label="play">▶️</span> Start Interview</span>
                                )}
                            </button>
                            <button
                                className="stop-button enhanced-btn"
                                type="button"
                                disabled={!interviewActive}
                                onClick={handleStopInterview}
                                style={{ flex: 1, background: '#d32f2f', color: '#fff', padding: '0.8rem', borderRadius: 8, fontWeight: 600, fontSize: '1.1rem', border: 'none', boxShadow: '0 2px 8px rgba(211,47,47,0.08)', cursor: !interviewActive ? 'not-allowed' : 'pointer', opacity: !interviewActive ? 0.6 : 1 }}
                            >
                                <span role="img" aria-label="stop">⏹️</span> Stop Interview
                            </button>
                        </div>
                        {error && (
                            <div className="error-message" style={{ color: '#d32f2f', background: '#fff3f3', borderRadius: 8, padding: '0.7rem', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                                <span>{error}</span>
                                <button className="close-error" onClick={() => setError('')} title="Dismiss" aria-label="Dismiss error" style={{ background: 'none', border: 'none', color: '#d32f2f', fontSize: '1.3rem', cursor: 'pointer' }}>&times;</button>
                            </div>
                        )}
                    </form>
                    {result && (
                        <div className="mock-result-section enhanced-result" style={{ marginTop: '2rem', background: '#f4f8ff', borderRadius: 8, padding: '1.2rem', boxShadow: '0 2px 8px rgba(35,64,142,0.06)' }}>
                            <div className="system-message">
                                <span role="status" className="result-message" style={{ color: '#23408e', fontWeight: 500, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span role="img" aria-label="success" style={{ marginRight: '6px' }}>✅</span>
                                    {result}
                                </span>
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};

export default MockInterview;
