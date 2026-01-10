import React, { useState, useRef } from 'react';
import { FileText, Sparkles, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import '../styles/ResumeBuilder.css';

// Hardcoded user data
const USER_DATA = {
  name: "Jane Smith",
  email: "jane.smith@email.com",
  phone: "+1-555-0123",
  location: "San Francisco, CA",
  linkedin: "linkedin.com/in/janesmith",
  github: "github.com/janesmith",
  portfolio: "janesmith.dev",
  summary: "Results-driven software engineer with 5+ years of experience in full-stack development",
  skills: ["JavaScript", "React", "Node.js", "Python", "AWS", "Docker", "PostgreSQL", "MongoDB"],
  experience: [
    {
      title: "Senior Software Engineer",
      company: "Tech Corp",
      duration: "2021 - Present",
      responsibilities: [
        "Led development of microservices architecture serving 1M+ users",
        "Mentored team of 5 junior developers",
        "Reduced deployment time by 40% through CI/CD optimization"
      ]
    },
    {
      title: "Software Engineer",
      company: "StartUp Inc",
      duration: "2019 - 2021",
      responsibilities: [
        "Built RESTful APIs using Node.js and Express",
        "Implemented responsive UI components with React",
        "Collaborated with cross-functional teams in Agile environment"
      ]
    }
  ],
  education: [
    {
      degree: "Bachelor of Science in Computer Science",
      school: "University of California",
      year: "2019"
    }
  ],
  certifications: ["AWS Certified Solutions Architect", "Professional Scrum Master I"]
};

// Resume templates
const TEMPLATES = {
  modern: `[NAME]
[EMAIL] | [PHONE] | [LOCATION] | [LINKEDIN] | [PORTFOLIO]

PROFESSIONAL SUMMARY
[SUMMARY]

TECHNICAL SKILLS
[SKILLS]

PROFESSIONAL EXPERIENCE
[EXPERIENCE]

EDUCATION
[EDUCATION]

CERTIFICATIONS
[CERTIFICATIONS]`,

  traditional: `[NAME]
[ADDRESS]
[PHONE] | [EMAIL]
[LINKEDIN] | [PORTFOLIO]

OBJECTIVE
[SUMMARY]

CORE COMPETENCIES
[SKILLS]

WORK EXPERIENCE
[EXPERIENCE]

ACADEMIC BACKGROUND
[EDUCATION]

PROFESSIONAL CERTIFICATIONS
[CERTIFICATIONS]`,

  technical: `[NAME]
Software Engineer
[EMAIL] | [PHONE] | [GITHUB] | [LINKEDIN]

SUMMARY
[SUMMARY]

TECHNICAL EXPERTISE
[SKILLS]

PROFESSIONAL EXPERIENCE
[EXPERIENCE]

PROJECTS
[PROJECTS]

EDUCATION
[EDUCATION]

CERTIFICATIONS & AWARDS
[CERTIFICATIONS]`
};

const ResumeBuilder = () => {
  const [jobDescription, setJobDescription] = useState('');
  const [template, setTemplate] = useState('modern');
  const [generatedResume, setGeneratedResume] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);

  const generateResume = async () => {
    if (!jobDescription.trim()) {
      setError('Please enter a job description');
      return;
    }

    setLoading(true);
    setError('');
    setGeneratedResume('');

    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('session_token');
      const response = await fetch('http://localhost:5000/generate-resume', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          jobDescription: jobDescription,
          template: template,
          userData: USER_DATA
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate resume');
      }

      const data = await response.json();
      setGeneratedResume(data.resume);
      
    } catch (err) {
      setError(err.message || 'An error occurred while generating the resume');
    } finally {
      setLoading(false);
    }
  };

  const downloadAsText = () => {
    const blob = new Blob([generatedResume], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ats-optimized-resume.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadAsPDF = async () => {
    setPdfLoading(true);
    try {
      // Create a temporary container for PDF rendering
      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '0';
      tempContainer.style.width = '794px'; // A4 width in pixels at 96 DPI
      tempContainer.style.minHeight = '1123px'; // A4 height in pixels
      tempContainer.style.padding = '60px 50px'; // Realistic margins
      tempContainer.style.backgroundColor = 'white';
      tempContainer.style.fontFamily = 'Calibri, Arial, sans-serif';
      tempContainer.style.fontSize = '11pt';
      tempContainer.style.lineHeight = '1.4';
      tempContainer.style.color = '#000';
      tempContainer.style.boxSizing = 'border-box';
      
      // Format the resume content as HTML
      tempContainer.innerHTML = formatResumeForPDF(generatedResume);
      
      document.body.appendChild(tempContainer);
      
      // Wait a bit for rendering
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Generate canvas from the container
      const canvas = await html2canvas(tempContainer, {
        scale: 2.5, // Higher scale for better quality
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 794,
        width: 794
      });
      
      // Remove temporary container
      document.body.removeChild(tempContainer);
      
      // Calculate PDF dimensions
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/png', 1.0);
      
      let heightLeft = imgHeight;
      let position = 0;
      
      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      // Add additional pages if needed
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      // Download the PDF
      pdf.save('ats-optimized-resume.pdf');
      
    } catch (err) {
      console.error('PDF generation error:', err);
      setError('Failed to generate PDF. Please try downloading as text instead.');
    } finally {
      setPdfLoading(false);
    }
  };

  const formatResumeForPDF = (text) => {
    const lines = text.split('\n');
    let html = '<div style="font-family: \'Calibri\', \'Arial\', sans-serif; line-height: 1.4; color: #000;">';
    let inList = false;
    let isFirstSection = true;
    let skipNext = false;

    lines.forEach((line, index) => {
      if (skipNext) {
        skipNext = false;
        return;
      }

      const trimmed = line.trim();
      const nextLine = index < lines.length - 1 ? lines[index + 1].trim() : '';
      
      // Skip empty lines but add spacing
      if (!trimmed) {
        if (inList) {
          html += '</ul></div>';
          inList = false;
        }
        return;
      }

      // Detect NAME (first line or very short all-caps at start)
      if (index === 0 || (isFirstSection && index <= 2 && trimmed === trimmed.toUpperCase() && trimmed.length < 40 && !trimmed.includes('|') && !trimmed.includes('@'))) {
        if (inList) {
          html += '</ul></div>';
          inList = false;
        }
        html += `<div style="text-align: center; margin-bottom: 8px;">
                   <h1 style="font-size: 22pt; margin: 0; padding: 0; color: #1a1a1a; font-weight: 700; letter-spacing: 0.5px;">${trimmed}</h1>
                 </div>`;
        isFirstSection = false;
        return;
      }

      // Detect contact info (has @, |, phone, linkedin, github, portfolio keywords)
      if (trimmed.includes('@') || 
          trimmed.includes('|') || 
          /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/.test(trimmed) ||
          /linkedin|github|portfolio/i.test(trimmed)) {
        html += `<div style="text-align: center; margin-bottom: 4px;">
                   <p style="font-size: 9.5pt; color: #444; margin: 0; padding: 0;">${trimmed}</p>
                 </div>`;
        return;
      }

      // Detect section headers (ALL CAPS, reasonable length, no numbers)
      if (trimmed === trimmed.toUpperCase() && 
          trimmed.length > 3 && 
          trimmed.length < 50 && 
          !/^\d/.test(trimmed) &&
          !trimmed.includes('|')) {
        if (inList) {
          html += '</ul></div>';
          inList = false;
        }
        html += `<div style="margin-top: 14px; margin-bottom: 8px;">
                   <h2 style="font-size: 12pt; margin: 0; padding: 0 0 3px 0; color: #1a1a1a; font-weight: 700; border-bottom: 2px solid #2c3e50; text-transform: uppercase; letter-spacing: 0.8px;">${trimmed}</h2>
                 </div>`;
        return;
      }

      // Detect job title (followed by company/date line)
      if (nextLine && 
          (nextLine.match(/\d{4}/) || nextLine.match(/[A-Z][a-z]+\s+\d{4}/) || nextLine.toLowerCase().includes('present')) &&
          !trimmed.match(/\d{4}/) &&
          !trimmed.startsWith('-') &&
          !trimmed.startsWith('•') &&
          !trimmed.startsWith('*')) {
        if (inList) {
          html += '</ul></div>';
          inList = false;
        }
        html += `<div style="margin-top: 10px;">
                   <h3 style="font-size: 11pt; margin: 0; padding: 0; color: #1a1a1a; font-weight: 700;">${trimmed}</h3>`;
        return;
      }

      // Detect company name with dates (has year, Present, etc.)
      if (trimmed.match(/\d{4}/) || 
          trimmed.toLowerCase().includes('present') || 
          trimmed.toLowerCase().includes('current')) {
        // Check if this looks like a company line (has separator like | or - or comma, and dates)
        if (trimmed.includes('|') || trimmed.includes(' - ') || trimmed.match(/[A-Za-z]+.*\d{4}/)) {
          html += `<p style="font-size: 10pt; color: #555; font-style: italic; margin: 2px 0 6px 0; padding: 0;">${trimmed}</p>
                 </div>`;
          return;
        }
      }

      // Detect bullet points
      if (trimmed.startsWith('•') || 
          trimmed.startsWith('-') || 
          trimmed.startsWith('*') || 
          trimmed.startsWith('–') ||
          trimmed.startsWith('—') ||
          /^[\d]+\./.test(trimmed)) {
        if (!inList) {
          html += '<div style="margin-top: 4px;"><ul style="margin: 0; padding-left: 18px; list-style-type: disc;">';
          inList = true;
        }
        const content = trimmed.replace(/^[•\-*–—]/, '').replace(/^\d+\./, '').trim();
        html += `<li style="font-size: 10.5pt; margin: 3px 0; padding: 0; color: #2c2c2c; line-height: 1.5;">${content}</li>`;
        return;
      }

      // Skills list (comma-separated or semi-colon separated)
      if ((trimmed.includes(',') || trimmed.includes(';')) && 
          trimmed.split(/[,;]/).length > 2 &&
          !trimmed.match(/\d{4}/) &&
          trimmed.length < 200) {
        if (inList) {
          html += '</ul></div>';
          inList = false;
        }
        html += `<div style="margin: 6px 0;">
                   <p style="font-size: 10.5pt; color: #2c2c2c; margin: 0; padding: 0; line-height: 1.6;">${trimmed}</p>
                 </div>`;
        return;
      }

      // Regular paragraph text
      if (inList) {
        html += '</ul></div>';
        inList = false;
      }
      html += `<div style="margin: 4px 0;">
                 <p style="font-size: 10.5pt; color: #2c2c2c; margin: 0; padding: 0; line-height: 1.5;">${trimmed}</p>
               </div>`;
    });

    if (inList) {
      html += '</ul></div>';
    }

    html += '</div>';
    return html;
  };

  return (
    <div className="resume-builder-page">
      <div className="resume-builder-container">
        {/* Hero Section */}
        <div className="builder-hero">
          <div className="hero-icon">
            <FileText className="icon" />
          </div>
          <h1>AI-Powered Resume Builder</h1>
          <p className="subtitle">Create ATS-optimized resumes tailored to job descriptions using Gemini AI</p>
        </div>

        {/* Main Content */}
        <div className="builder-content">
          {/* Input Section */}
          <div className="builder-section">
            <div className="section-card">
              <h2 className="section-title">
                <span className="step-number">1</span>
                Select Resume Template
              </h2>
              <div className="template-selector">
                <label className={`template-option ${template === 'modern' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="template"
                    value="modern"
                    checked={template === 'modern'}
                    onChange={(e) => setTemplate(e.target.value)}
                  />
                  <div className="template-card">
                    <div className="template-icon">📄</div>
                    <div className="template-info">
                      <h3>Modern Professional</h3>
                      <p>Clean, contemporary design for tech and business roles</p>
                    </div>
                  </div>
                </label>

                <label className={`template-option ${template === 'traditional' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="template"
                    value="traditional"
                    checked={template === 'traditional'}
                    onChange={(e) => setTemplate(e.target.value)}
                  />
                  <div className="template-card">
                    <div className="template-icon">📋</div>
                    <div className="template-info">
                      <h3>Traditional</h3>
                      <p>Classic format for corporate and formal positions</p>
                    </div>
                  </div>
                </label>

                <label className={`template-option ${template === 'technical' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="template"
                    value="technical"
                    checked={template === 'technical'}
                    onChange={(e) => setTemplate(e.target.value)}
                  />
                  <div className="template-card">
                    <div className="template-icon">💻</div>
                    <div className="template-info">
                      <h3>Technical/Developer</h3>
                      <p>Optimized for software engineering and IT roles</p>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div className="section-card">
              <h2 className="section-title">
                <span className="step-number">2</span>
                Enter Job Description
              </h2>
              <div className="jd-input">
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the job description here...

Example:
We are seeking a Senior Full Stack Developer to join our team.

Requirements:
- 5+ years of experience in software development
- Strong proficiency in JavaScript, React, and Node.js
- Experience with cloud platforms (AWS, Azure, or GCP)
- Knowledge of microservices architecture"
                  rows={12}
                />
              </div>
            </div>

            <button
              onClick={generateResume}
              disabled={loading || !jobDescription.trim()}
              className="generate-btn"
            >
              {loading ? (
                <>
                  <div className="spinner"></div>
                  Generating Resume...
                </>
              ) : (
                <>
                  <Sparkles className="btn-icon" />
                  Generate ATS Resume
                </>
              )}
            </button>

            {error && (
              <div className="error-message">
                <span className="error-icon">⚠️</span>
                {error}
              </div>
            )}
          </div>

          {/* Output Section */}
          <div className="builder-section">
            <div className="section-card">
              <div className="result-header">
                <h2 className="section-title">
                  <span className="step-number">3</span>
                  Your ATS-Optimized Resume
                </h2>
                {generatedResume && (
                  <div className="download-buttons">
                    <button 
                      onClick={downloadAsPDF} 
                      className="download-btn pdf"
                      disabled={pdfLoading}
                    >
                      {pdfLoading ? (
                        <>
                          <div className="spinner"></div>
                          Generating...
                        </>
                      ) : (
                        <>
                          <Download className="btn-icon" />
                          Download PDF
                        </>
                      )}
                    </button>
                    <button onClick={downloadAsText} className="download-btn txt">
                      <Download className="btn-icon" />
                      Download TXT
                    </button>
                  </div>
                )}
              </div>

              <div className="resume-preview">
                {generatedResume ? (
                  <pre className="resume-text">{generatedResume}</pre>
                ) : (
                  <div className="empty-state">
                    <FileText className="empty-icon" />
                    <p>Your generated resume will appear here</p>
                    <p className="empty-hint">Select a template and enter a job description to get started</p>
                  </div>
                )}
              </div>
            </div>

            {/* Template Preview */}
            <div className="section-card template-preview-card">
              <h3 className="preview-title">Template Preview</h3>
              <pre className="template-preview-text">{TEMPLATES[template]}</pre>
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div className="info-section">
          <div className="info-card">
            <h3>💡 How It Works</h3>
            <ol>
              <li>Choose a resume template that matches your industry</li>
              <li>Paste the job description you're targeting</li>
              <li>Our AI analyzes the requirements and optimizes your resume</li>
              <li>Download your ATS-friendly resume as PDF or TXT</li>
            </ol>
          </div>

          <div className="info-card">
            <h3>✨ Key Features</h3>
            <ul>
              <li><strong>ATS-Optimized:</strong> Formatted to pass applicant tracking systems</li>
              <li><strong>Keyword Matching:</strong> Incorporates relevant keywords from job descriptions</li>
              <li><strong>Professional Templates:</strong> Industry-standard layouts</li>
              <li><strong>AI-Powered:</strong> Intelligent content optimization using Gemini LLM</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResumeBuilder;
