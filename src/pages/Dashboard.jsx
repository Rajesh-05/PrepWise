import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
// import axios from 'axios';
import '../styles/Dashboard.css';

const Dashboard = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeDetail, setActiveDetail] = useState(null); // Which stat card is active for details
    const [showModal, setShowModal] = useState(false);
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
        const interval = setInterval(() => {
            fetchDashboardData();
        }, 10000); // Poll every 10 seconds
        return () => clearInterval(interval);
    }, [fetchDashboardData]);

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const formatDateTime = (dateString) => {
        if (!dateString) return 'N/A';
        const d = new Date(dateString);
        return d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        }) + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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
        } else {
            setActiveDetail(type);
            setShowModal(true);
        }
    };

    const closeModal = () => {
        setShowModal(false);
        setActiveDetail(null);
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


            {/* Analytics Section Heading */}
            <h2 style={{margin:'2.5rem 0 1.2rem 0',fontWeight:700,fontSize:'2.1rem',color:'#0e7490',letterSpacing:'-1px'}}>Your Usage Analytics</h2>

            {/* Enhanced Stats Section */}
            <div className="stats-section stats-grid" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:'2rem',margin:'2.5rem 0'}}>
                {/* Stat Card Template */}
                <div className="stat-card clickable" onClick={() => handleStatClick('chat')} title="Go to Chat" style={{cursor:'pointer',background:'linear-gradient(135deg,#f0fdfa 0%,#e0e7ef 100%)',borderRadius:'18px',boxShadow:'0 2px 12px rgba(0,0,0,0.07)',padding:'2rem 1.2rem',transition:'transform 0.12s,box-shadow 0.12s',border:'1.5px solid #e2e8f0',display:'flex',flexDirection:'column',alignItems:'center',gap:'0.5rem'}}>
                    <div className="stat-icon" style={{fontSize:'2.2rem',marginBottom:'0.5rem'}}>💬</div>
                    <div className="stat-content" style={{textAlign:'center'}}>
                        <h3 style={{margin:'0',fontSize:'2.1rem',fontWeight:700,color:'#0e7490'}}>{stats.chat_sessions.total_sessions}</h3>
                        <p style={{margin:'0.2rem 0 0.1rem',fontWeight:500}}>Chat Sessions</p>
                        <span className="sub-stat" style={{fontSize:'1rem',color:'#64748b'}}>
                            {stats.chat_sessions.total_messages} messages
                        </span>
                    </div>
                </div>
                <div className="stat-card clickable" onClick={() => handleStatClick('job')} title="Show Job Search Activities" style={{cursor:'pointer',background:'linear-gradient(135deg,#fef9c3 0%,#e0e7ef 100%)',borderRadius:'18px',boxShadow:'0 2px 12px rgba(0,0,0,0.07)',padding:'2rem 1.2rem',transition:'transform 0.12s,box-shadow 0.12s',border:'1.5px solid #e2e8f0',display:'flex',flexDirection:'column',alignItems:'center',gap:'0.5rem'}}>
                    <div className="stat-icon" style={{fontSize:'2.2rem',marginBottom:'0.5rem'}}>🔍</div>
                    <div className="stat-content" style={{textAlign:'center'}}>
                        <h3 style={{margin:'0',fontSize:'2.1rem',fontWeight:700,color:'#eab308'}}>{stats.job_searches.total_searches}</h3>
                        <p style={{margin:'0.2rem 0 0.1rem',fontWeight:500}}>Job Searches</p>
                        <span className="sub-stat" style={{fontSize:'1rem',color:'#64748b'}}>
                            {stats.job_searches.recent_jobs?.length || 0} recent jobs opened
                        </span>
                    </div>
                </div>
                <div className="stat-card clickable" onClick={() => handleStatClick('login')} title="Show Login Activities" style={{cursor:'pointer',background:'linear-gradient(135deg,#f1f5f9 0%,#e0e7ef 100%)',borderRadius:'18px',boxShadow:'0 2px 12px rgba(0,0,0,0.07)',padding:'2rem 1.2rem',transition:'transform 0.12s,box-shadow 0.12s',border:'1.5px solid #e2e8f0',display:'flex',flexDirection:'column',alignItems:'center',gap:'0.5rem'}}>
                    <div className="stat-icon" style={{fontSize:'2.2rem',marginBottom:'0.5rem'}}>🔐</div>
                    <div className="stat-content" style={{textAlign:'center'}}>
                        <h3 style={{margin:'0',fontSize:'2.1rem',fontWeight:700,color:'#334155'}}>{stats.user_info.total_logins}</h3>
                        <p style={{margin:'0.2rem 0 0.1rem',fontWeight:500}}>Total Logins</p>
                        <span className="sub-stat" style={{fontSize:'1rem',color:'#64748b'}}>
                            Last: {formatDate(stats.user_info.last_login)}
                        </span>
                    </div>
                </div>
                <div className="stat-card clickable" onClick={() => handleStatClick('question_bank')} title="Show Question Bank Sessions" style={{cursor:'pointer',background:'linear-gradient(135deg,#f0fdfa 0%,#e0e7ef 100%)',borderRadius:'18px',boxShadow:'0 2px 12px rgba(0,0,0,0.07)',padding:'2rem 1.2rem',transition:'transform 0.12s,box-shadow 0.12s',border:'1.5px solid #e2e8f0',display:'flex',flexDirection:'column',alignItems:'center',gap:'0.5rem'}}>
                    <div className="stat-icon" style={{fontSize:'2.2rem',marginBottom:'0.5rem'}}>📝</div>
                    <div className="stat-content" style={{textAlign:'center'}}>
                        <h3 style={{margin:'0',fontSize:'2.1rem',fontWeight:700,color:'#0e7490'}}>{stats.question_bank.total_sessions}</h3>
                        <p style={{margin:'0.2rem 0 0.1rem',fontWeight:500}}>Question Bank Sessions</p>
                    </div>
                </div>
                <div className="stat-card clickable" onClick={() => handleStatClick('mock')} title="Show Mock Interview Activities" style={{cursor:'pointer',background:'linear-gradient(135deg,#fef2f2 0%,#e0e7ef 100%)',borderRadius:'18px',boxShadow:'0 2px 12px rgba(0,0,0,0.07)',padding:'2rem 1.2rem',transition:'transform 0.12s,box-shadow 0.12s',border:'1.5px solid #e2e8f0',display:'flex',flexDirection:'column',alignItems:'center',gap:'0.5rem'}}>
                    <div className="stat-icon" style={{fontSize:'2.2rem',marginBottom:'0.5rem'}}>🎭</div>
                    <div className="stat-content" style={{textAlign:'center'}}>
                        <h3 style={{margin:'0',fontSize:'2.1rem',fontWeight:700,color:'#dc2626'}}>{stats.mock_interviews.total_interviews}</h3>
                        <p style={{margin:'0.2rem 0 0.1rem',fontWeight:500}}>Mock Interviews</p>
                    </div>
                </div>
                <div className="stat-card clickable" onClick={() => handleStatClick('resume')} title="Show Resume Activities" style={{cursor:'pointer',background:'linear-gradient(135deg,#f0fdfa 0%,#e0e7ef 100%)',borderRadius:'18px',boxShadow:'0 2px 12px rgba(0,0,0,0.07)',padding:'2rem 1.2rem',transition:'transform 0.12s,box-shadow 0.12s',border:'1.5px solid #e2e8f0',display:'flex',flexDirection:'column',alignItems:'center',gap:'0.5rem'}}>
                    <div className="stat-icon" style={{fontSize:'2.2rem',marginBottom:'0.5rem'}}>📄</div>
                    <div className="stat-content" style={{textAlign:'center'}}>
                        <h3 style={{margin:'0',fontSize:'2.1rem',fontWeight:700,color:'#0e7490'}}>{stats.resume_activities.total_activities}</h3>
                        <p style={{margin:'0.2rem 0 0.1rem',fontWeight:500}}>Resume Activities</p>
                        {/* Show average ATS score if available */}
                        {(() => {
                            const evals = stats.resume_activities.recent_activities.filter(a => typeof a.ats_score === 'number');
                            if (evals.length === 0) return null;
                            const avg = Math.round(evals.reduce((sum, a) => sum + a.ats_score, 0) / evals.length);
                            let color = '#16a34a';
                            if (avg < 70 && avg >= 40) color = '#f59e42';
                            if (avg < 40) color = '#dc2626';
                            return (
                                <span style={{display:'inline-block',marginTop:'0.4rem',padding:'0.25em 0.9em',borderRadius:'999px',background:color+'22',color:color,fontWeight:600,fontSize:'1.1rem',letterSpacing:'0.5px'}}>
                                    Avg ATS: {avg}%
                                </span>
                            );
                        })()}
                    </div>
                </div>
            </div>



            {/* Details shown in a popup/modal when stat card is clicked */}
            {showModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    background: 'rgba(0,0,0,0.45)',
                    zIndex: 1000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.2s',
                }} onClick={closeModal}>
                    <div style={{
                        background: 'linear-gradient(135deg, #f8fafc 0%, #e0e7ef 100%)',
                        borderRadius: '18px',
                        maxWidth: '1200px',
                        minWidth: '320px',
                        width: '99vw',
                        maxHeight: '85vh',
                        overflowY: 'auto',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                        padding: '36px 32px 32px 32px',
                        position: 'relative',
                        border: '1.5px solid #e2e8f0',
                        animation: 'fadeInModal 0.2s',
                    }} onClick={e => e.stopPropagation()}>
                        <button style={{
                            position: 'absolute',
                            top: 12,
                            right: 18,
                            background: '#f1f5f9',
                            border: 'none',
                            borderRadius: '50%',
                            width: 36,
                            height: 36,
                            fontSize: 22,
                            color: '#334155',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                            cursor: 'pointer',
                            transition: 'background 0.15s',
                        }} onClick={closeModal} aria-label="Close">&times;</button>
                        {activeDetail === 'login' && (
                            <div className="recent-section">
                                <h3 style={{marginTop:0}}>Login Activities</h3>
                                <div className="recent-items">
                                    {stats.activities.filter(a => a.activity_type === 'login').map((act, idx) => (
                                        <div key={act._id || idx} className="recent-item" style={{padding:'10px 0', borderBottom:'1px solid #e2e8f0'}}>
                                            <span style={{fontWeight:500, color:'#334155'}}>Login at</span> <span style={{color:'#64748b'}}>{formatDateTime(act.timestamp)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {activeDetail === 'question_bank' && (
                            <div className="recent-section">
                                <h3>Recent Question Bank Sessions</h3>
                                <div className="recent-items">
                                    {stats.question_bank.recent_sessions.map((session, index) => (
                                        <div key={index} className="recent-item">
                                            <h4>{session.company} - {session.role}</h4>
                                            <p>{session.domain} | {session.experience_level} | {session.difficulty} | {session.question_type}</p>
                                            <span className="timestamp">{formatDate(session.timestamp)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {activeDetail === 'resume' && (
                            <div className="recent-section">
                                <h3 style={{marginTop:0}}>Recent Resume Activities</h3>
                                <div className="recent-items">
                                    {stats.resume_activities.recent_activities.map((activity, index) => (
                                        <div key={index} className="recent-item" style={{padding:'12px 0', borderBottom:'1px solid #e2e8f0'}}>
                                            <h4 style={{margin:'0 0 4px 0', color:'#334155', fontWeight:600}}>{activity.activity_type.replace('_',' ').toUpperCase()}</h4>
                                            {activity.ats_score !== undefined && activity.ats_score !== null && (
                                                <div style={{marginBottom:4}}>
                                                    <span style={{fontWeight:500, color:'#0ea5e9'}}>ATS Score:</span> <span style={{fontWeight:600, color: activity.ats_score >= 70 ? '#16a34a' : activity.ats_score >= 40 ? '#f59e42' : '#dc2626'}}>{activity.ats_score}%</span>
                                                </div>
                                            )}
                                            {activity.suggestions && (
                                                <div style={{marginBottom:4}}><span style={{fontWeight:500, color:'#64748b'}}>Suggestions:</span> {activity.suggestions}</div>
                                            )}
                                            {activity.missing_keywords && Array.isArray(activity.missing_keywords) && activity.missing_keywords.length > 0 && (
                                                <div style={{marginBottom:4}}><span style={{fontWeight:500, color:'#64748b'}}>Missing Keywords:</span> {activity.missing_keywords.join(', ')}</div>
                                            )}
                                            {activity.resume_filename && (
                                                <div style={{marginBottom:4}}><span style={{fontWeight:500, color:'#64748b'}}>File:</span> {activity.resume_filename}</div>
                                            )}
                                            <span className="timestamp" style={{color:'#64748b'}}>{formatDateTime(activity.timestamp)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {activeDetail === 'mock' && (
                            <div className="recent-section">
                                <h3>Recent Mock Interviews</h3>
                                <div className="recent-items">
                                    {stats.mock_interviews.recent_interviews.map((interview, index) => (
                                        <div key={index} className="recent-item">
                                            <h4>{interview.interview_type} Interview</h4>
                                            {interview.overall_rating && (
                                                <p>Rating: {interview.overall_rating}/10</p>
                                            )}
                                            {interview.technical_score && (
                                                <p>Technical: {interview.technical_score}/10</p>
                                            )}
                                            {interview.communication_score && (
                                                <p>Communication: {interview.communication_score}/10</p>
                                            )}
                                            {interview.confidence_score && (
                                                <p>Confidence: {interview.confidence_score}/10</p>
                                            )}
                                            {interview.feedback && (
                                                <p>Feedback: {interview.feedback}</p>
                                            )}
                                            <span className="timestamp" style={{color:'#64748b'}}>{formatDateTime(interview.timestamp)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {activeDetail === 'job' && (
                            <div className="recent-section">
                                <h3>Recent Job Search Activities</h3>
                                <div className="recent-items">
                                    {stats.job_searches.recent_jobs.map((job, index) => (
                                        <div key={index} className="recent-item">
                                            <h4>{job.query}</h4>
                                            <span className="timestamp">{formatDate(job.timestamp)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
