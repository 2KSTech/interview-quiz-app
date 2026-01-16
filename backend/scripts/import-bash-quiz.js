/*
Import Bash quiz content (pinned commit) into backend/quizdb.sqlite

Source: https://github.com/Ebazhanov/linkedin-skill-assessments-quizzes
File: bash/bash-quiz.md at commit 6a818e3
*/

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const database = require('../services/database');
const { resolveTopicNameForImport } = require('../utils/topicNameResolver');
const appPathResolver = require('../services/appPathResolver');

const PINNED_COMMIT = process.env.QUIZ_COMMIT || '6a818e3';
const REPO_OWNER = process.env.REPO_OWNER || 'Ebazhanov';
const REPO_NAME = process.env.REPO_NAME || 'linkedin-skill-assessments-quizzes';
// LOCAL_FILE is required - no hardcoded fallback paths
const LOCAL_FILE = process.env.LOCAL_FILE;
const RAW_URL = LOCAL_FILE ? null : `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${PINNED_COMMIT}/${process.env.FILE_PATH || 'bash/bash-quiz.md'}`;

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

// Schema is now handled by the centralized database module

function parseMarkdown(md) {
  // Normalize line endings
  const text = md.replace(/\r\n?/g, '\n');

  // Extract topic from first '## <Topic>'
  const topicMatch = text.match(/^##\s+(.+)$/m);
  const topic = (process.env.TOPIC_NAME || (topicMatch ? topicMatch[1].trim() : 'Bash'));

  // Split into question blocks by heading variations like '#### Qn. Title', '### Qn. Title', or '#### Qn Title'
  // Support 3-6 leading hashes, optional dot after the number, and flexible spacing before the title
  const questionRegex = /^#{3,6}\s+Q(\d+)\.?\s+(.+)$/gm;
  const blocks = [];
  let match;
  while ((match = questionRegex.exec(text)) !== null) {
    const number = parseInt(match[1], 10);
    const title = match[2].trim();
    const start = match.index + match[0].length;
    const nextIndex = (() => {
      const next = questionRegex.exec(text);
      if (next) {
        // reset regex to allow subsequent loop to continue from next
        questionRegex.lastIndex = next.index;
        return next.index;
      }
      return text.length;
    })();
    const body = text.slice(start, nextIndex).trim();
    // restore lastIndex for outer while loop continuation
    questionRegex.lastIndex = nextIndex;
    blocks.push({ number, title, body });
  }

  // Helper to extract first fenced code block
  const codeBlockRegex = /```([a-zA-Z0-9_-]+)?\n([\s\S]*?)\n```/m;
  // Answers: lines starting with - [ ] or - [x]
  const choiceLineRegex = /^- \[( |x)\]\s+(.*)$/gm;
  // Reference line
  const refRegex = /^\[reference\]\(([^)]+)\)/mi;
  // Image markdown line
  const imageLineRegex = /^!\[[^\]]*\]\([^\)]+\)\s*$/m;

  const questions = blocks.map((b, idx) => {
    let code_language = null;
    let code_md = null;
    const codeMatch = b.body.match(codeBlockRegex);
    if (codeMatch) {
      code_language = (codeMatch[1] || '').trim() || null;
      code_md = '```' + (code_language || '') + '\n' + codeMatch[2] + '\n```';
    }

    const choices = [];
    let cm;
    while ((cm = choiceLineRegex.exec(b.body)) !== null) {
      const isx = cm[1] === 'x' ? 1 : 0;
      const label = cm[2].trim();
      choices.push({ is_correct: isx, label_md: label });
    }

    // Explanation and reference
    let reference_url = null;
    let explanation_md = null;
    const refMatch = b.body.match(refRegex);
    if (refMatch) {
      reference_url = refMatch[1].trim();
      const afterRef = b.body.slice(b.body.indexOf(refMatch[0]) + refMatch[0].length).trim();
      explanation_md = afterRef || null;
    }

    // Build prompt_md from title + any image lines appearing before first choice/code/reference (skip blank lines)
    let prompt_md = b.title;
    const lines = b.body.split('\n');
    const images = [];
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const ln = raw.trim();
      if (!ln) continue;
      if (/^- \[/.test(ln) || ln.startsWith('```') || /^\[reference\]\(/i.test(ln)) break;
      if (imageLineRegex.test(ln)) images.push(ln);
    }
    if (images.length > 0) {
      prompt_md = `${b.title}\n\n${images.join('\n')}`;
    }

    return {
      number_in_source: b.number,
      question_type: 'single',
      prompt_md,
      code_md,
      code_language,
      explanation_md,
      reference_url,
      position: idx + 1,
      choices,
    };
  });

  return { topic, questions };
}

async function main() {
  let md;
  
  // Prefer LOCAL_FILE (set by API routes) - no hardcoded paths
  if (LOCAL_FILE) {
    const tryPaths = [];
    if (path.isAbsolute(LOCAL_FILE)) {
      tryPaths.push(LOCAL_FILE);
    } else {
      // 1) As given (relative to current cwd)
      tryPaths.push(LOCAL_FILE);
      // 2) Relative to backend directory
      tryPaths.push(path.resolve(__dirname, '..', LOCAL_FILE));
      // 3) Relative to project root
      tryPaths.push(path.resolve(__dirname, '..', '..', LOCAL_FILE));
    }
    let found = null;
    for (const p of tryPaths) { 
      if (fs.existsSync(p)) { 
        found = p; 
        break; 
      } 
    }
    if (!found) {
      throw new Error(`LOCAL_FILE not found at any of: ${tryPaths.join(' | ')}`);
    }
    console.log(`Reading local quiz file: ${found}`);
    md = fs.readFileSync(found, 'utf8');
  } else if (RAW_URL) {
    // Fallback: fetch from GitHub (requires axios)
    console.log(`Fetching quiz markdown from ${RAW_URL}`);
    const resp = await axios.get(RAW_URL, { responseType: 'text' });
    md = resp.data;
  } else {
    throw new Error('Either LOCAL_FILE environment variable or FILE_PATH must be set');
  }
  
  if (!md) {
    throw new Error('No markdown content found');
  }
  // if (!md) {
  //   console.error('No markdown found in loaded local file', found);
  //   throw new Error('No markdown found');
  // }
  // const hash = sha256(md);
  const hash = sha256(md);

  // Ensure directory exists (use centralized database path resolution)
  const dbPath = appPathResolver.getQuizDbPath();
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  // Recreate static DB only if explicitly requested
  if (process.env.RECREATE_DB === '1' && fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }

  try {
    // Initialize database schema
    await database.initializeSchema('quiz');

    // Upsert source
    const sourceName = process.env.SOURCE_NAME || 'LinkedIn Skill Assessments (Community)';
    const repoUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}`;
    const sourceUrl = repoUrl;
    const license = process.env.LICENSE_SPDX || 'CC-BY-SA-4.0';
    const attribution = `${sourceName} – ${repoUrl} (commit ${PINNED_COMMIT})`;

    await database.run('quiz', `INSERT OR IGNORE INTO source (name, repo_url, source_url, license_spdx, attribution, commit_sha)
                   VALUES (?, ?, ?, ?, ?, ?)`,
      [sourceName, repoUrl, sourceUrl, license, attribution, PINNED_COMMIT]
    );
    const source = await database.get('quiz', `SELECT * FROM source WHERE name = ?`, [sourceName]);

    // Create import batch
    const filePath = LOCAL_FILE || (process.env.FILE_PATH || 'unknown');
    await database.run('quiz', `INSERT INTO import_batch (source_id, fetched_at, parser_version, raw_hash, notes)
                  VALUES (?, datetime('now'), ?, ?, ?)`,
      [source.id, 'v1', hash, `Imported ${filePath} at ${PINNED_COMMIT}`]
    );
    const batch = await database.get('quiz', `SELECT last_insert_rowid() AS id`);

    // Ensure topic
    const topicSlug = (process.env.TOPIC_SLUG || 'bash').toLowerCase();
    if (!topicSlug || topicSlug === 'null') {
      throw new Error('Invalid topic slug: ' + topicSlug);
    }

    // Get existing name from database if topic exists
    const existingTopic = await database.get('quiz', `SELECT name FROM quiz_topic WHERE slug = ?`, [topicSlug]);
    const dbName = existingTopic?.name || null;

    // Resolve topic name using standard utility (enforces data integrity)
    // filePath already declared above
    const topicName = resolveTopicNameForImport({
      slug: topicSlug,
      markdownFilePath: filePath,
      providedName: process.env.TOPIC_NAME || null,
      dbName: dbName
    });

    await database.run('quiz', `INSERT OR IGNORE INTO topic (slug, name) VALUES (?, ?)`, [topicSlug, topicName]);
    // Update slug if it was null (fix any existing bad data)
    await database.run('quiz', `UPDATE topic SET slug = ? WHERE slug IS NULL AND name = ?`, [topicSlug, topicName]);
    const topic = await database.get('quiz', `SELECT * FROM topic WHERE slug = ?`, [topicSlug]);
    // Set industry flag if requested
    if (process.env.INDUSTRY_SPECIFIC === '1') {
      await database.run('quiz', `UPDATE topic SET industry_specific = 1 WHERE slug = ?`, [topicSlug]);
    }

    // Ensure quiz_topic entry exists (create or update)
    // Preserve existing name and industry_specific if already set correctly
    const isIndustrySpecific = process.env.INDUSTRY_SPECIFIC === '1' ? 1 : 0;

    // Check if entry already exists
    const existing = await database.get('quiz', `SELECT name, industry_specific FROM quiz_topic WHERE slug = ?`, [topicSlug]);

    if (existing) {
      // Entry exists - only update if name is actually missing
      const existingName = existing.name;
      const needsNameUpdate = !existingName || existingName === 'null' || existingName === '';

      // Preserve industry_specific if already set to 1 (don't downgrade from industry to technical)
      const updateIndustry = (existing.industry_specific === 1) ? 1 : isIndustrySpecific;

      if (needsNameUpdate) {
        // Only update if name is missing
        await database.run('quiz', `
          UPDATE quiz_topic
          SET name = ?, industry_specific = ?
          WHERE slug = ?
        `, [topicName, updateIndustry, topicSlug]);
      } else if (updateIndustry !== existing.industry_specific) {
        // Only update industry_specific if it changed
        await database.run('quiz', `
          UPDATE quiz_topic
          SET industry_specific = ?
          WHERE slug = ?
        `, [updateIndustry, topicSlug]);
      }
      // If nothing changed, don't run UPDATE at all
    } else {
      // New entry - insert with extracted/proper name, not uppercased slug
      await database.run('quiz', `
        INSERT INTO quiz_topic (slug, name, industry_specific)
        VALUES (?, ?, ?)
      `, [topicSlug, topicName, isIndustrySpecific]);
    }

    // Create quiz
    const capitalized = topicSlug.charAt(0).toUpperCase() + topicSlug.slice(1);
    const quizTitle = `${capitalized} Quiz (${PINNED_COMMIT})`;
    await database.run('quiz', `INSERT OR IGNORE INTO quiz (topic_id, source_id, import_batch_id, title, slug)
                  VALUES (?, ?, ?, ?, ?)`, [topic.id, source.id, batch.id, quizTitle, topicSlug]);

    const quiz = await database.get('quiz', `SELECT * FROM quiz WHERE slug like ?`, [topicSlug + '%']);
    if (!quiz) {
      console.error('[import-bash-quiz] Quiz not found for slug', topicSlug);
      throw new Error('[import-bash-quiz] Quiz not found for slug ' + topicSlug);
    } else {
      console.log('[import-bash-quiz] Quiz found for slug', topicSlug, quiz);
    }

    // Parse markdown
    const { topic: parsedTopic, questions } = parseMarkdown(md);

    // Insert questions and choices (guard against zero)
    if (!questions || questions.length === 0) {
      throw new Error('[importer] zero questions parsed for ' + topicSlug);
    }

    console.log('[import-bash-quiz] Inserting questions', questions);

    // Insert questions
    await database.run('quiz', 'BEGIN');
    for (const q of questions) {
      // Make external UID topic-scoped to avoid collisions across topics
      const externalUid = `${topicSlug}#Q${q.number_in_source}@${PINNED_COMMIT}`;

      console.log('[import-bash-quiz] Storing question', q);
      if (q.number_in_source === 1) {
        console.error('[import-bash-quiz] Storing question', q.prompt_md);
      }

      const question_type = q.question_type === null || q.question_type.trim().length === 0 ? 'single' : q.question_type;
      console.error('[import-bash-quiz] Question type', question_type);

      const debug_check_insert =
      // Use INSERT OR REPLACE to handle existing questions (by external_uid)
      await database.run('quiz', `INSERT OR REPLACE INTO question (quiz_id, external_uid, number_in_source, question_type, prompt_md, code_md, code_language, explanation_md, difficulty, reference_url, position)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
        [quiz.id, externalUid, q.number_in_source, question_type, q.prompt_md, q.code_md, q.code_language, q.explanation_md, q.reference_url, q.position]);
      console.error('[import-bash-quiz] Debug check insert', debug_check_insert);

      if (debug_check_insert.changes === 0) {
        console.error('[import-bash-quiz] Question not inserted for external UID', externalUid);
        throw new Error('[import-bash-quiz] Question not inserted for external UID ' + externalUid);
      } else {
        console.log('[import-bash-quiz] Question inserted for external UID', externalUid);
        const questionRow = await database.get('quiz', `SELECT id FROM question WHERE external_uid = ?`, [externalUid]);
        if (!questionRow) {
          console.error('[import-bash-quiz] Question not found for external UID', externalUid);
          throw new Error('[import-bash-quiz] Question not found for external UID ' + externalUid);
        } else {
          console.log('[import-bash-quiz] Question found for external UID', externalUid, questionRow);
          // Delete existing choices before inserting new ones (in case question was replaced)
          await database.run('quiz', `DELETE FROM choice WHERE question_id = ?`, [questionRow.id]);
          let pos = 1;
          for (const choice of q.choices) {
            await database.run('quiz', `INSERT INTO choice (question_id, label_md, is_correct, position)
                          VALUES (?, ?, ?, ?)`, [questionRow.id, choice.label_md, choice.is_correct, pos++]);
          }
        }
      }
    }
    await database.run('quiz', 'COMMIT');

    console.log(`Imported ${questions.length} questions into quiz '${quizTitle}'`);
  } catch (err) {
    console.error('Import failed:', err);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

// Export parseMarkdown for unit testing
module.exports = {
  parseMarkdown,
};


