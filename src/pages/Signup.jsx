import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/Signup.css';

const Signup = () => {
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: '',
        acceptTerms: false,
        acceptMarketing: false
    });

    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [serverError, setServerError] = useState('');
    const navigate = useNavigate();

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));

        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }

        // If password changes and confirmPassword was set, revalidate match to clear lingering error
        if ((name === 'password' || name === 'confirmPassword') && formData.confirmPassword && formData.password) {
            const pwd = name === 'password' ? value : formData.password;
            const cpwd = name === 'confirmPassword' ? value : formData.confirmPassword;
            if (pwd === cpwd) {
                setErrors(prev => ({ ...prev, confirmPassword: '' }));
            }
        }
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.firstName.trim()) {
            newErrors.firstName = 'First name is required';
        }

        if (!formData.lastName.trim()) {
            newErrors.lastName = 'Last name is required';
        }

        if (!formData.email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = 'Please enter a valid email address';
        }

        if (!formData.password) {
            newErrors.password = 'Password is required';
        } else if (formData.password.length < 8) {
            newErrors.password = 'Password must be at least 8 characters long';
        }

        if (!formData.confirmPassword) {
            newErrors.confirmPassword = 'Please confirm your password';
        } else if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }

        if (!formData.acceptTerms) {
            newErrors.acceptTerms = 'You must accept the terms and conditions';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setIsLoading(true);
        setServerError('');
        try {
            await axios.post('/auth/signup', {
                firstName: formData.firstName,
                lastName: formData.lastName,
                email: formData.email,
                password: formData.password,
                acceptMarketing: formData.acceptMarketing
            });
            // On success, navigate to login
            navigate('/login', { replace: true, state: { signupEmail: formData.email } });
        } catch (err) {
            const msg = err?.response?.data?.error || 'Failed to create account. Please try again.';
            setServerError(msg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="signup-page">
            {/* Back to Home Link */}
            <div className="back-to-home">
                <Link to="/" className="back-link">
                    ← Back to Home
                </Link>
            </div>

            <div className="signup-container">
                {/* Left Side - Branding */}
                <div className="signup-branding">
                    <div className="branding-content">
                        <div className="logo-section">
                            <div className="logo-icon">🚀</div>
                            <h1>Join CareerAI</h1>
                            <p>Start your journey to interview success</p>
                        </div>

                        <div className="branding-features">
                            <div className="feature-item">
                                <div className="feature-icon">🎯</div>
                                <div className="feature-text">
                                    <h3>Free 14-Day Trial</h3>
                                    <p>No credit card required to get started</p>
                                </div>
                            </div>

                            <div className="feature-item">
                                <div className="feature-icon">🤖</div>
                                <div className="feature-text">
                                    <h3>AI-Powered Learning</h3>
                                    <p>Personalized interview preparation</p>
                                </div>
                            </div>

                            <div className="feature-item">
                                <div className="feature-icon">🏆</div>
                                <div className="feature-text">
                                    <h3>Proven Results</h3>
                                    <p>95% success rate for our users</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Side - Signup Form */}
                <div className="signup-form-section">
                    <div className="form-container">
                        <div className="form-header">
                            <h2>Create Your Account</h2>
                            <p>Join thousands of professionals who've transformed their careers</p>
                        </div>

                        <form onSubmit={handleSubmit} className="signup-form" noValidate>
                            <div className="name-row">
                                <div className="form-group">
                                    <label htmlFor="firstName">First Name</label>
                                    <input
                                        type="text"
                                        id="firstName"
                                        name="firstName"
                                        value={formData.firstName}
                                        onChange={handleInputChange}
                                        placeholder="Enter your first name"
                                        className={errors.firstName ? 'error' : ''}
                                        required
                                        autoComplete="given-name"
                                    />
                                    {errors.firstName && <span className="error-message">{errors.firstName}</span>}
                                </div>

                                <div className="form-group">
                                    <label htmlFor="lastName">Last Name</label>
                                    <input
                                        type="text"
                                        id="lastName"
                                        name="lastName"
                                        value={formData.lastName}
                                        onChange={handleInputChange}
                                        placeholder="Enter your last name"
                                        className={errors.lastName ? 'error' : ''}
                                        required
                                        autoComplete="family-name"
                                    />
                                    {errors.lastName && <span className="error-message">{errors.lastName}</span>}
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor="email">Email Address</label>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    placeholder="Enter your email address"
                                    className={errors.email ? 'error' : ''}
                                    required
                                    autoComplete="email"
                                />
                                {errors.email && <span className="error-message">{errors.email}</span>}
                            </div>

                            <div className="form-group">
                                <label htmlFor="password">Password</label>
                                <input
                                    type="password"
                                    id="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleInputChange}
                                    placeholder="Create a strong password"
                                    className={errors.password ? 'error' : ''}
                                    required
                                    autoComplete="new-password"
                                />
                                {errors.password && <span className="error-message">{errors.password}</span>}
                                <div className="password-hint">Must be at least 8 characters long</div>
                            </div>

                            <div className="form-group">
                                <label htmlFor="confirmPassword">Confirm Password</label>
                                <input
                                    type="password"
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleInputChange}
                                    placeholder="Confirm your password"
                                    className={errors.confirmPassword ? 'error' : ''}
                                    required
                                    autoComplete="new-password"
                                />

                                {serverError && (
                                    <div className="error-message" role="alert" aria-live="polite" style={{ marginTop: '0.5rem' }}>
                                        {serverError}
                                    </div>
                                )}
                                {errors.confirmPassword && <span className="error-message">{errors.confirmPassword}</span>}
                            </div>

                            <div className="form-options">
                                <label className="checkbox-container">
                                    <input
                                        type="checkbox"
                                        name="acceptTerms"
                                        checked={formData.acceptTerms}
                                        onChange={handleInputChange}
                                    />
                                    <span className="checkmark"></span>
                                    I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
                                </label>
                                {errors.acceptTerms && <span className="error-message">{errors.acceptTerms}</span>}
                            </div>

                            <div className="form-options">
                                <label className="checkbox-container">
                                    <input
                                        type="checkbox"
                                        name="acceptMarketing"
                                        checked={formData.acceptMarketing}
                                        onChange={handleInputChange}
                                    />
                                    <span className="checkmark"></span>
                                    I'd like to receive updates about new features and career tips (optional)
                                </label>
                            </div>

                            <button
                                type="submit"
                                className={`signup-btn ${isLoading ? 'loading' : ''}`}
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <span className="spinner"></span>
                                        Creating Account...
                                    </>
                                ) : (
                                    'Create Free Account'
                                )}
                            </button>

                            <div className="divider">
                                <span>or</span>
                            </div>

                            <button type="button" className="google-btn">
                                <span className="google-icon">🔍</span>
                                Continue with Google
                            </button>

                            <div className="login-prompt">
                                <p>Already have an account? <Link to="/login">Sign in here</Link></p>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Signup;

