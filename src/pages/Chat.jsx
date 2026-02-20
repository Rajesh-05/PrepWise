
import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import '../styles/Chat.css';
// Gemini system prompt and API key removed - now handled by backend

const Chat = () => {
    // Initialize state from localStorage if available (Instant Load)
    const [conversations, setConversations] = useState(() => {
        const local = localStorage.getItem('chat_conversations');
        return local ? JSON.parse(local) : [];
    });

    // Set active conversation from initial state if needed
    const [activeConversationId, setActiveConversationId] = useState(() => {
        const local = localStorage.getItem('chat_conversations');
        if (local) {
            const convs = JSON.parse(local);
            return convs.length > 0 ? convs[0].id : null;
        }
        return null;
    });

    const [value, setValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [editingConvId, setEditingConvId] = useState(null);
    const [editingTitle, setEditingTitle] = useState('');
    const listRef = useRef(null);
    const inputRef = useRef(null);
    const liveRef = useRef(null);


    // Fetch chat sessions from backend on mount, and persist in localStorage
    useEffect(() => {
        const fetchChats = async () => {
            const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
            if (!token) return;
            try {
                const response = await fetch('/api/chat-sessions', {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await response.json();
                if (response.ok && data.sessions) {
                    const convs = data.sessions.map((s, idx) => ({
                        id: s._id || s.session_id || idx,
                        session_id: s._id || s.session_id || idx,
                        title: s.topic || 'Chat Session',
                        messages: (s.messages || []).map(m => ({ role: m.role, content: m.content })),
                        createdAt: s.started_at ? new Date(s.started_at) : new Date(),
                        updatedAt: s.last_message_at ? new Date(s.last_message_at) : new Date()
                    }));
                    setConversations(convs);
                    localStorage.setItem('chat_conversations', JSON.stringify(convs));

                    // Only set active if none selected (prevent overriding user selection if they clicked fast)
                    setActiveConversationId(prev => (prev ? prev : (convs.length > 0 ? convs[0].id : null)));
                }
            } catch (err) {
                console.error("Failed to fetch chats:", err);
                // Keep existing localStorage data if fetch fails
            }
        };
        fetchChats();
    }, []);


    const activeConversation = conversations.find(c => c.id === activeConversationId);
    // Memoize messages to avoid triggering useEffect on every render
    const messages = React.useMemo(() => activeConversation?.messages || [], [activeConversation]);

    useEffect(() => {
        // Auto-scroll to bottom on new messages
        if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
        }
        // Announce new assistant messages to screen readers
        const last = messages[messages.length - 1];
        if (last && liveRef.current && last.role === 'model') {
            liveRef.current.textContent = `Assistant: ${last.content}`;
        }
    }, [messages]);

    const createNewConversation = () => {
        const newConv = {
            id: Date.now(),
            title: 'New Conversation',
            messages: [],
            createdAt: new Date(),
            updatedAt: new Date()
        };
        setConversations(prev => [newConv, ...prev]);
        localStorage.setItem('chat_conversations', JSON.stringify([newConv, ...conversations]));
        setActiveConversationId(newConv.id);
    };

    const updateConversationTitle = (convId, firstMessage) => {
        // Generate a title from the first message
        const title = firstMessage.length > 30
            ? firstMessage.substring(0, 30) + '...'
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

        // Add user message to conversation
        const newUserMsg = {
            role: 'user',
            content: userMessage
        };

        setConversations(prev => {
            const updated = prev.map(conv =>
                conv.id === activeConversationId
                    ? {
                        ...conv,
                        messages: [...conv.messages, newUserMsg],
                        updatedAt: new Date()
                    }
                    : conv
            );
            localStorage.setItem('chat_conversations', JSON.stringify(updated));
            return updated;
        });

        // Update conversation title if this is the first message
        if (messages.length === 0) {
            updateConversationTitle(activeConversationId, userMessage);
        }

        setIsLoading(true);

        try {
            const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');

            if (!token) {
                throw new Error('User is not authenticated');
            }

            // Save user message to backend
            const activeConv = conversations.find(c => c.id === activeConversationId);
            const backendSessionId = activeConv?.session_id || activeConversationId;

            const userMsgResponse = await fetch('/api/user/chat-message', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    session_id: backendSessionId,
                    message: userMessage,
                    role: 'user'
                })
            });

            const userMsgData = await userMsgResponse.json();

            // If backend created a new session and returned session_id, update our local conversation
            if (userMsgData.session_id) {
                setConversations(prev => prev.map(conv =>
                    conv.id === activeConversationId
                        ? { ...conv, session_id: userMsgData.session_id }
                        : conv
                ));
            }

            // If backend returned an AI response, add it to the conversation
            if (userMsgData.assistant_message) {
                const newAiMsg = {
                    role: 'model',
                    content: userMsgData.assistant_message
                };

                setConversations(prev => prev.map(conv =>
                    conv.id === activeConversationId
                        ? {
                            ...conv,
                            messages: [...conv.messages, newAiMsg],
                            updatedAt: new Date()
                        }
                        : conv
                ));
            }

        } catch (err) {
            console.error('Chat error:', err);
            setError(err.message || 'Failed to send message. Please try again.');

            // Remove the user message if there was an error
            setConversations(prev => prev.map(conv =>
                conv.id === activeConversationId
                    ? {
                        ...conv,
                        messages: conv.messages.slice(0, -1)
                    }
                    : conv
            ));
        } finally {
            setIsLoading(false);
        }
    };

    const deleteConversation = async (convId) => {
        const conv = conversations.find(c => c.id === convId);
        // If this conversation is from backend (has a session_id), delete from backend
        if (conv && conv.session_id) {
            const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
            try {
                const response = await fetch(`/api/chat-sessions/${conv.session_id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) {
                    console.error('Failed to delete chat session from backend');
                    return; // Don't delete from frontend if backend deletion failed
                }
            } catch (err) {
                console.error('Error deleting chat session:', err);
                return; // Don't delete from frontend if backend deletion failed
            }
        }

        // Delete from frontend
        if (conversations.length === 1) {
            // Don't delete the last conversation, just clear it
            const newId = Date.now();
            const newConv = {
                id: newId,
                title: 'New Conversation',
                messages: [],
                createdAt: new Date(),
                updatedAt: new Date()
            };
            setConversations([newConv]);
            localStorage.setItem('chat_conversations', JSON.stringify([newConv]));
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

    const startEditingTitle = (convId, currentTitle) => {
        setEditingConvId(convId);
        setEditingTitle(currentTitle);
    };

    const cancelEditingTitle = () => {
        setEditingConvId(null);
        setEditingTitle('');
    };

    const saveTitle = async (convId) => {
        if (!editingTitle.trim()) {
            cancelEditingTitle();
            return;
        }

        const conv = conversations.find(c => c.id === convId);

        // Update backend if this is a persisted session
        if (conv && conv.session_id) {
            const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
            try {
                const response = await fetch(`/api/chat-sessions/${conv.session_id}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ topic: editingTitle.trim() })
                });

                if (!response.ok) {
                    console.error('Failed to update chat session title in backend');
                }
            } catch (err) {
                console.error('Error updating chat session title:', err);
            }
        }

        // Update frontend state
        const updated = conversations.map(c =>
            c.id === convId ? { ...c, title: editingTitle.trim() } : c
        );
        setConversations(updated);
        localStorage.setItem('chat_conversations', JSON.stringify(updated));
        cancelEditingTitle();
    };

    const clearAllConversations = async () => {
        if (window.confirm('Are you sure you want to clear all conversations? This cannot be undone.')) {
            const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');

            // Delete all sessions from backend
            try {
                const response = await fetch('/api/chat-sessions', {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!response.ok) {
                    console.error('Failed to delete all chat sessions from backend');
                }
            } catch (err) {
                console.error('Error deleting all chat sessions:', err);
            }

            // Clear frontend state
            const newConv = {
                id: Date.now(),
                title: 'New Conversation',
                messages: [],
                createdAt: new Date(),
                updatedAt: new Date()
            };
            setConversations([newConv]);
            setActiveConversationId(newConv.id);
            localStorage.setItem('chat_conversations', JSON.stringify([newConv]));
        }
    };

    const resizeInput = () => {
        if (!inputRef.current) return;
        const ta = inputRef.current;
        ta.style.height = 'auto';
        ta.style.height = `${Math.min(200, ta.scrollHeight)}px`;
    };

    const formatMessageContent = (content) => {
        // Enhanced markdown-like formatting for rich text display
        let formatted = content;

        // Escape HTML first to prevent XSS
        formatted = formatted
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Code blocks with language support
        formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
            return `<pre class="code-block"><code class="language-${lang || 'plaintext'}">${code.trim()}</code></pre>`;
        });

        // Inline code
        formatted = formatted.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

        // Bold
        formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        // Italic
        formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');

        // Headers
        formatted = formatted.replace(/^### (.+)$/gm, '<h3 class="msg-h3">$1</h3>');
        formatted = formatted.replace(/^## (.+)$/gm, '<h2 class="msg-h2">$1</h2>');
        formatted = formatted.replace(/^# (.+)$/gm, '<h1 class="msg-h1">$1</h1>');

        // Numbered lists
        formatted = formatted.replace(/^\d+\.\s+(.+)$/gm, '<li class="numbered">$1</li>');

        // Bullet points (handle both - and •)
        formatted = formatted.replace(/^[•-]\s+(.+)$/gm, '<li>$1</li>');

        // Wrap consecutive list items in ul tags
        formatted = formatted.replace(/(<li(?:\s+class="numbered")?>.*?<\/li>\s*)+/g, (match) => {
            if (match.includes('class="numbered"')) {
                return `<ol class="msg-list">${match.replace(/\s+class="numbered"/g, '')}</ol>`;
            }
            return `<ul class="msg-list">${match}</ul>`;
        });

        // Links
        formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

        // Blockquotes
        formatted = formatted.replace(/^&gt;\s+(.+)$/gm, '<blockquote>$1</blockquote>');

        // Horizontal rule
        formatted = formatted.replace(/^---$/gm, '<hr>');

        // Paragraphs (double line break)
        formatted = formatted.replace(/\n\n+/g, '</p><p>');
        formatted = `<p>${formatted}</p>`;

        // Clean up empty paragraphs
        formatted = formatted.replace(/<p><\/p>/g, '');
        formatted = formatted.replace(/<p>\s*<\/p>/g, '');

        // Single line breaks within paragraphs
        formatted = formatted.replace(/<p>(.*?)<\/p>/gs, (match, content) => {
            // Don't add <br> if content has block elements
            if (content.includes('<pre>') || content.includes('<ul>') || content.includes('<ol>') ||
                content.includes('<h1>') || content.includes('<h2>') || content.includes('<h3>')) {
                return `<p>${content}</p>`;
            }
            return `<p>${content.replace(/\n/g, '<br>')}</p>`;
        });

        return formatted;
    };

    return (
        <div className="chat-page">
            <aside className="chat-sidebar">
                <div className="chat-sidebar-header">
                    <h3>Conversations</h3>
                    <button className="btn btn-secondary btn-small chat-new-btn" onClick={createNewConversation}>
                        New
                    </button>
                </div>
                <ul className="conversation-list">
                    {conversations.map(conv => (
                        <li
                            key={conv.id}
                            className={`conversation ${conv.id === activeConversationId ? 'active' : ''}`}
                            onClick={() => setActiveConversationId(conv.id)}
                        >
                            {editingConvId === conv.id ? (
                                <div className="conv-title-edit" onClick={(e) => e.stopPropagation()}>
                                    <input
                                        type="text"
                                        value={editingTitle}
                                        onChange={(e) => setEditingTitle(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                saveTitle(conv.id);
                                            } else if (e.key === 'Escape') {
                                                cancelEditingTitle();
                                            }
                                        }}
                                        onBlur={() => saveTitle(conv.id)}
                                        autoFocus
                                        className="conv-title-input"
                                    />
                                </div>
                            ) : (
                                <div
                                    className="conv-title"
                                    onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        startEditingTitle(conv.id, conv.title);
                                    }}
                                    title="Double-click to rename"
                                >
                                    {conv.title}
                                </div>
                            )}
                            <div className="conv-sub">
                                {conv.messages.length === 0
                                    ? 'No messages yet'
                                    : `${conv.messages.length} messages`}
                            </div>
                            <div className="conv-actions">
                                <button
                                    className="conv-edit-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        startEditingTitle(conv.id, conv.title);
                                    }}
                                    aria-label="Rename conversation"
                                    title="Rename"
                                >
                                    ✏️
                                </button>
                                <button
                                    className="conv-delete-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        deleteConversation(conv.id);
                                    }}
                                    aria-label="Delete conversation"
                                    title="Delete"
                                >
                                    ×
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
                <div className="chat-sidebar-footer">
                    <button className="btn btn-secondary btn-small" onClick={clearAllConversations}>
                        Clear All
                    </button>
                </div>
            </aside>

            <section className="chat-main chat-card">
                {/* <header className="chat-header">
                    <div>
                        <h2>AI Interview Coach</h2>
                        <div className="chat-meta">
                            {activeConversation?.title || 'New Conversation'} • {messages.length} messages
                        </div>
                    </div>
                </header> */}

                <div className="message-list" ref={listRef}>
                    {!activeConversationId ? (
                        <div className="chat-welcome">
                            <div className="welcome-icon">💬</div>
                            <h3>No Active Conversation</h3>
                            <p>Click the <strong>"New"</strong> button to start a new conversation with your AI Interview Coach!</p>
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="chat-welcome">
                            <div className="welcome-icon">🎯</div>
                            <h3>Welcome to Your AI Interview Coach!</h3>
                            <p>I'm here to help you:</p>
                            <ul>
                                <li>Learn technical concepts and algorithms</li>
                                <li>Practice behavioral interview questions</li>
                                <li>Understand system design patterns</li>
                                <li>Prepare for company-specific interviews</li>
                                <li>Get feedback on your approach</li>
                            </ul>
                            <p><strong>What would you like to work on today?</strong></p>
                        </div>
                    ) : (
                        messages.map((msg, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3 }}
                                className={`message ${msg.role === 'user' ? 'user' : 'assistant'}`}
                            >
                                <div className="message-body">
                                    <div
                                        className="message-text"
                                        dangerouslySetInnerHTML={{ __html: formatMessageContent(msg.content) }}
                                    />
                                </div>
                            </motion.div>
                        ))
                    )}
                    {isLoading && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="message assistant"
                        >
                            <div className="message-body">
                                <div className="typing-indicator">
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </div>

                {/* ARIA live region for screen readers (offscreen) */}
                <div ref={liveRef} className="sr-only" aria-live="polite" aria-atomic="true"></div>

                {error && (
                    <div className="chat-error">
                        <span className="error-icon">⚠️</span>
                        {error}
                    </div>
                )}

                <form className="chat-input" onSubmit={handleSend}>
                    <textarea
                        ref={inputRef}
                        placeholder={!activeConversationId ? "Click 'New' to start a conversation..." : "Ask me anything about interview prep, technical concepts, or career advice..."}
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
                        disabled={isLoading || !activeConversationId}
                    />
                    <div className="chat-input-actions">
                        <button
                            type="button"
                            className="btn btn-outline"
                            onClick={() => setValue('')}
                            disabled={isLoading || !activeConversationId}
                        >
                            Clear
                        </button>
                        <button
                            type="submit"
                            className={`btn btn-primary ${isLoading ? 'loading' : ''}`}
                            disabled={isLoading || !value.trim() || !activeConversationId}
                        >
                            {isLoading ? 'Sending...' : 'Send'}
                        </button>
                    </div>
                </form>
            </section>
        </div>
    );
};

export default Chat;
