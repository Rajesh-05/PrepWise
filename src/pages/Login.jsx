import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Toast from '../components/Toast';
import '../styles/Login.css';

const Login = () => {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        rememberMe: false
    });

    const [isLoading, setIsLoading] = useState(false);
    const [serverError, setServerError] = useState('');
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
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
            setToast({ show: true, message: 'Login successful! Redirecting...', type: 'success' });
            setTimeout(() => navigate('/', { replace: true }), 1000);
        } catch (err) {
            const msg = err?.response?.data?.error || 'Failed to sign in. Please check your credentials.';
            setServerError(msg);
            setToast({ show: true, message: msg, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    // Auto-login if session_token exists
    useEffect(() => {
        const sessionToken = localStorage.getItem('session_token');
        if (sessionToken) {
            axios.post('/auto-login', { session_token: sessionToken })
                .then(res => {
                    localStorage.setItem('auth_user', JSON.stringify(res.data.user));
                    navigate('/', { replace: true });
                })
                .catch(() => {
                    localStorage.removeItem('session_token');
                });
        }
    }, [navigate]);

    // Google login handler
    const handleGoogleLogin = () => {
        window.location.href = 'http://localhost:5000/auth/google/login';
    };

    // Listen for Google login callback (session_token in URL hash)
    useEffect(() => {
        if (window.location.hash.includes('session_token')) {
            const params = new URLSearchParams(window.location.hash.substring(1));
            const sessionToken = params.get('session_token');
            if (sessionToken) {
                localStorage.setItem('session_token', sessionToken);
                localStorage.setItem('auth_token', sessionToken); // Ensure Header detects token
                console.log('Login.jsx: session_token set:', sessionToken);
                // Fetch user profile
                axios.get('/auth/me', {
                    headers: {
                        'Authorization': `Bearer ${sessionToken}`
                    }
                })
                .then(res => {
                    console.log('Login.jsx: /auth/me response:', res.data);
                    localStorage.setItem('auth_user', JSON.stringify(res.data.user));
                    setToast({ show: true, message: 'Login successful with Google!', type: 'success' });
                    setTimeout(() => navigate('/', { replace: true }), 1000);
                })
                .catch(err => {
                    console.error('Login.jsx: Error fetching user after OAuth:', err);
                    setToast({ show: true, message: 'Failed to complete Google login', type: 'error' });
                    setTimeout(() => navigate('/login'), 1500);
                });
            }
        }
    }, [navigate]);

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
                                    {/* <span className="input-icon">📧</span> */}
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
                                    {/* <span className="input-icon">🔒</span> */}
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

                            <button type="button" className="google-btn" onClick={handleGoogleLogin}>
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
            {toast.show && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast({ ...toast, show: false })}
                />
            )}
        </div>
    );
};

export default Login;