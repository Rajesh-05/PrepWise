import React, { useState } from 'react';
import '../styles/QuestionBank.css';
import '../styles/JobFinder.css';
import { FaTimes } from 'react-icons/fa';

const QuestionCard = ({ question, answer, explanation }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="question-card">
      <p className="question-title">{question}</p>
      <button onClick={() => setIsOpen(!isOpen)} className="solution-toggle">
        {isOpen ? 'Hide Solution' : 'Show Solution'}
      </button>
      {isOpen && (
        <div className="solution-content">
          <h4>Answer:</h4>
          <p className="answer-text">{answer}</p>
          <h4>Explanation:</h4>
          <p className="explanation-text">{explanation}</p>
        </div>
      )}
    </div>
  );
};

const QuestionBank = () => {
  const [companyName, setCompanyName] = useState('');
  const [role, setRole] = useState('any');
  const [domain, setDomain] = useState('any');
  const [experience, setExperience] = useState('any');
  const [questionType, setQuestionType] = useState('any');
  const [difficulty, setDifficulty] = useState('any');
  const [numQuestions, setNumQuestions] = useState(15);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleReset = () => {
    setCompanyName('');
    setRole('any');
    setDomain('any');
    setExperience('any');
    setQuestionType('any');
    setDifficulty('any');
    setNumQuestions(15);
    setQuestions([]);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      const res = await fetch('/generate-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          company_name: companyName,
          role,
          domain,
          experience_level: experience,
          question_type: questionType,
          difficulty,
          num_questions: numQuestions
        })
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.questions)) {
        setQuestions(data.questions);
      } else {
        setError(data.error || 'Failed to generate questions');
      }
    } catch (e) {
      setError('Network error');
    }
    setLoading(false);
  };

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      const res = await fetch('/generate-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          company_name: companyName,
          role,
          domain,
          experience_level: experience,
          question_type: questionType,
          difficulty,
          num_questions: numQuestions
        })
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.questions)) {
        setQuestions(data.questions);
      } else {
        setError(data.error || 'Failed to generate questions');
      }
    } catch (e) {
      setError('Network error');
    }
    setLoading(false);
  };

  return (
    <div className="question-bank-container">
      <div className="question-filters-container">
        <div className="filters-header">
          <h2>Filters</h2>
          <button onClick={handleReset} className="reset-link">Reset</button>
        </div>
        <div className="filter-item">
          <label>Company Name</label>
          <div className="input-with-clear">
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Google, Amazon"
            />
            {companyName && <FaTimes className="clear-icon" onClick={() => setCompanyName('')} />}
          </div>
        </div>
        <div className="filter-item">
          <label>Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="any">Any</option>
            <option value="swe">Software Engineer</option>
            <option value="pm">Product Manager</option>
            <option value="da">Data Analyst</option>
          </select>
        </div>
        <div className="filter-item">
          <label>Domain / Skill Set</label>
          <select value={domain} onChange={(e) => setDomain(e.target.value)}>
            <option value="any">Any</option>
            <option value="fullstack">Full Stack</option>
            <option value="react">React</option>
            <option value="python">Python</option>
            <option value="sql">SQL</option>
          </select>
        </div>
        <div className="filter-item">
          <label>Experience Level</label>
          <select value={experience} onChange={(e) => setExperience(e.target.value)}>
            <option value="any">Any</option>
            <option value="entry">Entry-Level</option>
            <option value="mid">Mid-Level</option>
            <option value="senior">Senior</option>
          </select>
        </div>
        <div className="filter-item">
          <label>Question Type</label>
          <select value={questionType} onChange={(e) => setQuestionType(e.target.value)}>
            <option value="any">Any</option>
            <option value="technical">Technical</option>
            <option value="behavioral">Behavioral</option>
            <option value="system-design">System Design</option>
          </select>
        </div>
        <div className="filter-item">
          <label>Difficulty</label>
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            <option value="any">Any</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
        <div className="filters-footer">
            <button className="refresh-button" onClick={handleRefresh}>Refresh</button>
            <button className="submit-button" onClick={handleSubmit}>Submit</button>
        </div>
      </div>

      <div className="question-results-container">
        {loading && (
          <div className="loading-spinner">
            <div></div><div></div><div></div>
          </div>
        )}
        {!loading && !error && questions.length === 0 && (
          <div className="no-jobs">Enter filters and click Submit to get questions.</div>
        )}
        {error && <div className="error">{error}</div>}
        {questions.map(q => (
          <QuestionCard key={q.id} question={q.question || ''} answer={q.answer || ''} explanation={q.explanation || ''} />
        ))}
      </div>
    </div>
  );
};

export default QuestionBank;
