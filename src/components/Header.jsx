import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/Header.css';

const Header = () => {
    const [user, setUser] = useState(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        // Debug: Show token in console
        const token = localStorage.getItem('auth_token') || localStorage.getItem('session_token');
        console.log('Header.jsx: token from localStorage:', token);
        if (token) {
            fetchUserProfile(token);
        }
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };

        // Add event listener when dropdown is open
        if (showDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        // Cleanup
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showDropdown]);

    const fetchUserProfile = async (token) => {
        try {
            const response = await axios.get('/auth/me', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            console.log('Header.jsx: /auth/me response:', response.data);
            setUser(response.data.user);
        } catch (error) {
            console.error('Header.jsx: Failed to fetch user profile:', error);
            // Token might be expired
            localStorage.removeItem('auth_token');
            localStorage.removeItem('session_token');
        }
    };

    const handleLogout = async () => {
        const token = localStorage.getItem('auth_token') || localStorage.getItem('session_token');
        try {
            await axios.post('/auth/logout', {}, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
        } catch (error) {
            console.error('Logout error:', error);
        }

        // Clear local storage
        localStorage.removeItem('auth_token');
        localStorage.removeItem('session_token');
        localStorage.removeItem('auth_user');
        setUser(null);
        navigate('/login');
    };

    return (
        <header className="header">
            <div className="header-container">
                <div className="logo">
                    <Link to="/">
                        <h1>Prep<span className="logo-accent">Wise</span></h1>
                        <span>Career Toolkit</span>
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
                    {user ? (
                        <div className="user-profile-container" ref={dropdownRef}>
                            <div
                                className="user-profile"
                                onClick={() => setShowDropdown(!showDropdown)}
                                title={user.name || user.firstName || user.email}
                                style={{ cursor: 'pointer' }}
                                onDoubleClick={() => window.location.href = '/profile'}
                            >
                                {user.picture && user.picture.trim() !== '' && user.picture.trim() !== 'null' && user.picture.trim() !== 'undefined' ? (
                                    <img
                                        src={user.picture}
                                        alt={user.name || user.email}
                                        className="profile-picture"
                                        onError={e => {
                                            e.target.onerror = null;
                                            e.target.style.display = 'none';
                                            const placeholder = document.createElement('span');
                                            placeholder.innerHTML = `<svg class='profile-picture' viewBox='0 0 40 40' fill='none' xmlns='http://www.w3.org/2000/svg'><circle cx='20' cy='20' r='20' fill='#e5e7eb'/><path d='M20 21c3.314 0 6-2.686 6-6s-2.686-6-6-6-6 2.686-6 6 2.686 6 6 6zm0 2c-4.418 0-8 2.239-8 5v2h16v-2c0-2.761-3.582-5-8-5z' fill='#9ca3af'/></svg>`;
                                            e.target.parentNode.replaceChild(placeholder, e.target);
                                        }}
                                    />
                                ) : (
                                    // Show a blank profile SVG icon if no picture
                                    <svg className="profile-picture" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <circle cx="20" cy="20" r="20" fill="#e5e7eb" />
                                        <path d="M20 21c3.314 0 6-2.686 6-6s-2.686-6-6-6-6 2.686-6 6 2.686 6 6 6zm0 2c-4.418 0-8 2.239-8 5v2h16v-2c0-2.761-3.582-5-8-5z" fill="#9ca3af" />
                                    </svg>
                                )}
                            </div>
                            {showDropdown && (
                                <div className="user-dropdown">
                                    <div className="dropdown-user-info">
                                        <div className="dropdown-user-name">{user.name || user.firstName || 'User'}</div>
                                        <div className="dropdown-user-email">{user.email}</div>
                                    </div>
                                    <div className="dropdown-divider"></div>
                                    <Link to="/dashboard" className="dropdown-item" onClick={() => setShowDropdown(false)}>Dashboard</Link>
                                    <Link to="/profile" className="dropdown-item" onClick={() => setShowDropdown(false)}>Profile</Link>
                                    <div className="dropdown-divider"></div>
                                    <button onClick={handleLogout} className="dropdown-item logout-btn">
                                        Logout
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            <Link to="/login" className="btn btn-outline">Login</Link>
                            <Link to="/signup" className="btn btn-primary">Get Started</Link>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
