
import React, { useEffect, useRef } from 'react';
import '../styles/Toast.css';

const icons = {
    success: (
        <span className="toast-svg-bg toast-success-bg">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="11" fill="#10b981"/><path d="M7 11.5l3 3 5-5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </span>
    ),
    error: (
        <span className="toast-svg-bg toast-error-bg">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="11" fill="#ef4444"/><path d="M8 8l6 6M14 8l-6 6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/></svg>
        </span>
    ),
    info: (
        <span className="toast-svg-bg toast-info-bg">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="11" fill="#3b82f6"/><text x="11" y="16" textAnchor="middle" fontSize="13" fill="#fff">i</text></svg>
        </span>
    ),
};

const Toast = ({ message, type = 'success', onClose, duration = 3000 }) => {
    const progressRef = useRef();
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, duration);
        if (progressRef.current) {
            progressRef.current.style.transition = `width ${duration}ms linear`;
            progressRef.current.style.width = '0%';
        }
        return () => clearTimeout(timer);
    }, [duration, onClose]);

    return (
        <div className={`toast toast-${type}`} role="status" aria-live="polite">
            {icons[type]}
            <div className="toast-text">{message}</div>
            <button className="toast-close" onClick={onClose} aria-label="Close">✕</button>
            <div className={`toast-progress toast-progress-${type}`} ref={progressRef} />
        </div>
    );
};

export default Toast;
