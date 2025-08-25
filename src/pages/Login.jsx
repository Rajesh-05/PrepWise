import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/Login.css';

const Login = () => {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        rememberMe: false
    });

    const [isLoading, setIsLoading] = useState(false);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        // Simulate API call
        setTimeout(() => {
            setIsLoading(false);
            console.log('Login attempt:', formData);
        }, 1500);
    };

    return (
        <div className="login-page">
            {/* Back to Home Link */}
            <div className="back-to-home">
                <Link to="/" className="back-link">
                    ← Back to Home
                </Link>
            </div>

            <div className="login-container">
                {/* Left Side - Branding */}
                <div className="login-branding">
                    <div className="branding-content">
                        <div className="logo-section">
                            <div className="logo-icon">🤖</div>
                            <h1>CareerAI</h1>
                            <p>Your AI Career Companion</p>
                        </div>

                        <div className="branding-features">
                            <div className="feature-item">
                                <div className="feature-icon">🎯</div>
                                <div className="feature-text">
                                    <h3>AI-Powered Interview Prep</h3>
                                    <p>Practice with intelligent AI that adapts to your skill level</p>
                                </div>
                            </div>

                            <div className="feature-item">
                                <div className="feature-icon">📝</div>
                                <div className="feature-text">
                                    <h3>Smart Resume Builder</h3>
                                    <p>Create ATS-optimized resumes with AI suggestions</p>
                                </div>
                            </div>

                            <div className="feature-item">
                                <div className="feature-icon">🏢</div>
                                <div className="feature-text">
                                    <h3>Company Question Bank</h3>
                                    <p>Access real interview questions from top companies</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Side - Login Form */}
                <div className="login-form-section">
                    <div className="form-container">
                        <div className="form-header">
                            <h2>Welcome Back</h2>
                            <p>Sign in to continue your interview preparation journey</p>
                        </div>

                        <form onSubmit={handleSubmit} className="login-form">
                            <div className="form-group">
                                <label htmlFor="email">Email Address</label>
                                <div className="input-wrapper">
                                    <span className="input-icon">📧</span>
                                    <input
                                        type="email"
                                        id="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                        placeholder="Enter your email"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor="password">Password</label>
                                <div className="input-wrapper">
                                    <span className="input-icon">🔒</span>
                                    <input
                                        type="password"
                                        id="password"
                                        name="password"
                                        value={formData.password}
                                        onChange={handleInputChange}
                                        placeholder="Enter your password"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-options">
                                <label className="checkbox-container">
                                    <input
                                        type="checkbox"
                                        name="rememberMe"
                                        checked={formData.rememberMe}
                                        onChange={handleInputChange}
                                    />
                                    <span className="checkmark"></span>
                                    Remember me
                                </label>
                                <a href="/forgot-password" className="forgot-link">Forgot Password?</a>
                            </div>

                            <button
                                type="submit"
                                className={`login-btn ${isLoading ? 'loading' : ''}`}
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <span className="spinner"></span>
                                        Signing In...
                                    </>
                                ) : (
                                    'Sign In'
                                )}
                            </button>

                            <div className="divider">
                                <span>or</span>
                            </div>

                            <button type="button" className="google-btn">
                                <span className="google-icon">🔍</span>
                                Continue with Google
                            </button>

                            <div className="signup-prompt">
                                <p>Don't have an account? <a href="/signup">Sign up for free</a></p>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
