import React, { useState } from 'react';
import { FileText, Sparkles, Download, Upload, FileDown } from 'lucide-react';

const SAMPLE_TEMPLATES = {
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

const SAMPLE_USER_DATA = {
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

const SAMPLE_JD = `We are seeking a Senior Full Stack Developer to join our team.

Requirements:
- 5+ years of experience in software development
- Strong proficiency in JavaScript, React, and Node.js
- Experience with cloud platforms (AWS, Azure, or GCP)
- Knowledge of microservices architecture
- Experience with CI/CD pipelines
- Strong problem-solving skills
- Excellent communication abilities

Responsibilities:
- Design and develop scalable web applications
- Lead technical discussions and code reviews
- Mentor junior developers
- Collaborate with product and design teams
- Optimize application performance`;

export default function ATSResumeGenerator() {
  const [userData, setUserData] = useState(JSON.stringify(SAMPLE_USER_DATA, null, 2));
  const [jobDescription, setJobDescription] = useState(SAMPLE_JD);
  const [template, setTemplate] = useState('modern');
  const [apiKey, setApiKey] = useState('');
  const [generatedResume, setGeneratedResume] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateResume = async () => {
    if (!apiKey.trim()) {
      setError('Please enter your Gemini API key');
      return;
    }

    setLoading(true);
    setError('');
    setGeneratedResume('');

    try {
      const userDataObj = JSON.parse(userData);
      const selectedTemplate = SAMPLE_TEMPLATES[template];

      const prompt = `You are an expert ATS (Applicant Tracking System) resume writer. Your task is to create a highly optimized resume that will pass ATS screening and appeal to hiring managers.

JOB DESCRIPTION:
${jobDescription}

USER DATA:
${JSON.stringify(userDataObj, null, 2)}

RESUME TEMPLATE:
${selectedTemplate}

INSTRUCTIONS:
1. Analyze the job description and identify key requirements, skills, and keywords
2. Match the user's experience and skills to the job requirements
3. Use action verbs and quantifiable achievements
4. Incorporate relevant keywords from the job description naturally
5. Format the resume to be ATS-friendly (simple formatting, no tables, standard section headers)
6. Fill in the template placeholders with optimized content:
   - [NAME], [EMAIL], [PHONE], etc. with user's contact info
   - [SUMMARY] with a compelling 2-3 sentence summary tailored to the JD
   - [SKILLS] as a comma-separated list or bullet points of relevant skills
   - [EXPERIENCE] with formatted job entries highlighting relevant achievements
   - [EDUCATION] with degree information
   - [CERTIFICATIONS] if applicable
7. Ensure all content is truthful to the user's data but optimized for impact
8. Keep the resume to 1-2 pages worth of content

Generate the complete, ATS-optimized resume. Output ONLY the resume text, no explanations or metadata.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            "x-goog-api-key": apiKey
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: prompt
              }]
            }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 2048,
            }
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to generate resume');
      }

      const data = await response.json();
      const resume = data.candidates[0].content.parts[0].text;
      setGeneratedResume(resume);
    } catch (err) {
      setError(err.message || 'An error occurred while generating the resume');
    } finally {
      setLoading(false);
    }
  };

  const downloadResume = () => {
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
    try {
      // Create HTML content for PDF
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: 'Arial', sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 8.5in;
              margin: 0 auto;
              padding: 0.5in;
              font-size: 11pt;
            }
            h1 {
              font-size: 24pt;
              margin-bottom: 5px;
              color: #2c3e50;
            }
            h2 {
              font-size: 14pt;
              margin-top: 20px;
              margin-bottom: 10px;
              color: #34495e;
              border-bottom: 2px solid #3498db;
              padding-bottom: 5px;
            }
            h3 {
              font-size: 12pt;
              margin-top: 15px;
              margin-bottom: 5px;
              color: #2c3e50;
            }
            p {
              margin: 5px 0;
            }
            .contact-info {
              font-size: 10pt;
              color: #555;
              margin-bottom: 15px;
            }
            .section {
              margin-bottom: 20px;
            }
            ul {
              margin: 5px 0;
              padding-left: 20px;
            }
            li {
              margin: 3px 0;
            }
            .company-info {
              color: #555;
              font-style: italic;
            }
            @page {
              margin: 0.5in;
            }
          </style>
        </head>
        <body>
          ${formatResumeForPDF(generatedResume)}
        </body>
        </html>
      `;

      // Create a hidden iframe
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);

      // Write content to iframe
      const iframeDoc = iframe.contentWindow.document;
      iframeDoc.open();
      iframeDoc.write(htmlContent);
      iframeDoc.close();

      // Wait for content to load
      await new Promise(resolve => setTimeout(resolve, 500));

      // Trigger print dialog
      iframe.contentWindow.focus();
      iframe.contentWindow.print();

      // Clean up after a delay
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    } catch (err) {
      setError('Failed to generate PDF. Please try downloading as text instead.');
    }
  };

  const formatResumeForPDF = (text) => {
    // Convert plain text resume to HTML with proper formatting
    const lines = text.split('\n');
    let html = '';
    let inList = false;

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      
      if (!trimmed) {
        if (inList) {
          html += '</ul>';
          inList = false;
        }
        html += '<br>';
        return;
      }

      // Detect headers (all caps or title case lines)
      if (trimmed === trimmed.toUpperCase() && trimmed.length > 3 && trimmed.length < 50) {
        if (inList) {
          html += '</ul>';
          inList = false;
        }
        if (index === 0 || (index === 1 && lines[0].trim().length < 40)) {
          html += `<h1>${trimmed}</h1>`;
        } else {
          html += `<h2>${trimmed}</h2>`;
        }
      }
      // Detect contact info (contains @ or | or phone patterns)
      else if (trimmed.includes('@') || trimmed.includes('|') || /\d{3}[-.]?\d{3}[-.]?\d{4}/.test(trimmed)) {
        html += `<p class="contact-info">${trimmed}</p>`;
      }
      // Detect bullet points or list items
      else if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*') || /^[\d]+\./.test(trimmed)) {
        if (!inList) {
          html += '<ul>';
          inList = true;
        }
        const content = trimmed.replace(/^[•\-*]/, '').replace(/^\d+\./, '').trim();
        html += `<li>${content}</li>`;
      }
      // Detect job titles or section headers (often followed by company/dates)
      else if (index < lines.length - 1 && lines[index + 1].trim().match(/\d{4}|present|current/i)) {
        if (inList) {
          html += '</ul>';
          inList = false;
        }
        html += `<h3>${trimmed}</h3>`;
      }
      // Detect company info with dates
      else if (trimmed.match(/\d{4}/) && (trimmed.includes('-') || trimmed.toLowerCase().includes('present'))) {
        html += `<p class="company-info">${trimmed}</p>`;
      }
      // Regular text
      else {
        if (inList) {
          html += '</ul>';
          inList = false;
        }
        html += `<p>${trimmed}</p>`;
      }
    });

    if (inList) {
      html += '</ul>';
    }

    return html;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <FileText className="w-10 h-10 text-indigo-600" />
            <h1 className="text-4xl font-bold text-gray-800">ATS Resume Generator</h1>
          </div>
          <p className="text-gray-600">Powered by Gemini LLM - Create ATS-optimized resumes tailored to job descriptions</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Input Section */}
          <div className="space-y-6">
            {/* API Key */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Gemini API Key *
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your Gemini API key"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-2">
                Get your free API key from{' '}
                <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                  Google AI Studio
                </a>
              </p>
            </div>

            {/* Template Selection */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Resume Template
              </label>
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="modern">Modern Professional</option>
                <option value="traditional">Traditional</option>
                <option value="technical">Technical/Developer</option>
              </select>
            </div>

            {/* User Data */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                User Data (JSON)
              </label>
              <textarea
                value={userData}
                onChange={(e) => setUserData(e.target.value)}
                className="w-full h-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-sm"
                placeholder="Paste user data in JSON format"
              />
            </div>

            {/* Job Description */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Job Description
              </label>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                className="w-full h-48 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Paste the job description here"
              />
            </div>

            {/* Generate Button */}
            <button
              onClick={generateResume}
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate ATS Resume
                </>
              )}
            </button>
          </div>

          {/* Output Section */}
          <div className="space-y-6">
            {/* Template Preview */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Template Preview</h3>
              <pre className="bg-gray-50 p-4 rounded-lg text-xs overflow-auto max-h-64 border border-gray-200">
                {SAMPLE_TEMPLATES[template]}
              </pre>
            </div>

            {/* Generated Resume */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-700">Generated Resume</h3>
                {generatedResume && (
                  <div className="flex gap-2">
                    <button
                      onClick={downloadAsPDF}
                      className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
                    >
                      <FileDown className="w-4 h-4" />
                      PDF
                    </button>
                    <button
                      onClick={downloadResume}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
                    >
                      <Download className="w-4 h-4" />
                      TXT
                    </button>
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                  {error}
                </div>
              )}

              <textarea
                value={generatedResume}
                readOnly
                className="w-full h-[600px] px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm"
                placeholder="Your ATS-optimized resume will appear here..."
              />
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">How to Use</h3>
          <ol className="list-decimal list-inside space-y-2 text-gray-600">
            <li>Get your free Gemini API key from Google AI Studio and enter it above</li>
            <li>Select a resume template that fits your industry</li>
            <li>Update the User Data JSON with your actual information (or use the sample data)</li>
            <li>Paste the job description you're applying for</li>
            <li>Click "Generate ATS Resume" to create your optimized resume</li>
            <li>Download the generated resume and customize further if needed</li>
          </ol>
          
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Pro Tip:</strong> The generator analyzes the job description to identify key skills and requirements, 
              then optimizes your resume with relevant keywords and achievements to maximize ATS compatibility.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}