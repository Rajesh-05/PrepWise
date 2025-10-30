import React from 'react';
import '../styles/JobFinder.css';

const JobDetails = ({ job, onClose }) => {
    if (!job) return null;

    const fetchGlassdoorLink = async (companyName) => {
        try {
            const response = await fetch('http://127.0.0.1:5000/scrape-review', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ companyName }),
            });
            const data = await response.json();
            if (data.glassdoor_link) {
                window.open(data.glassdoor_link, '_blank');
            } else {
                window.open(`https://www.glassdoor.com/Reviews/company-reviews.htm?keyword=${encodeURIComponent(companyName)}`, '_blank');
            }
        } catch (error) {
            alert('Failed to fetch Glassdoor link. Redirecting to fallback link.');
            window.open(`https://www.glassdoor.com/Reviews/company-reviews.htm?keyword=${encodeURIComponent(companyName)}`, '_blank');
        }
    };

    const formatDescription = (description) => {
        if (!description) return 'No description available.';
        // Normalize common HTML/markdown residues, then split into paragraphs
        const cleaned = description
            .replace(/\*\*(.*?)\*\*/g, '$1') // remove bold markdown markers
            .replace(/<br\s*\/?>(\s*)/gi, '\n') // replace <br> with newline
            .replace(/<b>(.*?)<\/b>/gi, '$1') // strip <b> tags
            .replace(/[\\/*]+/g, ' '); // collapse slashes and asterisks into spaces

        return cleaned
            .split('\n')
            .map((line, index) => (
                <p key={index} dangerouslySetInnerHTML={{ __html: line }} />
            ));
    };

    return (
        <div className="job-details-modal">
            <div 
                className="job-details-content" 
                // ✨ ADD THIS INLINE STYLE TO FORCE POSITIONING CONTEXT
                style={{ position: 'relative' }} 
            >
                <button 
                    className="btn btn-close" 
                    onClick={onClose} 
                    aria-label="Close"
                    style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        width: '40px',
                        height: '40px',
                        borderRadius: '5px',
                        backgroundColor: 'transparent',
                        border: 'none',
                        fontSize: '24px',
                        cursor: 'pointer',
                    }}
                >
                    &times;
                </button>
                <div className="job-details-header">
                    <div className="job-details-title">
                        <h2>{job.title}</h2>
                        <h3>{job.company}</h3>
                        <p>{job.location}</p>
                    </div>
                    <div className="job-details-meta">
                        <span className="job-type">{job.job_type || 'N/A'}</span>
                        <span className="job-salary">{job.salary_min && job.salary_max ? `${job.salary_min} - ${job.salary_max} ${job.currency}` : 'Salary not disclosed'}</span>
                        <span className={`job-remote ${job.is_remote ? 'remote' : 'on-site'}`}>{job.is_remote ? 'Remote' : 'On-site'}</span>
                        <p>Posted on: {job.date_posted}</p>
                    </div>
                </div>

                <div className="job-details-section">
                    <h4>Job Description</h4>
                    <div className="job-description">
                        {formatDescription(job.description)}
                    </div>
                </div>

                <div className="job-details-footer">
                    <button
                        className="btn btn-primary"
                        onClick={() => {
                            const url = job.company_url || job.job_url;
                            if (url) {
                                window.open(url, '_blank');
                            } else {
                                alert('No website or job URL available.');
                            }
                        }}
                    >
                        Apply Now
                    </button>
                    <button
                        className="btn btn-reviews"
                        onClick={() => fetchGlassdoorLink(job.company)}
                    >
                        Company Reviews
                    </button>
                </div>
            </div>
        </div>
    );
};

export default JobDetails;