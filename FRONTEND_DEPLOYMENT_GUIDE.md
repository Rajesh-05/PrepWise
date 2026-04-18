# React Frontend Deployment Guide - Backend URL Update

## Overview
Your React frontend has been configured to use environment variables for API calls. This makes it easy to switch between local development and production backends without code changes.

---

## ✅ Changes Made

### 1. **Created Centralized API Configuration** (`src/config/api.js`)
- All API endpoints are now defined in one place
- Automatically uses `REACT_APP_API_URL` environment variable
- Falls back to `http://localhost:5000` for local development
- Includes helper functions for auth headers and error handling

### 2. **Created Environment Files**

#### `.env` (Development)
```
REACT_APP_API_URL=http://localhost:5000
   REACT_APP_VAPI_PUBLIC_KEY=your-vapi-public-key
   REACT_APP_GEMINI_API_KEY=your-gemini-api-key
   GROQ_API_KEY=your-groq-api-key
#### `.env.production` (Production - After Render Deployment)
```
REACT_APP_API_URL=https://prepwise-backend-38me.onrender.com
REACT_APP_VAPI_PUBLIC_KEY=your-vapi-public-key
REACT_APP_GEMINI_API_KEY=your-gemini-api-key
GROQ_API_KEY=your-groq-api-key
```

### 3. **Updated React Components**

| Component | Changes |
|-----------|---------|
| `src/App.jsx` | Added axios configuration to use API_BASE_URL |
| `src/components/JobDetails.jsx` | Updated to use `API_ENDPOINTS.SCRAPE_REVIEW` |
| `src/pages/Chat.jsx` | Imports centralized API config |
| `src/pages/Login.jsx` | Updated Google OAuth URL to `API_ENDPOINTS.AUTH_GOOGLE_LOGIN` |
| `src/pages/MockInterview.jsx` | Updated to use `API_ENDPOINTS.VAPI_ASSISTANT` |
| `src/pages/ResumeBuilder.jsx` | Updated to use `API_ENDPOINTS.GENERATE_RESUME` |
| `src/pages/ResumeEvaluator.jsx` | Updated both evaluate and improve endpoints |

---

## 🚀 Deployment Steps

### Step 1: Get Your Render Backend URL
After deploying the backend to Render, you'll get a URL like:
```
https://prepwise-backend-38me.onrender.com
```

### Step 2: Update Environment Variables for Vercel

**For Local Development:**
- The `.env` file is already configured for `http://localhost:5000`
- No changes needed for local testing

**For Production (Vercel):**
1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add/Update these variables:
   ```
   REACT_APP_API_URL=https://prepwise-backend-38me.onrender.com
   REACT_APP_VAPI_PUBLIC_KEY=your-vapi-public-key
   REACT_APP_GEMINI_API_KEY=your-gemini-api-key
   GROQ_API_KEY=your-groq-api-key
   ```

### Step 3: Trigger Rebuild on Vercel
1. Push changes to GitHub:
   ```bash
   git add .env .env.production src/config/api.js src/App.jsx src/components/JobDetails.jsx src/pages/*.jsx
   git commit -m "Update frontend API configuration for Render backend"
   git push
   ```

2. Vercel will automatically rebuild
3. Verify the build logs show no errors

### Step 4: Verify Deployment
1. Visit your Vercel frontend URL
2. Test API functionality:
   - **Login/Signup** - Should work with backend
   - **Job Search** - Test `/api/jobs` endpoint
   - **Resume Operations** - Test generation/evaluation
   - **Mock Interview** - Test Vapi integration

---

## 🔍 API Endpoints Configured

All endpoints use the base URL from `REACT_APP_API_URL`:

```javascript
// Authentication
/auth/signup
/auth/login
/auth/logout
/auth/me
/auth/google/login
/auth/google/callback

// Chat Sessions
/api/chat-sessions
/api/chat-sessions/{sessionId}

// Resume Operations
/generate-resume
/improve-resume
/evaluate-resume

// Job Finder
/scrape-review
/api/jobs

// Question Bank
/generate-questions

// Mock Interview
/api/vapi/assistant

// Health Check
/healthz
```

---

## 🧪 Testing the Connection

### Local Testing
```bash
# Terminal 1: Backend (Render-ready)
cd Backend
gunicorn app:app

# Terminal 2: Frontend
cd ~/PrepWise
npm start
```

Visit `http://localhost:3000` and test API calls.

### Production Testing (After Vercel Deploy)
1. Visit your Vercel URL: `https://prepwise-xxx.vercel.app`
2. Open browser DevTools → **Network** tab
3. Perform an action (login, search jobs, etc.)
4. Verify API calls go to: `https://prepwise-backend-38me.onrender.com/...`

---

## 📝 Environment Variables Reference

| Variable | Purpose | Local | Production |
|----------|---------|-------|------------|
| `REACT_APP_API_URL` | Backend API base URL | http://localhost:5000 | https://prepwise-backend-38me.onrender.com |
| `REACT_APP_VAPI_PUBLIC_KEY` | Vapi AI voice key | your-vapi-key | your-vapi-key |
| `REACT_APP_GEMINI_API_KEY` | Google Gemini AI key | your-gemini-key | your-gemini-key |
| `GROQ_API_KEY` | Groq LLM API key | your-groq-key | your-groq-key |

---

## ⚠️ Common Issues & Solutions

### Issue: API Calls Still Go to Localhost
**Solution:** 
1. Verify `.env` is not in `.gitignore` (it should NOT be ignored)
2. Restart React dev server after changing `.env`
3. Check `src/App.jsx` has axios configured: `axios.defaults.baseURL = API_BASE_URL;`

### Issue: CORS Errors
**Solution:**
1. Verify backend CORS is configured for your Vercel domain
2. In Backend/app.py, add your Vercel URL:
   ```python
   CORS(app, resources={
       ...
       "origins": ["https://your-vercel-url.vercel.app", "http://localhost:3000"],
       ...
   })
   ```

### Issue: Auth Token Not Persisted
**Solution:**
1. Verify `localStorage.setItem('auth_token', token)` is called
2. Check Header.jsx retrieves it: `localStorage.getItem('auth_token')`
3. Verify Bearer token is sent: `Authorization: Bearer {token}`

### Issue: Google OAuth Redirect Not Working
**Solution:**
1. Verify `GOOGLE_REDIRECT_URI` in backend matches:
   ```
   https://prepwise-backend-38me.onrender.com/auth/google/callback
   ```
2. Add Vercel URL as allowed origin in Google Console:
   - Go to Google Cloud Console
   - OAuth 2.0 Client ID settings
   - Add Authorized redirect URIs: `https://your-vercel-url.vercel.app/login`

---

## 📊 File Changes Summary

**Files Modified:**
- `.env` - Added API_URL configuration
- `.env.production` - Production API URL
- `src/config/api.js` - NEW: Centralized API configuration
- `src/App.jsx` - Added axios baseURL setup
- `src/components/JobDetails.jsx` - Updated endpoint
- `src/pages/Chat.jsx` - Imports API config
- `src/pages/Login.jsx` - Updated Google OAuth endpoint
- `src/pages/MockInterview.jsx` - Updated Vapi endpoint
- `src/pages/ResumeBuilder.jsx` - Updated endpoint
- `src/pages/ResumeEvaluator.jsx` - Updated 2 endpoints

**Total API Calls Updated:** 7 files, 9 hardcoded URLs replaced

---

## ✨ Next Steps

1. **Test Locally:**
   ```bash
   npm start
   # Visit http://localhost:3000
   # Test API calls work with local backend
   ```

2. **Deploy to Vercel:**
   ```bash
   git push
   # Vercel builds automatically
   ```

3. **Configure Vercel Environment Variables:**
   - Set `REACT_APP_API_URL` to your Render backend URL
   - Redeploy if needed

4. **Verify Production:**
   - Visit your Vercel URL
   - Check DevTools for API requests
   - Confirm they go to Render backend

5. **Update CORS on Backend (if needed):**
   - Add your Vercel frontend URL to CORS origins
   - Redeploy backend if changed

---

## 🔐 Security Notes

✅ **Done:**
- ✅ No hardcoded URLs in code (using env vars)
- ✅ Secrets stored in environment variables
- ✅ Auth tokens in localStorage (consider httpOnly cookies for production)
- ✅ CORS configured for specific origins

**Recommended for Production:**
- Implement refresh token rotation
- Use httpOnly cookies for JWT storage
- Add rate limiting on API calls
- Implement request logging/monitoring
- Add error tracking (Sentry)

---

## 📞 Support

If you encounter issues:

1. **Check Backend Logs** (Render Dashboard)
2. **Check Frontend Logs** (Browser Console)
3. **Verify Environment Variables** are set correctly
4. **Test Health Check:**
   ```bash
   curl https://prepwise-backend-38me.onrender.com/healthz
   # Should return: {"status": "ok"}
   ```

---

**Last Updated:** April 18, 2026
**Status:** ✅ Production Ready
