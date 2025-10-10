import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Home.css';

const InterviewPrep = () => {
    const navigate = useNavigate();

    const features = [
        {
            id: 1,
            name: 'AI Interview Coach',
            icon: '🤖',
            description: 'Practice with our intelligent AI that adapts to your skill level and provides real-time feedback',
            category: 'Core Feature',
            color: '#667eea',
            gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        },
        {
            id: 3,
            name: 'Company Question Bank',
            icon: '🏢',
            description: 'Access real interview questions from top companies with detailed answer guides',
            category: 'Interview Prep',
            color: '#4facfe',
            gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            action: () => navigate('/company-question-bank')
        },
        {
            id: 5,
            name: 'Mock Interviews',
            icon: '🎭',
            description: 'Simulate real interview scenarios with voice-based AI interactions',
            category: 'Practice',
            color: '#fa709a',
            gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
        }
    ];

    return (
        <div className="interview-prep">
            <section className="features">
                <div className="container">
                    <div className="section-intro">
                        <h2>Interview Preparation Tools</h2>
                        <p>Enhance your interview skills with our AI-powered tools</p>
                    </div>

                    <div className="features-grid">
                        {features.map(feature => (
                            <div
                                key={feature.id}
                                className="feature-card"
                                style={{ '--card-color': feature.color, '--card-gradient': feature.gradient }}
                                onClick={feature.action}
                            >
                                <div className="feature-header">
                                    <div className="feature-icon-wrapper">
                                        <div className="feature-icon">{feature.icon}</div>
                                    </div>
                                    <span className="feature-category">{feature.category}</span>
                                </div>
                                <h3>{feature.name}</h3>
                                <p>{feature.description}</p>
                                <div className="feature-action">
                                    <span>Learn More</span>
                                    <span className="arrow">→</span>
                                </div>
                                <div className="feature-glow"></div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
};

export default InterviewPrep;