const pathResolver = require('../../services/pathResolver');
const fs = require('fs');
const path = require('path');

describe('PathResolver Service', () => {
  beforeEach(() => {
    // Clear cache before each test to ensure clean state
    pathResolver.clearCache();
  });

  describe('Project Root Resolution', () => {
    test('should resolve project root correctly', () => {
      const projectRoot = pathResolver.getProjectRoot();
      expect(projectRoot).toBeDefined();
      expect(path.isAbsolute(projectRoot)).toBe(true);

      // Should contain package.json
      const packageJsonPath = path.join(projectRoot, 'package.json');
      expect(fs.existsSync(packageJsonPath)).toBe(true);
    });

    test('should cache project root result', () => {
      const first = pathResolver.getProjectRoot();
      const second = pathResolver.getProjectRoot();
      expect(first).toBe(second); // Same reference due to caching
    });
  });

  describe('Backend Root Resolution', () => {
    test('should resolve backend directory', () => {
      const backendRoot = pathResolver.getBackendRoot();
      expect(backendRoot).toBeDefined();
      expect(path.isAbsolute(backendRoot)).toBe(true);

      // Should be a directory
      expect(fs.statSync(backendRoot).isDirectory()).toBe(true);
    });
  });

  describe('Database Path Resolution', () => {
    test('should resolve quiz database path', () => {
      const dbPath = pathResolver.getQuizDatabasePath();
      expect(dbPath).toBeDefined();
      expect(path.isAbsolute(dbPath)).toBe(true);
      expect(dbPath.endsWith('quizdb.sqlite')).toBe(true);
    });

    test('should resolve results database path', () => {
      const dbPath = pathResolver.getResultsDatabasePath();
      expect(dbPath).toBeDefined();
      expect(path.isAbsolute(dbPath)).toBe(true);
      expect(dbPath.endsWith('quiz_results.sqlite')).toBe(true);
    });

    test('should create database directories if they do not exist', () => {
      const dbPath = pathResolver.getQuizDatabasePath();
      const dir = path.dirname(dbPath);
      expect(fs.existsSync(dir)).toBe(true);
    });
  });

  describe('Repository Path Resolution', () => {
    test('should resolve quiz repository path', () => {
      const repoPath = pathResolver.getQuizRepositoryPath();
      expect(repoPath).toBeDefined();
      expect(path.isAbsolute(repoPath)).toBe(true);
      expect(fs.existsSync(repoPath)).toBe(true);
      expect(fs.statSync(repoPath).isDirectory()).toBe(true);
    });

    test('should resolve tarball path', () => {
      const tarballPath = pathResolver.getQuizTarballPath();
      expect(tarballPath).toBeDefined();
      expect(path.isAbsolute(tarballPath)).toBe(true);
      // Note: tarball may not exist, that's ok
    });
  });

  describe('Schema Path Resolution', () => {
    test('should resolve schema directory', () => {
      const schemaDir = pathResolver.getSchemaDirectoryPath();
      expect(schemaDir).toBeDefined();
      expect(path.isAbsolute(schemaDir)).toBe(true);
      expect(fs.existsSync(schemaDir)).toBe(true);
    });

    test('should resolve schema files', () => {
      const quizSchema = pathResolver.getSchemaFilePath('quiz-content');
      const resultsSchema = pathResolver.getSchemaFilePath('quiz-results');

      expect(quizSchema).toBeDefined();
      expect(resultsSchema).toBeDefined();
      expect(path.isAbsolute(quizSchema)).toBe(true);
      expect(path.isAbsolute(resultsSchema)).toBe(true);
      expect(fs.existsSync(quizSchema)).toBe(true);
      expect(fs.existsSync(resultsSchema)).toBe(true);
    });
  });

  describe('Validation', () => {
    test('should validate existing paths', () => {
      const projectRoot = pathResolver.getProjectRoot();
      expect(pathResolver.validatePath(projectRoot)).toBe(true);
      expect(pathResolver.validatePath(projectRoot, { mustBeDirectory: true })).toBe(true);
    });

    test('should reject non-existent paths', () => {
      expect(pathResolver.validatePath('/nonexistent/path', { mustExist: true })).toBe(false);
    });

    test('should check if directory is non-empty', () => {
      const repoPath = pathResolver.getQuizRepositoryPath();
      expect(pathResolver.isNonEmptyDirectory(repoPath)).toBe(true);
    });
  });

  describe('Initialization', () => {
    test('should initialize successfully', () => {
      const result = pathResolver.initialize();
      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.paths).toBeDefined();
      expect(Object.keys(result.paths).length).toBeGreaterThan(0);
    });

    test('should provide all paths via getAllPaths', () => {
      const paths = pathResolver.getAllPaths();
      expect(paths).toHaveProperty('projectRoot');
      expect(paths).toHaveProperty('backendRoot');
      expect(paths).toHaveProperty('quizDatabase');
      expect(paths).toHaveProperty('resultsDatabase');
      expect(paths).toHaveProperty('quizRepository');
      expect(paths).toHaveProperty('quizTarball');
      expect(paths).toHaveProperty('schemaDirectory');
      expect(paths).toHaveProperty('publicAssets');
      expect(paths).toHaveProperty('vendorQuizzes');
    });
  });

  describe('Environment Variable Support', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      // Reset env for each test
      process.env = { ...originalEnv };
      pathResolver.clearCache();
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    test('should use custom database path from env', () => {
      process.env.DB_PATH = 'custom/path/to/db.sqlite';
      const dbPath = pathResolver.getQuizDatabasePath();
      expect(dbPath).toMatch(/custom\/path\/to\/db\.sqlite$/);
    });

    test('should use absolute custom repository path', () => {
      const absPath = path.resolve('/tmp/custom/repo');
      process.env.QUIZ_REPO_ROOT = absPath;
      pathResolver.clearCache();
      const repoPath = pathResolver.getQuizRepositoryPath(true); // skip validation
      expect(repoPath).toBe(absPath);
    });

    test('should resolve relative repository path', () => {
      process.env.QUIZ_REPO_ROOT = 'custom/relative/path';
      pathResolver.clearCache();
      const repoPath = pathResolver.getQuizRepositoryPath(true); // skip validation
      const expected = path.resolve(pathResolver.getProjectRoot(), 'custom/relative/path');
      expect(repoPath).toBe(expected);
    });
  });
});
