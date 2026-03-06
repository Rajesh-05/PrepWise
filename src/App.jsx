import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Chat from './pages/Chat';
import ResumeEvaluator from './pages/ResumeEvaluator';
import ResumeBuilder from './pages/ResumeBuilder';
import JobFinder from './pages/JobFinder';
import MockInterview from './pages/MockInterview';
import Pricing from './pages/Pricing';
import QuestionBank from './pages/QuestionBank';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';

import './styles/App.css';

function AppContent() {
    const location = useLocation();

    // Global Google OAuth token extraction
    useEffect(() => {
        if (window.location.hash.includes('session_token')) {
            const params = new URLSearchParams(window.location.hash.substring(1));
            const sessionToken = params.get('session_token');
            if (sessionToken) {
                localStorage.setItem('session_token', sessionToken);
                localStorage.setItem('auth_token', sessionToken); // For Header compatibility
                console.log('App.jsx: session_token set globally:', sessionToken);
                // Remove token from URL hash for cleanliness
                window.location.hash = '';
            }
        }
    }, []);

    return (
        <div className="App">
            <Header />
            <main className="main-content">
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/chat" element={<Chat />} />
                    <Route path="/resume-evaluator" element={<ResumeEvaluator />} />
                    <Route path="/resume-builder" element={<ResumeBuilder />} />
                    <Route path="/job-finder" element={<JobFinder />} />
                    <Route path="/mock-interview" element={<MockInterview />} />
                    <Route path="/pricing" element={<Pricing />} />
                    <Route path="/question-bank" element={<QuestionBank />} />
                    <Route path="/profile" element={<Profile />} />
                </Routes>
            </main>
            {location.pathname !== '/chat' && location.pathname !== '/job-finder' && location.pathname !== '/resume-evaluator' && location.pathname !== '/mock-interview' && location.pathname !== '/question-bank' && location.pathname !== '/resume-builder' && <Footer />}
        </div>
    );
}

function App() {
    return (
        <Router>
            <AppContent />
        </Router>
    );
}

export default App;
