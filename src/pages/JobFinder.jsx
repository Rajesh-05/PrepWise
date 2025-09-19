import React, { useState, useEffect } from 'react';
import '../styles/JobFinder.css';

const JobFinder = () => {
    const [jobs, setJobs] = useState([]);
    const [filteredJobs, setFilteredJobs] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [locationFilter, setLocationFilter] = useState('');
    const [jobTypeFilter, setJobTypeFilter] = useState('');
    const [experienceFilter, setExperienceFilter] = useState('');
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState('grid'); // grid or list

    // Sample job data - In a real app, this would come from an API
    const sampleJobs = [
        {
            id: 1,
            title: 'Frontend Developer',
            company: 'TechCorp Inc.',
            location: 'San Francisco, CA',
            type: 'Full-time',
            experience: 'Mid-level',
            salary: '$80,000 - $120,000',
            description: 'Join our team as a Frontend Developer and help build amazing user experiences with React, TypeScript, and modern web technologies.',
            skills: ['React', 'TypeScript', 'JavaScript', 'CSS', 'HTML'],
            remote: true,
            posted: '2 days ago',
            logo: '🚀',
            gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        },
        {
            id: 2,
            title: 'Full Stack Engineer',
            company: 'StartupXYZ',
            location: 'New York, NY',
            type: 'Full-time',
            experience: 'Senior',
            salary: '$120,000 - $160,000',
            description: 'We are looking for a Full Stack Engineer to join our growing team. Work with cutting-edge technologies and help scale our platform.',
            skills: ['Node.js', 'React', 'MongoDB', 'AWS', 'Docker'],
            remote: false,
            posted: '1 day ago',
            logo: '💻',
            gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
        },
        {
            id: 3,
            title: 'UI/UX Designer',
            company: 'DesignStudio',
            location: 'Los Angeles, CA',
            type: 'Contract',
            experience: 'Mid-level',
            salary: '$60,000 - $90,000',
            description: 'Create beautiful and intuitive designs for web and mobile applications. Work with a creative team on exciting projects.',
            skills: ['Figma', 'Adobe Creative Suite', 'Prototyping', 'User Research'],
            remote: true,
            posted: '3 days ago',
            logo: '🎨',
            gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
        },
        {
            id: 4,
            title: 'Data Scientist',
            company: 'DataTech Solutions',
            location: 'Seattle, WA',
            type: 'Full-time',
            experience: 'Senior',
            salary: '$130,000 - $180,000',
            description: 'Analyze complex datasets and build machine learning models to drive business insights and decision making.',
            skills: ['Python', 'TensorFlow', 'SQL', 'Statistics', 'Machine Learning'],
            remote: true,
            posted: '1 week ago',
            logo: '📊',
            gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'
        },
        {
            id: 5,
            title: 'DevOps Engineer',
            company: 'CloudFirst',
            location: 'Austin, TX',
            type: 'Full-time',
            experience: 'Mid-level',
            salary: '$90,000 - $130,000',
            description: 'Help maintain and scale our cloud infrastructure. Work with Docker, Kubernetes, and CI/CD pipelines.',
            skills: ['AWS', 'Docker', 'Kubernetes', 'Jenkins', 'Terraform'],
            remote: false,
            posted: '4 days ago',
            logo: '☁️',
            gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
        },
        {
            id: 6,
            title: 'Product Manager',
            company: 'InnovateLab',
            location: 'Boston, MA',
            type: 'Full-time',
            experience: 'Senior',
            salary: '$110,000 - $150,000',
            description: 'Lead product strategy and roadmap for our innovative SaaS platform. Work cross-functionally with engineering and design teams.',
            skills: ['Product Strategy', 'Agile', 'Analytics', 'User Research'],
            remote: true,
            posted: '5 days ago',
            logo: '📱',
            gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)'
        }
    ];

    useEffect(() => {
        // Simulate loading
        setLoading(true);
        setTimeout(() => {
            setJobs(sampleJobs);
            setFilteredJobs(sampleJobs);
            setLoading(false);
        }, 1000);
    }, []);

    useEffect(() => {
        filterJobs();
    }, [searchTerm, locationFilter, jobTypeFilter, experienceFilter, jobs]);

    const filterJobs = () => {
        let filtered = jobs.filter(job => {
            const matchesSearch = job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                job.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                job.skills.some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase()));
            
            const matchesLocation = !locationFilter || job.location.toLowerCase().includes(locationFilter.toLowerCase());
            const matchesJobType = !jobTypeFilter || job.type === jobTypeFilter;
            const matchesExperience = !experienceFilter || job.experience === experienceFilter;

            return matchesSearch && matchesLocation && matchesJobType && matchesExperience;
        });

        setFilteredJobs(filtered);
    };

    const clearFilters = () => {
        setSearchTerm('');
        setLocationFilter('');
        setJobTypeFilter('');
        setExperienceFilter('');
    };

    const JobCard = ({ job }) => (
        <div className="job-card" style={{ background: job.gradient }}>
            <div className="job-card-content">
                <div className="job-header">
                    <div className="job-logo">{job.logo}</div>
                    <div className="job-meta">
                        <span className="job-posted">{job.posted}</span>
                        {job.remote && <span className="remote-badge">Remote</span>}
                    </div>
                </div>
                
                <h3 className="job-title">{job.title}</h3>
                <p className="job-company">{job.company}</p>
                <p className="job-location">📍 {job.location}</p>
                
                <div className="job-details">
                    <span className="job-type">{job.type}</span>
                    <span className="job-experience">{job.experience}</span>
                </div>
                
                <p className="job-salary">💰 {job.salary}</p>
                <p className="job-description">{job.description}</p>
                
                <div className="job-skills">
                    {job.skills.map((skill, index) => (
                        <span key={index} className="skill-tag">{skill}</span>
                    ))}
                </div>
                
                <div className="job-actions">
                    <button className="btn btn-primary">Apply Now</button>
                    <button className="btn btn-secondary">Save Job</button>
                </div>
            </div>
        </div>
    );

    const JobListItem = ({ job }) => (
        <div className="job-list-item">
            <div className="job-list-logo" style={{ background: job.gradient }}>
                {job.logo}
            </div>
            <div className="job-list-content">
                <div className="job-list-header">
                    <h3 className="job-list-title">{job.title}</h3>
                    <span className="job-list-salary">{job.salary}</span>
                </div>
                <p className="job-list-company">{job.company} • {job.location}</p>
                <div className="job-list-meta">
                    <span className="job-type-small">{job.type}</span>
                    <span className="job-experience-small">{job.experience}</span>
                    <span className="job-posted-small">{job.posted}</span>
                    {job.remote && <span className="remote-badge-small">Remote</span>}
                </div>
                <div className="job-list-skills">
                    {job.skills.slice(0, 3).map((skill, index) => (
                        <span key={index} className="skill-tag-small">{skill}</span>
                    ))}
                    {job.skills.length > 3 && <span className="more-skills">+{job.skills.length - 3} more</span>}
                </div>
            </div>
            <div className="job-list-actions">
                <button className="btn btn-primary btn-small">Apply</button>
                <button className="btn btn-secondary btn-small">Save</button>
            </div>
        </div>
    );

    return (
        <div className="job-finder">
            <div className="job-finder-hero">
                <div className="container">
                    <div className="hero-content">
                        <h1>Find Your Dream Job</h1>
                        <p>Discover amazing opportunities with top companies</p>
                        
                        <div className="search-bar">
                            <div className="search-input">
                                <span className="search-icon">🔍</span>
                                <input
                                    type="text"
                                    placeholder="Search jobs, companies, or skills..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="location-input">
                                <span className="location-icon">📍</span>
                                <input
                                    type="text"
                                    placeholder="Location"
                                    value={locationFilter}
                                    onChange={(e) => setLocationFilter(e.target.value)}
                                />
                            </div>
                            <button className="search-btn">Search</button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="container">
                <div className="filters-section">
                    <div className="filters">
                        <select
                            value={jobTypeFilter}
                            onChange={(e) => setJobTypeFilter(e.target.value)}
                            className="filter-select"
                        >
                            <option value="">All Job Types</option>
                            <option value="Full-time">Full-time</option>
                            <option value="Part-time">Part-time</option>
                            <option value="Contract">Contract</option>
                            <option value="Internship">Internship</option>
                        </select>

                        <select
                            value={experienceFilter}
                            onChange={(e) => setExperienceFilter(e.target.value)}
                            className="filter-select"
                        >
                            <option value="">All Experience Levels</option>
                            <option value="Entry-level">Entry-level</option>
                            <option value="Mid-level">Mid-level</option>
                            <option value="Senior">Senior</option>
                        </select>

                        <button onClick={clearFilters} className="clear-filters">
                            Clear Filters
                        </button>
                    </div>

                    <div className="view-controls">
                        <div className="results-count">
                            {filteredJobs.length} jobs found
                        </div>
                        <div className="view-toggle">
                            <button
                                className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                                onClick={() => setViewMode('grid')}
                            >
                                ⋮⋮
                            </button>
                            <button
                                className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                                onClick={() => setViewMode('list')}
                            >
                                ☰
                            </button>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="loading">
                        <div className="loading-spinner"></div>
                        <p>Finding the perfect jobs for you...</p>
                    </div>
                ) : (
                    <div className={`jobs-container ${viewMode}`}>
                        {filteredJobs.length === 0 ? (
                            <div className="no-jobs">
                                <div className="no-jobs-icon">😔</div>
                                <h3>No jobs found</h3>
                                <p>Try adjusting your search criteria or filters</p>
                            </div>
                        ) : (
                            viewMode === 'grid' ? (
                                <div className="jobs-grid">
                                    {filteredJobs.map(job => (
                                        <JobCard key={job.id} job={job} />
                                    ))}
                                </div>
                            ) : (
                                <div className="jobs-list">
                                    {filteredJobs.map(job => (
                                        <JobListItem key={job.id} job={job} />
                                    ))}
                                </div>
                            )
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default JobFinder;
