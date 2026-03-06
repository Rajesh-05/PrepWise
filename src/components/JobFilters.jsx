import React from 'react';
import '../styles/JobFinder.css';

const JobFilters = ({ filters, onChange, onReset, onRefresh, onSubmit }) => {
    const update = (patch) => onChange({ ...filters, ...patch });

    return (
        <aside className="job-filters" aria-label="Job filters">
            <div className="filters-header">
                <h3>Filters</h3>
                <button className="btn-link" onClick={onReset} aria-label="Reset filters">Reset</button>
            </div>

            <div className="filter-group">
                <label htmlFor="filter-search">Search</label>
                <div className="search-inline">
                    <input
                        id="filter-search"
                        type="text"
                        placeholder="Search by title, JD or company"
                        value={filters.query}
                        onChange={e => update({ query: e.target.value })}
                    />
                    {filters.query && (
                        <button
                            className="clear-btn"
                            aria-label="Clear search"
                            onClick={() => update({ query: '' })}
                        >
                            ×
                        </button>
                    )}
                </div>
            </div>

            <div className="filter-group">
                <label htmlFor="filter-location">Location</label>
                <select id="filter-location" value={filters.location} onChange={e => update({ location: e.target.value })}>
                    <option value="">Any</option>
                    <option>Remote</option>
                    <option>New York</option>
                    <option>San Francisco</option>
                    <option>Bengaluru</option>
                </select>
            </div>

            <div className="filter-group">
                <label htmlFor="filter-mode">Work Mode</label>
                <select id="filter-mode" value={filters.mode} onChange={e => update({ mode: e.target.value })}>
                    <option value="">Any</option>
                    <option>Remote</option>
                    <option>Onsite</option>
                    <option>Hybrid</option>
                </select>
            </div>

            <div className="filter-group">
                <label htmlFor="filter-salary">Salary</label>
                <select id="filter-salary" value={filters.salary} onChange={e => update({ salary: e.target.value })}>
                    <option value="">Any</option>
                    <option>0-50k</option>
                    <option>50-100k</option>
                    <option>100k+</option>
                </select>
            </div>

            <div className="filter-group">
                <label htmlFor="filter-duration">Duration / Type</label>
                <select id="filter-duration" value={filters.duration} onChange={e => update({ duration: e.target.value })}>
                    <option value="">Any</option>
                    <option>Full-time</option>
                    <option>Part-time</option>
                    <option>Contract</option>
                    <option>Internship</option>
                </select>
            </div>

            <div className="filter-group">
                <label htmlFor="filter-skills">Skills</label>
                <input
                    id="filter-skills"
                    type="text"
                    placeholder="e.g. React, Python"
                    value={filters.skills}
                    onChange={e => update({ skills: e.target.value })}
                />
            </div>

            <div className="filters-footer">
                <button className="refresh-btn" onClick={onRefresh} title="Refresh jobs">Refresh</button>
                <button className="submit-btn" onClick={onSubmit} title="Submit to search jobs">Submit</button>
            </div>
        </aside>
    );
};

export default JobFilters;
