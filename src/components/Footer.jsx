import React from 'react';
import '../styles/Footer.css';

const Footer = () => {
    return (
        <footer className="footer">
            <div className="footer-container">
                <div className="footer-content">
                    <div className="footer-section">
                        <h3>PrepWise.AI</h3>
                        <p>Your AI-powered career companion designed to help you prepare, practice, and land your dream job. From interview prep to resume building, we've got everything you need to succeed.</p>
                    </div>
                    <div className="footer-section">
                        <h4>Platform Features</h4>
                        <ul>
                            <li><a href="/interview-prep">Interview Prep</a></li>
                            <li><a href="/resume-builder">Resume Builder</a></li>
                            <li><a href="/job-finder">Job Finder</a></li>
                            <li><a href="/mock-interviews">Mock Interviews</a></li>
                        </ul>
                    </div>
                    <div className="footer-section">
                        <h4>Support</h4>
                        <ul>
                            <li><a href="/help">Help Center</a></li>
                            <li><a href="/contact">Contact Us</a></li>
                            <li><a href="/faq">FAQ</a></li>
                            <li><a href="/tutorials">Tutorials</a></li>
                        </ul>
                    </div>
                    <div className="footer-section">
                        <h4>Company</h4>
                        <ul>
                            <li><a href="/about">About Us</a></li>
                            <li><a href="/pricing">Pricing</a></li>
                            <li><a href="/blog">Blog</a></li>
                            <li><a href="/careers">Careers</a></li>
                        </ul>
                    </div>
                    <div className="footer-section">
                        <h4>Connect</h4>
                        <div className="social-links">
                            <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">💼</a>
                            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" aria-label="Twitter">🐦</a>
                            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook">📘</a>
                            <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" aria-label="YouTube">📺</a>
                        </div>
                    </div>
                </div>
                <div className="footer-bottom">
                    <p>&copy; 2024 PrepWise.AI. All rights reserved. | Your AI-powered career companion</p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
