import React, { useState, useMemo } from 'react';
import '../styles/JobFinder.css';
import JobFilters from '../components/JobFilters';
import JobCard from '../components/JobCard';

const MOCK_JOBS = [
    {
        id: 1,
        title: 'Frontend Engineer',
        company: 'Acme Labs',
        location: 'Remote',
        type: 'Full-time',
        salary: '80k-120k',
        duration: 'Permanent',
        skills: ['React', 'JavaScript', 'CSS', 'HTML'],
        domain: 'Web',
        jd: 'Build responsive UI components using React.'
    },
    {
        id: 2,
        title: 'Data Scientist (Internship)',
        company: 'DataNova',
        location: 'Bengaluru',
        type: 'Internship',
        salary: '10k/month',
        duration: '3 months',
        skills: ['Python', 'Pandas', 'Machine Learning'],
        domain: 'Data',
        jd: 'Work on supervised learning problems and data pipelines.'
    },
    {
        id: 3,
        title: 'Backend Developer',
        company: 'Cloudify',
        location: 'San Francisco',
        type: 'Hybrid',
        salary: '120k+',
        duration: 'Permanent',
        skills: ['Node.js', 'Express', 'Databases'],
        domain: 'Cloud',
        jd: 'Develop scalable APIs and microservices.'
    }
];

const JobFinder = () => {
    const [filters, setFilters] = useState({ query: '', location: '', mode: '', salary: '', duration: '', skills: '' });

    const filteredJobs = useMemo(() => {
        const q = (filters.query || '').trim().toLowerCase();
        const skillList = (filters.skills || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

        const parseSalaryRange = (salaryStr) => {
            // returns [min, max] in thousands (k scale). max === Infinity when open-ended
            if (!salaryStr) return [0, Infinity];
            if (salaryStr.endsWith('+')) {
                const n = parseInt(salaryStr.replace(/[^0-9]/g, ''), 10);
                return [n, Infinity];
            }
            const parts = salaryStr.split('-').map(p => parseInt(p.replace(/[^0-9]/g, ''), 10));
            if (parts.length === 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
                return [parts[0], parts[1]];
            }
            return [0, Infinity];
        };

        const [selMin, selMax] = parseSalaryRange(filters.salary || '');

        return MOCK_JOBS.filter(job => {
            if (filters.location && job.location.toLowerCase() !== filters.location.toLowerCase()) return false;
            if (filters.mode && job.type.toLowerCase() !== filters.mode.toLowerCase()) return false;

            // normalize job.salary to a representative numeric min value (in same units as filter)
            const jobSalaryStr = (job.salary || '').toLowerCase();
            let jobMin = 0;
            if (jobSalaryStr.includes('k')) {
                // examples: '80k-120k', '120k+'
                const nums = jobSalaryStr.replace(/\+/g, '').split('-').map(s => parseInt(s.replace(/[^0-9]/g, ''), 10)).filter(n => !Number.isNaN(n));
                if (nums.length > 0) jobMin = nums[0];
            } else if (jobSalaryStr.includes('month')) {
                // treat monthly as lower than annual; convert '10k/month' -> 10 (k)
                const n = parseInt(jobSalaryStr.replace(/[^0-9]/g, ''), 10);
                if (!Number.isNaN(n)) jobMin = n; // treating as 'k'-scale for permissive match
            } else {
                const n = parseInt(jobSalaryStr.replace(/[^0-9]/g, ''), 10);
                if (!Number.isNaN(n)) jobMin = n;
            }

            if (!(jobMin >= selMin && jobMin <= selMax)) return false;

            if (filters.duration && job.duration.toLowerCase().indexOf(filters.duration.toLowerCase()) === -1 && job.type.toLowerCase().indexOf(filters.duration.toLowerCase()) === -1) return false;

            if (skillList.length > 0) {
                const jobSkills = job.skills.map(s => s.toLowerCase());
                const hasAll = skillList.every(s => jobSkills.includes(s));
                if (!hasAll) return false;
            }

            if (q) {
                const hay = (job.title + ' ' + job.company + ' ' + job.jd + ' ' + job.domain).toLowerCase();
                if (!hay.includes(q)) return false;
            }

            return true;
        });
    }, [filters]);

    const handleApply = (job) => {
        // placeholder - in a real app you'd navigate or open modal
        alert(`Applying to ${job.title} at ${job.company}`);
    };

    const resetFilters = () => setFilters({ query: '', location: '', mode: '', salary: '', duration: '', skills: '' });

    return (
        <div className="job-finder-page">
            <div className="job-finder-grid">
                <JobFilters filters={filters} onChange={setFilters} onReset={resetFilters} />

                <section className="job-results">
                    <div className="results-header">
                        <div>{filteredJobs.length} jobs found</div>
                        <div className="sort-placeholder">Sort: <select><option>Relevance</option><option>Latest</option></select></div>
                    </div>

                    <div className="jobs-list">
                        {filteredJobs.map(job => (
                            <JobCard key={job.id} job={job} onApply={handleApply} />
                        ))}

                        {filteredJobs.length === 0 && (
                            <div className="no-results">No jobs found. Try changing your filters or search.</div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default JobFinder;
