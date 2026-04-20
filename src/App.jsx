import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import axios from 'axios';
import Header from './components/Header';
import Footer from './components/Footer';
import Home          from './pages/Home';
import Login         from './pages/Login';
import Signup        from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard     from './pages/Dashboard';
import Chat          from './pages/Chat';
import ResumeEvaluator from './pages/ResumeEvaluator';
import ResumeBuilder from './pages/ResumeBuilder';
import JobFinder     from './pages/JobFinder';
import MockInterview from './pages/MockInterview';
import Pricing       from './pages/Pricing';
import QuestionBank  from './pages/QuestionBank';
import Profile       from './pages/Profile';
import './styles/App.css';

// ── Axios global defaults ────────────────────────────────────────────────────
// Every axios call inherits the backend base URL automatically.
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
axios.defaults.baseURL = API_BASE_URL;

// ── Global request interceptor ───────────────────────────────────────────────
// Attaches the auth_token to every outgoing axios request automatically.
// This means every component (Chat, JobFinder, MockInterview, etc.) gets
// authenticated without needing to manually add the header each time.
axios.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('auth_token');
        if (token && !config.headers['Authorization']) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// ── Global response interceptor ──────────────────────────────────────────────
// If the server returns 401 (token expired / invalid), clear auth and
// redirect to login. This catches ALL pages uniformly.
axios.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            const isAuthRoute = error.config?.url?.includes('/auth/');
            if (!isAuthRoute) {
                // Token is invalid — force re-login
                localStorage.removeItem('auth_token');
                localStorage.removeItem('auth_user');
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

// ── Pages that should not show the Footer ────────────────────────────────────
const NO_FOOTER_PATHS = new Set([
    '/chat', '/job-finder', '/resume-evaluator',
    '/mock-interview', '/question-bank', '/resume-builder',
]);

function AppContent() {
    const location = useLocation();
    const showFooter = !NO_FOOTER_PATHS.has(location.pathname);

    return (
        <div className="App">
            <Header />
            <main className="main-content">
                <Routes>
                    <Route path="/"                element={<Home />} />
                    <Route path="/login"            element={<Login />} />
                    <Route path="/signup"           element={<Signup />} />
                    <Route path="/forgot-password"  element={<ForgotPassword />} />
                    <Route path="/dashboard"        element={<Dashboard />} />
                    <Route path="/chat"             element={<Chat />} />
                    <Route path="/resume-evaluator" element={<ResumeEvaluator />} />
                    <Route path="/resume-builder"   element={<ResumeBuilder />} />
                    <Route path="/job-finder"       element={<JobFinder />} />
                    <Route path="/mock-interview"   element={<MockInterview />} />
                    <Route path="/pricing"          element={<Pricing />} />
                    <Route path="/question-bank"    element={<QuestionBank />} />
                    <Route path="/profile"          element={<Profile />} />
                </Routes>
            </main>
            {showFooter && <Footer />}
        </div>
    );
}

export default function App() {
    return (
        <Router>
            <AppContent />
        </Router>
    );
}