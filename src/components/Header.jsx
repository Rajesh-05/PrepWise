import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Header.css';

const Header = () => {
    return (
        <header className="header">
            <div className="header-container">
                <div className="logo">
                    <Link to="/">
                        <h1>PrepWise.AI</h1>
                        <span>Your AI Career Companion</span>
                    </Link>
                </div>
                <nav className="nav">
                    <Link to="/" className="nav-link">Home</Link>
                    <Link to="/mock-interview" className="nav-link">Mock Interview</Link>
                    <Link to="/resume-builder" className="nav-link">Resume Builder</Link>
                    <Link to="/resume-evaluator" className="nav-link">Resume Evaluator</Link>
                    <Link to="/job-finder" className="nav-link">Job Finder</Link>
                    <Link to="/pricing" className="nav-link">Pricing</Link>
                </nav>
                <div className="header-actions">
                    <Link to="/login" className="btn btn-outline">Login</Link>
                    <Link to="/signup" className="btn btn-primary">Get Started</Link>
                </div>
            </div>
        </header>
    );
};

export default Header;
