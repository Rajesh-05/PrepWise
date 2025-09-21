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
                    
                </Routes>
            </main>
            {location.pathname !== '/chat' && location.pathname !== '/job-finder' && location.pathname !== '/resume-evaluator' && <Footer />}
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
