import React, { useState, useRef, useEffect } from 'react';

const MockInterview = () => {
    const [jd, setJd] = useState('');
    const [fileName, setFileName] = useState('');
    const [jdUploaded, setJdUploaded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState('');
    const [error, setError] = useState('');
    const [interviewActive, setInterviewActive] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const timerRef = useRef(null);

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
        if (loading || interviewActive) return;
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

    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, []);


    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFileName(file.name);
            const reader = new FileReader();
            reader.onload = (ev) => {
                setJd(ev.target.result);
                setJdUploaded(true);
                setTimeout(() => setJdUploaded(false), 2000);
            };
            reader.readAsText(file);
        }
    };

    // Format elapsed seconds to MM:SS for a small timer display
    const formatElapsed = (seconds) => {
        const mm = Math.floor(seconds / 60).toString().padStart(2, '0');
        const ss = (seconds % 60).toString().padStart(2, '0');
        return `${mm}:${ss}`;
    };

    return (
        <div
            className="mock-interview-page"
            style={{
                height: '89vh', // Changed from minHeight to height to fit viewport
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'stretch',
                justifyContent: 'space-between',
                padding: '2rem',
                width: '100%',
                margin: 0,
                gap: '2rem',
                overflow: 'hidden', // Added to prevent scrolling
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
                    overflow: 'auto', // Added to prevent overflow
                }}
            >
                <h2
                    style={{
                        color: '#23408e',
                        fontWeight: 700,
                        fontSize: '1.5rem',
                        marginBottom: '1rem',
                    }}
                >
                    How it works
                </h2>
                <ul style={{ color: '#23408e', fontSize: '1rem', lineHeight: '1.6' }}>
                    <li>Paste or upload a Job Description (JD) to start your mock interview.</li>
                    <li>
                        Click <b>Start Interview</b> to begin. The system will simulate a real interview based
                        on your JD.
                    </li>
                    <li>You'll receive questions, feedback, and adaptive difficulty as you respond.</li>
                    <li>Make sure your microphone is enabled for voice interaction.</li>
                </ul>
                <div style={{ marginTop: '1rem', fontSize: '0.97em', color: '#23408e' }}>
                    <span role="img" aria-label="info">
                        ℹ️
                    </span>{' '}
                    <b>Tip:</b> Stay calm and answer as you would in a real interview!
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
                    overflow: 'auto', // Added to prevent overflow
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
                        {jdUploaded && (
                            <span style={{ color: '#388e3c', fontWeight: 600, fontSize: '0.98rem', marginLeft: '0.5rem', transition: 'opacity 0.3s' }}>
                                <span role="img" aria-label="check">✅</span> JD uploaded
                            </span>
                        )}
                    </div>
                    <div className="button-group" style={{ marginTop: '1.2rem', display: 'flex', gap: '1rem' }}>
                        <button
                            className="start-button enhanced-btn"
                            type="submit"
                            disabled={loading || !jd.trim() || interviewActive}
                            aria-busy={loading}
                            style={{ flex: 1, background: '#23408e', color: '#fff', padding: '0.8rem', borderRadius: 8, fontWeight: 600, fontSize: '1.1rem', border: 'none', boxShadow: '0 2px 8px rgba(35,64,142,0.08)', cursor: loading || !jd.trim() || interviewActive ? 'not-allowed' : 'pointer', opacity: loading || !jd.trim() || interviewActive ? 0.6 : 1 }}
                        >
                            <span><span role="img" aria-label="play">▶️</span> Start Interview</span>
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
                    {/* show a small elapsed timer while the interview is active */}
                    {interviewActive && (
                        <div className="elapsed-timer" style={{ marginTop: '0.6rem', color: '#23408e', fontWeight: 600 }}>
                            <span role="img" aria-label="timer" style={{ marginRight: '0.4rem' }}>⏱️</span>
                            Elapsed: {formatElapsed(elapsed)}
                        </div>
                    )}
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
            </main>
        </div>
    );
};

export default MockInterview;
