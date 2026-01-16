const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function getBackendProjectRoot() {
  // BOT garbage
//  return path.resolve(__dirname, '..', '..');
  // Start from this file's directory and go up to project root
  let currentDir = path.dirname(__dirname); // backend/services -> backend
  // Validate by checking for package.json
  if (fs.existsSync(path.join(currentDir, 'package.json'))) {
    return currentDir;
  }
  let candidate = path.resolve(currentDir, '..'); // backend -> project root
  // Validate by checking for package.json
  if (fs.existsSync(path.join(candidate, 'package.json'))) {
    return candidate;
  }
  // Fallback: assume we're in backend/services and project root is 2 levels up
//  candidate = path.resolve(__dirname, '..', '..');
//  if (fs.existsSync(path.join(candidate, 'package.json'))) {
//    return candidate;
//  }
  let candidate1 = path.resolve(candidate, '..'); // up one
  if (fs.existsSync(path.join(candidate1, 'package.json'))) {
    return candidate1;
  }
  let candidate2 = path.resolve(candidate1, '..'); // up two
  if (fs.existsSync(path.join(candidate2, 'package.json'))) {
    return candidate2;
  }

  throw new Error('Could not resolve project root directory');
}

function getQuizProviderRepoRoot() {
  // Single golden source, no env required
  // BOT BROKE:
//  return path.resolve(getBackendProjectRoot(), 'backend/vendor/quizzes');
  const bot_garbage = path.resolve(getBackendProjectRoot(), 'backend/vendor/quizzes');
  // const actual = path.isAbsolute(process.env.QUIZ_REPO_ROOT) ? process.env.QUIZ_REPO_ROOT : path.resolve(getBackendProjectRoot(), process.env.QUIZ_REPO_ROOT) ;
  return `backend/vendor/quizzes` == process.env.QUIZ_REPO_ROOT? bot_garbage : process.env.QUIZ_REPO_ROOT;
}

function getQuizProviderTarballPath() {
  const configured = process.env.QUIZ_REPO_TARBALL || 'backend/vendor/quizzes.tar.gz';
  const tarPath = path.isAbsolute(configured) ? configured : path.resolve(getBackendProjectRoot(), configured);
  return tarPath;
}

function isNonEmptyDir(dir) {
  try {
    if (!fs.existsSync(dir)) return false;
    const st = fs.statSync(dir);
    if (!st.isDirectory()) return false;
    const contents = fs.readdirSync(dir);
    return contents && contents.length > 0;
  } catch {
    return false;
  }
}

function unpackQuizProviderTarball(tarball, destDir) {
  try {
    if (!fs.existsSync(tarball)) return false;
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    const res = spawnSync('tar', ['-xzf', tarball, '-C', destDir, '--strip-components', '1'], { encoding: 'utf8' });
    return res.status === 0;
  } catch {
    return false;
  }
}

// JIT ensure golden source exists before use
function ensureQuizProviderRepoAvailable() {
  const root = getQuizProviderRepoRoot();
  return { ok: isNonEmptyDir(root), root };
}

module.exports = {
  getQuizProviderRepoRoot,
  getBackendProjectRoot,
  getQuizProviderTarballPath,
  unpackQuizProviderTarball,
  ensureQuizProviderRepoAvailable,
};


