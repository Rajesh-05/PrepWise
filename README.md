# PrepWise AI - Your AI-Powered Career Companion

**PrepWise AI** is a comprehensive platform designed to help you prepare, practice, and land your dream job. Our AI-powered suite of tools covers every aspect of your career journey with smart resume building, mock interviews, job hunting, and interview preparation.

---

## 🎥 PrepWise AI Project Demo

▶️ **Watch the PrepWise AI Project Demo:** [YouTube Demo Video](https://youtu.be/_-HgQjbb3U0)

---

## 🎯 Key Features

### 1. **📝 Smart Resume Builder & Evaluator**
- **Resume Builder**: Create ATS-friendly resumes with AI-suggested content
- **Resume Evaluator**: Get instant ATS score analysis and improvement suggestions
- **JD-Based Resume Rewriter**: Automatically tailor your resume to specific job descriptions
- **PDF Export**: Generate professional resume PDFs with templates

### 2. **🎤 AI-Powered Mock Interview Agent**
- **Voice-Based Interviews**: Real-time voice conversation with AI interviewer
- **Interview Types**: Behavioral, technical, and mixed interview simulations
- **Instant Feedback**: Get scores for communication, technical skills, and confidence
- **Transcript & Analysis**: Complete interview transcripts with AI-powered critiques

### 3. **🧠 Question Bank & Quiz Engine**
- **Company-Specific Questions**: Curated questions from top companies
- **Role & Skill-Based**: Filter by role, domain, and experience level
- **Dynamic Quizzes**: Real-time quiz generation with scoring and analysis
- **Difficulty Levels**: From beginner to advanced technical questions

### 4. **🔍 AI Job Finder with Quick Apply**
- **Personalized Job Listings**: Intelligent job recommendations
- **Advanced Filtering**: Filter by location, role, company, and salary
- **One-Click Apply**: Quickly apply with tailored resumes
- **Job Details**: Comprehensive job descriptions and company insights

### 5. **💬 Interactive Interview Prep Assistant**
- **Topic-Wise Explanations**: Deep dive into concepts with AI guidance
- **Real-Time Q&A**: Ask questions and get instant expert answers
- **Progress Tracking**: Monitor your learning journey
- **Resource Library**: Comprehensive materials for different topics

### 6. **📊 Personal Progress Dashboard**
- **Activity Tracker**: Automatic recording of your learning journey
- **Statistics Dashboard**: Visual insights into your strengths and weaknesses
- **Performance Metrics**: Track quiz scores, interview ratings, and more
- **Learning Timeline**: See your progress over time

### 7. **👤 User Profile & Authentication**
- **Google OAuth Integration**: Quick sign-in with Google account
- **Email/Password Authentication**: Traditional secure login
- **Profile Management**: Manage your profile information and preferences
- **Session Tracking**: Automatic activity logging and analytics

---

## 🛠️ Tech Stack

### **Frontend**
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.3.1 | UI Framework |
| React Router | 7.8.1 | Client-side routing |
| Axios | 1.6.0 | HTTP client |
| Framer Motion | 10.16.4 | Animations & micro-interactions |
| Lucide React | 0.553.0 | Icon library |
| React Icons | 5.5.0 | Additional icons |
| React Markdown | 10.1.0 | Markdown rendering |
| Vapi AI | 2.5.2 | Voice-based mock interviews |
| HTML2Canvas | 1.4.1 | Screenshot utility |
| jsPDF | 3.0.4 | PDF generation |

### **Backend**
| Technology | Version | Purpose |
|------------|---------|---------|
| Python | 3.7+ | Backend language |
| Flask | Latest | Web framework |
| Flask-CORS | Latest | Cross-origin support |
| MongoDB | Latest | NoSQL database |
| PyJWT | Latest | JWT token management |
| Google Genai | Latest | AI-powered features (Gemini API) |
| PDFPlumber | Latest | PDF text extraction |
| Python-JobsPy | Latest | Job scraping & search |
| Requests | Latest | HTTP requests |
| Werkzeug | Latest | Secure password hashing |

---

## 📁 Project Structure

```
PrepWise/
├── Backend/
│   ├── app.py                    # Main Flask application & API endpoints
│   ├── models.py                 # MongoDB schema definitions
│   ├── auth_utils.py             # Authentication & activity tracking utilities
│   ├── import_check.py           # Dependency checker
│   ├── requirements.txt          # Python dependencies
│   ├── __pycache__/              # Python cache
│   └── static/uploads/           # User file uploads (resumes, etc.)
│
├── src/
│   ├── App.jsx                   # Main React component
│   ├── index.js                  # React entry point
│   ├── setupTests.js             # Test configuration
│   ├── reportWebVitals.js        # Performance metrics
│   │
│   ├── components/               # Reusable components
│   │   ├── Header.jsx            # Navigation header
│   │   ├── Footer.jsx            # Footer
│   │   ├── JobCard.jsx           # Job listing card
│   │   ├── JobDetails.jsx        # Detailed job view
│   │   ├── JobFilters.jsx        # Job filtering controls
│   │   └── Toast.jsx             # Notification component
│   │
│   ├── pages/                    # Page components
│   │   ├── Home.jsx              # Landing page
│   │   ├── Login.jsx             # Login page
│   │   ├── Signup.jsx            # Registration page
│   │   ├── Dashboard.jsx         # User dashboard with analytics
│   │   ├── Profile.jsx           # User profile management
│   │   ├── Chat.jsx              # AI chat interface
│   │   ├── QuestionBank.jsx      # Question bank interface
│   │   ├── ResumeBuilder.jsx     # Resume creation tool
│   │   ├── ResumeEvaluator.jsx   # Resume analysis tool
│   │   ├── JobFinder.jsx         # Job search interface
│   │   ├── MockInterview.jsx     # Mock interview interface
│   │   ├── Pricing.jsx           # Pricing page
│   │   ├── ForgotPassword.jsx    # Password recovery
│   │   └── test.jsx              # Testing page
│   │
│   └── styles/                   # CSS stylesheets
│       ├── App.css
│       ├── index.css
│       ├── Header.css
│       ├── Footer.css
│       ├── Home.css
│       ├── Login.css
│       ├── Signup.css
│       ├── Dashboard.css
│       ├── Profile.css
│       ├── Chat.css
│       ├── QuestionBank.css
│       ├── ResumeBuilder.css
│       ├── ResumeEvaluator.css
│       ├── JobFinder.css
│       ├── MockInterview.css
│       ├── Pricing.css
│       ├── ForgotPassword.css
│       └── Toast.css
│
├── public/
│   ├── index.html                # HTML template
│   ├── manifest.json             # PWA manifest
│   ├── robots.txt                # SEO robots file
│   └── Images/                   # Static images
│
├── package.json                  # Frontend dependencies & scripts
├── README.md                      # Original README
├── USER_TRACKING_SYSTEM.md       # Activity tracking documentation
└── .env.example                  # Environment variables template
```

---

## 🚀 Getting Started

### **Prerequisites**
- **Node.js** v16 or higher
- **Python** 3.7 or higher
- **npm** or **yarn** package manager
- **MongoDB** (local or Atlas cloud)
- **Google OAuth** credentials (for Google login)
- **Gemini API** key (for AI features)
- **Vapi.AI** account (for voice mock interviews)

### **Installation & Setup**

#### **1. Clone the Repository**
```bash
git clone https://github.com/Rajesh-05/PrepWise.git
cd PrepWise
```

#### **2. Frontend Setup**
```bash
# Install frontend dependencies
npm install

# Create .env file in root directory
# Required variables:
# REACT_APP_VAPI_PUBLIC_KEY=your_vapi_public_key
# VAPI_API_KEY=your_vapi_api_key
```

#### **3. Backend Setup**
```bash
# Navigate to backend directory
cd Backend

# Create Python virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Create .env file in Backend directory
# Required variables:
# GEMINI_API_KEY=your_gemini_api_key
# MONGODB_URI=mongodb://localhost:27017
# MONGODB_DBNAME=prepwise
# JWT_SECRET=your_jwt_secret
# JWT_EXPIRES_MIN=120
# VAPI_API_KEY=your_vapi_api_key
# REACT_APP_VAPI_PUBLIC_KEY=your_vapi_public_key
# GOOGLE_OAUTH_CLIENT_ID=your_google_oauth_client_id
# GOOGLE_OAUTH_CLIENT_SECRET=your_google_oauth_client_secret
```

#### **4. Database Setup**
```bash
# MongoDB Atlas or Local MongoDB must be running
# Update MONGODB_URI in Backend/.env with your connection string
```

#### **5. Run the Application**

**Option A: Development Mode**
```bash
# From root directory, run both frontend and backend concurrently
npm run dev
```

**Option B: Run Separately**
```bash
# Terminal 1 - Frontend (from root)
npm start

# Terminal 2 - Backend (from Backend directory)
python app.py
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000

---

## 📚 API Endpoints

### **Authentication Endpoints**
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|-----------------|
| POST | `/auth/signup` | Register new user | ❌ |
| POST | `/auth/login` | Email/password login | ❌ |
| POST | `/auth/logout` | Logout user | ✅ |
| GET | `/auth/me` | Get current user info | ✅ |
| GET | `/auth/google/login` | Google OAuth login | ❌ |
| GET | `/auth/google/callback` | Google OAuth callback | ❌ |
| POST | `/auth/forgot-password` | Request password reset | ❌ |
| POST | `/auth/reset-password` | Reset password | ❌ |

### **User Dashboard & Analytics**
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|-----------------|
| GET | `/api/user/dashboard` | Get user dashboard stats | ✅ |
| GET | `/api/user/activity-log` | Get activity history | ✅ |

### **Resume Features**
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|-----------------|
| POST | `/evaluate-resume` | Evaluate resume & get ATS score | ✅ |
| POST | `/improve-resume` | Get resume improvement suggestions | ✅ |
| POST | `/generate-resume` | Generate resume from user data | ✅ |

### **Question Bank**
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|-----------------|
| POST | `/generate-questions` | Generate interview questions | ✅ |

### **Mock Interviews**
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|-----------------|
| POST | `/api/vapi/assistant` | Create mock interview session | ✅ |
| POST | `/api/user/mock-interview-score` | Save interview scores | ✅ |

### **Job Search**
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|-----------------|
| GET | `/api/jobs` | Search job listings | ✅ |

### **Chat**
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|-----------------|
| POST | `/api/user/chat-message` | Save chat session messages | ✅ |

---

## 🗄️ Database Schema

### **Collections**

#### **1. Users Collection**
Stores user account information and authentication details.
```javascript
{
  _id: ObjectId,
  email: String (unique),
  googleId: String (optional),
  firstName: String,
  lastName: String,
  name: String,
  picture: String (profile picture URL),
  passwordHash: String,
  createdAt: DateTime,
  lastLogin: DateTime,
  subscriptionTier: String (free/pro/enterprise),
  totalLoginCount: Number
}
```

#### **2. User Activities Collection**
Tracks general user activities and page views.
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  email: String,
  activityType: String (login/logout/pageView/featureUse),
  activityName: String,
  metadata: Object,
  timestamp: DateTime
}
```

#### **3. Question Bank Activities**
Logs question generation sessions.
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  email: String,
  company: String,
  role: String,
  domain: String,
  experienceLevel: String,
  questionType: String,
  difficulty: String,
  numQuestions: Number,
  questionsGenerated: Array,
  timestamp: DateTime
}
```

#### **4. Mock Interviews Collection**
Records mock interview sessions and performance metrics.
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  email: String,
  interviewType: String (behavioral/technical/mixed),
  jobDescription: String,
  durationMinutes: Number,
  vapiAssistantId: String,
  vapiCallId: String,
  overallRating: Number (1-10),
  communicationScore: Number,
  technicalScore: Number,
  confidenceScore: Number,
  feedback: String,
  transcript: String,
  timestamp: DateTime
}
```

#### **5. Resume Activities Collection**
Logs resume evaluations, improvements, and builds.
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  email: String,
  activityType: String (evaluation/improvement/build),
  resumeFilename: String,
  atsScore: Number,
  missingKeywords: Array,
  suggestions: Array,
  jobDescription: String,
  timestamp: DateTime
}
```

#### **6. Chat Sessions Collection**
Stores conversation history and chat metadata.
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  email: String,
  sessionId: String,
  messages: Array,
  messageCount: Number,
  topics: Array,
  context: String,
  timestamp: DateTime
}
```

#### **7. Job Searches Collection**
Tracks job search activities and saved jobs.
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  email: String,
  searchQuery: String,
  location: String,
  jobsFound: Number,
  savedJobs: Array,
  appliedJobs: Array,
  timestamp: DateTime
}
```

#### **8. Quiz Attempts Collection**
Records quiz performance data.
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  email: String,
  quizType: String,
  company: String,
  role: String,
  totalQuestions: Number,
  answeredQuestions: Number,
  correctAnswers: Number,
  scorePercentage: Number,
  timeTakenSeconds: Number,
  quizData: Object,
  timestamp: DateTime
}
```

#### **9. Subscription Info Collection**
Manages subscription and pricing information.
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  email: String,
  tier: String (free/pro/enterprise),
  startDate: DateTime,
  endDate: DateTime,
  renewalDate: DateTime,
  status: String (active/cancelled/expired),
  paymentMethod: String
}
```

---

## 🔐 Authentication & Security

### **Authentication Methods**
1. **Google OAuth 2.0**: Secure authentication via Google accounts
2. **Email/Password**: Traditional login with hashed passwords
3. **JWT Tokens**: Secure token-based session management

### **Security Features**
- **Password Hashing**: Werkzeug-based secure password hashing
- **JWT Tokens**: HTTP-only token storage
- **CORS**: Cross-origin resource sharing configured
- **Token Expiration**: Automatic token expiration and refresh
- **Activity Logging**: All user activities logged for security

---

## 🎨 Frontend Features

### **Responsive Design**
- Mobile-first approach
- Fully responsive layouts
- Works on all device sizes (mobile, tablet, desktop)

### **User Experience**
- Smooth animations with Framer Motion
- Toast notifications for user feedback
- Loading states and error handling
- Intuitive navigation

### **Components**
- **Header**: Navigation, user profile, logout
- **Footer**: Links and information
- **JobCard**: Reusable job listing display
- **JobFilters**: Advanced filtering options
- **Toast**: Notification system

---

## 🔄 Workflow Examples

### **Resume Evaluation Flow**
1. User uploads resume (PDF or text)
2. Backend extracts text using PDFPlumber
3. Gemini AI analyzes resume structure and content
4. ATS score calculated based on keywords and formatting
5. Improvement suggestions generated
6. Results displayed to user
7. Activity logged in resume_activities collection

### **Mock Interview Flow**
1. User inputs job description and interview type
2. Vapi.AI creates voice-enabled interview session
3. AI conducts real-time interview conversation
4. Speech-to-text transcription recorded
5. Interview metrics calculated (communication, technical, confidence)
6. Feedback and suggestions generated
7. Complete session saved with transcript
8. Activity logged in mock_interviews collection

### **Job Search Flow**
1. User enters job search criteria (role, location, company)
2. Backend queries Python-JobsPy for available positions
3. Jobs filtered and ranked by relevance
4. Results displayed in job cards
5. User can save jobs or apply with tailored resume
6. Job search activity logged
7. Application status tracked

---

## 📊 Dashboard Analytics

The user dashboard provides comprehensive insights:

- **Total Sessions**: Sum of all question bank sessions
- **Mock Interviews**: Count with average rating score
- **Resume Evaluations**: Count with average ATS score
- **Chat Sessions**: Total sessions with message count
- **Job Searches**: Total searches performed
- **Login Insights**: Total logins and last login timestamp
- **Activity Timeline**: Chronological view of all activities

---

## 🔧 Development

### **Running Tests**
```bash
npm test
```

### **Building for Production**
```bash
npm run build
```

This creates an optimized production build in the `build/` directory.

### **Environment Variables**

Create `.env` files in both root and Backend directories:

**Root `.env` (Frontend):**
```
REACT_APP_VAPI_PUBLIC_KEY=your_vapi_public_key
VAPI_API_KEY=your_vapi_api_key
```

**Backend `.env`:**
```
# AI & API Configuration
GEMINI_API_KEY=your_gemini_api_key

# Database Configuration
MONGODB_URI=mongodb://localhost:27017
MONGODB_DBNAME=prepwise

# JWT Configuration
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_MIN=120

# Vapi AI Configuration
VAPI_API_KEY=your_vapi_api_key
REACT_APP_VAPI_PUBLIC_KEY=your_vapi_public_key

# Google OAuth Configuration
GOOGLE_OAUTH_CLIENT_ID=your_google_oauth_client_id
GOOGLE_OAUTH_CLIENT_SECRET=your_google_oauth_client_secret
```

---

## 📝 File Upload Handling

Resumes and other files are stored in:
```
Backend/static/uploads/
```

Supported formats:
- PDF files
- Text files
- Word documents (converted to PDF)

---

## 🐛 Troubleshooting

### **Frontend Issues**
| Issue | Solution |
|-------|----------|
| Port 3000 already in use | Change port: `PORT=3001 npm start` |
| Module not found | Run `npm install` to install dependencies |
| API not responding | Check if backend is running on port 5000 |
| White blank page | Check browser console for errors |

### **Backend Issues**
| Issue | Solution |
|-------|----------|
| Port 5000 already in use | Change port in app.py or kill process using port |
| MongoDB connection error | Verify MongoDB URI in .env file |
| Missing dependencies | Run `pip install -r requirements.txt` |
| API key errors | Verify API keys in .env file |

### **Common Errors**
- **CORS errors**: Ensure Flask-CORS is properly configured
- **JWT token expired**: User needs to re-login
- **File upload failed**: Check file size and format
- **Google OAuth error**: Verify client ID and redirect URI

---

## 📚 Additional Documentation

- [User Tracking System](./USER_TRACKING_SYSTEM.md) - Detailed activity tracking documentation
- [API Documentation](./Backend/API_DOCS.md) - Comprehensive API reference (if available)

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 🙋 Support

For support, email: support@prepwise.ai or open an issue on GitHub.

---

## 🗺️ Roadmap

- [ ] Mobile app (React Native)
- [ ] Video interview playback and analysis
- [ ] Collaborative study groups
- [ ] Company-specific interview guides
- [ ] Resume template marketplace
- [ ] AI-powered career coaching
- [ ] Job market analytics and insights
- [ ] Salary negotiation guide
- [ ] Interview video recording and playback

---

## 👥 Team

Built with ❤️ by the PrepWise AI team.

---

## 🎉 Acknowledgments

- Google Generative AI (Gemini) for AI features
- Vapi.AI for voice interview capabilities
- MongoDB for database solutions
- React community for amazing tools and libraries

---

**Last Updated:** January 2026
**Version:** 1.0.0
