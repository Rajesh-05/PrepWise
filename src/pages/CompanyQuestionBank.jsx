import React, { useState } from 'react';
import '../styles/JobFinder.css';

const CompanyQuestionBank = () => {
    const [filters, setFilters] = useState({
        companyName: '',
        role: 'Any',
        domain: 'Any',
        experience: 'Any',
        questionType: 'Any',
        difficulty: 'Any'
    });
    const [questions] = useState([
        {
            id: 1,
            question: 'What is the primary difference between WHERE and HAVING clauses in SQL?',
            answer: 'The WHERE clause filters records before grouping, while the HAVING clause filters groups of records after grouping.',
            explanation: 'The WHERE clause works on individual rows before they are grouped, whereas the HAVING clause works on aggregated data after grouping. For example, you can use WHERE to filter rows based on a condition and then use HAVING to filter the grouped results based on aggregate functions like COUNT, SUM, etc.'
        },
        {
            id: 2,
            question: 'If you have 10,000 transactions and you select the top 50, what percentage of transactions did you select?',
            answer: '0.5%',
            explanation: 'The calculation is simple: (50 / 10,000) * 100 = 0.5%. This is a basic percentage calculation often used in data analysis.'
        },
        {
            id: 3,
            question: 'Explain the concept of \u2018NULL\u2019 in a SQL database.',
            answer: 'NULL represents a missing or unknown value. It is NOT the same as a zero (0) or an empty string (\u2018\u2019).',
            explanation: 'NULL is used to represent missing or undefined values in a database. Comparisons with NULL require special operators like IS NULL or IS NOT NULL because NULL is not equal to any value, including itself.'
        }
    ]);

    const handleFilterChange = (field, value) => {
        setFilters({ ...filters, [field]: value });
    };

    const handleReset = () => {
        setFilters({
            companyName: '',
            role: 'Any',
            domain: 'Any',
            experience: 'Any',
            questionType: 'Any',
            difficulty: 'Any'
        });
    };

    const [expandedQuestion, setExpandedQuestion] = useState(null);

    const toggleAnswer = (id) => {
        setExpandedQuestion(expandedQuestion === id ? null : id);
    };

    return (
        <div className="job-finder-page container" style={{ backgroundColor: 'var(--light-gray)' }}>
            <div className="job-finder-grid">
                {/* Left Panel: Filters */}
                <aside className="job-filters" aria-label="Question filters">
                    <div className="filters-header">
                        <h3>Filters</h3>
                        <button className="btn-link" onClick={handleReset} aria-label="Reset filters">Reset</button>
                    </div>

                    <div className="filter-group">
                        <label htmlFor="filter-company-name">Company Name</label>
                        <div className="search-inline">
                            <input
                                id="filter-company-name"
                                type="text"
                                placeholder="e.g. Google, Amazon"
                                value={filters.companyName}
                                onChange={(e) => handleFilterChange('companyName', e.target.value)}
                            />
                            {filters.companyName && (
                                <button
                                    className="clear-btn"
                                    aria-label="Clear company name"
                                    onClick={() => handleFilterChange('companyName', '')}
                                >
                                    ×
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="filter-group">
                        <label htmlFor="filter-role">Role</label>
                        <select id="filter-role" value={filters.role} onChange={(e) => handleFilterChange('role', e.target.value)}>
                            <option value="Any">Any</option>
                            <option>Software Engineer</option>
                            <option>Product Manager</option>
                            <option>Data Analyst</option>
                        </select>
                    </div>

                    <div className="filter-group">
                        <label htmlFor="filter-domain">Domain / Skill Set</label>
                        <select id="filter-domain" value={filters.domain} onChange={(e) => handleFilterChange('domain', e.target.value)}>
                            <option value="Any">Any</option>
                            <option>Full Stack</option>
                            <option>React</option>
                            <option>Python</option>
                            <option>SQL</option>
                        </select>
                    </div>

                    <div className="filter-group">
                        <label htmlFor="filter-experience">Experience Level</label>
                        <select id="filter-experience" value={filters.experience} onChange={(e) => handleFilterChange('experience', e.target.value)}>
                            <option value="Any">Any</option>
                            <option>Entry-Level</option>
                            <option>Mid-Level</option>
                            <option>Senior</option>
                        </select>
                    </div>

                    <div className="filter-group">
                        <label htmlFor="filter-question-type">Question Type</label>
                        <select id="filter-question-type" value={filters.questionType} onChange={(e) => handleFilterChange('questionType', e.target.value)}>
                            <option value="Any">Any</option>
                            <option>Technical</option>
                            <option>Behavioral</option>
                            <option>System Design</option>
                        </select>
                    </div>

                    <div className="filter-group">
                        <label htmlFor="filter-difficulty">Difficulty</label>
                        <select id="filter-difficulty" value={filters.difficulty} onChange={(e) => handleFilterChange('difficulty', e.target.value)}>
                            <option value="Any">Any</option>
                            <option>Easy</option>
                            <option>Medium</option>
                            <option>Hard</option>
                        </select>
                    </div>

                    <div className="refresh-container">
                        <button className="refresh-btn" title="Refresh questions">🔄 Refresh</button>
                    </div>
                </aside>

                {/* Right Panel: Question List */}
                <div>
                    {questions.map((question) => (
                        <div key={question.id} className="question-card" style={{ background: 'white', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', padding: '16px', marginBottom: '16px' }}>
                            <h3>{question.question}</h3>
                            <button
                                className="btn-link"
                                onClick={() => toggleAnswer(question.id)}
                                style={{ color: 'var(--secondary-blue)', cursor: 'pointer' }}
                            >
                                {expandedQuestion === question.id ? 'Hide Answer' : 'Show Answer'}
                            </button>
                            {expandedQuestion === question.id && (
                                <div className="answer-section" style={{ background: 'var(--light-gray)', padding: '12px', borderRadius: '4px', marginTop: '8px', lineHeight: '2.5' }}>
                                    <p><strong>Answer:</strong> {question.answer}</p>
                                    <p><strong>Explanation:</strong> {question.explanation}</p>
                                    <div style={{ lineHeight: '1.0' }}></div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CompanyQuestionBank;
