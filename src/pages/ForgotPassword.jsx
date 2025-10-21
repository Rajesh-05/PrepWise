import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import '../styles/ForgotPassword.css';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage('');
        setError('');

        try {
            const response = await axios.post('/auth/forgot-password', { email });
            setMessage(response.data.message);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to send reset link. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="forgot-password-page">
            <div className="back-to-home">
                <Link to="/" className="back-link">
                    ← Back to Home
                </Link>
            </div>

            <div className="forgot-password-container">
                <div className="form-container">
                    <div className="form-header">
                        <h2>Forgot Password</h2>
                        <p>Enter your email to receive a password reset link.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="forgot-password-form">
                        <div className="form-group">
                            <label htmlFor="email">Email Address</label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter your email"
                                required
                            />
                        </div>

                        {message && <div className="success-message" role="alert">{message}</div>}
                        {error && <div className="error-message" role="alert">{error}</div>}

                        <button
                            type="submit"
                            className={`forgot-password-btn ${isLoading ? 'loading' : ''}`}
                            disabled={isLoading}
                        >
                            {isLoading ? 'Sending...' : 'Send Reset Link'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;