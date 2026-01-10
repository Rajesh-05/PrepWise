import React, { useState } from 'react';
import '../styles/JobFinder.css';
import JobFilters from '../components/JobFilters';
import JobCard from '../components/JobCard';
import JobDetails from '../components/JobDetails';

const JobFinder = () => {
        const [filters, setFilters] = useState({ query: '', location: '', mode: '', salary: '', duration: '', skills: '' });
        const [jobs, setJobs] = useState([]);
        const [loading, setLoading] = useState(false);
        const [error, setError] = useState('');
        const [selectedJob, setSelectedJob] = useState(null);

        // Handle Reset
        const handleReset = () => {
            setFilters({ query: '', location: '', mode: '', salary: '', duration: '', skills: '' });
            setJobs([]);
            setError('');
        };

        // Handle Submit - Fetch jobs
        const handleSubmit = async () => {
            if (!filters.query) {
                setError('Please enter a search query');
                return;
            }
            setLoading(true);
            setError('');
            try {
                const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
                const res = await fetch(
                    `/api/jobs?query=${encodeURIComponent(filters.query)}&location=${encodeURIComponent(filters.location)}&num_jobs=10`,
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    }
                );
                const data = await res.json();
                console.log('API Response:', data); // Debug log
                if (res.ok) {
                    if (data.error) {
                        setError(data.error);
                        setJobs([]);
                    } else if (data.jobs && data.jobs.length > 0) {
                        setJobs(data.jobs);
                    } else {
                        setError('No jobs found. Try different filters.');
                        setJobs([]);
                    }
                } else {
                    setError(data.error || 'Failed to fetch jobs');
                    setJobs([]);
                }
            } catch (err) {
                console.error('Fetch error:', err); // Debug log
                setError('Network error. Please try again.');
                setJobs([]);
            }
            setLoading(false);
        };

        // Handle Refresh - Re-fetch with same filters
        const handleRefresh = async () => {
            if (!filters.query) {
                setError('Please enter a search query first');
                return;
            }
            setLoading(true);
            setError('');
            try {
                const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
                const res = await fetch(
                    `/api/jobs?query=${encodeURIComponent(filters.query)}&location=${encodeURIComponent(filters.location)}&num_jobs=10`,
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    }
                );
                const data = await res.json();
                console.log('API Response (Refresh):', data); // Debug log
                if (res.ok) {
                    if (data.error) {
                        setError(data.error);
                        setJobs([]);
                    } else if (data.jobs && data.jobs.length > 0) {
                        setJobs(data.jobs);
                    } else {
                        setError('No jobs found. Try different filters.');
                        setJobs([]);
                    }
                } else {
                    setError(data.error || 'Failed to fetch jobs');
                    setJobs([]);
                }
            } catch (err) {
                console.error('Fetch error (Refresh):', err); // Debug log
                setError('Network error. Please try again.');
                setJobs([]);
            }
            setLoading(false);
        };

        return (
            <div className="job-finder-page container">
                <div className="job-finder-grid">
                    <div>
                        <JobFilters 
                            filters={filters} 
                            onChange={setFilters}
                            onReset={handleReset}
                            onRefresh={handleRefresh}
                            onSubmit={handleSubmit}
                        />
                    </div>
                    <div>
                        {loading && <div className="loading-spinner">Loading jobs...</div>}
                        {error && <div className="error">{error}</div>}
                        {!loading && !error && jobs.length === 0 && (
                            <div className="no-jobs">Enter a search query and click Submit to find jobs.</div>
                        )}
                        {!loading && !error && jobs.map((job) => (
                            <JobCard 
                                key={job.id || job.title} 
                                job={job} 
                                onApply={() => {
                                    if (job.job_url) {
                                        window.open(job.job_url, '_blank');
                                    } else {
                                        alert('No job URL available');
                                    }
                                }}
                                onDetails={() => setSelectedJob(job)}
                            />
                        ))}
                    </div>
                </div>
                {selectedJob && <JobDetails job={selectedJob} onClose={() => setSelectedJob(null)} />}
            </div>
        );
}
export default JobFinder;
