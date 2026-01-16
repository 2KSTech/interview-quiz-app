const express = require('express');
const router = express.Router();
const quizContentDb = require('../services/quizContentDb');
const quizResultsDb = require('../services/quizResultsDb');
const { scanLocalRepo } = require('../services/localTopicScanner');
const { ensureQuizProviderRepoAvailable, getQuizProviderRepoRoot } = require('../services/goldenSource');
const { resolveTopicName } = require('../utils/topicNameResolver');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

// --- Quiz content (read-only) ---
// List available topics (optionally filtered by category)
router.get('/quiz/topics', async (req, res) => {
  try {
    const { industry_specific } = req.query;
    let industrySpecific = null;
    if (industry_specific !== undefined) {
      industrySpecific = industry_specific === '1' || industry_specific === 'true';
    }
    const topics = await quizContentDb.listTopics(industrySpecific);
    res.json(topics);
  } catch (e) {
    console.error('[GET /api/quiz/topics] Error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// List topics by category (technical vs industry-specific)
router.get('/quiz/topics/by-category', async (req, res) => {
  try {
    const { industry_specific } = req.query;
    const isIndustry = industry_specific === '1' || industry_specific === 'true';
    const topics = await quizContentDb.listTopicsByCategory(isIndustry);
    res.json(topics);
  } catch (e) {
    console.error('[GET /api/quiz/topics/by-category] Error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Local clone-only: enumerate topics from local repo
router.get('/quiz/topics/local', async (_req, res) => {
  try {
    const ensured = ensureQuizProviderRepoAvailable();
    const root = ensured.root || getQuizProviderRepoRoot();
    const list = scanLocalRepo(root) || [];
    res.json({ root, topics: list, ensured: ensured.ok });
  } catch (e) {
    console.error('[GET /api/quiz/topics/local] Error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Validate DB integrity (check for uppercase slugs/names, category mismatches)
router.get('/quiz/topics/validate', async (_req, res) => {
  try {
    const result = await quizContentDb.validateTopicIntegrity();
    res.json(result);
  } catch (e) {
    console.error('[GET /api/quiz/topics/validate] Error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Fix DB integrity issues (auto-fix uppercase slugs/names)
router.post('/quiz/topics/fix-integrity', async (_req, res) => {
  try {
    const result = await quizContentDb.fixTopicIntegrity();
    res.json({ success: true, ...result });
  } catch (e) {
    console.error('[POST /api/quiz/topics/fix-integrity] Error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get topics from quiz_topic table filtered by category (includes all manually marked topics)
router.get('/quiz/topics/by-category-with-files', async (req, res) => {
  const requestId = Date.now();
  try {
    const { industry_specific } = req.query;
    const isIndustry = industry_specific === '1' || industry_specific === 'true';
    const flag = isIndustry ? 1 : 0;
    
    console.log(`[${requestId}] ========================================`);
    console.log(`[${requestId}] [by-category-with-files] -0- REQUEST RECEIVED:`, { 
      industry_specific, 
      isIndustry, 
      flag,
      query: req.query,
      timestamp: new Date().toISOString()
    });
    
    // Get all topics from quiz_topic table with this category
    const queryStart = Date.now();
    const topics = await quizContentDb.all(
      `SELECT slug, name, industry_specific FROM quiz_topic WHERE industry_specific = ? ORDER BY COALESCE(name, slug) ASC`,
      [flag]
    );
    const queryTime = Date.now() - queryStart;
    
    console.log(`[${requestId}] [by-category-with-files] 🗄️  DB QUERY RESULT:`, { 
      flag, 
      queryTime: `${queryTime}ms`,
      count: topics.length,
      sample: topics.slice(0, 5).map(t => ({ 
        slug: t.slug, 
        name: t.name, 
        flag: t.industry_specific,
        flagType: typeof t.industry_specific
      })),
      hasAdobe: topics.some(t => t.slug?.includes('adobe')),
      hasAws: topics.some(t => t.slug?.includes('aws')),
      hasAccounting: topics.some(t => t.slug?.includes('accounting'))
    });
    
    // Get local file paths for these topics
    const ensured = ensureQuizProviderRepoAvailable();
    const root = ensured.root || getQuizProviderRepoRoot();
    const allLocal = scanLocalRepo(root) || [];
    const localBySlug = new Map(allLocal.map(t => [t.topic_slug?.toLowerCase(), t]));
    
    console.log(`[${requestId}] [by-category-with-files] LOCAL FILES:`, {
      localCount: allLocal.length,
      root
    });
    
    // Combine quiz_topic data with local file info
    const result = topics.map(qt => {
      const slug = qt.slug?.toLowerCase();
      const local = localBySlug.get(slug);
      return {
        topic_slug: qt.slug,
        topic_name: (qt.name && qt.name !== 'null') ? qt.name : qt.slug,
        file: local?.file || '',
        cached: !!local
      };
    });
    
    console.log(`[${requestId}] [by-category-with-files] -0- SENDING RESPONSE:`, { 
      flag, 
      resultCount: result.length,
      first3: result.slice(0, 3).map(t => ({ slug: t.topic_slug, name: t.topic_name })),
      hasAdobe: result.some(t => t.topic_slug?.includes('adobe')),
      hasAws: result.some(t => t.topic_slug?.includes('aws')),
      hasAccounting: result.some(t => t.topic_slug?.includes('accounting'))
    });
    console.log(`[${requestId}] ========================================`);
    
    res.json(result);
  } catch (e) {
    console.error(`[${requestId}] [by-category-with-files] -0- ERROR:`, e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all topics for admin management
router.get('/quiz/topics/all', async (_req, res) => {
  try {
    const topics = await quizContentDb.all(
      `SELECT slug, name, industry_specific FROM quiz_topic ORDER BY COALESCE(NULLIF(name, 'null'), slug) ASC`
    );
    res.json(topics.map(t => {
      // Handle null, empty string, or the string "null" (case-insensitive, trimmed)
      const rawName = t.name ? String(t.name).trim() : '';
      const isValidName = rawName && rawName.toLowerCase() !== 'null' && rawName !== '';
      const name = isValidName ? rawName : t.slug;
      return {
        slug: t.slug,
        name: name,
        industry_specific: t.industry_specific === 1
      };
    }));
  } catch (e) {
    console.error('[GET /api/quiz/topics/all] Error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reload all topics from local files (preserves quiz_topic table)
router.post('/quiz/reload-all', async (_req, res) => {
  const startTime = Date.now();
  try {
    let root = getQuizProviderRepoRoot();
    root = process.env.QUIZ_REPO_ROOT == `backend/vendor/quizzes` ? getQuizProviderRepoRoot() : process.env.QUIZ_REPO_ROOT ;
    const allLocal = scanLocalRepo(root) || [];
    
    if (allLocal.length === 0) {
      // const mesg = 'No local topic files found in repo root: ${root}';
      // return res.status(400).json({ message: $mesg});
      return res.status(400).json({ message: `No local topic files found in ${root}` });
    }
    
    const results = [];
    const errors = [];
    
    for (const local of allLocal) {
      try {
        // Get existing category from quiz_topic table
        const existing = await quizContentDb.get(
          `SELECT industry_specific FROM quiz_topic WHERE slug = ?`,
          [local.topic_slug.toLowerCase()]
        );
        
        const industrySpecific = existing?.industry_specific === 1 ? '1' : '0';
        
        // Import topic
        const { spawnSync } = require('child_process');
        const env = Object.assign({}, process.env, {
          LOCAL_FILE: local.file,
          TOPIC_SLUG: local.topic_slug,
          TOPIC_NAME: local.topic_name,
          SOURCE_NAME: 'LinkedIn Skill Assessments (Local Clone)',
          QUIZ_COMMIT: process.env.QUIZ_COMMIT || '6a818e3',
          INDUSTRY_SPECIFIC: industrySpecific
        });
        
        const proc = spawnSync('node', ['scripts/import-bash-quiz.js'], {
          cwd: path.resolve(__dirname, '..'),
          env,
          encoding: 'utf8'
        });
        
        if (proc.status === 0) {
          results.push({ slug: local.topic_slug, success: true });
        } else {
          const errorMsg = proc.stderr || proc.stdout || 'Unknown error';
          console.error(`[reload-all] Import failed for ${local.topic_slug}:`, errorMsg);
          errors.push({ slug: local.topic_slug, error: errorMsg });
        }
      } catch (e) {
        errors.push({ slug: local.topic_slug, error: e.message });
      }
    }
    
    const duration = Date.now() - startTime;
    res.json({
      success: true,
      total: allLocal.length,
      succeeded: results.length,
      failed: errors.length,
      duration: `${duration}ms`,
      results,
      errors
    });
  } catch (e) {
    console.error('[POST /api/quiz/reload-all] Error:', e);
    res.status(500).json({ message: 'Server error', error: e.message });
  }
});

// Bulk update topic categories
router.post('/quiz/topics/bulk-update-category', async (req, res) => {
  try {
    const { updates } = req.body || {};
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ message: 'updates array required' });
    }
    
    await quizContentDb.run('BEGIN');
    const results = [];
    
    try {
      for (const update of updates) {
        const { slug, industry_specific } = update;
        if (!slug || (industry_specific !== 0 && industry_specific !== 1)) {
          results.push({ slug, success: false, error: 'Invalid slug or industry_specific value' });
          continue;
        }
        
        // Update or insert
        await quizContentDb.run(
          `INSERT INTO quiz_topic (slug, name, industry_specific) 
           VALUES (?, ?, ?)
           ON CONFLICT(slug) DO UPDATE SET industry_specific = ?`,
          [slug.toLowerCase(), null, industry_specific, industry_specific]
        );
        
        results.push({ slug, success: true });
      }
      
      await quizContentDb.run('COMMIT');
      res.json({ success: true, updated: results.length, results });
    } catch (e) {
      await quizContentDb.run('ROLLBACK');
      throw e;
    }
  } catch (e) {
    console.error('[POST /api/quiz/topics/bulk-update-category] Error:', e);
    res.status(500).json({ message: 'Server error', error: e.message });
  }
});

// Import a local topic file into content DB
router.post('/quiz/import-local', async (req, res) => {
  try {
    const { topic_slug, topic_name, local_file, industry_specific } = req.body || {};
    if (!local_file || !topic_slug || !topic_name) {
      return res.status(400).json({ message: 'topic_slug, topic_name, local_file required' });
    }
    const { spawnSync } = require('child_process');
    const env = Object.assign({}, process.env, {
      LOCAL_FILE: local_file,
      TOPIC_SLUG: String(topic_slug),
      TOPIC_NAME: String(topic_name),
      SOURCE_NAME: 'LinkedIn Skill Assessments (Local Clone)',
      QUIZ_COMMIT: process.env.QUIZ_COMMIT || '6a818e3',
      INDUSTRY_SPECIFIC: industry_specific === '1' || industry_specific === 1 ? '1' : '0'
    });
    console.log('[import-local] start', { topic_slug, topic_name, local_file, industry_specific });
    const proc = spawnSync('node', ['scripts/import-bash-quiz.js'], { 
      cwd: path.resolve(__dirname, '..'), 
      env, 
      encoding: 'utf8' 
    });
    if (proc.status !== 0) {
      console.error('[import-local] failed', proc.stderr || proc.stdout);
      return res.status(500).json({ message: 'Import failed', output: proc.stdout });
    }
    console.log('[import-local] complete');
    return res.json({ success: true });
  } catch (e) {
    console.error('[POST /api/quiz/import-local] Error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get latest quiz for a topic (slug)
router.get('/quiz/:topicSlug/latest', async (req, res) => {
  try {
    const { topicSlug } = req.params;
    const quiz = await quizContentDb.getLatestQuizForTopicSlug(topicSlug);
    if (!quiz) return res.status(404).json({ message: 'Not found' });
    res.json(quiz);
  } catch (e) {
    console.error('[GET /api/quiz/:topicSlug/latest] Error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get quiz questions with choices
router.get('/quiz/:quizSlug/questions', async (req, res) => {
  try {
    const { quizSlug } = req.params;
    const offset = Math.max(0, parseInt(req.query.offset) || 0);
    const limit = Math.max(1, Math.min(500, parseInt(req.query.limit) || 200));
    const quiz = await quizContentDb.getQuizBySlug(quizSlug);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }
    const questions = await quizContentDb.getQuestionsWithChoices(quiz.id, offset, limit);
    if (!questions) {
      return res.status(404).json({ message: 'Questions not found' });
    }
    res.json({ quiz: await quizContentDb.getQuizMetaWithCounts(quizSlug), questions });
  } catch (e) {
    console.error('[GET /api/quiz/:quizSlug/questions] Error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Stream quiz image assets from vendored quizzes folder
router.get('/quiz-assets/:topic/*', async (req, res) => {
  try {
    const { topic } = req.params;
    const wildcard = req.params[0] || '';
    const subPath = wildcard.startsWith('images/') ? wildcard : path.posix.join('images', wildcard);
    const root = getQuizProviderRepoRoot();
    const absDir = path.resolve(root, topic, 'images');
    const absFile = path.resolve(root, topic, subPath);
    const rel = path.relative(absDir, absFile);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      return res.status(400).json({ message: 'Invalid path' });
    }
    if (!fs.existsSync(absFile)) {
      return res.status(404).json({ message: 'Not found' });
    }
    const stat = fs.statSync(absFile);
    if (!stat.isFile()) {
      return res.status(404).json({ message: 'Not found' });
    }
    const m = mime.lookup(absFile) || 'application/octet-stream';
    res.setHeader('Content-Type', m);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    const stream = fs.createReadStream(absFile);
    stream.on('error', () => res.status(500).end());
    stream.pipe(res);
  } catch (e) {
    console.error('[GET /api/quiz-assets/:topic/*] Error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Random 10 questions (no auth required for quiz app)
router.get('/quiz/:topicSlug/random10', async (req, res) => {
  try {
    const { topicSlug } = req.params;
    let quiz = await quizContentDb.getLatestQuizForTopicSlug(topicSlug);
    if (!quiz) {
      // Auto-import from golden source if available
      try {
        const root = getQuizProviderRepoRoot();
        const localFile = path.join(root, String(topicSlug), `${String(topicSlug)}-quiz.md`);
        if (fs.existsSync(localFile)) {
          const { spawnSync } = require('child_process');
          console.warn('[random10] quiz missing; importing from authoritative source', { topicSlug, localFile });
          // Get topic info from DB to preserve name and industry_specific flag
          const topicInfo = await quizContentDb.getTopicInfo(topicSlug);
          // Resolve topic name using standard utility (enforces data integrity)
          let mdContent = null;
          try {
            mdContent = fs.readFileSync(localFile, 'utf8');
          } catch (e) {
            console.warn('[random10] Could not read markdown file', e);
          }
          const topicName = resolveTopicName({
            slug: topicSlug,
            dbName: topicInfo.name,
            markdownContent: mdContent
          });
          const env = Object.assign({}, process.env, {
            LOCAL_FILE: localFile,
            TOPIC_SLUG: String(topicSlug).toLowerCase(),
            TOPIC_NAME: topicName,
            INDUSTRY_SPECIFIC: topicInfo.industry_specific === 1 ? '1' : '0',
            SOURCE_NAME: 'LinkedIn Skill Assessments (Local Clone)',
            QUIZ_COMMIT: process.env.QUIZ_COMMIT || '6a818e3'
          });
          const proc = spawnSync('node', ['scripts/import-bash-quiz.js'], { 
            cwd: path.resolve(__dirname, '..'), 
            env, 
            encoding: 'utf8' 
          });
          if (proc.status !== 0) {
            console.error('[random10] auto-import failed', proc.stderr || proc.stdout);
          }
          quiz = await quizContentDb.getLatestQuizForTopicSlug(topicSlug);
        }
      } catch (e) {
        console.error('[random10] auto-import error', e);
      }
      if (!quiz) {
        return res.status(404).json({ message: 'Quiz for ' + topicSlug + ' not found' });
      }
    }

    // Get random questions (no user filtering for quiz app)
    let questions = await quizContentDb.getRandomQuestionsWithChoices(quiz.id, 10, []);
    if (!questions || questions.length === 0) {
      // Fallback: first 10 in order
      questions = await quizContentDb.getQuestionsWithChoices(quiz.id, 0, 10);
      if (!questions || questions.length === 0) {
        // Self-heal: attempt re-import
        try {
          const root = getQuizProviderRepoRoot();
          const localFile = path.join(root, String(topicSlug), `${String(topicSlug)}-quiz.md`);
          if (fs.existsSync(localFile)) {
            const { spawnSync } = require('child_process');
            console.warn('[random10] zero questions – re-importing', { topicSlug, localFile });
            // Get topic info from DB to preserve name and industry_specific flag
            const topicInfo = await quizContentDb.getTopicInfo(topicSlug);
            // Resolve topic name using standard utility (enforces data integrity)
            let mdContent = null;
            try {
              mdContent = fs.readFileSync(localFile, 'utf8');
            } catch (e) {
              console.warn('[random10] Could not read markdown file', e);
            }
            const topicName = resolveTopicName({
              slug: topicSlug,
              dbName: topicInfo.name,
              markdownContent: mdContent
            });
            const env = Object.assign({}, process.env, {
              LOCAL_FILE: localFile,
              TOPIC_SLUG: String(topicSlug).toLowerCase(),
              TOPIC_NAME: topicName,
              INDUSTRY_SPECIFIC: topicInfo.industry_specific === 1 ? '1' : '0',
              SOURCE_NAME: 'LinkedIn Skill Assessments (Local Clone)',
              QUIZ_COMMIT: process.env.QUIZ_COMMIT || '6a818e3'
            });
            const proc = spawnSync('node', ['scripts/import-bash-quiz.js'], { 
              cwd: path.resolve(__dirname, '..'), 
              env, 
              encoding: 'utf8' 
            });
            if (proc.status !== 0) {
              console.error('[random10] self-heal import failed', proc.stderr || proc.stdout);
            }
            quiz = await quizContentDb.getLatestQuizForTopicSlug(topicSlug);
            if (quiz && quiz.id) {
              questions = await quizContentDb.getQuestionsWithChoices(quiz.id, 0, 10);
            }
          }
        } catch (e) {
          console.error('[random10] self-heal import error', e);
        }
      }
    }
    res.json({ quiz, questions });
  } catch (e) {
    console.error('[GET /api/quiz/:topicSlug/random10] Error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Quiz session endpoints (no auth required for quiz app)
router.post('/quiz/session/start', async (req, res) => {
  try {
    const { topic_slug, quiz_slug, score_total } = req.body || {};
    if (!topic_slug || !quiz_slug) {
      return res.status(400).json({ message: 'topic_slug and quiz_slug required' });
    }
    // Use a default user_id for quiz app
    const userId = req.body.user_id || 'anonymous';
    const r = await quizResultsDb.run(
      `INSERT INTO quiz_session (user_id, topic_slug, quiz_slug, score_total) VALUES (?, ?, ?, ?)`,
      [String(userId), String(topic_slug), String(quiz_slug), Number(score_total) || 0]
    );
    res.json({ id: r.lastID });
  } catch (e) {
    console.error('[POST /api/quiz/session/start] Error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/quiz/session/:sessionId/answer', async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    const { question_id, selected_choice_ids = [], is_correct = false } = req.body || {};
    if (!sessionId || !question_id) {
      return res.status(400).json({ message: 'sessionId and question_id required' });
    }
    const r = await quizResultsDb.run(
      `INSERT INTO question_response (session_id, question_id, is_correct) VALUES (?, ?, ?)`,
      [sessionId, Number(question_id), is_correct ? 1 : 0]
    );
    const responseId = r.lastID;
    for (const cid of Array.isArray(selected_choice_ids) ? selected_choice_ids : []) {
      await quizResultsDb.run(
        `INSERT INTO response_choice (response_id, choice_id, selected) VALUES (?, ?, 1)`,
        [responseId, Number(cid)]
      );
    }
    res.json({ id: responseId });
  } catch (e) {
    console.error('[POST /api/quiz/session/:sessionId/answer] Error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/quiz/session/:sessionId/complete', async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    const { score_correct, duration_ms } = req.body || {};
    await quizResultsDb.run(
      `UPDATE quiz_session SET score_correct = ?, completed_at = datetime('now'), duration_ms = ? WHERE id = ?`,
      [Number(score_correct) || 0, Number(duration_ms) || null, sessionId]
    );
    res.json({ success: true });
  } catch (e) {
    console.error('[POST /api/quiz/session/:sessionId/complete] Error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user metrics (high scores and completion counts)
router.get('/quiz/metrics', async (req, res) => {
  try {
    const userId = req.query.user_id || 'anonymous';
    
    // Get topic slugs by category
    const technicalSlugs = await quizContentDb.getTopicSlugsByCategory(false);
    const industrySlugs = await quizContentDb.getTopicSlugsByCategory(true);
    
    console.log('[Metrics] Topic slugs:', {
      technical: technicalSlugs.slice(0, 5),
      industry: industrySlugs.slice(0, 5),
      technicalCount: technicalSlugs.length,
      industryCount: industrySlugs.length
    });
    
    // Get high score for technical tests
    let technicalHighScore = 0;
    if (technicalSlugs.length > 0) {
      const placeholders = technicalSlugs.map(() => '?').join(',');
      const technicalSessions = await quizResultsDb.all(
        `SELECT score_correct, score_total, topic_slug
         FROM quiz_session 
         WHERE user_id = ? AND topic_slug IN (${placeholders}) AND completed_at IS NOT NULL AND score_total > 0
         ORDER BY CAST(score_correct AS FLOAT) / score_total DESC
         LIMIT 1`,
        [String(userId), ...technicalSlugs]
      );
      if (technicalSessions.length > 0) {
        const session = technicalSessions[0];
        technicalHighScore = Math.round((session.score_correct / session.score_total) * 100);
        console.log('[Metrics] Technical high score:', {
          score: technicalHighScore,
          topic: session.topic_slug,
          correct: session.score_correct,
          total: session.score_total
        });
      }
    }
    
    // Get high score for industry-specific tests
    let industryHighScore = 0;
    if (industrySlugs.length > 0) {
      const placeholders = industrySlugs.map(() => '?').join(',');
      const industrySessions = await quizResultsDb.all(
        `SELECT score_correct, score_total, topic_slug
         FROM quiz_session 
         WHERE user_id = ? AND topic_slug IN (${placeholders}) AND completed_at IS NOT NULL AND score_total > 0
         ORDER BY CAST(score_correct AS FLOAT) / score_total DESC
         LIMIT 1`,
        [String(userId), ...industrySlugs]
      );
      if (industrySessions.length > 0) {
        const session = industrySessions[0];
        industryHighScore = Math.round((session.score_correct / session.score_total) * 100);
        console.log('[Metrics] Industry high score:', {
          score: industryHighScore,
          topic: session.topic_slug,
          correct: session.score_correct,
          total: session.score_total
        });
      }
    }
    
    const response = {
      technicalHighScore: Number(technicalHighScore),
      industryHighScore: Number(industryHighScore),
      // Behavioral completion count will be tracked client-side in localStorage
    };
    
    console.log('[Metrics] Returning:', response);
    res.json(response);
  } catch (e) {
    console.error('[GET /api/quiz/metrics] Error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

