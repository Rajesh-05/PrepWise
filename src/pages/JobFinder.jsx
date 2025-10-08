import React, { useState, useEffect, useCallback } from 'react';
import '../styles/JobFinder.css';
import JobFilters from '../components/JobFilters';
import JobCard from '../components/JobCard';
import JobDetails from '../components/JobDetails';

// Debounce hook
function useDebounce(value, delay) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debounced;
}

const JobFinder = () => {
        const [filters, setFilters] = useState({ query: '', location: '', mode: '', salary: '', duration: '', skills: '' });
        const [jobs, setJobs] = useState([]);
        const [loading, setLoading] = useState(false);
        const [error, setError] = useState('');
        const [refreshKey, setRefreshKey] = useState(0);
        const [selectedJob, setSelectedJob] = useState(null);

        // Debounce filters for API call
        const debouncedFilters = useDebounce(filters, 600);

        // Cache jobs in sessionStorage
        useEffect(() => {
            const cacheKey = JSON.stringify(debouncedFilters);
            const cached = sessionStorage.getItem('jobfinder:' + cacheKey);
            if (cached) {
                setJobs(JSON.parse(cached));
                setError('');
                setLoading(false);
                return;
            }
            if (!debouncedFilters.query) {
                setJobs([]);
                setError('');
                setLoading(false);
                return;
            }
            setLoading(true);
            setError('');
            fetch(
                `/api/jobs?query=${encodeURIComponent(debouncedFilters.query)}&location=${encodeURIComponent(debouncedFilters.location)}&num_jobs=10`
            )
                .then((res) => res.json())
                .then((data) => {
                    if (data.error) {
                        setError(data.error);
                        setJobs([]);
                    } else {
                        setJobs(data.jobs || []);
                        sessionStorage.setItem('jobfinder:' + cacheKey, JSON.stringify(data.jobs || []));
                    }
                })
                .catch((err) => {
                    setError('Failed to fetch jobs.');
                    setJobs([]);
                })
                .finally(() => setLoading(false));
        }, [debouncedFilters, refreshKey]);

        // Manual refresh
        const handleRefresh = useCallback(() => {
            setRefreshKey((k) => k + 1);
            // Clear cache for current filters
            const cacheKey = JSON.stringify(debouncedFilters);
            sessionStorage.removeItem('jobfinder:' + cacheKey);
        }, [debouncedFilters]);

        return (
            <div className="job-finder-page container">
                <div className="job-finder-grid">
                    <div>
                        <JobFilters 
                            filters={filters} 
                            onChange={setFilters}
                            onReset={() => setFilters({ query: '', location: '', mode: '', salary: '', duration: '', skills: '' })}
                            onRefresh={handleRefresh}
                        />
                    </div>
                    <div>
                        {loading && <div className="loading-spinner">Loading jobs...</div>}
                        {error && <div className="error">{error}</div>}
                        {!loading && !error && jobs.length === 0 && debouncedFilters.query && (
                            <div className="no-jobs">No jobs found. Try changing filters.</div>
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
