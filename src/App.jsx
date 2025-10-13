import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Chat from './pages/Chat';
import ResumeEvaluator from './pages/ResumeEvaluator';
import JobFinder from './pages/JobFinder';
import MockInterview from './pages/MockInterview';
import Pricing from './pages/Pricing';
import QuestionBank from './pages/QuestionBank';

import './styles/App.css';

function AppContent() {
    const location = useLocation();

    return (
        <div className="App">
            <Header />
            <main className="main-content">
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/chat" element={<Chat />} />
                    <Route path="/resume-evaluator" element={<ResumeEvaluator />} />
                    <Route path="/job-finder" element={<JobFinder />} />
                    <Route path="/mock-interview" element={<MockInterview />} />
                    <Route path="/pricing" element={<Pricing />} />
                    <Route path="/question-bank" element={<QuestionBank />} />
                </Routes>
            </main>
            {location.pathname !== '/chat' && location.pathname !== '/job-finder' && location.pathname !== '/resume-evaluator' && location.pathname !== '/mock-interview' && location.pathname !== '/question-bank' && <Footer />}
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
