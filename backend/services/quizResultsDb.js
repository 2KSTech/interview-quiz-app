const database = require('./database');

class QuizResultsDb {
  constructor() {
    this.initialized = false;
  }

  async connect() {
    if (!this.initialized) {
      await database.initializeSchema('results');
      this.initialized = true;
    }
    return database.getConnection('results');
  }

  async run(sql, params = []) {
    await this.connect();
    return database.run('results', sql, params);
  }

  async get(sql, params = []) {
    await this.connect();
    return database.get('results', sql, params);
  }

  async all(sql, params = []) {
    await this.connect();
    return database.all('results', sql, params);
  }

  close() {
    database.close('results');
    this.initialized = false;
  }

  // Helper method to get quiz sessions filtered by category (for metrics aggregation)
  // Requires topic slugs array from quizContentDb.getTopicSlugsByCategory()
  // Example usage:
  //   const topicSlugs = await quizContentDb.getTopicSlugsByCategory(true); // industry-specific
  //   const sessions = await quizResultsDb.getSessionsByTopicSlugs(userId, topicSlugs);
  async getSessionsByTopicSlugs(userId, topicSlugs = []) {
    if (!topicSlugs || topicSlugs.length === 0) {
      return [];
    }
    const placeholders = topicSlugs.map(() => '?').join(',');
    return await this.all(
      `SELECT * FROM quiz_session 
       WHERE user_id = ? AND topic_slug IN (${placeholders})
       ORDER BY started_at DESC`,
      [String(userId), ...topicSlugs]
    );
  }
}

module.exports = new QuizResultsDb();
