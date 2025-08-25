# CareerAI - Your AI-Powered Career Companion

CareerAI is the ultimate platform designed to help you prepare, practice, and land your dream job. Our comprehensive suite of AI-powered tools covers every aspect of your career journey.

## 🚀 Key Features

- **🎯 Interactive Interview Prep Assistant**: Topic-wise concept explanations, quizzes, and real-time Q&A
- **📊 Personal Progress Tracker**: Automatically records your learning journey and visualizes strengths/weaknesses
- **📝 Smart Resume Builder**: ATS-friendly resumes with AI-suggested content and exportable templates
- **🔄 JD-Based Resume Rewriter**: Tailors your resume perfectly to each job description
- **🧪 Assessment Engine**: Dynamic quizzes and coding tests for technical and soft skills
- **🔍 AI Job Finder & Quick Apply**: Personalized job listings with one-click tailored applications
- **🎤 Voice-Based Mock Interview Agent**: AI interviewer that listens, responds, and gives instant feedback
- **🏢 Company Q&A Miner**: Curates past interview questions from top companies with AI-powered critiques

## 🛠️ Tech Stack

### Frontend
- React 19.1.1
- React Router v7.8.1 for navigation
- Modern CSS with responsive design
- Interactive animations and micro-interactions

### Backend
- Python Flask
- RESTful API endpoints
- CORS enabled for frontend integration
- Mock data for development

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- Python 3.7 or higher
- npm or yarn

### Frontend Setup
1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm start
   ```

3. Open [http://localhost:3000](http://localhost:3000) to view the app

### Backend Setup
1. Navigate to the Backend directory:
   ```bash
   cd Backend
   ```

2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Start the Flask server:
   ```bash
   python app.py
   ```

4. The API will be available at [http://localhost:5000](http://localhost:5000)

## 📁 Project Structure

```
CareerAI/
├── src/                    # Frontend source code
│   ├── components/         # Reusable UI components
│   │   ├── Header.js      # Navigation header
│   │   └── Footer.js      # Site footer
│   ├── pages/             # Page components
│   │   └── Home.js        # Landing page
│   ├── App.js             # Main application component
│   └── index.js           # Application entry point
├── Backend/               # Python backend
│   ├── app.py             # Flask application
│   └── requirements.txt   # Python dependencies
├── public/                # Static assets
└── package.json           # Frontend dependencies
```

## 🔌 API Endpoints

- `GET /api/features` - Get all platform features
- `GET /api/progress/{user_id}` - Get user progress
- `GET /api/interview-questions` - Get interview questions
- `POST /api/resume-suggestions` - Get AI resume suggestions
- `POST /api/mock-interview` - Start mock interview session
- `POST /api/job-recommendations` - Get personalized job recommendations

## 📱 Available Scripts

- `npm start` - Runs the app in development mode
- `npm run build` - Builds the app for production
- `npm test` - Launches the test runner

## 🎨 Design Features

- **Modern UI/UX**: Clean, professional design optimized for career professionals
- **Responsive Design**: Works seamlessly on all devices
- **Interactive Elements**: Engaging animations and micro-interactions
- **Accessibility**: Built with accessibility best practices
- **Performance**: Optimized for fast loading and smooth interactions

## 🚀 How It Works

1. **Sign Up & Profile**: Create your account and tell us about your career goals
2. **AI Assessment**: Our AI analyzes your skills and creates a personalized learning path
3. **Practice & Improve**: Use our tools to practice interviews, build resumes, and assess skills
4. **Land Your Dream Job**: Apply with confidence using your AI-optimized materials

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 📞 Support

For support and questions, please open an issue in the repository.

---

**Transform your career with AI-powered tools designed for success! 🚀**
