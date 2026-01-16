const { parseCsv, toObjects } = require('../utils/csv');
const database = require('./database');

class QuizContentDb {
  constructor() {
    this.initialized = false;
  }

  async connect() {
    if (!this.initialized) {
      await database.initializeSchema('quiz');
      this.initialized = true;
    }
    return database.getConnection('quiz');
  }

  close() {
    database.close('quiz');
    this.initialized = false;
  }

  async all(sql, params = []) {
    await this.connect();
    return database.all('quiz', sql, params);
  }

  async get(sql, params = []) {
    await this.connect();
    return database.get('quiz', sql, params);
  }

  async run(sql, params = []) {
    await this.connect();
    return database.run('quiz', sql, params);
  }

  async listTopics(industrySpecific = null) {
    // console.log('[quizContentDb.js - listTopics] listing topics on db',QUIZ_DB_PATH);
    console.log('[quizContentDb.js - listTopics] listing topics on db');
    // Join with quiz_topic to get industry_specific flag, defaulting to 0 (technical) if not found
    // If industrySpecific is specified (true/false), filter by that category
    // Filter out topics with null slugs
    let whereClause = 'WHERE t.slug IS NOT NULL';
    if (industrySpecific === true) {
      whereClause += ' AND COALESCE(qt.industry_specific, 0) = 1';
    } else if (industrySpecific === false) {
      whereClause += ' AND COALESCE(qt.industry_specific, 0) = 0';
    }
    return await this.all(`
      SELECT t.slug, t.name, t.description, 
             COALESCE(qt.industry_specific, 0) as industry_specific
      FROM topic t
      LEFT JOIN quiz_topic qt ON qt.slug = t.slug
      ${whereClause}
      ORDER BY t.name ASC
    `);
  }

  async getLatestQuizForTopicSlug(topicSlug) {
    console.log('[getLatestQuizForTopicSlug] getting latest quiz from quiz table for topic slug', topicSlug);
    // Choose most recent by created_at, then id desc
    const debug_check = await this.get(`SELECT * FROM quiz WHERE slug = ?`, [topicSlug]);
    console.log('[getLatestQuizForTopicSlug] debug_check', debug_check);
    // return await this.get(
    //   `SELECT q.* FROM quiz q
    //    JOIN topic t ON t.id = q.topic_id
    //    WHERE t.slug = ?
    //    ORDER BY q.created_at DESC, q.id DESC
    //    LIMIT 1`,
    //   [topicSlug]
    // );
    return debug_check;
  }

  async getQuizBySlug(quizSlug) {
    console.log('[getQuizBySlug] getting quiz from quiz table for quiz slug', quizSlug);
    // return await this.get(`SELECT * FROM quiz WHERE substr(slug, 1, length(?)) = ?`, [quizSlug]);
    // const debug_quiz = await this.get(`SELECT * FROM quiz WHERE substr(slug, 1, length(?)) = ?`, [quizSlug]);
    const debug_quiz = await this.get(`SELECT * FROM quiz WHERE slug = ?`, [quizSlug]);
    if (!debug_quiz) {
      console.error('[getQuizBySlug] QUIZ not found as',quizSlug,' trying wildcard...');
      const wildcard = quizSlug + '%';
      return await this.get(`SELECT * FROM quiz WHERE slug like ?`, [wildcard]);
    }
    console.log('[getQuizBySlug] debug_quiz', debug_quiz);
    return debug_quiz;
  }

  async getQuizMetaWithCounts(quizSlug) {
    console.log('[getQuizMetaWithCounts] getting quiz meta with counts from quiz table for quiz slug', quizSlug);
    const quiz = await this.getQuizBySlug(quizSlug);
    if (!quiz) return null;
    const counts = await this.get(`SELECT COUNT(*) as question_count FROM question WHERE quiz_id = ?`, [quiz.id]);
    return Object.assign({}, quiz, counts || { question_count: 0 });
  }

  async getQuestionsWithChoices(quizId, offset = 0, limit = 1000) {
    console.log('[getQuestionsWithChoices] getting questions with choices from question table for quiz id', quizId);
    const questions = await this.all(
      `SELECT id, external_uid, number_in_source, question_type, prompt_md, code_md, code_language, explanation_md, difficulty, reference_url, position
       FROM question
       WHERE quiz_id = ? AND active = 1
       ORDER BY position ASC
       LIMIT ? OFFSET ?`,
      [quizId, limit, offset]
    );
    const ids = questions.map(q => q.id);
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    const choices = await this.all(
      `SELECT id, question_id, label_md, is_correct, position
       FROM choice
       WHERE question_id IN (${placeholders})
       ORDER BY question_id ASC, position ASC`,
      ids
    );
    const byQ = new Map();
    for (const q of questions) byQ.set(q.id, []);
    for (const c of choices) {
      const arr = byQ.get(c.question_id) || [];
      arr.push({ id: c.id, label_md: c.label_md, is_correct: !!c.is_correct, position: c.position });
      byQ.set(c.question_id, arr);
    }
    return questions.map(q => ({
      id: q.id,
      external_uid: q.external_uid,
      number_in_source: q.number_in_source,
      question_type: q.question_type,
      prompt_md: q.prompt_md,
      code_md: q.code_md,
      code_language: q.code_language,
      explanation_md: q.explanation_md,
      difficulty: q.difficulty,
      reference_url: q.reference_url,
      position: q.position,
      choices: byQ.get(q.id) || []
    }));
  }

  async getRandomQuestionsWithChoices(quizId, limit = 10, excludeIds = []) {
    console.log('[getRandomQuestionsWithChoices] getting random questions with choices from question table for quiz id', quizId);
    // Build exclusion clause
    const excludeList = Array.isArray(excludeIds) && excludeIds.length > 0 ? excludeIds.map(() => '?').join(',') : null;

    // First try excluding recently answered
    let questions = await this.all(
      `SELECT id, external_uid, number_in_source, question_type, prompt_md, code_md, code_language, explanation_md, difficulty, reference_url, position
       FROM question
       WHERE quiz_id = ? AND active = 1 ${excludeList ? `AND id NOT IN (${excludeList})` : ''}
       ORDER BY RANDOM()
       LIMIT ?`,
      excludeList ? [quizId, ...excludeIds, limit] : [quizId, limit]
    );

    // If not enough, fill remaining ignoring exclusion
    if (questions.length < limit) {
      const remaining = limit - questions.length;
      const pickedIds = new Set(questions.map(q => q.id));
      const fillers = await this.all(
        `SELECT id, external_uid, number_in_source, question_type, prompt_md, code_md, code_language, explanation_md, difficulty, reference_url, position
         FROM question
         WHERE quiz_id = ? AND active = 1
         ORDER BY RANDOM()
         LIMIT ?`,
        [quizId, remaining]
      );
      for (const f of fillers) {
        if (!pickedIds.has(f.id)) questions.push(f);
      }
    }

    // Fetch choices for selected questions
    const ids = questions.map(q => q.id);
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    const choices = await this.all(
      `SELECT id, question_id, label_md, is_correct, position
       FROM choice
       WHERE question_id IN (${placeholders})
       ORDER BY question_id ASC, position ASC`,
      ids
    );
    const byQ = new Map();
    for (const q of questions) byQ.set(q.id, []);
    for (const c of choices) {
      const arr = byQ.get(c.question_id) || [];
      arr.push({ id: c.id, label_md: c.label_md, is_correct: !!c.is_correct, position: c.position });
      byQ.set(c.question_id, arr);
    }
    return questions.map(q => ({
      id: q.id,
      external_uid: q.external_uid,
      number_in_source: q.number_in_source,
      question_type: q.question_type,
      prompt_md: q.prompt_md,
      code_md: q.code_md,
      code_language: q.code_language,
      explanation_md: q.explanation_md,
      difficulty: q.difficulty,
      reference_url: q.reference_url,
      position: q.position,
      choices: byQ.get(q.id) || []
    }));
  }

  // Quiz topic management methods
  async getTopicCategory(slug) {
    const row = await this.get(
      `SELECT industry_specific FROM quiz_topic WHERE slug = ?`,
      [slug]
    );
    // Default to technical (0) if no entry exists
    return row ? (row.industry_specific === 1) : false;
  }

  async getTopicInfo(slug) {
    // Get topic info from quiz_topic table, or fallback to topic table
    const row = await this.get(
      `SELECT slug, name, industry_specific FROM quiz_topic WHERE slug = ?`,
      [slug]
    );
    if (row) {
      return {
        slug: row.slug,
        name: row.name || slug,
        industry_specific: row.industry_specific === 1 ? 1 : 0
      };
    }
    // Fallback to topic table
    const topicRow = await this.get(
      `SELECT slug, name, industry_specific FROM topic WHERE slug = ?`,
      [slug]
    );
    if (topicRow) {
      return {
        slug: topicRow.slug,
        name: topicRow.name || slug,
        industry_specific: topicRow.industry_specific === 1 ? 1 : 0
      };
    }
    // Default if not found
    return {
      slug: slug,
      name: slug, // Will be extracted from markdown if available
      industry_specific: 0
    };
  }

  async updateTopicSlug(topicName, slug) {
    // Update slug if topic exists, otherwise create entry with default industry_specific=0
    await this.run(
      `INSERT INTO quiz_topic (slug, name, industry_specific) 
       VALUES (?, ?, 0)
       ON CONFLICT(slug) DO UPDATE SET name = ?`,
      [slug, topicName, topicName]
    );
  }

  async listTopicsByCategory(industrySpecific = false) {
    const flag = industrySpecific ? 1 : 0;
    // Join with topic table to get actual topics that exist, with quiz_topic providing the category
    // This ensures we only return topics that have quizzes, and they're properly categorized
    // Filter out topics with null slugs and handle null/empty names
    const rows = await this.all(
      `SELECT t.slug, 
              CASE 
                WHEN qt.name IS NOT NULL AND qt.name != '' AND qt.name != 'null' THEN qt.name
                WHEN t.name IS NOT NULL AND t.name != '' AND t.name != 'null' THEN t.name
                ELSE t.slug
              END as name,
              t.description,
              COALESCE(qt.industry_specific, 0) as industry_specific
       FROM topic t
       LEFT JOIN quiz_topic qt ON qt.slug = t.slug
       WHERE t.slug IS NOT NULL AND COALESCE(qt.industry_specific, 0) = ?
       ORDER BY name ASC`,
      [flag]
    );
    // Ensure name is never null or 'null' string
    return rows.map(row => ({
      ...row,
      name: row.name && row.name !== 'null' ? row.name : row.slug
    }));
  }

  // Get topic slugs by category for metrics aggregation
  // Returns array of topic slugs that belong to the specified category
  async getTopicSlugsByCategory(industrySpecific = false) {
    const flag = industrySpecific ? 1 : 0;
    const rows = await this.all(
      `SELECT t.slug
       FROM topic t
       LEFT JOIN quiz_topic qt ON qt.slug = t.slug
       WHERE t.slug IS NOT NULL AND COALESCE(qt.industry_specific, 0) = ?`,
      [flag]
    );
    return rows.map(r => r.slug).filter(Boolean);
  }

  async getAllQuizTopics() {
    return await this.all(
      `SELECT slug, name, industry_specific 
       FROM quiz_topic 
       ORDER BY name ASC`
    );
  }

  async exportQuizTopicsToCsv(outputPath) {
    const topics = await this.getAllQuizTopics();
    // Export format: name,slug,industry_specific
    const header = ['slug', 'name', 'industry_specific'];
    const lines = [header.join(',')];
    
    for (const topic of topics) {
      const name = `"${String(topic.name).replace(/"/g, '""')}"`;
      const slug = topic.slug ? `"${String(topic.slug).replace(/"/g, '""')}"` : '';
      lines.push(`${name},${slug},${topic.industry_specific}`);
    }
    
    fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
    return { count: topics.length, path: outputPath };
  }

  async importQuizTopicsFromCsv(csvPath) {
    if (!fs.existsSync(csvPath)) {
      throw new Error(`CSV file not found: ${csvPath}`);
    }
    
    const content = fs.readFileSync(csvPath, 'utf8');
    const rows = parseCsv(content);
    const { header, records } = toObjects(rows);
    
    // Validate header - require name and industry_specific, slug is optional
    if (!header.includes('name')) {
      throw new Error('Missing required column: name');
    }
    if (!header.includes('industry_specific')) {
      throw new Error('Missing required column: industry_specific');
    }
    
    // Import records
    await this.run('BEGIN');
    try {
      let imported = 0;
      for (const record of records) {
        const name = record.name?.trim();
        if (!name) continue; // Skip empty rows
        
        const slug = record.slug?.trim() || null;
        const industrySpecific = parseInt(record.industry_specific, 10) || 0;
        const flag = industrySpecific === 1 ? 1 : 0;
        
        await this.run(
          `INSERT INTO quiz_topic (slug, name, industry_specific) 
           VALUES (?, ?, ?)
           ON CONFLICT(slug) DO UPDATE SET name = COALESCE(?, name), industry_specific = ?`,
          [slug, name, flag, name, flag]
        );
        imported++;
      }
      await this.run('COMMIT');
      return { imported };
    } catch (err) {
      await this.run('ROLLBACK');
      throw err;
    }
  }

  // Validate DB integrity: check that topic slugs are lowercase and names are preserved
  async validateTopicIntegrity() {
    const issues = [];
    const topics = await this.all('SELECT slug, name, industry_specific FROM quiz_topic ORDER BY slug');
    
    for (const topic of topics) {
      // Check if slug is lowercase
      if (topic.slug && topic.slug !== topic.slug.toLowerCase()) {
        issues.push({
          type: 'uppercase_slug',
          slug: topic.slug,
          message: `Topic slug should be lowercase: ${topic.slug}`
        });
      }
      // Check if name is uppercase (likely from bug)
      if (topic.name && topic.name === topic.name.toUpperCase() && topic.name.length > 3) {
        issues.push({
          type: 'uppercase_name',
          slug: topic.slug,
          name: topic.name,
          message: `Topic name appears to be incorrectly uppercased: ${topic.name}`
        });
      }
    }
    
    return {
      valid: issues.length === 0,
      issues,
      topicCount: topics.length
    };
  }

  // Fix common integrity issues
  async fixTopicIntegrity() {
    const fixed = [];
    const topics = await this.all('SELECT slug, name, industry_specific FROM quiz_topic');
    
    await this.run('BEGIN');
    try {
      for (const topic of topics) {
        let needsUpdate = false;
        let newSlug = topic.slug;
        let newName = topic.name;
        
        // Fix uppercase slugs
        if (topic.slug && topic.slug !== topic.slug.toLowerCase()) {
          newSlug = topic.slug.toLowerCase();
          // Check if a topic with the new slug already exists
          const existing = await this.get('SELECT slug FROM quiz_topic WHERE slug = ?', [newSlug]);
          if (existing && existing.slug !== topic.slug) {
            // Duplicate exists - delete the uppercase one instead of updating
            await this.run('DELETE FROM quiz_topic WHERE slug = ?', [topic.slug]);
            fixed.push({ 
              action: 'deleted_duplicate', 
              old: { slug: topic.slug, name: topic.name }, 
              reason: `Lowercase slug '${newSlug}' already exists` 
            });
            continue;
          }
          needsUpdate = true;
        }
        
        // Fix uppercase names (if name is all uppercase and matches slug pattern)
        if (topic.name && topic.name === topic.name.toUpperCase() && 
            topic.name.replace(/[-_]/g, '').toLowerCase() === topic.slug?.toLowerCase().replace(/[-_]/g, '')) {
          // Name is just uppercased slug - try to get better name from topic table
          const topicRow = await this.get('SELECT name FROM topic WHERE slug = ?', [newSlug]);
          if (topicRow && topicRow.name && topicRow.name !== topicRow.name.toUpperCase()) {
            newName = topicRow.name;
            needsUpdate = true;
          } else {
            // Generate proper name from slug
            newName = newSlug.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            needsUpdate = true;
          }
        }
        
        if (needsUpdate) {
          await this.run(
            `UPDATE quiz_topic SET slug = ?, name = ? WHERE slug = ?`,
            [newSlug, newName, topic.slug]
          );
          fixed.push({ old: { slug: topic.slug, name: topic.name }, new: { slug: newSlug, name: newName } });
        }
      }
      await this.run('COMMIT');
      return { fixed: fixed.length, details: fixed };
    } catch (err) {
      await this.run('ROLLBACK');
      throw err;
    }
  }
}

module.exports = new QuizContentDb();


