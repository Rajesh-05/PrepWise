import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Home.css';

const Home = () => {
    const features = [
        {
            id: 1,
            name: 'Interview Practice',
            icon: '🎤',
            description: 'Practice with a conversational coach that listens, adapts, and gives you honest, detailed feedback after every answer.',
            category: 'Core Feature',
            route: '/chat',
            color: '#0F2D5C',
            gradient: 'linear-gradient(135deg, #0F2D5C 0%, #1A3F7A 100%)'
        },
        {
            id: 2,
            name: 'Resume Coach',
            icon: '📋',
            description: 'Build ATS-friendly resumes with smart suggestions, get instant scores, and tailor every application to a job description.',
            category: 'Resume Tools',
            route: '/resume-builder',
            color: '#0F2D5C',
            gradient: 'linear-gradient(135deg, #1A3F7A 0%, #0F2D5C 100%)'
        },
        {
            id: 3,
            name: 'Question Bank',
            icon: '📚',
            description: 'Study real questions asked at top companies, organised by role, domain, and difficulty — with model answers.',
            category: 'Interview Prep',
            route: '/question-bank',
            color: '#0F2D5C',
            gradient: 'linear-gradient(135deg, #0F2D5C 0%, #1A3F7A 100%)'
        },
        {
            id: 4,
            name: 'Progress Dashboard',
            icon: '📊',
            description: 'See how far you have come. Track quiz scores, interview ratings, and activity history all in one place.',
            category: 'Analytics',
            route: '/dashboard',
            color: '#0F2D5C',
            gradient: 'linear-gradient(135deg, #1A3F7A 0%, #0F2D5C 100%)'
        },
        {
            id: 5,
            name: 'Mock Interviews',
            icon: '🎙️',
            description: 'Run full voice-based interview simulations and receive scores on communication, confidence, and technical depth.',
            category: 'Practice',
            route: '/mock-interview',
            color: '#0F2D5C',
            gradient: 'linear-gradient(135deg, #0F2D5C 0%, #1A3F7A 100%)'
        },
        {
            id: 6,
            name: 'Job Finder',
            icon: '🔍',
            description: 'Discover roles that match your skills — filter by company, location, and salary, then apply with a tailored resume.',
            category: 'Career',
            route: '/job-finder',
            color: '#0F2D5C',
            gradient: 'linear-gradient(135deg, #1A3F7A 0%, #0F2D5C 100%)'
        }
    ];

    const testimonials = [
        {
            name: 'Sarah Chen',
            role: 'Software Engineer at Google',
            text: 'The interview practice gave me confidence I never had before. The feedback was specific, actionable, and genuinely helped me improve.',
            initials: 'SC'
        },
        {
            name: 'Marcus Rodriguez',
            role: 'Product Manager at Microsoft',
            text: 'Finally a platform that feels like a real career resource, not a gimmick. I landed two offers after a month of using PrepWise.',
            initials: 'MR'
        },
        {
            name: 'Priya Patel',
            role: 'Data Scientist at Amazon',
            text: 'The resume coach completely changed my application hit rate. I went from zero callbacks to five interviews in two weeks.',
            initials: 'PP'
        }
    ];

    return (
        <div className="home">
            {/* Hero Section */}
            <section className="hero">
                <div className="hero-background">
                    <div className="hero-shapes"></div>
                </div>

                <div className="hero-content">
                    <div className="hero-center">
                        <div className="hero-badge">
                            <span>🎓</span>
                            <span>Your Career Toolkit</span>
                        </div>

                        <h1 className="hero-title">
                            Land the Job<br />
                            You<span className="gradient-text"> Deserve</span>
                        </h1>

                        <p className="hero-description">
                            PrepWise gives students and job seekers the tools to prepare smarter —
                            practice interviews, build better resumes, and apply with confidence.
                        </p>

                        <div className="hero-actions">
                            <Link to="/signup" className="btn-primary">
                                <span>Get Started Free</span>
                                <span className="btn-arrow">→</span>
                            </Link>
                            <Link to="/chat" className="btn-secondary">
                                <span>Try Interview Practice</span>
                            </Link>
                        </div>

                        <div className="hero-stats">
                            <div className="stat-item">
                                <span className="stat-number">50K+</span>
                                <span className="stat-label">Students Helped</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-number">95%</span>
                                <span className="stat-label">Offer Rate</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-number">200+</span>
                                <span className="stat-label">Companies</span>
                            </div>
                        </div>

                    </div>{/* end hero-center */}
                </div>{/* end hero-content */}
            </section>

            {/* Features Section */}
            <section className="features">
                <div className="container">
                    <div className="section-intro">
                        <div className="section-tag">What You Get</div>
                        <h2>Everything You Need to Land the Job</h2>
                        <p>Six powerful tools built for students and job seekers — all in one place, zero fluff.</p>
                    </div>

                    <div className="features-grid">
                        {features.map(feature => {
                            let link = feature.route;
                            return (
                                <Link key={feature.id} to={link || '#'} className="feature-link" style={{ textDecoration: 'none' }}>
                                    <div className="feature-card" style={{ '--card-color': feature.color, '--card-gradient': feature.gradient }}>
                                        <div className="feature-header">
                                            <div className="feature-icon-wrapper">
                                                <div className="feature-icon">{feature.icon}</div>
                                            </div>
                                            <span className="feature-category">{feature.category}</span>
                                        </div>
                                        <h3>{feature.name}</h3>
                                        <p>{feature.description}</p>
                                        <div className="feature-action">
                                            <span>Explore Now</span>
                                            <span className="arrow">→</span>
                                        </div>
                                        <div className="feature-glow"></div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Highlight Section */}
            <section className="highlight">
                <div className="container">
                    <div className="highlight-content">
                        <div className="highlight-left">
                            <div className="highlight-badge">🔥 Top Feature</div>
                            <h2>Real Questions from Real Interviews</h2>
                            <p>
                                Our Question Bank includes curated questions from Google, Microsoft, Amazon,
                                and hundreds more. Study smart, not just hard — with model answers and tips
                                for every role.
                            </p>

                            <div className="highlight-benefits">
                                <div className="benefit">
                                    <span className="check">✓</span>
                                    <span>Questions from actual interview rounds</span>
                                </div>
                                <div className="benefit">
                                    <span className="check">✓</span>
                                    <span>Detailed answer coaching and critique</span>
                                </div>
                                <div className="benefit">
                                    <span className="check">✓</span>
                                    <span>Company-specific preparation strategies</span>
                                </div>
                            </div>

                            <Link to="/question-bank" className="btn-primary">Explore Question Bank</Link>
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
                        <div className="section-tag">Student Stories</div>
                        <h2>Real Outcomes, Real People</h2>
                        <p>Thousands of students have used PrepWise to go from uncertain to hired.</p>
                    </div>

                    <div className="testimonials-grid">
                        {testimonials.map((testimonial, index) => (
                            <div key={index} className="testimonial-card">
                                <div className="testimonial-content">
                                    <p>"{testimonial.text}"</p>
                                </div>
                                <div className="testimonial-author">
                                    <div className="author-avatar">{testimonial.initials}</div>
                                    <div className="author-info">
                                        <div className="author-name">{testimonial.name}</div>
                                        <div className="author-role">{testimonial.role}</div>
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
                        <h2>Your Next Offer Starts Here</h2>
                        <p>Join thousands of students who prepared with PrepWise and walked into interviews with confidence.</p>
                        <div className="cta-actions">
                            <Link to="/signup" className="btn-primary btn-large">Start for Free</Link>
                            <Link to="/question-bank" className="btn-outline btn-large">Browse Questions</Link>
                        </div>
                        <div className="cta-note">
                            <span>No credit card required — always free to start</span>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Home;