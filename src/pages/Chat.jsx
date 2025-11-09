import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import '../styles/Chat.css';

// System prompt for Gemini AI Interview Coach
const SYSTEM_PROMPT = `You are an expert AI Interview Coach and Career Mentor specialized in helping candidates prepare for technical and behavioral interviews. Your role is to:

**Core Responsibilities:**
1. Teach and explain technical concepts clearly with examples
2. Provide practical interview preparation strategies
3. Share real-world scenarios and case studies
4. Offer constructive feedback on answers and approaches
5. Guide candidates through complex problem-solving exercises
6. Help with behavioral interview preparation using the STAR method
7. Discuss company-specific interview processes and cultures

**Your Teaching Style:**
- Break down complex topics into digestible parts
- Use analogies and real-world examples
- Provide code snippets or pseudocode when relevant
- Ask clarifying questions to understand the candidate's level
- Encourage critical thinking with follow-up questions
- Be supportive, patient, and motivating

## Your reponse length is strictly limited to 150 words per message. If the topic requires more depth, suggest continuing in the next message.

Keep responses concise, clear, and actionable. Use formatting like bullet points and code blocks when appropriate. Always be encouraging and professional.`;

const Chat = () => {
    const [conversations, setConversations] = useState([
        {
            id: 1,
            title: 'New Conversation',
            messages: [],
            createdAt: new Date(),
            updatedAt: new Date()
        }
    ]);
    const [activeConversationId, setActiveConversationId] = useState(1);
    const [value, setValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const listRef = useRef(null);
    const inputRef = useRef(null);
    const liveRef = useRef(null);

    const activeConversation = conversations.find(c => c.id === activeConversationId);
    const messages = activeConversation?.messages || [];

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

    useEffect(() => {
        // Load conversations from localStorage
        const saved = localStorage.getItem('chat_conversations');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setConversations(parsed);
                if (parsed.length > 0) {
                    setActiveConversationId(parsed[0].id);
                }
            } catch (err) {
                console.error('Failed to load conversations:', err);
            }
        }
    }, []);

    useEffect(() => {
        // Save conversations to localStorage
        if (conversations.length > 0) {
            localStorage.setItem('chat_conversations', JSON.stringify(conversations));
        }
    }, [conversations]);

    const createNewConversation = () => {
        const newConv = {
            id: Date.now(),
            title: 'New Conversation',
            messages: [],
            createdAt: new Date(),
            updatedAt: new Date()
        };
        setConversations(prev => [newConv, ...prev]);
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

        setConversations(prev => prev.map(conv => 
            conv.id === activeConversationId 
                ? { 
                    ...conv, 
                    messages: [...conv.messages, newUserMsg],
                    updatedAt: new Date()
                } 
                : conv
        ));

        // Update conversation title if this is the first message
        if (messages.length === 0) {
            updateConversationTitle(activeConversationId, userMessage);
        }

        setIsLoading(true);

        try {
            const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
            
            if (!GEMINI_API_KEY) {
                throw new Error('Gemini API key is not configured');
            }

            // Build conversation history for Gemini
            const conversationHistory = messages.map(msg => ({
                role: msg.role,
                parts: [{ text: msg.content }]
            }));

            // Add system context as first user message if this is the start
            if (conversationHistory.length === 0) {
                conversationHistory.unshift({
                    role: 'user',
                    parts: [{ text: SYSTEM_PROMPT }]
                });
                conversationHistory.push({
                    role: 'model',
                    parts: [{ text: 'Hello! I\'m your AI Interview Coach. I\'m here to help you prepare for interviews, learn new concepts, and advance your career. What would you like to work on today?' }]
                });
            }

            // Add the new user message
            conversationHistory.push({
                role: 'user',
                parts: [{ text: userMessage }]
            });

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        contents: conversationHistory,
                        generationConfig: {
                            temperature: 0.7,
                            topK: 40,
                            topP: 0.95,
                            maxOutputTokens: 2048,
                        },
                        safetySettings: [
                            {
                                category: "HARM_CATEGORY_HARASSMENT",
                                threshold: "BLOCK_MEDIUM_AND_ABOVE"
                            },
                            {
                                category: "HARM_CATEGORY_HATE_SPEECH",
                                threshold: "BLOCK_MEDIUM_AND_ABOVE"
                            }
                        ]
                    })
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'Failed to get response from AI');
            }

            const data = await response.json();
            const aiResponse = data.candidates[0].content.parts[0].text;

            // Add AI response to conversation
            const newAiMsg = {
                role: 'model',
                content: aiResponse
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

    const deleteConversation = (convId) => {
        if (conversations.length === 1) {
            // Don't delete the last conversation, just clear it
            setConversations([{
                id: Date.now(),
                title: 'New Conversation',
                messages: [],
                createdAt: new Date(),
                updatedAt: new Date()
            }]);
            setActiveConversationId(Date.now());
        } else {
            const filtered = conversations.filter(c => c.id !== convId);
            setConversations(filtered);
            if (activeConversationId === convId && filtered.length > 0) {
                setActiveConversationId(filtered[0].id);
            }
        }
    };

    const clearAllConversations = () => {
        if (window.confirm('Are you sure you want to clear all conversations?')) {
            const newConv = {
                id: Date.now(),
                title: 'New Conversation',
                messages: [],
                createdAt: new Date(),
                updatedAt: new Date()
            };
            setConversations([newConv]);
            setActiveConversationId(newConv.id);
            localStorage.removeItem('chat_conversations');
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
        formatted = formatted.replace(/^[•\-]\s+(.+)$/gm, '<li>$1</li>');
        
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
                    <button className="btn btn-outline btn-small chat-new-btn" onClick={createNewConversation}>
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
                            <div className="conv-title">{conv.title}</div>
                            <div className="conv-sub">
                                {conv.messages.length === 0 
                                    ? 'No messages yet' 
                                    : `${conv.messages.length} messages`}
                            </div>
                            <button 
                                className="conv-delete-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    deleteConversation(conv.id);
                                }}
                                aria-label="Delete conversation"
                            >
                                ×
                            </button>
                        </li>
                    ))}
                </ul>
                <div className="chat-sidebar-footer">
                    <button className="btn btn-outline btn-small" onClick={clearAllConversations}>
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
                    {messages.length === 0 ? (
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
                        placeholder="Ask me anything about interview prep, technical concepts, or career advice..."
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
                        disabled={isLoading}
                    />
                    <div className="chat-input-actions">
                        <button 
                            type="button" 
                            className="btn btn-outline" 
                            onClick={() => setValue('')}
                            disabled={isLoading}
                        >
                            Clear
                        </button>
                        <button 
                            type="submit" 
                            className={`btn btn-primary ${isLoading ? 'loading' : ''}`} 
                            disabled={isLoading || !value.trim()}
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
