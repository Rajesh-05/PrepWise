import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/Login.css';

const Login = () => {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        rememberMe: false
    });

    const [isLoading, setIsLoading] = useState(false);
    const [serverError, setServerError] = useState('');
    const navigate = useNavigate();

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
        setServerError('');
        try {
            const res = await axios.post('/auth/login', {
                email: formData.email,
                password: formData.password
            });
            const { token, user } = res.data;
            // Store token; for a production app consider httpOnly cookies via server
            localStorage.setItem('auth_token', token);
            localStorage.setItem('auth_user', JSON.stringify(user));
            navigate('/', { replace: true });
        } catch (err) {
            const msg = err?.response?.data?.error || 'Failed to sign in. Please check your credentials.';
            setServerError(msg);
        } finally {
            setIsLoading(false);
        }
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
                            <h1>PrepWise.AI</h1>
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
                                        autoComplete="email"
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
                                        autoComplete="current-password"
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
                                <Link to="/forgot-password" className="forgot-link">Forgot Password?</Link>
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

                            {serverError && (
                                <div className="error-message" role="alert" aria-live="polite" style={{ marginTop: '0.5rem' }}>
                                    {serverError}
                                </div>
                            )}

                            <div className="signup-prompt">
                                <p>Don't have an account? <Link to="/signup">Sign up for free</Link></p>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;