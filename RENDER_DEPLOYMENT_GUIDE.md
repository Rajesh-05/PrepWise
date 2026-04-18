# PrepWise Render Deployment Guide

Complete instructions for deploying both backend (Flask) and frontend (React) to Render.

---

## 📋 Pre-Deployment Checklist

- [ ] Backend is ready (refactored app.py, requirements.txt updated)
- [ ] Frontend API configuration is set (src/config/api.js created)
- [ ] Environment variables are configured
- [ ] GitHub repository is up to date
- [ ] Git branch pushed to remote (ui-enhancement-branch)

---

## 🔧 Part 1: Deploy Backend to Render

### Step 1: Create a New Web Service on Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **New +** → **Web Service**
3. Connect your GitHub repository
   - Select "Rajesh-05/PrepWise"
   - Branch: `ui-enhancement-branch`
4. Fill in the configuration:

| Field | Value |
|-------|-------|
| **Name** | prepwise-backend |
| **Environment** | Python 3 |
| **Region** | Choose closest to you (Singapore/India: Singapore) |
| **Branch** | ui-enhancement-branch |
| **Build Command** | `bash Backend/render-build.sh` |
| **Start Command** | `cd Backend && gunicorn app:app --bind 0.0.0.0:$PORT` |

### Step 2: Add Environment Variables

In Render dashboard → **Settings** → **Environment**:

```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
MONGODB_DBNAME=prepwise
JWT_SECRET=your-super-secret-key-change-this
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GROQ_API_KEY=your-groq-api-key
GEMINI_API_KEY=your-gemini-api-key
VAPI_API_KEY=your-vapi-api-key
GOOGLE_REDIRECT_URI=https://prepwise-backend-xxxxx.onrender.com/auth/google/callback
FLASK_ENV=production
```

**⚠️ IMPORTANT:** After deployment, Render will give you a URL like:
```
https://prepwise-backend-xxxxx.onrender.com
```

Update `GOOGLE_REDIRECT_URI` with your actual Render URL!

### Step 3: Deploy Backend

1. Click **Deploy**
2. Wait for build to complete (5-10 minutes)
3. Check logs for errors
4. Once live, test health check:

```bash
curl https://prepwise-backend-xxxxx.onrender.com/healthz
# Should return: {"status": "ok"}
```

**Your Backend URL:**
```
https://prepwise-backend-xxxxx.onrender.com
```

---

## 🌐 Part 2: Deploy Frontend to Render

### Step 1: Update Frontend Configuration

Update `.env.production` with your new backend URL:

```bash
REACT_APP_API_URL=https://prepwise-backend-xxxxx.onrender.com
REACT_APP_VAPI_PUBLIC_KEY=your-vapi-public-key
REACT_APP_GEMINI_API_KEY=your-gemini-api-key
GROQ_API_KEY=your-groq-api-key
```

Commit this change:
```bash
git add .env.production
git commit -m "Update backend URL for production Render deployment"
git push
```

### Step 2: Create Static Site on Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **New +** → **Static Site**
3. Connect your GitHub repository
   - Select "Rajesh-05/PrepWise"
   - Branch: `ui-enhancement-branch`
4. Fill in configuration:

| Field | Value |
|-------|-------|
| **Name** | prepwise-frontend |
| **Repository** | Rajesh-05/PrepWise |
| **Branch** | ui-enhancement-branch |
| **Build Command** | `npm install && npm run build` |
| **Publish Directory** | `build` |

### Step 3: Deploy Frontend

1. Click **Deploy**
2. Wait for build to complete (3-5 minutes)
3. Once live, you'll get a URL like:
   ```
   https://prepwise-frontend-xxxxx.onrender.com
   ```

---

## ✅ Post-Deployment Verification

### 1. Test Backend Health

```bash
curl https://prepwise-backend-xxxxx.onrender.com/healthz
```

Expected response:
```json
{"status": "ok"}
```

### 2. Test Frontend Loads

1. Visit `https://prepwise-frontend-xxxxx.onrender.com`
2. Check browser console (F12) for errors
3. Should see your PrepWise homepage

### 3. Test API Calls

#### Login Test:
```bash
curl -X POST https://prepwise-backend-xxxxx.onrender.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass"}'
```

#### Health Check:
```bash
curl https://prepwise-backend-xxxxx.onrender.com/healthz
```

#### Jobs Endpoint:
```bash
curl https://prepwise-backend-xxxxx.onrender.com/api/jobs?title=developer
```

### 4. Full End-to-End Test

1. Go to your frontend URL
2. Click **Sign Up**
3. Create an account
4. Should redirect to dashboard
5. Try using features:
   - Resume Builder
   - Job Search
   - Mock Interview

---

## 🔄 Redeploy Backend with Latest Changes

If you need to update your backend code:

```bash
# Make your changes
git add Backend/
git commit -m "Update backend code"
git push

# Render will automatically redeploy when it detects push to ui-enhancement-branch
# Monitor deployment in Render Dashboard
```

---

## 🔄 Redeploy Frontend with Latest Changes

If you need to update your frontend code:

```bash
# Make your changes
git add src/
git commit -m "Update frontend code"
git push

# Render will automatically rebuild Static Site
# Monitor build in Render Dashboard
```

---

## 📊 Your Deployed URLs

Once everything is live:

| Service | URL |
|---------|-----|
| **Frontend** | `https://prepwise-frontend-xxxxx.onrender.com` |
| **Backend** | `https://prepwise-backend-xxxxx.onrender.com` |
| **Backend Health** | `https://prepwise-backend-xxxxx.onrender.com/healthz` |

---

## ⚠️ Common Issues & Solutions

### Issue 1: Backend Returns 502 Bad Gateway

**Solution:**
1. Check Render logs: Dashboard → Your Service → Logs
2. Look for MongoDB connection errors
3. Verify `MONGODB_URI` is correct
4. Verify IP whitelist in MongoDB Atlas includes Render (0.0.0.0/0)

### Issue 2: Frontend API Calls Fail (CORS Error)

**Solution:**
1. Verify backend CORS is configured for frontend URL
2. Check Backend/app.py has:
   ```python
   CORS(app, resources={
       r"/api/*": {"origins": ["https://prepwise-frontend-xxxxx.onrender.com"]}
   })
   ```
3. Restart backend service

### Issue 3: Google OAuth Not Working

**Solution:**
1. Verify `GOOGLE_REDIRECT_URI` matches backend URL:
   ```
   https://prepwise-backend-xxxxx.onrender.com/auth/google/callback
   ```
2. Add frontend URL to Google OAuth authorized redirect URIs:
   - Go to Google Cloud Console
   - Select your project
   - OAuth 2.0 Client ID
   - Add: `https://prepwise-frontend-xxxxx.onrender.com/login`

### Issue 4: Frontend Doesn't Load

**Solution:**
1. Check Render build logs for npm errors
2. Verify all dependencies are installed
3. Check for any hardcoded localhost URLs (should use env vars)
4. Verify `.env.production` has correct API_URL

### Issue 5: Database Timeouts

**Solution:**
1. Increase MongoDB connection timeout in Backend/app.py:
   ```python
   serverSelectionTimeoutMS=10000  # 10 seconds
   ```
2. Redeploy backend
3. Monitor connection pool usage

---

## 🔐 Security Configuration

### MongoDB Atlas Setup

1. Go to [MongoDB Atlas](https://account.mongodb.com)
2. Select your cluster
3. **Security** → **Network Access**
4. Add IP address:
   - For Render: Use `0.0.0.0/0` (Render IPs are dynamic)
5. **Database Access**
6. Verify username/password are correct

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. OAuth 2.0 Client ID settings
3. Add authorized redirect URIs:
   ```
   https://prepwise-backend-xxxxx.onrender.com/auth/google/callback
   https://prepwise-frontend-xxxxx.onrender.com/login
   ```

---

## 📈 Monitoring & Logs

### Backend Logs (Render)
1. Dashboard → prepwise-backend
2. **Logs** tab
3. Watch for errors in real-time

### Frontend Build Logs (Render)
1. Dashboard → prepwise-frontend
2. **Logs** tab
3. Check build output

### Database Logs (MongoDB Atlas)
1. MongoDB Atlas Dashboard
2. **Logs** section
3. Monitor connection health

---

## 🔄 Update Workflow

For future updates:

```bash
# 1. Make changes locally
# 2. Test with local backend: npm start
# 3. Push to GitHub
git add .
git commit -m "Description of changes"
git push

# 4. Render automatically deploys
# 5. Monitor in Render Dashboard
# 6. Test on live URL
```

---

## 💡 Pro Tips

✅ **Use Render Cron Jobs** for scheduled tasks
✅ **Set up alerts** for failed builds/deploys
✅ **Use environment-specific configs** (dev vs production)
✅ **Monitor API response times** with browser DevTools
✅ **Keep MongoDB backups** enabled in Atlas

---

## 🚀 You're Live!

Your PrepWise application is now deployed to Render! 

**Frontend:** https://prepwise-frontend-xxxxx.onrender.com
**Backend:** https://prepwise-backend-xxxxx.onrender.com

Share your URLs and start using the platform! 🎉

---

**Last Updated:** April 18, 2026
**Status:** ✅ Ready to Deploy
