import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import Toast from '../components/Toast';
import { API_ENDPOINTS } from '../config/api';
import '../styles/Login.css';

const Login = () => {
    const [formData, setFormData] = useState({ email: '', password: '', rememberMe: false });
    const [isLoading, setIsLoading]   = useState(false);
    const [oauthLoading, setOauthLoading] = useState(false);
    const [serverError, setServerError]   = useState('');
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

    const navigate  = useNavigate();
    const location  = useLocation();

    // Ref prevents duplicate OAuth processing in React 18 Strict Mode
    const oauthHandled = useRef(false);

    // ── STEP 1: Handle Google OAuth callback ─────────────────────────────────
    // Backend redirects to: /login?session_token=<JWT>
    // We read it here, store it, fetch the user, then navigate home.
    useEffect(() => {
        const params       = new URLSearchParams(location.search);
        const sessionToken = params.get('session_token');

        if (!sessionToken || oauthHandled.current) return;
        oauthHandled.current = true;

        setOauthLoading(true);

        // Store the token immediately so all subsequent requests are authenticated
        localStorage.setItem('auth_token', sessionToken);

        // Clean the token out of the URL bar without adding a history entry
        window.history.replaceState({}, document.title, window.location.pathname);

        // Fetch the user profile to populate auth_user
        axios.get(API_ENDPOINTS.AUTH_ME, {
            headers: { Authorization: `Bearer ${sessionToken}` }
        })
            .then(res => {
                localStorage.setItem('auth_user', JSON.stringify(res.data.user));
                setToast({ show: true, message: 'Signed in with Google!', type: 'success' });
                setTimeout(() => navigate('/', { replace: true }), 800);
            })
            .catch(err => {
                console.error('Google OAuth /auth/me failed:', err);
                localStorage.removeItem('auth_token');
                oauthHandled.current = false;
                setOauthLoading(false);
                setServerError('Google sign-in failed — please try again.');
                setToast({ show: true, message: 'Google sign-in failed', type: 'error' });
            });
    }, [location.search, navigate]);

    // ── STEP 2: Auto-redirect if already logged in ───────────────────────────
    // Skip if we are in the middle of processing an OAuth callback
    useEffect(() => {
        const hasOAuthParam = new URLSearchParams(location.search).has('session_token');
        if (hasOAuthParam) return; // Let the OAuth effect handle it

        const token = localStorage.getItem('auth_token');
        if (!token) return;

        axios.get(API_ENDPOINTS.AUTH_ME, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(res => {
                localStorage.setItem('auth_user', JSON.stringify(res.data.user));
                navigate('/', { replace: true });
            })
            .catch(() => {
                // Token is invalid / expired — clear it and let the user log in
                localStorage.removeItem('auth_token');
                localStorage.removeItem('auth_user');
            });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run only on mount

    // ── Email / password login ───────────────────────────────────────────────
    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setServerError('');
        try {
            const res = await axios.post(API_ENDPOINTS.AUTH_LOGIN, {
                email:    formData.email,
                password: formData.password,
            });
            const { token, user } = res.data;
            localStorage.setItem('auth_token', token);
            localStorage.setItem('auth_user', JSON.stringify(user));
            setToast({ show: true, message: 'Login successful! Redirecting...', type: 'success' });
            setTimeout(() => navigate('/', { replace: true }), 800);
        } catch (err) {
            const msg = err?.response?.data?.error || 'Failed to sign in. Please check your credentials.';
            setServerError(msg);
            setToast({ show: true, message: msg, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = () => {
        // Redirect the browser directly to the backend Google OAuth endpoint
        window.location.href = API_ENDPOINTS.AUTH_GOOGLE_LOGIN;
    };

    // ── Render ───────────────────────────────────────────────────────────────
    if (oauthLoading) {
        return (
            <div className="login-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
                    <p style={{ color: '#0F2D5C', fontWeight: 600 }}>Completing Google sign-in…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="login-page">
            <div className="back-to-home">
                <Link to="/" className="back-link">← Back to Home</Link>
            </div>

            <div className="login-container">
                {/* Left branding */}
                <div className="login-branding">
                    <div className="branding-content">
                        <div className="logo-section">
                            <div className="logo-icon">🎓</div>
                            <h1>PrepWise</h1>
                            <p>Your Career Toolkit</p>
                        </div>
                        <div className="branding-features">
                            {[
                                { icon: '🎤', title: 'Interview Practice', desc: 'Practice with a coach that gives you honest, detailed feedback' },
                                { icon: '📋', title: 'Resume Coach',       desc: 'Build ATS-friendly resumes tailored to each job description' },
                                { icon: '📚', title: 'Question Bank',      desc: 'Real questions from top companies, with model answers' },
                            ].map(({ icon, title, desc }) => (
                                <div className="feature-item" key={title}>
                                    <div className="feature-icon">{icon}</div>
                                    <div className="feature-text">
                                        <h3>{title}</h3>
                                        <p>{desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right form */}
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
                                    <input
                                        type="email" id="email" name="email"
                                        value={formData.email} onChange={handleInputChange}
                                        placeholder="Enter your email"
                                        autoComplete="email" required
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor="password">Password</label>
                                <div className="input-wrapper">
                                    <input
                                        type="password" id="password" name="password"
                                        value={formData.password} onChange={handleInputChange}
                                        placeholder="Enter your password"
                                        autoComplete="current-password" required
                                    />
                                </div>
                            </div>

                            <div className="form-options">
                                <label className="checkbox-container">
                                    <input type="checkbox" name="rememberMe"
                                           checked={formData.rememberMe} onChange={handleInputChange} />
                                    <span className="checkmark"></span>
                                    Remember me
                                </label>
                                <Link to="/forgot-password" className="forgot-link">Forgot Password?</Link>
                            </div>

                            <button type="submit"
                                    className={`login-btn ${isLoading ? 'loading' : ''}`}
                                    disabled={isLoading}>
                                {isLoading ? <><span className="spinner"></span>Signing In…</> : 'Sign In'}
                            </button>

                            <div className="divider"><span>or</span></div>

                            <button type="button" className="google-btn" onClick={handleGoogleLogin}>
                                <span className="google-icon">🔍</span>
                                Continue with Google
                            </button>

                            {serverError && (
                                <div className="error-message" role="alert" aria-live="polite"
                                     style={{ marginTop: '0.5rem' }}>
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
                <Toast message={toast.message} type={toast.type}
                       onClose={() => setToast(t => ({ ...t, show: false }))} />
            )}
        </div>
    );
};

export default Login;