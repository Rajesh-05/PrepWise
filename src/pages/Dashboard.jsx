import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
// import axios from 'axios';
import '../styles/Dashboard.css';

const Dashboard = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showActivities, setShowActivities] = useState(true);
    const navigate = useNavigate();

    const fetchDashboardData = useCallback(async () => {
        const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
        if (!token) {
            navigate('/login');
            return;
        }
        try {
            const response = await fetch('/api/dashboard-info', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            if (response.ok) {
                setStats(data);
                setLoading(false);
            } else {
                setError(data.error || 'Failed to load dashboard data');
                setLoading(false);
            }
        } catch (err) {
            setError('Network error');
            setLoading(false);
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

    // Clickable stat cards
    const handleStatClick = (type) => {
        if (type === 'chat') {
            navigate('/chat');
        } else if (type === 'job') {
            navigate('/job-finder');
        } else if (type === 'login') {
            setShowActivities(true);
        }
    };

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <div className="user-welcome">
                    {stats?.user?.picture ? (
                        <img src={stats.user.picture} alt="Profile" className="dashboard-profile-pic" />
                    ) : (
                        <div className="dashboard-profile-pic avatar-placeholder">👤</div>
                    )}
                    <div>
                        <h1>Welcome back, {stats?.user?.firstName || stats?.user?.name}!</h1>
                        <p>Email: {stats?.user?.email}</p>
                        <p>Subscription: <b>{stats?.user?.subscription_tier || 'N/A'}</b></p>
                        <p>Status: <b>{stats?.user?.subscription_status || 'N/A'}</b></p>
                        <p>Start: {formatDate(stats?.user?.subscription_start)}</p>
                        <p>End: {formatDate(stats?.user?.subscription_end)}</p>
                    </div>
                </div>
                <div className="subscription-badge">
                    <span className="tier-badge" title="Current Plan">{stats?.user?.subscription_tier?.toUpperCase() || 'FREE'}</span>
                </div>
            </div>

            <div className="dashboard-section">
                <h2>Recent Subscription Details</h2>
                {stats?.subscription ? (
                    <div className="subscription-details">
                        <p>Tier: <span className="badge tier-badge">{stats.subscription.subscription_tier}</span></p>
                        <p>Status: <span className={`badge ${stats.subscription.payment_status === 'active' ? 'badge-success' : 'badge-warning'}`}>{stats.subscription.payment_status}</span></p>
                        <p>Start: {formatDate(stats.subscription.start_date)}</p>
                        <p>End: {formatDate(stats.subscription.end_date)}</p>
                        <p>Amount Paid: <span className="badge badge-info">${stats.subscription.amount_paid || 0}</span></p>
                        <p>Auto Renew: <span className={`badge ${stats.subscription.auto_renew ? 'badge-success' : 'badge-warning'}`}>{stats.subscription.auto_renew ? 'Yes' : 'No'}</span></p>
                    </div>
                ) : <p>No subscription history found.</p>}
            </div>

            <div className="dashboard-section">
                <h2 style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                    Recent Activity
                    <button className="toggle-btn" onClick={() => setShowActivities(v => !v)}>
                        {showActivities ? 'Hide' : 'Show'}
                    </button>
                </h2>
                {showActivities && (
                    <ul className="activity-list">
                        {stats?.activities?.length ? stats.activities.map((act, idx) => (
                            <li key={act._id || idx} className="activity-list-item">
                                <span className="activity-avatar" title={act.activity_type}>
                                    {act.activity_type === 'login' && '🔐'}
                                    {act.activity_type === 'question_bank' && '📝'}
                                    {act.activity_type === 'mock_interview' && '🎭'}
                                    {act.activity_type === 'resume_evaluator' && '📄'}
                                    {act.activity_type === 'resume_builder' && '📝'}
                                    {act.activity_type === 'chat' && '💬'}
                                    {act.activity_type === 'job_finder' && '🔍'}
                                </span>
                                <span className="activity-main">
                                    <b>{act.activity_type.replace('_', ' ').toUpperCase()}</b> - {act.activity_name}
                                    <span className="activity-date">({formatDate(act.timestamp)})</span>
                                </span>
                            </li>
                        )) : <li>No recent activity found.</li>}
                    </ul>
                )}
            </div>

            {/* Stats Section */}
            <div className="stats-section stats-grid">
                <div className="stat-card clickable" onClick={() => handleStatClick('chat')} title="Go to Chat">
                    <div className="stat-icon">💬</div>
                    <div className="stat-content">
                        <h3>{stats.chat_sessions.total_sessions}</h3>
                        <p>Chat Sessions</p>
                        <span className="sub-stat">
                            {stats.chat_sessions.total_messages} messages
                        </span>
                    </div>
                </div>

                <div className="stat-card clickable" onClick={() => handleStatClick('job')} title="Go to Job Finder">
                    <div className="stat-icon">🔍</div>
                    <div className="stat-content">
                        <h3>{stats.job_searches.total_searches}</h3>
                        <p>Job Searches</p>
                    </div>
                </div>

                <div className="stat-card clickable" onClick={() => handleStatClick('login')} title="Show Login Activities">
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
                <h2>Recent Timeline</h2>
                <div className="activity-timeline">
                    {stats.activity_timeline.slice(0, 10).map((activity, index) => (
                        <div key={index} className="activity-item">
                            <div className="activity-icon" title={activity.activity_type}>
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
