/**
 * Centralized API Configuration
 * All API calls should use URLs from this file
 * This makes it easy to switch between local and production backends
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/**
 * API Endpoints
 */
export const API_ENDPOINTS = {
  // Authentication
  AUTH_SIGNUP: `${API_BASE_URL}/auth/signup`,
  AUTH_LOGIN: `${API_BASE_URL}/auth/login`,
  AUTH_LOGOUT: `${API_BASE_URL}/auth/logout`,
  AUTH_ME: `${API_BASE_URL}/auth/me`,
  AUTH_GOOGLE_LOGIN: `${API_BASE_URL}/auth/google/login`,
  AUTH_GOOGLE_CALLBACK: `${API_BASE_URL}/auth/google/callback`,
  AUTH_FORGOT_PASSWORD: `${API_BASE_URL}/auth/forgot-password`,

  // Chat Sessions
  CHAT_SESSIONS: `${API_BASE_URL}/api/chat-sessions`,
  CHAT_SESSION_DELETE: (sessionId) => `${API_BASE_URL}/api/chat-sessions/${sessionId}`,
  CHAT_SESSION_UPDATE: (sessionId) => `${API_BASE_URL}/api/chat-sessions/${sessionId}`,
  CHAT_MESSAGE: `${API_BASE_URL}/api/user/chat-message`,

  // Resume Operations
  GENERATE_RESUME: `${API_BASE_URL}/generate-resume`,
  IMPROVE_RESUME: `${API_BASE_URL}/improve-resume`,
  EVALUATE_RESUME: `${API_BASE_URL}/evaluate-resume`,

  // Job Finder
  SCRAPE_REVIEW: `${API_BASE_URL}/scrape-review`,
  GET_JOBS: `${API_BASE_URL}/api/jobs`,

  // Question Bank
  GENERATE_QUESTIONS: `${API_BASE_URL}/generate-questions`,

  // Mock Interview
  VAPI_ASSISTANT: `${API_BASE_URL}/api/vapi/assistant`,
  VAPI_FEEDBACK: `${API_BASE_URL}/api/vapi/generate-feedback`,

  // User
  DASHBOARD_INFO: `${API_BASE_URL}/api/dashboard-info`,
  USER_DASHBOARD: `${API_BASE_URL}/api/user/dashboard`,
  USER_ACTIVITY_LOG: `${API_BASE_URL}/api/user/activity-log`,
  USER_PROFILE_PIC_UPLOAD: `${API_BASE_URL}/api/user/upload-profile-pic`,
  USER_PROFILE_PIC_DELETE: `${API_BASE_URL}/api/user/delete-profile-pic`,

  // Health check
  HEALTH_CHECK: `${API_BASE_URL}/healthz`,
};

/**
 * Get authorization headers for authenticated requests
 */
export const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };
};

/**
 * Handle API errors consistently
 */
export const handleApiError = (error) => {
  if (error.response) {
    // API returned an error status
    return {
      error: true,
      message: error.response.data?.error || 'An error occurred',
      status: error.response.status,
      data: error.response.data,
    };
  } else if (error.request) {
    // Request made but no response
    return {
      error: true,
      message: 'No response from server. Check your internet connection or backend URL.',
      status: 0,
    };
  } else {
    // Error setting up request
    return {
      error: true,
      message: error.message || 'An error occurred',
      status: 0,
    };
  }
};

export default API_ENDPOINTS;
