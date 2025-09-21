import React from 'react';
import '../styles/JobFinder.css';

const initialsFromCompany = (name) => {
    if (!name) return '';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
};

const JobCard = ({ job, onApply }) => {
    return (
        <article className="job-card" aria-labelledby={`job-${job.id}-title`}>
            <div className="job-card-left">
                <div className="company-badge" aria-hidden="true">{initialsFromCompany(job.company)}</div>
                <div>
                    <div className="job-company">{job.company}</div>
                    <h3 id={`job-${job.id}-title`} className="job-title">{job.title}</h3>
                    <p className="job-jd" title={job.jd}>{job.jd}</p>
                    <div className="job-meta">
                        <span className="job-location">{job.location}</span>
                        <span className="job-type">{job.type}</span>
                        <span className="job-salary">{job.salary}</span>
                    </div>
                </div>
            </div>
            <div className="job-card-right">
                <div className="job-skills" aria-label={`Skills: ${job.skills.join(', ')}`}>
                    {job.skills.slice(0, 4).map((s, i) => (
                        <span key={i} className="skill-pill">{s}</span>
                    ))}
                </div>
                <div className="job-actions">
                    <button
                        className="btn btn-small btn-primary btn-apply"
                        onClick={() => onApply(job)}
                        aria-label={`Apply to ${job.title} at ${job.company}`}
                    >
                        Apply
                    </button>
                    <button className="btn btn-small btn-outline btn-details" aria-label={`View details for ${job.title}`}>
                        Details
                    </button>
                </div>
            </div>
        </article>
    );
};

export default JobCard;
