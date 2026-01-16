# Repository Analysis: Quiz App Structure & Cleanup Guide

## Executive Summary

This repository is **NOT organized like a regular webapp**. It's a **single-purpose quiz application** that's been extracted from a larger "WorkInPilot" application. The app is almost entirely centered around `src/components/MockInterviews.tsx`, with a minimal backend API for quiz data.

## Architecture Overview

### Frontend Structure
- **Single-page app** with one main component: `MockInterviews.tsx` (1,410 lines)
- Minimal structure:
  - `App.tsx` → renders `MockInterviews`
  - `main.tsx` → React entry point
  - `services/api.ts` → API client (no auth)
  - `config/environment.ts` → API URL config
  - `data/mockData.ts` → Mock behavioral interview data

### Backend Structure
- **Minimal Express server** (`backend/server.js`) that only loads:
  - `routes/quiz-api.js` - Quiz endpoints
  - Quiz databases (SQLite)
- **Vestigial routes** exist but are NOT loaded:
  - `routes/api.js` (8,000+ lines - unused!)
  - `routes/auth.js` (1,200+ lines - unused!)
  - `routes/admin.js` (unused)
  - `routes/dashboard.js` (unused)
  - `routes/app.js` (unused)

## Essential Environment Variables

### Backend (Required)
```bash
# Quiz repository location (defaults to backend/vendor/quizzes)
QUIZ_REPO_ROOT=backend/vendor/quizzes

# GitHub commit to use for imports (defaults to '6a818e3')
QUIZ_COMMIT=cb7c9a5eea171be3ac0e5ca2ecc9fab7de775a91

# Server port (defaults to 3010)
PORT=3010

# CORS origins (optional, defaults include localhost)
CORS_ORIGINS=http://localhost:5173,http://localhost:3010
```

### Frontend (Optional)
```bash
# API base URL (defaults to http://localhost:3010/api)
VITE_API_BASE_URL=http://localhost:3010/api
```

## Environment Variables That Can Be Deleted

The `backend/config.env.example` file contains **325+ lines** of configuration for services that are **NOT used** by this quiz app:

### Can Delete (Not Used by Quiz App)
- **Keycloak** (authentication) - `KEYCLOAK_*`
- **NextCloud** (file storage) - `NEXTCLOUD_*`
- **MailCow/Stalwart** (email) - `MAILCOW_*`, `STALWART_*`, `WORKINPILOT_MAIL_*`
- **Ollama** (AI/LLM) - `OLLAMA_*`, `AI_ENABLED`, `USE_RAW_RESUME_CACHE`
- **SOGo** (webmail) - `SOGO_*`
- **RSS Feeds** - `WORKINPILOT_RSS_*`
- **NC Service** - `NC_SERVICE_*`
- **Database** - `DB_PATH` (quiz app uses `quizdb.sqlite` hardcoded)
- **Session** - `SESSION_SECRET` (no auth = no sessions)
- **WorkInPilot branding** - `WORKINPILOT_*` (except quiz-related)

### Keep (Used by Quiz App)
- `QUIZ_REPO_ROOT` (or rely on default)
- `QUIZ_COMMIT` (or rely on default '6a818e3')
- `PORT` (or rely on default 3010)
- `CORS_ORIGINS` (optional)

## Importing Latest Commit

**YES, the repo can import from the latest commit!**

The system uses the `QUIZ_COMMIT` environment variable throughout:

1. **Current default**: `6a818e3` (hardcoded in multiple places)
2. **Latest commit**: `cb7c9a5eea171be3ac0e5ca2ecc9fab7de775a91`

### How to Update

**Option 1: Set environment variable**
```bash
export QUIZ_COMMIT=cb7c9a5eea171be3ac0e5ca2ecc9fab7de775a91
# Then run imports
```

**Option 2: Update default in code** (not recommended, but possible)
Files to update:
- `backend/scripts/import-bash-quiz.js` (line 15)
- `backend/routes/quiz-api.js` (lines 211, 302, 422, 475)
- `backend/services/vendorInit.js` (line 83)
- `backend/routes/api.js` (lines 757, 892, 952) - if you keep this file

**Option 3: Use test script**
```bash
cd backend
./scripts/test-import-commit.sh cb7c9a5eea171be3ac0e5ca2ecc9fab7de775a91
```

## Files/Directories That Can Be Deleted

### Backend Routes (Unused)
- `backend/routes/api.js` (8,000+ lines - not loaded by server.js)
- `backend/routes/auth.js` (1,200+ lines - not loaded)
- `backend/routes/admin.js` (not loaded)
- `backend/routes/dashboard.js` (not loaded)
- `backend/routes/app.js` (not loaded)

### Backend Services (Unused)
- `backend/services/databaseService.js` (if only used by unused routes)
- `backend/services/enrichment.js` (if unused)
- `backend/services/robots.js` (if unused)
- `backend/middleware/auth.js` (no auth needed)
- `backend/config/passport.js` (no auth needed)
- `backend/config/database.js` (if unused)
- `backend/config/nextcloud-*.js` (NextCloud integration)
- `backend/config/env-loader.js` (validates unused env vars)

### Backend Scripts (Potentially Unused)
- `backend/init_activity.js` (if unused)
- `backend/init_db.py` (if unused)
- `backend/diagnostic.js` (if unused)
- `backend/app.py` (FastAPI app - not used, Express is used)

### Frontend (All Essential)
All frontend files appear to be used - keep them.

### Documentation (Review)
- `docs/` - May contain useful info, review before deleting
- `utils/` - Review scripts, some may be useful

## Recommended Cleanup Steps

1. **Create minimal `.env.example`**:
   ```bash
   # Quiz App Configuration
   QUIZ_REPO_ROOT=backend/vendor/quizzes
   QUIZ_COMMIT=cb7c9a5eea171be3ac0e5ca2ecc9fab7de775a91
   PORT=3010
   CORS_ORIGINS=http://localhost:5173,http://localhost:3010
   
   # Frontend (optional)
   VITE_API_BASE_URL=http://localhost:3010/api
   ```

2. **Delete unused route files** (after confirming they're not imported)

3. **Delete unused service files** (after confirming dependencies)

4. **Update default commit** in code if you want to pin to latest

5. **Simplify `config.env.example`** to only quiz-related vars

## Current State Summary

- **Frontend**: Clean, minimal, focused on quiz UI
- **Backend**: Mixed - core quiz functionality is clean, but lots of vestigial code from parent app
- **Config**: Bloated with unused environment variables
- **Dependencies**: Some unused (Keycloak, NextCloud, etc.) but harmless if not imported

## Quiz Import Mechanism

The app imports quizzes from:
- **Source**: `https://github.com/Ebazhanov/linkedin-skill-assessments-quizzes`
- **Method**: Local file import from `backend/vendor/quizzes/` directory
- **Format**: Markdown files like `{topic}/{topic}-quiz.md`
- **Commit tracking**: Uses `QUIZ_COMMIT` env var for attribution
- **Import script**: `backend/scripts/import-bash-quiz.js`

The import system:
1. Scans local repo for topics (`localTopicScanner.js`)
2. Imports markdown files into SQLite (`quizdb.sqlite`)
3. Supports both cached (already imported) and uncached topics
4. Tracks commit SHA in database for attribution

