const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const appPathResolver = require('./appPathResolver');

/**
 * Centralized database management for the quiz application.
 * Handles path resolution, schema initialization, and connection management.
 */
class Database {
  constructor() {
    this.connections = new Map();
    this.initialized = new Map();
  }

  /**
   * Resolve database file path with validation via appPathResolver
   * @param {string} dbType - 'quiz' or 'results'
   * @returns {string} - validated absolute path
   */
  resolveDatabasePath(dbType) {
    if (dbType === 'quiz') return appPathResolver.getQuizDbPath();
    if (dbType === 'results') return appPathResolver.getResultsDbPath();
    throw new Error(`Unknown dbType '${dbType}' for resolveDatabasePath`);
  }

  /**
   * Resolve quiz repository root path with validation via appPathResolver
   * @returns {string} - validated absolute path
   */
  resolveQuizRepoPath() {
    return appPathResolver.getQuizRepoRoot();
  }

  /**
   * Load schema SQL from file
   * @param {string} schemaType - 'quiz-content' or 'quiz-results'
   * @returns {string} - SQL schema content
   */
  loadSchema(schemaType) {
    const schemaFile = `${schemaType}-schema.sql`;
    const schemaDir = path.join(__dirname, '..', 'schema');
    const schemaPath = path.join(schemaDir, schemaFile);

    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found: ${schemaPath}`);
    }

    return fs.readFileSync(schemaPath, 'utf8');
  }

  /**
   * Get or create database connection
   * @param {string} dbType - 'quiz' or 'results'
   * @returns {sqlite3.Database}
   */
  getConnection(dbType) {
    if (this.connections.has(dbType)) {
      return this.connections.get(dbType);
    }

    const dbPath = this.resolveDatabasePath(dbType);
    console.log(`[Database] Connecting to ${dbType} database: ${dbPath}`);

    const db = new sqlite3.Database(dbPath);
    this.connections.set(dbType, db);

    return db;
  }

  /**
   * Initialize database schema if not already done
   * @param {string} dbType - 'quiz' or 'results'
   * @returns {Promise<void>}
   */
  async initializeSchema(dbType) {
    if (this.initialized.has(dbType)) {
      return;
    }

    const db = this.getConnection(dbType);
    const schemaType = dbType === 'quiz' ? 'quiz-content' : 'quiz-results';
    const schemaSql = this.loadSchema(schemaType);

    console.log(`[Database] Initializing ${dbType} schema...`);

    return new Promise((resolve, reject) => {
      db.exec(schemaSql, (err) => {
        if (err) {
          console.error(`[Database] Failed to initialize ${dbType} schema:`, err);
          reject(err);
        } else {
          console.log(`[Database] Successfully initialized ${dbType} schema`);
          this.initialized.set(dbType, true);
          resolve();
        }
      });
    });
  }

  /**
   * Run SQL query with promise wrapper
   * @param {string} dbType - 'quiz' or 'results'
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise}
   */
  async run(dbType, sql, params = []) {
    const db = this.getConnection(dbType);
    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }

  /**
   * Get single row with promise wrapper
   * @param {string} dbType - 'quiz' or 'results'
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Object|null>}
   */
  async get(dbType, sql, params = []) {
    const db = this.getConnection(dbType);
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      });
    });
  }

  /**
   * Get multiple rows with promise wrapper
   * @param {string} dbType - 'quiz' or 'results'
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Array>}
   */
  async all(dbType, sql, params = []) {
    const db = this.getConnection(dbType);
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  /**
   * Close database connection
   * @param {string} dbType - 'quiz' or 'results'
   */
  close(dbType) {
    if (this.connections.has(dbType)) {
      const db = this.connections.get(dbType);
      db.close();
      this.connections.delete(dbType);
      this.initialized.delete(dbType);
    }
  }

  /**
   * Close all database connections
   */
  closeAll() {
    for (const dbType of this.connections.keys()) {
      this.close(dbType);
    }
  }
}

// Export singleton instance
module.exports = new Database();
