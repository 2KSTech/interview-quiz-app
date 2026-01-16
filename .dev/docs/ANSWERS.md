# Answers to Analysis Questions

## 1. Canonical Structure for a Complex Single-Page App

### Current Structure (Minimal)
```
src/
  ├── App.tsx                    # Root component
  ├── main.tsx                   # Entry point
  ├── components/
  │   └── MockInterviews.tsx     # Main feature (1,410 lines - too large!)
  ├── config/
  │   └── environment.ts         # Config
  ├── data/
  │   └── mockData.ts            # Static data
  ├── services/
  │   └── api.ts                 # API client
  └── types/
      └── index.ts               # TypeScript types
```

### Recommended Structure for Complex SPA

```
src/
  ├── main.tsx                   # Entry point
  ├── App.tsx                    # Root component with routing
  │
  ├── components/                # Reusable UI components
  │   ├── common/                # Shared components (Button, Modal, etc.)
  │   │   ├── Button.tsx
  │   │   ├── Modal.tsx
  │   │   └── ImageModal.tsx
  │   ├── layout/                # Layout components
  │   │   ├── Header.tsx
  │   │   ├── Footer.tsx
  │   │   └── AdminPanel.tsx
  │   └── ui/                    # Basic UI primitives
  │       ├── Timer.tsx
  │       └── ScoreDisplay.tsx
  │
  ├── features/                  # Feature-based organization (RECOMMENDED)
  │   └── interviews/
  │       ├── components/       # Feature-specific components
  │       │   ├── InterviewCard.tsx
  │       │   ├── QuestionDisplay.tsx
  │       │   ├── ChoiceList.tsx
  │       │   ├── BehavioralResponse.tsx
  │       │   └── VideoRecorder.tsx
  │       ├── hooks/             # Feature-specific hooks
  │       │   ├── useQuiz.ts
  │       │   ├── useTimer.ts
  │       │   └── useVideoRecording.ts
  │       ├── services/          # Feature-specific services
  │       │   └── quizService.ts
  │       ├── types/             # Feature-specific types
  │       │   └── interview.types.ts
  │       └── MockInterviews.tsx # Main feature component (refactored)
  │
  ├── pages/                     # Page-level components (if using routing)
  │   ├── HomePage.tsx
  │   └── InterviewPage.tsx
  │
  ├── services/                  # Global services
  │   ├── api.ts                 # API client
  │   └── storage.ts             # LocalStorage wrapper
  │
  ├── hooks/                     # Global reusable hooks
  │   ├── useApi.ts
  │   └── useDarkMode.ts
  │
  ├── utils/                     # Utility functions
  │   ├── formatTime.ts
  │   ├── quizHelpers.ts
  │   └── constants.ts
  │
  ├── config/                    # Configuration
  │   ├── environment.ts
  │   └── routes.ts              # Route definitions
  │
  ├── types/                     # Global TypeScript types
  │   └── index.ts
  │
  └── styles/                    # Global styles
      ├── index.css
      └── themes.css
```

### Key Principles:
1. **Feature-based organization** - Group related code together
2. **Separation of concerns** - Components, hooks, services, types
3. **Reusability** - Common components in `components/common/`
4. **Scalability** - Easy to add new features without restructuring
5. **Co-location** - Related files live near each other

### Refactoring Recommendation:
Break `MockInterviews.tsx` (1,410 lines) into:
- `features/interviews/MockInterviews.tsx` (orchestration)
- `features/interviews/components/InterviewCard.tsx`
- `features/interviews/components/QuestionDisplay.tsx`
- `features/interviews/components/VideoRecorder.tsx`
- `features/interviews/hooks/useQuiz.ts`
- `features/interviews/hooks/useTimer.ts`
- etc.

---

## 2. Why Only 1 VITE Env Var? Is Vite Decommissioned?

### Vite is NOT Decommissioned - It's Active!

**Evidence:**
-  `vite.config.ts` exists and is properly configured
-  `package.json` has `"dev": "vite"` script
-  Vite dependencies are installed
-  HMR (Hot Module Replacement) is configured

### Why Only 1 VITE Env Var?

Vite only exposes environment variables that are **prefixed with `VITE_`** to the client. This is a **security feature** to prevent accidentally exposing sensitive server-side variables.

**Current usage:**
```typescript
// src/config/environment.ts
const envUrl = import.meta.env.VITE_API_BASE_URL;  //  Exposed
```

**Why you might not see updates:**

1. **Not running dev server** - Make sure you're running:
   ```bash
   npm run dev
   ```
   NOT viewing a production build in `dist/`

2. **Browser cache** - Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)

3. **Vite dev server not running** - Check if port 5173 is active:
   ```bash
   lsof -i :5173
   ```

4. **Watching wrong directory** - Vite watches `src/` by default

5. **HMR overlay disabled** - Your config has `overlay: false`, so errors might be silent

### Adding More VITE Env Vars

Create `.env` or `.env.local` in project root:
```bash
# .env.local (gitignored)
VITE_API_BASE_URL=http://localhost:3010/api
VITE_APP_NAME=Quiz App
VITE_ENABLE_DEBUG=true
VITE_MAX_QUESTIONS=10
```

Access in code:
```typescript
const apiUrl = import.meta.env.VITE_API_BASE_URL;
const appName = import.meta.env.VITE_APP_NAME;
const debug = import.meta.env.VITE_ENABLE_DEBUG === 'true';
```

**Note:** `.env.local` exists but might not be loaded. Vite loads:
1. `.env` (all environments)
2. `.env.local` (all environments, gitignored)
3. `.env.[mode]` (e.g., `.env.development`)
4. `.env.[mode].local` (e.g., `.env.development.local`)

---

## 3. Can You Run test-import? A/B Testing Latest Repo Content

### Yes! The Script Exists and Works

**Location:** `backend/scripts/test-import-commit.sh`

**Current Status:**
-  Script exists and is executable
-  `vendor/quizzes` IS a git repo (on branch `main`)
-  Latest commits visible: `08a5cc4`, `2a5efd7`, etc.

### How to Use for A/B Testing

**Step 1: Test import from specific commit**
```bash
cd backend
./scripts/test-import-commit.sh cb7c9a5eea171be3ac0e5ca2ecc9fab7de775a91
```

**What it does:**
1. Backs up current `quizdb.sqlite`
2. Notes current git state in `vendor/quizzes`
3. Checks out the test commit
4. Imports one topic (bash) as a test
5. Restores original git state
6. Leaves database backup for comparison

**Step 2: Compare databases**
```bash
# Original database
sqlite3 quizdb.sqlite "SELECT COUNT(*) FROM question WHERE quiz_id IN (SELECT id FROM quiz WHERE slug='bash');"

# Test database
sqlite3 quizdb.sqlite.backup.YYYYMMDD_HHMMSS "SELECT COUNT(*) FROM question WHERE quiz_id IN (SELECT id FROM quiz WHERE slug='bash');"
```

**Step 3: Full import test (manual)**
```bash
cd backend/vendor/quizzes
git checkout cb7c9a5eea171be3ac0e5ca2ecc9fab7de775a91

# Import multiple topics
export QUIZ_COMMIT=cb7c9a5eea171be3ac0e5ca2ecc9fab7de775a91
node scripts/import-bash-quiz.js  # For bash
# Repeat for other topics via API or script

# Test in app
# Compare results

# Restore
git checkout main  # or your original branch
```

### Enhanced A/B Testing Script

 **Created:** `backend/scripts/test-import-ab.sh`

This enhanced script:
1.  Creates a separate test database (doesn't modify production)
2.  Imports from test commit into test DB
3.  Provides comparison stats
4.  Automatically restores vendor repo state
5.  Handles upstream remote setup

**Usage:**
```bash
cd backend
./scripts/test-import-ab.sh cb7c9a5eea171be3ac0e5ca2ecc9fab7de775a91 bash
```

**What it does:**
- Backs up current database
- Creates test database: `quizdb.test.YYYYMMDD_HHMMSS.sqlite`
- Fetches from upstream if needed
- Checks out test commit
- Imports topic into test DB
- Shows comparison stats
- Restores vendor repo to original state
- Leaves both databases for comparison

### Current Commit Status

**Your vendor/quizzes repo:**
- Current branch: `main`
- Current commit: `08a5cc4` (SCRUM-648 and GH Issue 21)
- Remote: `origin` → `joanatam/wip-quiz-app` (your fork)
- Upstream: `upstream` → `Ebazhanov/linkedin-skill-assessments-quizzes`  Added
- Target commit: `cb7c9a5eea171be3ac0e5ca2ecc9fab7de775a91`  Found in upstream

**Verified:** The target commit exists in upstream:
```
cb7c9a5e Fix IT Ops answers Q18, Q20, Q31, Q43, Q51, Q52 (#3884) (#7250)
```

**To manually update vendor/quizzes to latest:**
```bash
cd backend/vendor/quizzes
git fetch upstream
git checkout cb7c9a5eea171be3ac0e5ca2ecc9fab7de775a91
# Or merge: git merge cb7c9a5eea171be3ac0e5ca2ecc9fab7de775a91
```

**The enhanced script (`test-import-ab.sh`) handles this automatically!**

---

## Quick Fixes

### Fix Vite HMR Issues
1. **Check dev server is running:**
   ```bash
   npm run dev
   ```
   Should see: `VITE v5.x.x  ready in xxx ms`

2. **Verify HMR is working:**
   - Make a small change in `src/App.tsx`
   - Should see browser update automatically
   - Check browser console for HMR messages

3. **If still not working, try:**
   ```bash
   # Clear Vite cache
   rm -rf node_modules/.vite
   npm run dev
   ```

### Fix Environment Variables
1. **Create `.env` file** (not `.env.local` for now):
   ```bash
   # .env
   VITE_API_BASE_URL=http://localhost:3010/api
   ```

2. **Restart dev server** after creating `.env`

3. **Verify it's loaded:**
   ```typescript
   console.log('API URL:', import.meta.env.VITE_API_BASE_URL);
   ```

