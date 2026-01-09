import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/Dashboard.css';

const Dashboard = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const fetchDashboardData = useCallback(async () => {
        const token = localStorage.getItem('auth_token') || localStorage.getItem('session_token');
        
        if (!token) {
            navigate('/login');
            return;
        }

        try {
            const response = await axios.get('/api/user/dashboard', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            setStats(response.data);
            setLoading(false);
        } catch (err) {
            console.error('Error fetching dashboard:', err);
            if (err.response?.status === 401) {
                localStorage.removeItem('auth_token');
                localStorage.removeItem('session_token');
                navigate('/login');
            } else {
                setError('Failed to load dashboard data');
                setLoading(false);
            }
        }
    }, [navigate]);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    if (loading) {
        return (
            <div className="dashboard-container">
                <div className="loading">Loading your dashboard...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="dashboard-container">
                <div className="error">{error}</div>
            </div>
        );
    }

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <div className="user-welcome">
                    {stats.user_info.picture && (
                        <img src={stats.user_info.picture} alt="Profile" className="dashboard-profile-pic" />
                    )}
                    <div>
                        <h1>Welcome back, {stats.user_info.firstName || stats.user_info.name}!</h1>
                        <p>Member since {formatDate(stats.user_info.member_since)}</p>
                    </div>
                </div>
                <div className="subscription-badge">
                    <span className="tier-badge">{stats.user_info.subscription_tier.toUpperCase()}</span>
                </div>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon">📝</div>
                    <div className="stat-content">
                        <h3>{stats.question_bank.total_sessions}</h3>
                        <p>Question Bank Sessions</p>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">🎭</div>
                    <div className="stat-content">
                        <h3>{stats.mock_interviews.total_interviews}</h3>
                        <p>Mock Interviews</p>
                        <span className="sub-stat">
                            Avg Rating: {stats.mock_interviews.average_rating.toFixed(1)}/10
                        </span>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">📄</div>
                    <div className="stat-content">
                        <h3>{stats.resume_activities.total_evaluations}</h3>
                        <p>Resume Evaluations</p>
                        <span className="sub-stat">
                            Avg ATS Score: {stats.resume_activities.average_ats_score.toFixed(0)}%
                        </span>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">💬</div>
                    <div className="stat-content">
                        <h3>{stats.chat_sessions.total_sessions}</h3>
                        <p>Chat Sessions</p>
                        <span className="sub-stat">
                            {stats.chat_sessions.total_messages} messages
                        </span>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">🔍</div>
                    <div className="stat-content">
                        <h3>{stats.job_searches.total_searches}</h3>
                        <p>Job Searches</p>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">🔐</div>
                    <div className="stat-content">
                        <h3>{stats.user_info.total_logins}</h3>
                        <p>Total Logins</p>
                        <span className="sub-stat">
                            Last: {formatDate(stats.user_info.last_login)}
                        </span>
                    </div>
                </div>
            </div>

            <div className="activity-section">
                <h2>Recent Activity</h2>
                <div className="activity-timeline">
                    {stats.activity_timeline.slice(0, 10).map((activity, index) => (
                        <div key={index} className="activity-item">
                            <div className="activity-icon">
                                {activity.activity_type === 'login' && '🔐'}
                                {activity.activity_type === 'question_bank' && '📝'}
                                {activity.activity_type === 'mock_interview' && '🎭'}
                                {activity.activity_type === 'resume_evaluator' && '📄'}
                                {activity.activity_type === 'resume_builder' && '📝'}
                                {activity.activity_type === 'chat' && '💬'}
                                {activity.activity_type === 'job_finder' && '🔍'}
                            </div>
                            <div className="activity-content">
                                <h4>{activity.activity_name}</h4>
                                <p>{formatDate(activity.timestamp)}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="recent-sections">
                {stats.question_bank.recent_sessions.length > 0 && (
                    <div className="recent-section">
                        <h3>Recent Question Bank Sessions</h3>
                        <div className="recent-items">
                            {stats.question_bank.recent_sessions.slice(0, 5).map((session, index) => (
                                <div key={index} className="recent-item">
                                    <h4>{session.company} - {session.role}</h4>
                                    <p>{session.domain} | {session.experience_level} | {session.difficulty}</p>
                                    <span className="timestamp">{formatDate(session.timestamp)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {stats.mock_interviews.recent_interviews.length > 0 && (
                    <div className="recent-section">
                        <h3>Recent Mock Interviews</h3>
                        <div className="recent-items">
                            {stats.mock_interviews.recent_interviews.slice(0, 5).map((interview, index) => (
                                <div key={index} className="recent-item">
                                    <h4>{interview.interview_type} Interview</h4>
                                    {interview.overall_rating && (
                                        <p>Rating: {interview.overall_rating}/10</p>
                                    )}
                                    <span className="timestamp">{formatDate(interview.timestamp)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {stats.resume_activities.recent_activities.length > 0 && (
                    <div className="recent-section">
                        <h3>Recent Resume Activities</h3>
                        <div className="recent-items">
                            {stats.resume_activities.recent_activities.slice(0, 5).map((activity, index) => (
                                <div key={index} className="recent-item">
                                    <h4>{activity.activity_type}</h4>
                                    {activity.ats_score && (
                                        <p>ATS Score: {activity.ats_score}%</p>
                                    )}
                                    <span className="timestamp">{formatDate(activity.timestamp)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
