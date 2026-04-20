import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_ENDPOINTS } from '../config/api';
import '../styles/Signup.css';

const Signup = () => {
    const [formData, setFormData] = useState({
        firstName: '', lastName: '', email: '', password: '', confirmPassword: '', acceptTerms: false,
    });
    const [errors, setErrors]         = useState({});
    const [isLoading, setIsLoading]   = useState(false);
    const [serverError, setServerError] = useState('');
    const [successMsg, setSuccessMsg]   = useState('');
    const navigate = useNavigate();

    // Auto-redirect if already logged in
    useEffect(() => {
        const token = localStorage.getItem('auth_token');
        if (!token) return;
        axios.get(API_ENDPOINTS.AUTH_ME, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(() => navigate('/', { replace: true }))
            .catch(() => {
                localStorage.removeItem('auth_token');
                localStorage.removeItem('auth_user');
            });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
        // Clear field error when user types
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    };

    const validate = () => {
        const errs = {};
        if (!formData.firstName.trim()) errs.firstName = 'First name is required';
        if (!formData.lastName.trim())  errs.lastName  = 'Last name is required';
        if (!formData.email.trim())     errs.email     = 'Email is required';
        else if (!/\S+@\S+\.\S+/.test(formData.email)) errs.email = 'Enter a valid email';
        if (!formData.password)         errs.password  = 'Password is required';
        else if (formData.password.length < 8) errs.password = 'Password must be at least 8 characters';
        if (formData.password !== formData.confirmPassword)
            errs.confirmPassword = 'Passwords do not match';
        if (!formData.acceptTerms) errs.acceptTerms = 'You must accept the terms';
        return errs;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setServerError('');
        setSuccessMsg('');

        const errs = validate();
        if (Object.keys(errs).length > 0) { setErrors(errs); return; }

        setIsLoading(true);
        try {
            const res = await axios.post(API_ENDPOINTS.AUTH_SIGNUP, {
                firstName: formData.firstName.trim(),
                lastName:  formData.lastName.trim(),
                email:     formData.email.trim().toLowerCase(),
                password:  formData.password,
            });

            // Backend now returns a token on signup so the user is auto-logged in
            const { token, user } = res.data;
            if (token) {
                localStorage.setItem('auth_token', token);
                localStorage.setItem('auth_user', JSON.stringify(user));
                setSuccessMsg('Account created! Redirecting…');
                setTimeout(() => navigate('/', { replace: true }), 1000);
            } else {
                // Fallback: no token returned — redirect to login
                setSuccessMsg('Account created! Please sign in.');
                setTimeout(() => navigate('/login'), 1500);
            }
        } catch (err) {
            const msg = err?.response?.data?.error || 'Failed to create account. Please try again.';
            setServerError(msg);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSignup = () => {
        // Same endpoint as login — Google handles new vs existing users
        window.location.href = API_ENDPOINTS.AUTH_GOOGLE_LOGIN;
    };

    return (
        <div className="signup-page">
            <div className="back-to-home">
                <Link to="/" className="back-link">← Back to Home</Link>
            </div>

            <div className="signup-container">
                {/* Left branding */}
                <div className="signup-branding">
                    <div className="branding-content">
                        <div className="logo-section">
                            <div className="logo-icon">🎓</div>
                            <h1>PrepWise</h1>
                            <p>Your Career Toolkit</p>
                        </div>
                        <div className="branding-features">
                            {[
                                { icon: '✅', title: 'Free to Start',      desc: 'No credit card required — create your account in seconds' },
                                { icon: '🎯', title: 'Personalized Prep',   desc: 'AI tailored to your role, company and experience level' },
                                { icon: '🚀', title: 'Interview-Ready',     desc: 'Students who use PrepWise get 3× more interview callbacks' },
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
                <div className="signup-form-section">
                    <div className="form-container">
                        <div className="form-header">
                            <h2>Create Your Account</h2>
                            <p>Join thousands of students preparing smarter</p>
                        </div>

                        <form onSubmit={handleSubmit} className="signup-form" noValidate>
                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="firstName">First Name</label>
                                    <input type="text" id="firstName" name="firstName"
                                           value={formData.firstName} onChange={handleChange}
                                           placeholder="First name" autoComplete="given-name" />
                                    {errors.firstName && <span className="field-error">{errors.firstName}</span>}
                                </div>
                                <div className="form-group">
                                    <label htmlFor="lastName">Last Name</label>
                                    <input type="text" id="lastName" name="lastName"
                                           value={formData.lastName} onChange={handleChange}
                                           placeholder="Last name" autoComplete="family-name" />
                                    {errors.lastName && <span className="field-error">{errors.lastName}</span>}
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor="email">Email Address</label>
                                <input type="email" id="email" name="email"
                                       value={formData.email} onChange={handleChange}
                                       placeholder="Enter your email" autoComplete="email" />
                                {errors.email && <span className="field-error">{errors.email}</span>}
                            </div>

                            <div className="form-group">
                                <label htmlFor="password">Password</label>
                                <input type="password" id="password" name="password"
                                       value={formData.password} onChange={handleChange}
                                       placeholder="At least 8 characters" autoComplete="new-password" />
                                {errors.password && <span className="field-error">{errors.password}</span>}
                            </div>

                            <div className="form-group">
                                <label htmlFor="confirmPassword">Confirm Password</label>
                                <input type="password" id="confirmPassword" name="confirmPassword"
                                       value={formData.confirmPassword} onChange={handleChange}
                                       placeholder="Repeat your password" autoComplete="new-password" />
                                {errors.confirmPassword && <span className="field-error">{errors.confirmPassword}</span>}
                            </div>

                            <div className="form-group checkbox-group">
                                <label className="checkbox-container">
                                    <input type="checkbox" name="acceptTerms"
                                           checked={formData.acceptTerms} onChange={handleChange} />
                                    <span className="checkmark"></span>
                                    I agree to the{' '}
                                    <Link to="/terms" className="inline-link">Terms of Service</Link>
                                    {' '}and{' '}
                                    <Link to="/privacy" className="inline-link">Privacy Policy</Link>
                                </label>
                                {errors.acceptTerms && <span className="field-error">{errors.acceptTerms}</span>}
                            </div>

                            {serverError && (
                                <div className="error-message" role="alert">{serverError}</div>
                            )}
                            {successMsg && (
                                <div className="success-message" role="status">{successMsg}</div>
                            )}

                            <button type="submit"
                                    className={`signup-btn ${isLoading ? 'loading' : ''}`}
                                    disabled={isLoading}>
                                {isLoading ? <><span className="spinner"></span>Creating Account…</> : 'Create Account'}
                            </button>

                            <div className="divider"><span>or</span></div>

                            <button type="button" className="google-btn" onClick={handleGoogleSignup}>
                                <span className="google-icon">🔍</span>
                                Sign up with Google
                            </button>

                            <div className="login-prompt">
                                <p>Already have an account? <Link to="/login">Sign in</Link></p>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Signup;