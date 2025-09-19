import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import '../styles/Chat.css';

const initialMessages = [
    { id: 1, author: 'system', text: 'Welcome to CareerAI chat — how can I help you prepare today?', time: '09:00' },
    { id: 2, author: 'user', text: 'Hi — I want tips for a backend interview.', time: '09:01' },
    { id: 3, author: 'assistant', text: 'Great — tell me which topics you want to focus on: algorithms, system design, or language specifics?', time: '09:01' }
];

const Chat = () => {
    const [messages, setMessages] = useState(initialMessages);
    const [value, setValue] = useState('');
    const [isSending, setIsSending] = useState(false);
    const listRef = useRef(null);
    const inputRef = useRef(null);
    const liveRef = useRef(null);

    useEffect(() => {
        // Auto-scroll to bottom on new messages
        if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
        }
        // Announce new assistant messages to screen readers
        const last = messages[messages.length - 1];
        if (last && liveRef.current) {
            liveRef.current.textContent = `${last.author === 'assistant' ? 'Assistant: ' : ''}${last.text}`;
        }
    }, [messages]);

    const handleSend = (e) => {
        e && e.preventDefault();
        if (!value.trim()) return;
        const newMsg = {
            id: Date.now(),
            author: 'user',
            text: value.trim(),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setMessages(prev => [...prev, newMsg]);
        setValue('');
        setIsSending(true);

        // Simulate AI assistant response
        setTimeout(() => {
            setMessages(prev => [...prev, { id: Date.now() + 1, author: 'assistant', text: 'Thanks — here are a few tips: practice data structures, understand RESTful API design, and review concurrency patterns.', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
            setIsSending(false);
        }, 900);
    };

    const resizeInput = () => {
        if (!inputRef.current) return;
        const ta = inputRef.current;
        ta.style.height = 'auto';
        ta.style.height = `${Math.min(200, ta.scrollHeight)}px`;
    };
    const bubbleVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    };

    return (
        <div className="chat-page">
           
                <aside className="chat-sidebar">
                    <div className="chat-sidebar-header">
                        <h3>Conversations</h3>
                        <button className="btn btn-outline btn-small chat-new-btn">New</button>
                    </div>
                    <ul className="conversation-list">
                        <li className="conversation active">
                            <div className="conv-title">Interview Prep — Backend</div>
                            <div className="conv-sub">Last: Review system design</div>
                        </li>
                        <li className="conversation">
                            <div className="conv-title">Resume Review</div>
                            <div className="conv-sub">Last: Updated summary</div>
                        </li>
                    </ul>
                </aside>

                <section className="chat-main chat-card">
                    <header className="chat-header">
                        <div>
                            <h2>Interview Prep — Backend</h2>
                            <div className="chat-meta">AI Coach • Active</div>
                        </div>
                        <div className="chat-header-actions">
                            <button className="btn btn-outline">Export</button>
                            <button className="btn btn-primary">End Session</button>
                        </div>
                    </header>

                    <div className="message-list" ref={listRef}>
                        {messages.map(msg => (
                            <motion.div
                             key={msg.id} 
                             className={`message ${msg.author}`}>
                                <div className="message-body">
                                    <div className="message-text">{msg.text}</div>
                                    <div className="message-time">{msg.time}</div>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {/* ARIA live region for screen readers (offscreen) */}
                    <div ref={liveRef} className="sr-only" aria-live="polite" aria-atomic="true"></div>

                    <form className="chat-input" onSubmit={handleSend}>
                        <textarea
                            ref={inputRef}
                            placeholder="Type your message..."
                            value={value}
                            onChange={e => { setValue(e.target.value); resizeInput(); }}
                            rows={1}
                            aria-label="Message input"
                            onKeyDown={(e) => {
                                // Send on Enter, add newline on Shift+Enter
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                    // reset size after sending
                                    setTimeout(() => resizeInput(), 0);
                                }
                            }}
                            onInput={resizeInput}
                        />
                        <div className="chat-input-actions">
                            <button type="button" className="btn btn-outline" onClick={() => setValue('')}>Clear</button>
                            <button type="submit" className={`btn btn-primary ${isSending ? 'loading' : ''}`} disabled={isSending}>
                                {isSending ? 'Sending...' : 'Send'}
                            </button>
                        </div>
                    </form>
                </section>
        </div>
    );
};

export default Chat;
