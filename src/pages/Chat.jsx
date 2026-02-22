import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/Chat.css';

// Multi-Agent endpoint configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

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

    const activeConversation = conversations.find(c => c.id === activeConversationId);
    const messages = activeConversation?.messages || [];

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (listRef.current) {
            listRef.current.scrollTo({
                top: listRef.current.scrollHeight,
                behavior: 'smooth'
            });
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

    // Save conversations to localStorage
    useEffect(() => {
        if (conversations.length > 0) {
            localStorage.setItem('chat_conversations', JSON.stringify(conversations));
        }
    }, [conversations]);

    // Auto-close sidebar on mobile
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth <= 768) {
                setIsSidebarOpen(false);
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const createNewConversation = () => {
        const newConv = {
            id: Date.now(),
            title: 'New Conversation',
            messages: [],
            current_agent: null,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        setConversations(prev => [newConv, ...prev]);
        setActiveConversationId(newConv.id);
        if (window.innerWidth <= 768) setIsSidebarOpen(false);
    };

    const updateConversationTitle = (convId, firstMessage) => {
        const title = firstMessage.length > 35 
            ? firstMessage.substring(0, 35) + '...' 
            : firstMessage;
        setConversations(prev => prev.map(conv => 
            conv.id === convId ? { ...conv, title } : conv
        ));
    };

    const handleSend = async (e) => {
        e && e.preventDefault();
        if (!value.trim() || isLoading) return;

        const userMessage = value.trim();
        setValue('');
        setError('');

        // Reset textarea height
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
        }

        const newUserMsg = {
            role: 'user',
            content: userMessage,
            timestamp: new Date().toISOString()
        };

        setConversations(prev => prev.map(conv => 
            conv.id === activeConversationId 
                ? { ...conv, messages: [...conv.messages, newUserMsg], updatedAt: new Date() } 
                : conv
        ));

        if (messages.length === 0) {
            updateConversationTitle(activeConversationId, userMessage);
        }

        setIsLoading(true);

        try {
            const currentConv = conversations.find(c => c.id === activeConversationId);
            const conversationMessages = currentConv?.messages || [];
            const currentAgent = currentConv?.current_agent || null;

            const response = await fetch(`${API_BASE_URL}/multi-agent/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: userMessage,
                    messages: conversationMessages,
                    current_agent: currentAgent
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to get response');
            }

            const data = await response.json();
            
            const newAiMsg = {
                role: 'assistant',
                content: data.response,
                category: data.category,
                timestamp: new Date().toISOString()
            };

            setConversations(prev => prev.map(conv => 
                conv.id === activeConversationId 
                    ? { 
                        ...conv, 
                        messages: [...conv.messages, newAiMsg],
                        current_agent: data.current_agent || conv.current_agent,
                        updatedAt: new Date()
                    } 
                    : conv
            ));

        } catch (err) {
            console.error('Chat error:', err);
            setError(err.message || 'Failed to send message. Please try again.');
            setConversations(prev => prev.map(conv => 
                conv.id === activeConversationId 
                    ? { ...conv, messages: conv.messages.slice(0, -1) } 
                    : conv
            ));
        } finally {
            setIsLoading(false);
            // Re-focus input after send
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    };

    const deleteConversation = (convId) => {
        if (conversations.length === 1) {
            const newId = Date.now();
            setConversations([{
                id: newId,
                title: 'New Conversation',
                messages: [],
                current_agent: null,
                createdAt: new Date(),
                updatedAt: new Date()
            }]);
            setActiveConversationId(newId);
        } else {
            const filtered = conversations.filter(c => c.id !== convId);
            setConversations(filtered);
            if (activeConversationId === convId && filtered.length > 0) {
                setActiveConversationId(filtered[0].id);
            }
        }
    };

    const clearAllConversations = () => {
        if (window.confirm('Clear all conversations? This cannot be undone.')) {
            const newId = Date.now();
            setConversations([{
                id: newId,
                title: 'New Conversation',
                messages: [],
                current_agent: null,
                createdAt: new Date(),
                updatedAt: new Date()
            }]);
            setActiveConversationId(newId);
            localStorage.removeItem('chat_conversations');
        }
    };

    const exportConversation = (convId) => {
        const conv = conversations.find(c => c.id === convId);
        if (!conv) return;

        let markdown = `# ${conv.title}\n\n`;
        markdown += `**Created:** ${new Date(conv.createdAt).toLocaleString()}\n`;
        markdown += `**Last Updated:** ${new Date(conv.updatedAt).toLocaleString()}\n`;
        markdown += `**Messages:** ${conv.messages.length}\n\n---\n\n`;

        conv.messages.forEach((msg) => {
            const role = msg.role === 'user' ? '👤 You' : '🤖 AI Assistant';
            const timestamp = msg.timestamp ? ` (${new Date(msg.timestamp).toLocaleTimeString()})` : '';
            markdown += `## ${role}${timestamp}\n\n`;
            if (msg.category) markdown += `*Category: ${msg.category}*\n\n`;
            markdown += `${msg.content}\n\n---\n\n`;
        });

        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${conv.title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const resizeInput = useCallback(() => {
        if (!inputRef.current) return;
        const ta = inputRef.current;
        ta.style.height = 'auto';
        ta.style.height = `${Math.min(150, ta.scrollHeight)}px`;
    }, []);

    const formatMessageContent = (content) => {
        let formatted = content;
        
        formatted = formatted
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        
        formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
            return `<pre class="code-block"><code class="language-${lang || 'plaintext'}">${code.trim()}</code></pre>`;
        });
        
        formatted = formatted.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
        formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        formatted = formatted.replace(/^### (.+)$/gm, '<h3 class="msg-h3">$1</h3>');
        formatted = formatted.replace(/^## (.+)$/gm, '<h2 class="msg-h2">$1</h2>');
        formatted = formatted.replace(/^# (.+)$/gm, '<h1 class="msg-h1">$1</h1>');
        formatted = formatted.replace(/^\d+\.\s+(.+)$/gm, '<li class="numbered">$1</li>');
        formatted = formatted.replace(/^[•\-]\s+(.+)$/gm, '<li>$1</li>');
        
        formatted = formatted.replace(/(<li(?:\s+class="numbered")?>.*?<\/li>\s*)+/g, (match) => {
            if (match.includes('class="numbered"')) {
                return `<ol class="msg-list">${match.replace(/\s+class="numbered"/g, '')}</ol>`;
            }
            return `<ul class="msg-list">${match}</ul>`;
        });
        
        formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
        formatted = formatted.replace(/^&gt;\s+(.+)$/gm, '<blockquote>$1</blockquote>');
        formatted = formatted.replace(/^---$/gm, '<hr>');
        
        formatted = formatted.replace(/\n\n+/g, '</p><p>');
        formatted = `<p>${formatted}</p>`;
        formatted = formatted.replace(/<p><\/p>/g, '');
        formatted = formatted.replace(/<p>\s*<\/p>/g, '');
        
        formatted = formatted.replace(/<p>(.*?)<\/p>/gs, (match, content) => {
            if (content.includes('<pre>') || content.includes('<ul>') || content.includes('<ol>') || 
                content.includes('<h1>') || content.includes('<h2>') || content.includes('<h3>')) {
                return `<p>${content}</p>`;
            }
            return `<p>${content.replace(/\n/g, '<br>')}</p>`;
        });
        
        return formatted;
    };

    const getCategoryBadge = (category) => {
        const categoryMap = {
            '1': { label: 'Learning', color: '#10b981', icon: '📚' },
            '2': { label: 'Resume', color: '#8b5cf6', icon: '📝' },
            '3': { label: 'Interview', color: '#f59e0b', icon: '🎤' },
            '4': { label: 'Job Search', color: '#3b82f6', icon: '💼' },
            'Tutorial': { label: 'Tutorial', color: '#10b981', icon: '📖' },
            'Question': { label: 'Q&A', color: '#06b6d4', icon: '💡' }
        };
        const cat = categoryMap[category] || { label: 'AI Response', color: '#667eea', icon: '🤖' };
        return (
            <span className="category-badge" style={{ backgroundColor: `${cat.color}15`, color: cat.color }}>
                <span className="badge-icon">{cat.icon}</span>
                {cat.label}
            </span>
        );
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const switchConversation = (convId) => {
        setActiveConversationId(convId);
        if (window.innerWidth <= 768) setIsSidebarOpen(false);
    };

    return (
        <div className={`chat-page ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
            {/* Mobile overlay */}
            {isSidebarOpen && (
                <div 
                    className="sidebar-overlay" 
                    onClick={() => setIsSidebarOpen(false)}
                    aria-hidden="true"
                />
            )}

            {/* Sidebar */}
            <aside className={`chat-sidebar ${isSidebarOpen ? 'open' : ''}`}>
                <div className="chat-sidebar-header">
                    <h3>Conversations</h3>
                    <div className="sidebar-header-actions">
                        <button 
                            className="icon-btn new-chat-btn" 
                            onClick={createNewConversation}
                            title="New conversation"
                            aria-label="New conversation"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 5v14M5 12h14"/>
                            </svg>
                        </button>
                        <button 
                            className="icon-btn close-sidebar-btn"
                            onClick={() => setIsSidebarOpen(false)}
                            title="Close sidebar"
                            aria-label="Close sidebar"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M15 18l-6-6 6-6"/>
                            </svg>
                        </button>
                    </div>
                </div>
                
                <ul className="conversation-list">
                    {conversations.map(conv => (
                        <li 
                            key={conv.id} 
                            className={`conversation ${conv.id === activeConversationId ? 'active' : ''}`}
                            onClick={() => switchConversation(conv.id)}
                        >
                            <div className="conv-icon">
                                {conv.messages.length === 0 ? '✨' : '💬'}
                            </div>
                            <div className="conv-info">
                                <div className="conv-title">{conv.title}</div>
                                <div className="conv-sub">
                                    {conv.messages.length === 0 
                                        ? 'Start chatting' 
                                        : `${conv.messages.length} ${conv.messages.length === 1 ? 'message' : 'messages'}`}
                                </div>
                            </div>
                            <div className="conv-actions">
                                <button 
                                    className="conv-action-btn"
                                    onClick={(e) => { e.stopPropagation(); exportConversation(conv.id); }}
                                    aria-label="Export conversation"
                                    title="Export"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                                    </svg>
                                </button>
                                <button 
                                    className="conv-action-btn delete"
                                    onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                                    aria-label="Delete conversation"
                                    title="Delete"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                                    </svg>
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>

                <div className="chat-sidebar-footer">
                    <button className="clear-all-btn" onClick={clearAllConversations}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                        </svg>
                        Clear All
                    </button>
                </div>
            </aside>

            {/* Main Chat Area */}
            <section className="chat-main">
                {/* Chat Header */}
                <div className="chat-header">
                    <button 
                        className="icon-btn toggle-sidebar-btn"
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
                        title={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                        </svg>
                    </button>
                    <div className="chat-header-title">
                        <h2>{activeConversation?.title || 'New Conversation'}</h2>
                        {activeConversation?.current_agent && (
                            <span className="agent-indicator">
                                {(() => {
                                    const agentMap = {
                                        'general': '🤖 PrepWise AI',
                                        'learning_resource': '📚 Learning',
                                        'tutorial': '📖 Tutorial',
                                        'interview_preparation': '🎤 Interview',
                                        'resume_making': '📝 Resume',
                                        'job_search': '💼 Job Search'
                                    };
                                    return agentMap[activeConversation.current_agent] || '🤖 AI Assistant';
                                })()}
                            </span>
                        )}
                    </div>
                    <div className="chat-header-actions">
                        {messages.length > 0 && (
                            <button 
                                className="icon-btn"
                                onClick={() => exportConversation(activeConversationId)}
                                title="Export conversation"
                                aria-label="Export conversation"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                            <p>Your intelligent multi-agent assistant for career success. Ask me anything about learning, resumes, interviews, or job searching.</p>
                            <div className="feature-grid">
                                <button className="feature-card" onClick={() => { setValue('Create a tutorial on machine learning basics'); inputRef.current?.focus(); }}>
                                    <span className="feature-icon">📚</span>
                                    <h4>Learning & Tutorials</h4>
                                    <p>Master topics with tutorials and code examples</p>
                                </button>
                                <button className="feature-card" onClick={() => { setValue('Help me build a resume for a software engineering role'); inputRef.current?.focus(); }}>
                                    <span className="feature-icon">📝</span>
                                    <h4>Resume Building</h4>
                                    <p>Create ATS-optimized resumes</p>
                                </button>
                                <button className="feature-card" onClick={() => { setValue('Give me interview questions for a data scientist position'); inputRef.current?.focus(); }}>
                                    <span className="feature-icon">🎤</span>
                                    <h4>Interview Prep</h4>
                                    <p>Practice with curated questions</p>
                                </button>
                                <button className="feature-card" onClick={() => { setValue('Search for remote React developer jobs'); inputRef.current?.focus(); }}>
                                    <span className="feature-icon">💼</span>
                                    <h4>Job Search</h4>
                                    <p>Discover tailored opportunities</p>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="messages-container">
                            <AnimatePresence>
                                {messages.map((msg, index) => (
                                    <motion.div
                                        key={index}
                                        initial={{ opacity: 0, y: 12 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.25, ease: 'easeOut' }}
                                        className={`message ${msg.role === 'user' ? 'user' : 'assistant'}`}
                                    >
                                        <div className="message-avatar">
                                            {msg.role === 'user' ? '👤' : '🤖'}
                                        </div>
                                        <div className="message-content">
                                            {msg.category && (
                                                <div className="message-category">
                                                    {getCategoryBadge(msg.category)}
                                                </div>
                                            )}
                                            <div 
                                                className="message-text"
                                                dangerouslySetInnerHTML={{ __html: formatMessageContent(msg.content) }}
                                            />
                                            <div className="message-time">
                                                {formatTime(msg.timestamp)}
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                            
                            {isLoading && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="message assistant"
                                >
                                    <div className="message-avatar">🤖</div>
                                    <div className="message-content">
                                        <div className="typing-indicator">
                                            <span></span>
                                            <span></span>
                                            <span></span>
                                            <span className="typing-label">Thinking...</span>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    )}
                </div>

                {/* ARIA live region */}
                <div ref={liveRef} className="sr-only" aria-live="polite" aria-atomic="true"></div>

                {/* Error */}
                <AnimatePresence>
                    {error && (
                        <motion.div 
                            className="chat-error"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                        >
                            <span className="error-icon">⚠️</span>
                            <span className="error-text">{error}</span>
                            <button className="error-dismiss" onClick={() => setError('')} aria-label="Dismiss error">×</button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Input Area */}
                <form className="chat-input" onSubmit={handleSend}>
                    <div className="input-wrapper">
                        <textarea
                            ref={inputRef}
                            placeholder="Ask about tutorials, resume building, interview prep, job search..."
                            value={value}
                            onChange={e => { setValue(e.target.value); resizeInput(); }}
                            rows={1}
                            aria-label="Type your message"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            onInput={resizeInput}
                            disabled={isLoading}
                        />
                        <button 
                            type="submit" 
                            className={`send-btn ${isLoading ? 'loading' : ''} ${value.trim() ? 'active' : ''}`}
                            disabled={isLoading || !value.trim()}
                            title="Send message (Enter)"
                            aria-label="Send message"
                        >
                            {isLoading ? (
                                <div className="send-spinner" />
                            ) : (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                                </svg>
                            )}
                        </button>
                    </div>
                    <div className="input-hint">
                        <kbd>Enter</kbd> to send · <kbd>Shift + Enter</kbd> for new line
                    </div>
                </form>
            </section>
        </div>
    );
};

export default Chat;
