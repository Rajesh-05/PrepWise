import React, { useState, useRef, useEffect } from 'react';
import '../styles/MockInterview.css';

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
        <div className="mock-interview-page">
            {/* Left Column: Instructions/Help */}
            <aside className="instructions-column">
                <h2>How it works</h2>
                <ul>
                    <li>Paste or upload a Job Description (JD) to start your mock interview.</li>
                    <li>
                        Click <b>Start Interview</b> to begin. The system will simulate a real interview based
                        on your JD.
                    </li>
                    <li>You'll receive questions, feedback, and adaptive difficulty as you respond.</li>
                    <li>Make sure your microphone is enabled for voice interaction.</li>
                </ul>
                <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#64748b' }}>
                    <span role="img" aria-label="info">ℹ️</span>{' '}
                    <b>Tip:</b> Stay calm and answer as you would in a real interview!
                </div>
            </aside>

            {/* Right Column: JD Input and Controls */}
            <main className="interaction-column">
                <form className="mock-form" onSubmit={e => { e.preventDefault(); handleStartInterview(); }}>
                    <label htmlFor="jd-input" className="jd-label">
                        Job Description (JD)
                    </label>
                    <textarea
                        id="jd-input"
                        value={jd}
                        onChange={e => setJd(e.target.value)}
                        placeholder="Paste Job Description (JD) here or upload a file..."
                        rows={8}
                        className="jd-textarea"
                        aria-describedby="jd-helper"
                    />
                    <div id="jd-helper" className="helper-text">
                        You can paste the JD or upload a file (.txt, .pdf, .doc, .docx).
                    </div>
                    <div className="upload-group">
                        <input
                            type="file"
                            accept=".txt,.pdf,.doc,.docx"
                            id="jd-upload"
                            style={{ display: 'none' }}
                            onChange={handleFileUpload}
                        />
                        <label htmlFor="jd-upload" className="upload-btn" tabIndex={0}>
                            <span role="img" aria-label="upload">📤</span> <span>Upload JD</span>
                        </label>
                        {fileName && <span className="file-name" title={fileName}><span role="img" aria-label="file">📄</span> {fileName}</span>}
                        {jdUploaded && (
                            <span style={{ color: '#16a34a', fontWeight: 600, fontSize: '0.85rem', marginLeft: '0.5rem' }}>
                                <span role="img" aria-label="check">✅</span> JD uploaded
                            </span>
                        )}
                    </div>
                    <div className="button-group">
                        <button
                            className="start-button enhanced-btn"
                            type="submit"
                            disabled={loading || !jd.trim() || interviewActive}
                            aria-busy={loading}
                        >
                            <span><span role="img" aria-label="play">▶️</span> Start Interview</span>
                        </button>
                        <button
                            className="stop-button enhanced-btn"
                            type="button"
                            disabled={!interviewActive}
                            onClick={handleStopInterview}
                        >
                            <span role="img" aria-label="stop">⏹️</span> Stop Interview
                        </button>
                    </div>
                    {interviewActive && (
                        <div className="elapsed-timer">
                            <span role="img" aria-label="timer" style={{ marginRight: '0.4rem' }}>⏱️</span>
                            Elapsed: {formatElapsed(elapsed)}
                        </div>
                    )}
                    {error && (
                        <div className="error-message">
                            <span>{error}</span>
                            <button className="close-error" onClick={() => setError('')} title="Dismiss" aria-label="Dismiss error">&times;</button>
                        </div>
                    )}
                </form>
                {result && (
                    <div className="mock-result-section">
                        <div className="system-message">
                            <span role="status" className="result-message">
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
