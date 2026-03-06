import React, { useState } from 'react';
import '../styles/JobFinder.css';
import JobCard from '../components/JobCard';
import JobDetails from '../components/JobDetails';

const JobFinder = () => {
    const [filters, setFilters] = useState({ query: '', location: '', mode: '', salary: '', duration: '', skills: '' });
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedJob, setSelectedJob] = useState(null);

    const update = (patch) => setFilters(f => ({ ...f, ...patch }));

    const fetchJobs = async () => {
        if (!filters.query) { setError('Please enter a job title to search'); return; }
        setLoading(true);
        setError('');
        try {
            const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
            const res = await fetch(
                `/api/jobs?query=${encodeURIComponent(filters.query)}&location=${encodeURIComponent(filters.location)}&num_jobs=10`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            const data = await res.json();
            if (res.ok && data.jobs && data.jobs.length > 0) {
                setJobs(data.jobs);
            } else {
                setError(data.error || 'No jobs found. Try a different search term.');
                setJobs([]);
            }
        } catch {
            setError('Network error. Please try again.');
            setJobs([]);
        }
        setLoading(false);
    };

    const handleKeyDown = (e) => { if (e.key === 'Enter') fetchJobs(); };

    const handleReset = () => {
        setFilters({ query: '', location: '', mode: '', salary: '', duration: '', skills: '' });
        setJobs([]);
        setError('');
    };

    return (
        <div className="jf-page">
            {/* ── Search Header ── */}
            <div className="jf-header">
                <div className="jf-header-inner">
                    <div className="jf-title-row">
                        <span className="jf-title-icon">🔍</span>
                        <h1 className="jf-title">Job Finder</h1>
                    </div>
                    <p className="jf-subtitle">Find roles that match your skills — search by title, company, or JD</p>
                    <div className="jf-search-bar">
                        <div className="jf-search-input-wrap">
                            <span className="jf-search-ico">🔎</span>
                            <input
                                type="text"
                                className="jf-search-input"
                                placeholder='e.g. "React Developer", "Product Manager", "Data Analyst"'
                                value={filters.query}
                                onChange={e => update({ query: e.target.value })}
                                onKeyDown={handleKeyDown}
                                autoFocus
                            />
                            {filters.query && (
                                <button className="jf-clear-btn" onClick={() => update({ query: '' })} aria-label="Clear">✕</button>
                            )}
                        </div>
                        <button className="jf-search-btn" onClick={fetchJobs} disabled={loading}>
                            {loading ? <span className="jf-spin" /> : 'Search'}
                        </button>
                    </div>
                    {/* Filter Chips */}
                    <div className="jf-filters-row">
                        <select className="jf-chip" value={filters.location} onChange={e => update({ location: e.target.value })}>
                            <option value="">📍 Any Location</option>
                            <optgroup label="Remote">
                                <option value="Remote">🌐 Remote (Worldwide)</option>
                                <option value="Remote USA">🇺🇸 Remote (USA only)</option>
                            </optgroup>
                            <optgroup label="🇺🇸 United States">
                                <option>New York, NY</option>
                                <option>San Francisco, CA</option>
                                <option>San Jose, CA</option>
                                <option>Seattle, WA</option>
                                <option>Austin, TX</option>
                                <option>Chicago, IL</option>
                                <option>Boston, MA</option>
                                <option>Los Angeles, CA</option>
                            </optgroup>
                            <optgroup label="🇬🇧 United Kingdom">
                                <option>London, UK</option>
                                <option>Manchester, UK</option>
                            </optgroup>
                            <optgroup label="🇮🇳 India">
                                <option>Bengaluru</option>
                                <option>Hyderabad</option>
                                <option>Mumbai</option>
                                <option>Pune</option>
                                <option>Chennai</option>
                                <option>Delhi NCR</option>
                            </optgroup>
                            <optgroup label="🇨🇦 Canada">
                                <option>Toronto</option>
                                <option>Vancouver</option>
                            </optgroup>
                            <optgroup label="🇦🇺 Australia">
                                <option>Sydney</option>
                                <option>Melbourne</option>
                            </optgroup>
                        </select>
                        <select className="jf-chip" value={filters.mode} onChange={e => update({ mode: e.target.value })}>
                            <option value="">💻 Work Mode</option>
                            <option>Remote</option>
                            <option>Onsite</option>
                            <option>Hybrid</option>
                        </select>
                        <select className="jf-chip" value={filters.duration} onChange={e => update({ duration: e.target.value })}>
                            <option value="">📋 Job Type</option>
                            <option>Full-time</option>
                            <option>Part-time</option>
                            <option>Contract</option>
                            <option>Internship</option>
                        </select>
                        <select className="jf-chip" value={filters.salary} onChange={e => update({ salary: e.target.value })}>
                            <option value="">💰 Salary Range</option>
                            <optgroup label="Entry Level">
                                <option value="0-30k">Under $30k</option>
                                <option value="30-50k">$30k – $50k</option>
                                <option value="50-70k">$50k – $70k</option>
                            </optgroup>
                            <optgroup label="Mid Level">
                                <option value="70-100k">$70k – $100k</option>
                                <option value="100-130k">$100k – $130k</option>
                                <option value="130-160k">$130k – $160k</option>
                            </optgroup>
                            <optgroup label="Senior / Executive">
                                <option value="160-200k">$160k – $200k</option>
                                <option value="200k+">$200k+</option>
                            </optgroup>
                        </select>
                        <input
                            type="text"
                            className="jf-chip jf-skills-chip"
                            placeholder="🛠 Skills (e.g. React, Python)"
                            value={filters.skills}
                            onChange={e => update({ skills: e.target.value })}
                        />
                        {(filters.location || filters.mode || filters.duration || filters.salary || filters.skills) && (
                            <button className="jf-chip jf-reset-chip" onClick={handleReset}>✕ Reset</button>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Results Area ── */}
            <div className="jf-results">

                {/* Loading */}
                {loading && (
                    <div className="jf-loading">
                        <div className="jf-loading-dots">
                            <span /><span /><span />
                        </div>
                        <p>Searching for opportunities…</p>
                    </div>
                )}

                {/* Error */}
                {!loading && error && (
                    <div className="jf-error-state">
                        <div className="jf-error-icon">⚠️</div>
                        <p>{error}</p>
                    </div>
                )}

                {/* Empty State */}
                {!loading && !error && jobs.length === 0 && (
                    <div className="jf-empty-state">
                        <div className="jf-empty-icon">🎯</div>
                        <h3>Find your next opportunity</h3>
                        <p>Type a job title above and press <strong>Search</strong> to discover matching roles.</p>
                        <div className="jf-tips">
                            <div className="jf-tip">💡 Be specific — "React Developer" beats "Developer"</div>
                            <div className="jf-tip">🌍 Add a location for local results</div>
                            <div className="jf-tip">🎓 Try "Internship" in Job Type for entry-level roles</div>
                        </div>
                    </div>
                )}

                {/* Results Header */}
                {!loading && !error && jobs.length > 0 && (
                    <div className="jf-results-header">
                        <span className="jf-results-count">{jobs.length} roles found</span>
                        <button className="jf-refresh-btn" onClick={fetchJobs}>↻ Refresh</button>
                    </div>
                )}

                {/* Job Cards Grid */}
                {!loading && !error && jobs.length > 0 && (
                    <div className="jf-cards-grid">
                        {jobs.map((job) => (
                            <JobCard
                                key={job.id || job.title}
                                job={job}
                                onApply={() => job.job_url ? window.open(job.job_url, '_blank') : alert('No URL available')}
                                onDetails={() => setSelectedJob(job)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {selectedJob && <JobDetails job={selectedJob} onClose={() => setSelectedJob(null)} />}
        </div>
    );
};

export default JobFinder;
