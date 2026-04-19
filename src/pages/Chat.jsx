import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_ENDPOINTS } from '../config/api';
import '../styles/Chat.css';

const Chat = () => {
    const [conversations, setConversations] = useState([
        {
            id: 1,
            title: 'New Conversation',
            messages: [],
            current_agent: null,
            createdAt: new Date(),
            updatedAt: new Date()
        }
    ]);
    const [activeConversationId, setActiveConversationId] = useState(1);
    const [value, setValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const listRef = useRef(null);
    const inputRef = useRef(null);
    const liveRef = useRef(null);

    // ── Fetch chat sessions from backend on mount ───────────────────────────
    useEffect(() => {
        const fetchChats = async () => {
            const token = localStorage.getItem('auth_token');
            if (!token) return;
            try {
                const response = await fetch(API_ENDPOINTS.CHAT_SESSIONS, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await response.json();
                if (response.ok && data.sessions && data.sessions.length > 0) {
                    const convs = data.sessions.map((s, idx) => ({
                        id:         s._id || s.session_id || idx,
                        session_id: s._id || s.session_id || idx,
                        title:      s.topic || 'Chat Session',
                        messages:   (s.messages || []).map(m => ({ role: m.role, content: m.content })),
                        createdAt:  s.started_at      ? new Date(s.started_at)      : new Date(),
                        updatedAt:  s.last_message_at ? new Date(s.last_message_at) : new Date()
                    }));
                    setConversations(convs);
                    localStorage.setItem('chat_conversations', JSON.stringify(convs));
                    setActiveConversationId(prev => prev || (convs.length > 0 ? convs[0].id : null));
                }
            } catch (err) {
                console.error('Failed to fetch chats:', err);
            }
        };
        fetchChats();
    }, []);

    const activeConversation = conversations.find(c => c.id === activeConversationId);
    const messages = React.useMemo(() => activeConversation?.messages || [], [activeConversation]);

    // Auto-scroll
    useEffect(() => {
        if (listRef.current) {
            listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
        }
        const last = messages[messages.length - 1];
        if (last && liveRef.current && last.role === 'assistant') {
            liveRef.current.textContent = `Assistant: ${last.content}`;
        }
    }, [messages]);

    // Load conversations from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('chat_conversations');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.length > 0) {
                    setConversations(parsed);
                    setActiveConversationId(parsed[0].id);
                }
            } catch (err) {
                console.error('Failed to load conversations:', err);
            }
        }
    }, []);

    // Persist conversations
    useEffect(() => {
        if (conversations.length > 0) {
            localStorage.setItem('chat_conversations', JSON.stringify(conversations));
        }
    }, [conversations]);

    // Auto-close sidebar on mobile
    useEffect(() => {
        const handleResize = () => { if (window.innerWidth <= 768) setIsSidebarOpen(false); };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const createNewConversation = () => {
        const newConv = {
            id: Date.now(), title: 'New Conversation',
            messages: [], current_agent: null,
            createdAt: new Date(), updatedAt: new Date()
        };
        setConversations(prev => [newConv, ...prev]);
        setActiveConversationId(newConv.id);
        if (window.innerWidth <= 768) setIsSidebarOpen(false);
    };

    const updateConversationTitle = (convId, firstMessage) => {
        const title = firstMessage.length > 35
            ? firstMessage.substring(0, 35) + '...'
            : firstMessage;
        setConversations(prev => prev.map(c => c.id === convId ? { ...c, title } : c));
    };

    // ── Send message ────────────────────────────────────────────────────────
    const handleSend = async (e) => {
        e && e.preventDefault();
        if (!value.trim() || isLoading) return;

        const userMessage = value.trim();
        setValue('');
        setError('');
        if (inputRef.current) inputRef.current.style.height = 'auto';

        const newUserMsg = { role: 'user', content: userMessage, timestamp: new Date().toISOString() };
        setConversations(prev => prev.map(c =>
            c.id === activeConversationId
                ? { ...c, messages: [...c.messages, newUserMsg], updatedAt: new Date() }
                : c
        ));

        if (messages.length === 0) updateConversationTitle(activeConversationId, userMessage);
        setIsLoading(true);

        try {
            const currentConv = conversations.find(c => c.id === activeConversationId);
            const token = localStorage.getItem('auth_token');

            // FIX: use API_ENDPOINTS.MULTI_AGENT_CHAT instead of hardcoded URL
            const response = await fetch(API_ENDPOINTS.MULTI_AGENT_CHAT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    query:         userMessage,
                    messages:      currentConv?.messages || [],
                    current_agent: currentConv?.current_agent || null
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to get response');
            }

            const data = await response.json();
            const newAiMsg = {
                role:      'assistant',
                content:   data.response,
                category:  data.category,
                timestamp: new Date().toISOString()
            };

            setConversations(prev => prev.map(c =>
                c.id === activeConversationId
                    ? { ...c, messages: [...c.messages, newAiMsg],
                        current_agent: data.current_agent || c.current_agent,
                        updatedAt: new Date() }
                    : c
            ));

        } catch (err) {
            console.error('Chat error:', err);
            setError(err.message || 'Failed to send message. Please try again.');
            // Roll back the user message on error
            setConversations(prev => prev.map(c =>
                c.id === activeConversationId
                    ? { ...c, messages: c.messages.slice(0, -1) }
                    : c
            ));
        } finally {
            setIsLoading(false);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    };

    // ── Delete conversation ─────────────────────────────────────────────────
    const deleteConversation = async (convId) => {
        const conv = conversations.find(c => c.id === convId);

        // If this conversation exists in the backend, delete it there first
        if (conv && conv.session_id) {
            // FIX: use API_ENDPOINTS.CHAT_SESSION_DELETE() instead of hardcoded '/api/chat-sessions/...'
            const token = localStorage.getItem('auth_token');
            try {
                const response = await fetch(API_ENDPOINTS.CHAT_SESSION_DELETE(conv.session_id), {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) {
                    console.error('Failed to delete session from backend');
                    return;
                }
            } catch (err) {
                console.error('Error deleting session:', err);
                return;
            }
        }

        if (conversations.length === 1) {
            const newId = Date.now();
            setConversations([{ id: newId, title: 'New Conversation', messages: [],
                                current_agent: null, createdAt: new Date(), updatedAt: new Date() }]);
            setActiveConversationId(newId);
        } else {
            const filtered = conversations.filter(c => c.id !== convId);
            setConversations(filtered);
            localStorage.setItem('chat_conversations', JSON.stringify(filtered));
            if (activeConversationId === convId && filtered.length > 0) {
                setActiveConversationId(filtered[0].id);
            }
        }
    };

    const clearAllConversations = () => {
        if (!window.confirm('Clear all conversations? This cannot be undone.')) return;
        const newId = Date.now();
        setConversations([{ id: newId, title: 'New Conversation', messages: [],
                            current_agent: null, createdAt: new Date(), updatedAt: new Date() }]);
        setActiveConversationId(newId);
        localStorage.removeItem('chat_conversations');
    };

    const exportConversation = (convId) => {
        const conv = conversations.find(c => c.id === convId);
        if (!conv) return;
        let md = `# ${conv.title}\n\n`;
        md += `**Created:** ${new Date(conv.createdAt).toLocaleString()}\n`;
        md += `**Last Updated:** ${new Date(conv.updatedAt).toLocaleString()}\n`;
        md += `**Messages:** ${conv.messages.length}\n\n---\n\n`;
        conv.messages.forEach(msg => {
            const role = msg.role === 'user' ? '👤 You' : '🤖 AI Assistant';
            md += `### ${role}\n${msg.content}\n\n`;
        });
        const blob = new Blob([md], { type: 'text/markdown' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `${conv.title.replace(/[^a-z0-9]/gi, '_')}.md`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const resizeInput = useCallback(() => {
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
            inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`;
        }
    }, []);

    // ── Category badge helper ───────────────────────────────────────────────
    const getCategoryBadge = (category) => {
        const map = {
            '0': { label: '💬 General',         color: '#6b7280' },
            '1': { label: '📚 Learning',         color: '#3b82f6' },
            '2': { label: '📝 Resume',           color: '#10b981' },
            '3': { label: '🎤 Interview Prep',   color: '#8b5cf6' },
            '4': { label: '💼 Job Search',       color: '#f59e0b' },
        };
        const badge = map[category?.trim()] || { label: `🤖 ${category || 'AI'}`, color: '#6b7280' };
        return (
            <span style={{
                background: badge.color, color: '#fff',
                borderRadius: '999px', padding: '2px 10px',
                fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.02em'
            }}>
                {badge.label}
            </span>
        );
    };

    // ── Message content formatter ───────────────────────────────────────────
    const formatMessageContent = (content) => {
        if (!content) return '';
        return content
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g,     '<em>$1</em>')
            .replace(/`([^`]+)`/g,     '<code>$1</code>')
            .replace(/```[\s\S]*?```/g, m =>
                `<pre><code>${m.replace(/```[a-z]*/g,'').replace(/```/g,'').trim()}</code></pre>`)
            .replace(/^#{1,3}\s(.+)$/gm, '<strong>$1</strong>')
            .replace(/^[-*]\s(.+)$/gm,   '<li>$1</li>')
            .replace(/(<li>.*<\/li>)/s,  '<ul>$1</ul>')
            .replace(/\n/g, '<br>');
    };

    const formatTime = (ts) => {
        if (!ts) return '';
        try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
        catch { return ''; }
    };

    // ── Render ──────────────────────────────────────────────────────────────
    return (
        <div className="chat-page">
            {/* Sidebar */}
            <aside className={`chat-sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
                <div className="sidebar-header">
                    <button className="toggle-sidebar" onClick={() => setIsSidebarOpen(p => !p)}
                            aria-label="Toggle sidebar">
                        {isSidebarOpen ? '◀' : '▶'}
                    </button>
                    {isSidebarOpen && (
                        <>
                            <span className="sidebar-title">Conversations</span>
                            <button className="new-conv-btn" onClick={createNewConversation}
                                    title="New conversation">＋ New</button>
                        </>
                    )}
                </div>

                {isSidebarOpen && (
                    <div className="conversations-list">
                        {conversations.map(conv => (
                            <div key={conv.id}
                                 className={`conversation-item ${conv.id === activeConversationId ? 'active' : ''}`}
                                 onClick={() => setActiveConversationId(conv.id)}>
                                <div className="conv-info">
                                    <span className="conv-title">{conv.title}</span>
                                    <span className="conv-meta">
                                        {conv.messages.length} msg
                                        {conv.current_agent && ` · ${conv.current_agent}`}
                                    </span>
                                </div>
                                <div className="conv-actions">
                                    <button className="conv-action-btn"
                                            onClick={e => { e.stopPropagation(); exportConversation(conv.id); }}
                                            title="Export" aria-label="Export conversation">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                                             stroke="currentColor" strokeWidth="2">
                                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                                        </svg>
                                    </button>
                                    <button className="conv-action-btn delete"
                                            onClick={e => { e.stopPropagation(); deleteConversation(conv.id); }}
                                            title="Delete" aria-label="Delete conversation">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                                             stroke="currentColor" strokeWidth="2">
                                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                                            <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                        {conversations.length > 1 && (
                            <button className="clear-all-btn" onClick={clearAllConversations}>
                                🗑 Clear All
                            </button>
                        )}
                    </div>
                )}
            </aside>

            {/* Main chat area */}
            <section className="chat-main">
                <div className="chat-header">
                    <div className="chat-header-left">
                        {!isSidebarOpen && (
                            <button className="toggle-sidebar" onClick={() => setIsSidebarOpen(true)}
                                    aria-label="Open sidebar">▶</button>
                        )}
                        <h2 className="chat-title">
                            {activeConversation?.title || 'Chat'}
                            {activeConversation?.current_agent && (
                                <span className="agent-badge">
                                    {activeConversation.current_agent.replace('_', ' ')}
                                </span>
                            )}
                        </h2>
                    </div>
                    <div className="chat-header-actions">
                        <button className="header-btn" onClick={createNewConversation} title="New conversation">
                            ＋ New
                        </button>
                        {activeConversation && activeConversation.messages.length > 0 && (
                            <button className="header-btn"
                                    onClick={() => exportConversation(activeConversationId)}
                                    title="Export conversation">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                                     stroke="currentColor" strokeWidth="2">
                                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                                </svg>
                            </button>
                        )}
                    </div>
                </div>

                {/* Messages */}
                <div className="message-list" ref={listRef}>
                    {messages.length === 0 ? (
                        <div className="chat-welcome">
                            <div className="welcome-icon">🎓</div>
                            <h3>PrepWise AI Career Assistant</h3>
                            <p>Your intelligent multi-agent assistant. Ask about learning, resumes, interviews, or job searching.</p>
                            <div className="feature-grid">
                                {[
                                    { prompt: 'Create a tutorial on machine learning basics', icon: '📚', title: 'Learning & Tutorials', desc: 'Master topics with tutorials and examples' },
                                    { prompt: 'Help me build a resume for a software engineering role', icon: '📝', title: 'Resume Building', desc: 'Create ATS-optimized resumes' },
                                    { prompt: 'Give me interview questions for a data scientist position', icon: '🎤', title: 'Interview Prep', desc: 'Practice with curated questions' },
                                    { prompt: 'Search for remote React developer jobs', icon: '💼', title: 'Job Search', desc: 'Discover tailored opportunities' },
                                ].map(({ prompt, icon, title, desc }) => (
                                    <button key={title} className="feature-card"
                                            onClick={() => { setValue(prompt); inputRef.current?.focus(); }}>
                                        <span className="feature-icon">{icon}</span>
                                        <h4>{title}</h4>
                                        <p>{desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="messages-container">
                            <AnimatePresence>
                                {messages.map((msg, idx) => (
                                    <motion.div key={idx}
                                        initial={{ opacity: 0, y: 12 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.25, ease: 'easeOut' }}
                                        className={`message ${msg.role === 'user' ? 'user' : 'assistant'}`}>
                                        <div className="message-avatar">{msg.role === 'user' ? '👤' : '🤖'}</div>
                                        <div className="message-content">
                                            {msg.category && (
                                                <div className="message-category">{getCategoryBadge(msg.category)}</div>
                                            )}
                                            <div className="message-text"
                                                 dangerouslySetInnerHTML={{ __html: formatMessageContent(msg.content) }} />
                                            <div className="message-time">{formatTime(msg.timestamp)}</div>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>

                            {isLoading && (
                                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                            className="message assistant">
                                    <div className="message-avatar">🤖</div>
                                    <div className="message-content">
                                        <div className="typing-indicator">
                                            <span/><span/><span/>
                                            <span className="typing-label">Thinking...</span>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    )}
                </div>

                {/* ARIA live region */}
                <div ref={liveRef} className="sr-only" aria-live="polite" aria-atomic="true" />

                {/* Error */}
                <AnimatePresence>
                    {error && (
                        <motion.div className="chat-error"
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
                            <span className="error-icon">⚠️</span>
                            <span className="error-text">{error}</span>
                            <button className="error-dismiss" onClick={() => setError('')} aria-label="Dismiss">×</button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Input */}
                <form className="chat-input" onSubmit={handleSend}>
                    <div className="input-wrapper">
                        <textarea
                            ref={inputRef}
                            placeholder="Ask about tutorials, resume building, interview prep, job search..."
                            value={value}
                            onChange={e => { setValue(e.target.value); resizeInput(); }}
                            rows={1}
                            aria-label="Type your message"
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                            onInput={resizeInput}
                            disabled={isLoading}
                        />
                        <button type="submit"
                                className={`send-btn ${isLoading ? 'loading' : ''} ${value.trim() ? 'active' : ''}`}
                                disabled={isLoading || !value.trim()}
                                title="Send (Enter)" aria-label="Send message">
                            {isLoading ? <div className="send-spinner" /> : (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                                     stroke="currentColor" strokeWidth="2">
                                    <line x1="22" y1="2" x2="11" y2="13"/>
                                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                                </svg>
                            )}
                        </button>
                    </div>
                    <div className="input-hint"><kbd>Enter</kbd> to send · <kbd>Shift+Enter</kbd> for new line</div>
                </form>
            </section>
        </div>
    );
};

export default Chat;