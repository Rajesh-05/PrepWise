import React, { useState, useEffect } from 'react';
import '../styles/ResumeEvaluator.css';

const ResumeEvaluator = () => {
    const [resumeFile, setResumeFile] = useState(null);
    const [jdMode, setJdMode] = useState('text');
    const [jdText, setJdText] = useState('');
    const [jdFile, setJdFile] = useState(null);
    // mainMessage removed — no backend placeholder message
    const [resumeError, setResumeError] = useState('');
    const [jdError, setJdError] = useState('');

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

    const handleDragEnter = (e, setIsDragging) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e, setIsDragging) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // show toast indicating the form is not actually submitted
    setToastText('Form yet to be submitted');
    setToastVisible(true);
    // auto-hide handled in useEffect below
        let hasError = false;

    setResumeError('');
    setJdError('');

        if (!resumeFile) {
            setResumeError('Please upload your resume PDF.');
            hasError = true;
        }
        if (jdMode === 'text' && !jdText.trim()) {
            setJdError('Please paste the job description text.');
            hasError = true;
        }
        if (jdMode === 'file' && !jdFile) {
            setJdError('Please upload the job description PDF.');
            hasError = true;
        }

        if (hasError) {
            return;
        }

        console.log({ resumeFile, jdMode, jdText, jdFile });
    };

    // auto-hide toast after 3 seconds
    useEffect(() => {
        if (!toastVisible) return undefined;
        const t = setTimeout(() => setToastVisible(false), 3000);
        return () => clearTimeout(t);
    }, [toastVisible]);

    const closeToast = () => setToastVisible(false);

    return (
        <div className="resume-evaluator-page">
            <div className="eval-card">
                <div className="header-with-logo">
                    {/* load logo from public folder to avoid importing files outside src */}
                    <img src={process.env.PUBLIC_URL + '/Images/cv.png'} alt="CV" className="cv-logo" />
                    <h2>Resume Evaluator</h2>
                </div>
                <p className="subtitle">
                    Get AI-powered insights on your resume's effectiveness and compatibility
                    with job requirements.
                </p>

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
                            onDrop={(e) => handleDrop(e, setResumeFile, setResumeError, setIsResumeDragging)}
                            onDragOver={handleDragOver}
                            onDragEnter={(e) => handleDragEnter(e, setIsResumeDragging)}
                            onDragLeave={(e) => handleDragLeave(e, setIsResumeDragging)}
                        >
                            <input
                                type="file"
                                accept=".pdf"
                                onChange={(e) => handleFileChange(e, setResumeFile, setResumeError, setIsResumeDragging)}
                            />
                            {resumeFile ? (
                                <div className="file-name">
                                    <i className="fas fa-file-pdf"></i> {resumeFile.name}
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
                            >
                                Paste Text
                            </button>
                            <button
                                type="button"
                                className={jdMode === 'file' ? 'active' : ''}
                                onClick={() => {
                                    setJdMode('file');
                                    setJdError('');
                                }}
                            >
                                Upload File
                            </button>
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
                        <button type="submit" className="btn-primary">
                            Evaluate
                        </button>
                    </div>
                </form>
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