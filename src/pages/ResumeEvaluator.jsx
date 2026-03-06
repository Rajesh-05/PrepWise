import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import '../styles/ResumeEvaluator.css';

const ResumeEvaluator = () => {
    const [improveResumeFile, setImproveResumeFile] = useState(null);
    const handleDragEnter = (e, setIsDragging) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e, setIsDragging) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setEvalResult(null);
        try {
            const formData = new FormData();
            if (!atsResumeFile) {
                setLoading(false);
                setEvalResult(null);
                setResumeError('Please upload your resume PDF.');
                return;
            }
            formData.append('file', atsResumeFile);
            if (jdMode === 'text') {
                if (!jdText.trim()) {
                    setLoading(false);
                    setEvalResult(null);
                    setJdError('Please enter the job description.');
                    return;
                }
                formData.append('job_description', jdText);
            } else {
                if (!jdFile) {
                    setLoading(false);
                    setEvalResult(null);
                    setJdError('Please upload the job description PDF.');
                    return;
                }
                formData.append('job_description', jdFile);
            }
            const token = localStorage.getItem('auth_token') || localStorage.getItem('session_token');
            const res = await fetch('http://localhost:5000/evaluate-resume', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });
            if (!res.ok) {
                const err = await res.json();
                setEvalResult({ summary: err.error || 'Error evaluating resume.' });
                setLoading(false);
                return;
            }
            const data = await res.json();
            setEvalResult(data);
        } catch (err) {
            setEvalResult({ summary: err.message || 'Error evaluating resume.' });
        }
        setLoading(false);
    };

    // Handle Resume Improver form submit
    const handleImproveSubmit = async (e) => {
        e.preventDefault();
        setImproveLoading(true);
        setImproveResult(null);
        try {
            if (!improveResumeFile) {
                setImproveLoading(false);
                setImproveResult(null);
                setResumeError('Please upload your resume PDF.');
                return;
            }
            const formData = new FormData();
            formData.append('file', improveResumeFile);
            const token = localStorage.getItem('auth_token') || localStorage.getItem('session_token');
            const res = await fetch('http://localhost:5000/improve-resume', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });
            if (!res.ok) {
                const err = await res.json();
                setImproveResult({ suggestions: err.error || 'Error improving resume.' });
                setImproveLoading(false);
                return;
            }
            const data = await res.json();
            setImproveResult(data);
        } catch (err) {
            setImproveResult({ suggestions: err.message || 'Error improving resume.' });
        }
        setImproveLoading(false);
    };

    // Close toast notification
    const closeToast = () => {
        setToastVisible(false);
        // Clear toast text as well (prevents unused setter ESLint warning)
        setToastText('');
    };
    const [activeTab, setActiveTab] = useState('ats');
    const [atsResumeFile, setAtsResumeFile] = useState(null);
    const [jdMode, setJdMode] = useState('text');
    const [jdText, setJdText] = useState('');
    const [jdFile, setJdFile] = useState(null);
    // mainMessage removed — no backend placeholder message
    const [resumeError, setResumeError] = useState('');
    const [jdError, setJdError] = useState('');

    // ATS evaluation result
    const [evalResult, setEvalResult] = useState(null);
    const [loading, setLoading] = useState(false);

    // Resume improvement result
    const [improveResult, setImproveResult] = useState(null);
    const [improveLoading, setImproveLoading] = useState(false);

    const [isResumeDragging, setIsResumeDragging] = useState(false);
    const [isJdDragging, setIsJdDragging] = useState(false);

    // Toast state
    const [toastVisible, setToastVisible] = useState(false);
    const [toastText, setToastText] = useState('');

    const handleFileChange = (e, setFile, setError, setIsDragging) => {
        const f = e.target.files && e.target.files[0];
        setFile(f || null);
        setError('');
        setIsDragging(false);
    };

    const handleDrop = (e, setFile, setError, setIsDragging) => {
        e.preventDefault();
        const f = e.dataTransfer.files && e.dataTransfer.files[0];
        setFile(f);
        setError('');
        setIsDragging(false);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    return (
        <div className="resume-evaluator-page">
            <div className="eval-layout">

                {/* Left Sidebar */}
                <div className="eval-sidebar">
                    <h3 className="eval-sidebar-title">
                        <img src={process.env.PUBLIC_URL + '/Images/cv.png'} alt="CV" className="cv-logo" />
                        Resume Tools
                    </h3>

                    {/* Tab Switcher */}
                    <div className="eval-tab-nav">
                        <button
                            className={`eval-tab-btn ${activeTab === 'ats' ? 'active' : ''}`}
                            onClick={() => setActiveTab('ats')}
                        >
                            🎯 Evaluator
                        </button>
                        <button
                            className={`eval-tab-btn ${activeTab === 'improve' ? 'active' : ''}`}
                            onClick={() => setActiveTab('improve')}
                        >
                            ✏️ Resume Improver
                        </button>
                    </div>

                    {/* Info blurb */}
                    <div className="eval-info">
                        {activeTab === 'ats' ? (
                            <ul className="eval-info-list">
                                <li>📄 Upload your resume PDF</li>
                                <li>📋 Paste or upload the job description</li>
                                <li>🤖 Get ATS match score + missing keywords</li>
                                <li>💡 Receive AI-powered improvement tips</li>
                            </ul>
                        ) : (
                            <ul className="eval-info-list">
                                <li>📄 Upload your resume PDF</li>
                                <li>🤖 AI scans structure, skills, achievements</li>
                                <li>💡 Get instant actionable improvement tips</li>
                                <li>✅ No job description required</li>
                            </ul>
                        )}
                    </div>
                </div>

                {/* Right: Form card */}
                <div className="eval-card">
                    <div className="header-with-logo">
                        <h2>{activeTab === 'ats' ? 'Resume Evaluator' : 'Resume Improver'}</h2>
                    </div>
                    <p className="subtitle">
                        {activeTab === 'ats'
                            ? 'Get AI-powered insights on your resume\'s effectiveness and compatibility with job requirements.'
                            : 'Upload your resume and receive actionable feedback on structure, skills, achievements, and more. No job description required!'}
                    </p>

                    {/* ATS Tab */}
                    {activeTab === 'ats' && (
                        <>
                            <form className="eval-form" onSubmit={handleSubmit}>
                                <div className="field resume-field">
                                    <label className="field-label">Upload Resume (PDF)</label>
                                    <div
                                        className={`file-picker ${isResumeDragging ? 'dragging' : ''}`}
                                        onDrop={(e) => handleDrop(e, setAtsResumeFile, setResumeError, setIsResumeDragging)}
                                        onDragOver={handleDragOver}
                                        onDragEnter={(e) => handleDragEnter(e, setIsResumeDragging)}
                                        onDragLeave={(e) => handleDragLeave(e, setIsResumeDragging)}
                                    >
                                        <input
                                            type="file"
                                            accept=".pdf"
                                            onChange={(e) => handleFileChange(e, setAtsResumeFile, setResumeError, setIsResumeDragging)}
                                        />
                                        {atsResumeFile ? (
                                            <div className="file-name">
                                                <i className="fas fa-file-pdf"></i> {atsResumeFile.name}
                                            </div>
                                        ) : (
                                            <p>Drag & Drop your resume here or click to browse</p>
                                        )}
                                    </div>
                                    {resumeError && <div className="error-message">{resumeError}</div>}
                                </div>
                                <div className="field jd-field">
                                    <label className="field-label">Job Description</label>
                                    <div className="jd-mode-toggle">
                                        <button
                                            type="button"
                                            className={jdMode === 'text' ? 'active' : ''}
                                            onClick={() => {
                                                setJdMode('text');
                                                setJdError('');
                                            }}
                                        >Paste Text</button>
                                        <button
                                            type="button"
                                            className={jdMode === 'file' ? 'active' : ''}
                                            onClick={() => {
                                                setJdMode('file');
                                                setJdError('');
                                            }}
                                        >Upload File</button>
                                    </div>
                                    {jdMode === 'text' ? (
                                        <textarea
                                            value={jdText}
                                            onChange={(e) => {
                                                setJdText(e.target.value);
                                                setJdError('');
                                            }}
                                            placeholder="Paste job description here..."
                                        />
                                    ) : (
                                        <div
                                            className={`file-picker ${isJdDragging ? 'dragging' : ''}`}
                                            onDrop={(e) => handleDrop(e, setJdFile, setJdError, setIsJdDragging)}
                                            onDragOver={handleDragOver}
                                            onDragEnter={(e) => handleDragEnter(e, setIsJdDragging)}
                                            onDragLeave={(e) => handleDragLeave(e, setIsJdDragging)}
                                        >
                                            <input
                                                type="file"
                                                accept=".pdf"
                                                onChange={(e) => handleFileChange(e, setJdFile, setJdError, setIsJdDragging)}
                                            />
                                            {jdFile ? (
                                                <div className="file-name">
                                                    <i className="fas fa-file-pdf"></i> {jdFile.name}
                                                </div>
                                            ) : (
                                                <p>Drag & Drop the JD here or click to browse</p>
                                            )}
                                        </div>
                                    )}
                                    {jdError && <div className="error-message">{jdError}</div>}
                                </div>
                                <div className="form-actions">
                                    <button type="submit" className="btn-primary" disabled={loading}>
                                        {loading ? 'Evaluating...' : 'Evaluate'}
                                    </button>
                                </div>
                            </form>
                            {/* Evaluation Result */}
                            {evalResult && (
                                <div className="eval-result">
                                    <h3>Evaluation Result</h3>
                                    <div><strong>Match Score:</strong> {evalResult.match_score}</div>
                                    <div><strong>Summary:</strong> {evalResult.summary}</div>
                                    <div><strong>Missing Keywords:</strong> {Array.isArray(evalResult.missing_keywords) ? evalResult.missing_keywords.join(', ') : ''}</div>
                                </div>
                            )}
                        </>
                    )}

                    {/* Resume Improver Tab */}
                    {activeTab === 'improve' && (
                        <>
                            <form className="eval-form" onSubmit={handleImproveSubmit}>
                                <div className="field resume-field">
                                    <label className="field-label">Upload Resume (PDF)</label>
                                    <div
                                        className={`file-picker ${isResumeDragging ? 'dragging' : ''}`}
                                        onDrop={(e) => handleDrop(e, setImproveResumeFile, setResumeError, setIsResumeDragging)}
                                        onDragOver={handleDragOver}
                                        onDragEnter={(e) => handleDragEnter(e, setIsResumeDragging)}
                                        onDragLeave={(e) => handleDragLeave(e, setIsResumeDragging)}
                                    >
                                        <input
                                            type="file"
                                            accept=".pdf"
                                            onChange={(e) => handleFileChange(e, setImproveResumeFile, setResumeError, setIsResumeDragging)}
                                        />
                                        {improveResumeFile ? (
                                            <div className="file-name">
                                                <i className="fas fa-file-pdf"></i> {improveResumeFile.name}
                                            </div>
                                        ) : (
                                            <p>Drag & Drop your resume here or click to browse</p>
                                        )}
                                    </div>
                                    {resumeError && <div className="error-message">{resumeError}</div>}
                                </div>
                                <div className="form-actions">
                                    <button type="submit" className="btn-primary" disabled={improveLoading}>
                                        {improveLoading ? 'Improving...' : 'Get Suggestions'}
                                    </button>
                                </div>
                            </form>
                            {/* Improvement Result */}
                            {improveResult && (
                                <div className="eval-result">
                                    <h3>Resume Suggestions</h3>
                                    <ReactMarkdown>{
                                        Array.isArray(improveResult.suggestions)
                                            ? improveResult.suggestions.map(s => `- ${s}`).join('\n')
                                            : improveResult.suggestions
                                    }</ReactMarkdown>
                                </div>
                            )}
                        </>
                    )}
                    {/* Toast */}
                    {toastVisible && (
                        <div className="toast" role="status" aria-live="polite">
                            <div className="toast-text">{toastText}</div>
                            <button className="toast-close" onClick={closeToast} aria-label="Close">✕</button>
                        </div>
                    )}
                </div>{/* end eval-card */}
            </div>{/* end eval-layout */}
        </div>
    );
};

export default ResumeEvaluator;
