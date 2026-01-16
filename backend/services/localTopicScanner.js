const fs = require('fs');
const path = require('path');
const { slugToName } = require('../utils/topicNameResolver');

/**
 * Scan a locally cloned quizzes repo for topics.
 * Expected structure: <repoRoot>/<topic>/<topic>-quiz.md
 */
function scanLocalRepo(repoRoot) {
  const results = [];
  if (!repoRoot || !fs.existsSync(repoRoot)) return results;
  const entries = fs.readdirSync(repoRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const topic = entry.name;
    const mdFile = path.join(repoRoot, topic, `${topic}-quiz.md`);
    if (fs.existsSync(mdFile)) {
      results.push({
        topic_slug: topic.toLowerCase(),
        topic_name: slugToName(topic), // Use standard utility for consistency
        file: mdFile
      });
    }
  }
  return results;
}

module.exports = { scanLocalRepo };



