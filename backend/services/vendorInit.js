const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const sqlite3 = require('sqlite3').verbose();
const { scanLocalRepo } = require('./localTopicScanner');
const database = require('../services/database');
const appPathResolver = require('./appPathResolver');

//
// this script is a perfect example of the stupidity of BOTS-- even a high school student could have done a better job w simple path construction
// this sloppy scheme only works for 1 dir structure!  
// I'm not even sure why a DB path needs to be constructed repeatedly - if the DB obj is proper!  DOH!
// the other 'vendor' stuff speaks for itself.  that whole import was written by a poetry BOT, no doubt.
//
// NONE of these awful Cursor BOTS can be trusted to do this basic stuff properly, or even detect when it is rubbish, ruining the entire app!
//

// Use centralized appPathResolver for repo and tarball paths
function resolveRepoRoot() {
  return appPathResolver.getQuizRepoRoot();
}

function resolveTarballPath() {
  return appPathResolver.getQuizRepoTarball();
}

function pathExistsNonEmptyDir(dir) {
  try {
    if (!fs.existsSync(dir)) return false;
    const stat = fs.statSync(dir);
    if (!stat.isDirectory()) return false;
    const entries = fs.readdirSync(dir);
    return entries && entries.length > 0;
  } catch { return false; }
}

function unpackQuizProviderTarball(tarball, destDir) {
  try {
    if (!fs.existsSync(tarball)) return { ok: false, reason: 'tarball_missing' };
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    const result = spawnSync('tar', ['-xzf', tarball, '-C', destDir, '--strip-components', '1'], { encoding: 'utf8' });
    if (result.status !== 0) {
      return { ok: false, reason: 'tar_failed', output: (result.stderr || result.stdout) };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'exception', error: e.message };
  }
}

function countTopicsInContentDb() {
  return new Promise(async (resolve) => {
    try {
      // Use centralized database path resolution (env-driven via appPathResolver)
      const dbPath = appPathResolver.getQuizDbPath();
      if (!fs.existsSync(dbPath)) return resolve(0);

      await database.initializeSchema('quiz');
      const count = await database.get('quiz', `SELECT COUNT(*) as c FROM topic`);
      resolve(count?.c || 0);
    } catch (err) {
      console.warn('[countTopicsInContentDb] Error:', err.message);
      resolve(0);
    }
  });
}

async function preseedIfEmpty(repoRoot) {
  const count = await countTopicsInContentDb();
  if (count > 0) return { seeded: false, reason: 'already_seeded' };

  // Import up to 2 default topics if present: bash and aws
  const candidates = [
    { slug: 'bash', name: 'Bash', file: path.join(repoRoot, 'bash', 'bash-quiz.md'), industry: false },
    { slug: 'aws', name: 'AWS', file: path.join(repoRoot, 'aws', 'aws-quiz.md'), industry: true },
  ];

  let imported = 0;
  for (const c of candidates) {
    if (fs.existsSync(c.file)) {
      try {
        const env = Object.assign({}, process.env, {
          LOCAL_FILE: c.file,
          TOPIC_SLUG: c.slug,
          TOPIC_NAME: c.name,
          SOURCE_NAME: 'LinkedIn Skill Assessments (Vendored Snapshot)',
          INDUSTRY_SPECIFIC: c.industry ? '1' : '0',
          QUIZ_COMMIT: process.env.QUIZ_COMMIT || '6a818e3'
        });

        const proc = spawnSync('node', ['scripts/import-bash-quiz.js'], {
          cwd: path.resolve(__dirname, '..'),
          env,
          encoding: 'utf8',
          stdio: 'pipe' // Prevent stdout pollution
        });

        if (proc.status !== 0) {
          console.error(`[vendorInit] Import failed for ${c.slug}:`, proc.stderr || proc.stdout);
        } else {
          imported++;
          console.log(`[vendorInit] Successfully imported ${c.slug}`);
        }
      } catch (error) {
        console.error(`[vendorInit] Exception importing ${c.slug}:`, error.message);
      }
    } else {
      console.log(`[vendorInit] Skipping ${c.slug} - file not found: ${c.file}`);
    }
  }

  return { seeded: true, imported };
}

async function initOnce() {
  const repoRoot = resolveRepoRoot();
  // Ensure repo is available
  if (!pathExistsNonEmptyDir(repoRoot)) {
    const tarPath = resolveTarballPath();
    const unpack = unpackQuizProviderTarball(tarPath, repoRoot);
    if (!unpack.ok) {
      console.warn('[vendorInit] No local quizzes repo and tarball unavailable or failed to unpack:', unpack.reason);
      return { ok: false, reason: 'unavailable' };
    }
  }
  // Quick scan to confirm structure
  const topics = scanLocalRepo(repoRoot);
  if (!topics || topics.length === 0) {
    console.warn('[vendorInit] Local repo found but no topics discovered at', repoRoot);
    return { ok: false, reason: 'no_topics' };
  }
  // Preseed DB if empty
  await preseedIfEmpty(repoRoot);
  return { ok: true, repoRoot };
}

module.exports = { initOnce };



