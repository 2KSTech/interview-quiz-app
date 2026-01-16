const fs = require("fs");
const path = require("path");
const resolveParentPath = require("@stdlib/fs-resolve-parent-path").sync;
const MARKERS = ["package.json", "backend/.env", ".git"];
function getProjectRoot(startDir = process.cwd()) {
  for (const marker of MARKERS) {
    const found = resolveParentPath(marker, { dir: startDir });
    if (found) {
      return path.dirname(found);
    }
  }
  throw new Error(
    "Project root not found. Ensure package.json or backend/.env exists."
  );
}
function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}
function normalizeEnvPath(varName, shouldExist = false, mustBeDir = false) {
  const raw = process.env[varName];
  if (!raw || raw.trim() === "") {
    throw new Error(`Missing required env '${varName}'`);
  }
  let resolved = raw;
  if (!path.isAbsolute(raw)) {
    const mode = (process.env.ENV_PATH_TYPE || "relative").toLowerCase();
    if (mode === "absolute") {
      throw new Error(
        `ENV_PATH_TYPE = absolute but '${varName}' is relative: ${raw}`
      );
    }
    const root = getProjectRoot();
    resolved = path.resolve(root, raw);
  }
  if (mustBeDir) {
    if (shouldExist && !fs.existsSync(resolved)) {
      throw new Error(`Directory not found for ${varName}: ${resolved}`);
    }
    if (!fs.existsSync(resolved)) ensureDir(resolved);
  } else {
      /* ensure parent dir for files*/
      const parent = path.dirname(resolved);
    if (!fs.existsSync(parent)) ensureDir(parent);
    if (shouldExist && !fs.existsSync(resolved)) {
      throw new Error(`File not found for ${varName}: ${resolved})`);
    }
  }
  return resolved;
}
module.exports = {
  getProjectRoot,
  getQuizRepoRoot: () => normalizeEnvPath("QUIZ_REPO_ROOT", false, true),
  getQuizRepoTarball: () => normalizeEnvPath("QUIZ_REPO_TARBALL", false, false),
  getQuizDbPath: () => normalizeEnvPath("QUIZ_DB_PATH", false, false),
  getResultsDbPath: () => normalizeEnvPath("RESULTS_DB_PATH", false, false),
  getLogFile: () => normalizeEnvPath("LOG_FILE", false, false),
  resolveFromRoot: (rel) => path.resolve(getProjectRoot(), rel),
};
