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
            const res = await fetch('http://localhost:5000/evaluate-resume', {
                method: 'POST',
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
            const res = await fetch('http://localhost:5000/improve-resume', {
                method: 'POST',
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
            <div className="eval-card">
                {/* Tab Switcher at top */}
                <div className="tab-switcher" style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
                    <button
                        className={activeTab === 'ats' ? 'active' : ''}
                        style={{
                            padding: '10px 32px',
                            borderRadius: '24px 0 0 24px',
                            border: '1px solid #ccc',
                            background: activeTab === 'ats' ? '#fff' : '#f3f3f3',
                            fontWeight: activeTab === 'ats' ? 'bold' : 'normal',
                            boxShadow: activeTab === 'ats' ? '0 2px 8px rgba(0,0,0,0.04)' : 'none',
                            cursor: 'pointer',
                            outline: 'none',
                            zIndex: 2
                        }}
                        onClick={() => setActiveTab('ats')}
                    >Evaluator</button>
                    <button
                        className={activeTab === 'improve' ? 'active' : ''}
                        style={{
                            padding: '10px 32px',
                            borderRadius: '0 24px 24px 0',
                            border: '1px solid #ccc',
                            borderLeft: 'none',
                            background: activeTab === 'improve' ? '#fff' : '#f3f3f3',
                            fontWeight: activeTab === 'improve' ? 'bold' : 'normal',
                            boxShadow: activeTab === 'improve' ? '0 2px 8px rgba(0,0,0,0.04)' : 'none',
                            cursor: 'pointer',
                            outline: 'none',
                            zIndex: 2
                        }}
                        onClick={() => setActiveTab('improve')}
                    >Resume Improver</button>
                </div>
                <div className="header-with-logo">
                    <img src={process.env.PUBLIC_URL + '/Images/cv.png'} alt="CV" className="cv-logo" />
                    <h2>{activeTab === 'ats' ? 'Resume Evaluator' : 'Resume Improver'}</h2>
                </div>
                <p className="subtitle">
                    {activeTab === 'ats'
                        ? 'Get AI-powered insights on your resume\'s effectiveness and compatibility with job requirements.'
                        : 'Get personalized AI-powered suggestions to improve your resume. Just upload your resume PDF and receive actionable feedback on structure, skills, achievements, and more. No job description required!'}
                </p>

                {/* ATS Tab */}
                {activeTab === 'ats' && (
                    <>
                        <div className="feature-tabs">
                            <div className="tab-card">
                                <div className="tab-icon">🎯</div>
                                <h3>ATS Compatibility</h3>
                                <p>Check if your resume passes Applicant Tracking Systems.</p>
                            </div>
                            <div className="tab-card">
                                 <div className="tab-icon">⭐</div>
                                <h3>Skills Matching</h3>
                                <p>See how well your skills align with job requirements.</p>
                            </div>
                            <div className="tab-card">
                                  <div className="tab-icon">🤖</div>
                                <h3>AI-Powered Feedback</h3>
                                <p>Get detailed suggestions for improvement.</p>
                            </div>
                        </div>
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
                        <div className="feature-tabs">
                            <div className="tab-card">
                                <div className="tab-icon">📝</div>
                                <h3>Resume Improver</h3>
                                <p>Receive instant, actionable tips to boost your resume's impact.</p>
                            </div>
                        </div>
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
                                <ReactMarkdown>{improveResult.suggestions}</ReactMarkdown>
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
            </div>
        </div>
    );
};

export default ResumeEvaluator;
