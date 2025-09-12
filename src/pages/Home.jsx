import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Home.css';

const Home = () => {
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
            id: 2,
            name: 'Smart Resume Builder',
            icon: '📄',
            description: 'Create ATS-optimized resumes with AI suggestions and professional templates',
            category: 'Resume Tools',
            color: '#f093fb',
            gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
        },
        {
            id: 3,
            name: 'Company Question Bank',
            icon: '🏢',
            description: 'Access real interview questions from top companies with detailed answer guides',
            category: 'Interview Prep',
            color: '#4facfe',
            gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
        },
        {
            id: 4,
            name: 'Progress Analytics',
            icon: '📊',
            description: 'Track your improvement with detailed insights and personalized recommendations',
            category: 'Analytics',
            color: '#43e97b',
            gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'
        },
        {
            id: 5,
            name: 'Mock Interviews',
            icon: '🎭',
            description: 'Simulate real interview scenarios with voice-based AI interactions',
            category: 'Practice',
            color: '#fa709a',
            gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
        },
        {
            id: 6,
            name: 'Job Matching',
            icon: '🎯',
            description: 'Find opportunities that match your skills and experience perfectly',
            category: 'Career',
            color: '#ffecd2',
            gradient: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)'
        }
    ];

    const testimonials = [
        {
            name: 'Sarah Chen',
            role: 'Software Engineer',
            company: 'Google',
            text: 'The AI interview prep helped me land my dream job. The feedback was incredibly detailed!',
            avatar: '👩‍💻'
        },
        {
            name: 'Marcus Rodriguez',
            role: 'Product Manager',
            company: 'Microsoft',
            text: 'Finally, a platform that actually prepares you for real interviews. Game changer!',
            avatar: '👨‍💼'
        },
        {
            name: 'Priya Patel',
            role: 'Data Scientist',
            company: 'Amazon',
            text: 'The resume builder is magic. My applications went from 0 to 10 responses overnight.',
            avatar: '👩‍🔬'
        }
    ];

    return (
        <div className="home">
            {/* Hero Section */}
            <section className="hero">
                <div className="hero-background">
                    <div className="hero-shapes">
                        <div className="shape shape-1"></div>
                        <div className="shape shape-2"></div>
                        <div className="shape shape-3"></div>
                    </div>
                </div>

                <div className="hero-content">
                    <div className="hero-left">
                        <div className="hero-badge">
                            <span>🚀</span>
                            <span>AI-Powered Interview Prep</span>
                        </div>

                        <h1 className="hero-title">
                            Master Your Next
                            <span className="gradient-text"> Interview</span>
                        </h1>

                        <p className="hero-description">
                            Stop guessing what interviewers want. Our AI analyzes thousands of real interviews
                            to give you the exact preparation you need to succeed.
                        </p>

                        <div className="hero-actions">
                            <button className="btn-primary">
                                <span>Start Free Trial</span>
                                <span className="btn-arrow">→</span>
                            </button>
                            <button className="btn-secondary">
                                <span>Watch Demo</span>
                                <span className="play-icon">▶</span>
                            </button>
                            <Link to="/chat" className="btn-primary">
                                <span>Go to Chat</span>
                            </Link>
                        </div>

                        <div className="hero-stats">
                            <div className="stat-item">
                                <span className="stat-number">50K+</span>
                                <span className="stat-label">Users</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-number">95%</span>
                                <span className="stat-label">Success Rate</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-number">200+</span>
                                <span className="stat-label">Companies</span>
                            </div>
                        </div>
                    </div>

                    <div className="hero-right">
                        <div className="hero-visual">
                            <div className="floating-element element-1">
                                <div className="element-icon">🎯</div>
                                <div className="element-text">AI Coach</div>
                            </div>
                            <div className="floating-element element-2">
                                <div className="element-icon">📝</div>
                                <div className="element-text">Resume</div>
                            </div>
                            <div className="floating-element element-3">
                                <div className="element-icon">🏆</div>
                                <div className="element-text">Success</div>
                            </div>
                            <div className="main-visual">
                                <div className="visual-circle">
                                    <div className="inner-circle">
                                        <span className="ai-icon">🤖</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="features">
                <div className="container">
                    <div className="section-intro">
                        <h2>Interview Strategies</h2>
                        <p>Our AI platform combines cutting-edge technology with proven interview strategies</p>
                    </div>

                    <div className="features-grid">
                        {features.map(feature => (
                            <div key={feature.id} className="feature-card" style={{ '--card-color': feature.color, '--card-gradient': feature.gradient }}>
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

            {/* Highlight Section */}
            <section className="highlight">
                <div className="container">
                    <div className="highlight-content">
                        <div className="highlight-left">
                            <div className="highlight-badge">🔥 Exclusive Feature</div>
                            <h2>Company Question Bank</h2>
                            <p>
                                Access real interview questions from top tech companies like Google, Microsoft,
                                Amazon, and more. Our AI analyzes your answers and provides "if I were you"
                                improvements that actually work.
                            </p>

                            <div className="highlight-benefits">
                                <div className="benefit">
                                    <span className="check">✓</span>
                                    <span>Real questions from actual interviews</span>
                                </div>
                                <div className="benefit">
                                    <span className="check">✓</span>
                                    <span>AI-powered answer critiques</span>
                                </div>
                                <div className="benefit">
                                    <span className="check">✓</span>
                                    <span>Company-specific strategies</span>
                                </div>
                            </div>

                            <button className="btn-primary">Explore Question Bank</button>
                        </div>

                        <div className="highlight-right">
                            <div className="company-showcase">
                                <div className="company-row">
                                    <div className="company-logo">G</div>
                                    <div className="company-logo">M</div>
                                    <div className="company-logo">A</div>
                                </div>
                                <div className="company-row">
                                    <div className="company-logo">M</div>
                                    <div className="company-logo">A</div>
                                    <div className="company-logo">N</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Testimonials */}
            <section className="testimonials">
                <div className="container">
                    <div className="section-intro">
                        <h2>What Our Users Say</h2>
                        <p>Join thousands of professionals who've transformed their careers</p>
                    </div>

                    <div className="testimonials-grid">
                        {testimonials.map((testimonial, index) => (
                            <div key={index} className="testimonial-card">
                                <div className="testimonial-content">
                                    <p>"{testimonial.text}"</p>
                                </div>
                                <div className="testimonial-author">
                                    <div className="author-avatar">{testimonial.avatar}</div>
                                    <div className="author-info">
                                        <div className="author-name">{testimonial.name}</div>
                                        <div className="author-role">{testimonial.role} at {testimonial.company}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="cta">
                <div className="container">
                    <div className="cta-content">
                        <h2>Ready to Ace Your Interview?</h2>
                        <p>Start your free trial today and see the difference AI-powered preparation makes</p>
                        <div className="cta-actions">
                            <button className="btn-primary btn-large">Get Started Free</button>
                            <button className="btn-outline btn-large">Schedule Demo</button>
                        </div>
                        <div className="cta-note">
                            <span>✓</span>
                            <span>No credit card required • 14-day free trial</span>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Home;
