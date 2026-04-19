/**
 * PrepWise — Centralized API Configuration
 * All API calls must use URLs from this file.
 * Switch backends by changing REACT_APP_API_URL in .env / Render env vars.
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export const API_ENDPOINTS = {
  // ── Authentication ────────────────────────────────────────────────────────
  AUTH_SIGNUP:           `${API_BASE_URL}/auth/signup`,
  AUTH_LOGIN:            `${API_BASE_URL}/auth/login`,
  AUTH_LOGOUT:           `${API_BASE_URL}/auth/logout`,
  AUTH_ME:               `${API_BASE_URL}/auth/me`,
  AUTH_GOOGLE_LOGIN:     `${API_BASE_URL}/auth/google/login`,
  AUTH_GOOGLE_CALLBACK:  `${API_BASE_URL}/auth/google/callback`,
  AUTH_FORGOT_PASSWORD:  `${API_BASE_URL}/auth/forgot-password`,
  AUTH_RESET_PASSWORD:   `${API_BASE_URL}/auth/reset-password`,

  // ── Chat Sessions ─────────────────────────────────────────────────────────
  CHAT_SESSIONS:         `${API_BASE_URL}/api/chat-sessions`,
  CHAT_SESSION_DELETE:   (id) => `${API_BASE_URL}/api/chat-sessions/${id}`,
  CHAT_SESSION_UPDATE:   (id) => `${API_BASE_URL}/api/chat-sessions/${id}`,

  // ── Multi-Agent Chat ──────────────────────────────────────────────────────
  MULTI_AGENT_CHAT:      `${API_BASE_URL}/multi-agent/chat`,

  // ── Resume Operations ─────────────────────────────────────────────────────
  GENERATE_RESUME:       `${API_BASE_URL}/generate-resume`,
  IMPROVE_RESUME:        `${API_BASE_URL}/improve-resume`,
  EVALUATE_RESUME:       `${API_BASE_URL}/evaluate-resume`,

  // ── Job Finder ────────────────────────────────────────────────────────────
  SCRAPE_REVIEW:         `${API_BASE_URL}/scrape-review`,
  GET_JOBS:              `${API_BASE_URL}/api/jobs`,

  // ── Question Bank ─────────────────────────────────────────────────────────
  GENERATE_QUESTIONS:    `${API_BASE_URL}/generate-questions`,

  // ── Mock Interview ────────────────────────────────────────────────────────
  VAPI_ASSISTANT:        `${API_BASE_URL}/api/vapi/assistant`,

  // ── User / Dashboard ─────────────────────────────────────────────────────
  DASHBOARD_INFO:        `${API_BASE_URL}/api/dashboard-info`,
  USER_DASHBOARD:        `${API_BASE_URL}/api/user/dashboard`,
  USER_ACTIVITY_LOG:     `${API_BASE_URL}/api/user/activity-log`,
  USER_PROFILE_PIC_UPLOAD: `${API_BASE_URL}/api/user/upload-profile-pic`,
  USER_PROFILE_PIC_DELETE: `${API_BASE_URL}/api/user/delete-profile-pic`,

  // ── Health ────────────────────────────────────────────────────────────────
  HEALTH_CHECK:          `${API_BASE_URL}/healthz`,
};

/**
 * Returns Authorization header using the standardized 'auth_token' key.
 * FIX: original used localStorage.getItem('token') — now uses 'auth_token'
 * to match what Login.jsx, Signup.jsx, and every other component stores.
 */
export const getAuthHeaders = () => {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
};

/** Consistent API error shape for catch blocks. */
export const handleApiError = (error) => {
  if (error.response) {
    return {
      error:   true,
      message: error.response.data?.error || 'An error occurred',
      status:  error.response.status,
      data:    error.response.data,
    };
  }
  if (error.request) {
    return {
      error:   true,
      message: 'No response from server. Check your internet connection or backend URL.',
      status:  0,
    };
  }
  return { error: true, message: error.message || 'An error occurred', status: 0 };
};

export default API_ENDPOINTS;