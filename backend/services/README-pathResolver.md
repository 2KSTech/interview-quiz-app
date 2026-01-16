# PathResolver Service

A centralized path resolution service for the quiz application that provides a single source of truth for all file and directory paths.

## Overview

This service replaces the scattered and inconsistent path resolution logic found across multiple files (`vendorInit.js`, `database.js`, `goldenSource.js`, etc.) with a clean, cached, and validated approach.

## Features

- **Centralized Path Resolution**: All paths are resolved in one place
- **Caching**: Paths are computed once and cached for performance
- **Validation**: Optional validation ensures paths exist and meet requirements
- **Environment Variable Support**: Respects environment variables for configurable paths
- **Error Handling**: Clear error messages for missing or invalid paths

## API

### Core Methods

#### `getProjectRoot()`
Returns the absolute path to the project root directory (where `package.json` is located).

#### `getBackendRoot()`
Returns the absolute path to the backend directory.

#### `getQuizDatabasePath()`
Returns the absolute path to the quiz database file.

#### `getResultsDatabasePath()`
Returns the absolute path to the quiz results database file.

#### `getQuizRepositoryPath([skipValidation])`
Returns the absolute path to the quiz repository directory.
- `skipValidation` (boolean): Skip existence validation (useful for testing)

#### `getQuizTarballPath()`
Returns the absolute path to the quiz tarball file.

#### `getSchemaDirectoryPath()`
Returns the absolute path to the schema directory.

#### `getSchemaFilePath(schemaType)`
Returns the absolute path to a specific schema file.
- `schemaType`: `'quiz-content'` or `'quiz-results'`

#### `getPublicAssetsPath()`
Returns the absolute path to the public assets directory.

#### `getVendorQuizzesPath()`
Returns the absolute path to the vendor quizzes directory.

### Utility Methods

#### `clearCache()`
Clears all cached paths. Useful for testing or reinitialization.

#### `validatePath(filePath, options)`
Validates that a path exists and meets requirements.
- `options.mustExist`: Path must exist
- `options.mustBeDirectory`: Path must be a directory
- `options.mustBeFile`: Path must be a file
- `options.mustBeNonEmpty`: Directory must be non-empty

#### `isNonEmptyDirectory(dirPath)`
Checks if a directory exists and is non-empty.

#### `getAllPaths()`
Returns an object containing all resolved paths.

#### `initialize()`
Initializes and validates all paths at startup. Returns `{ok, errors, paths}`.

## Environment Variables

The service respects the following environment variables:

- `DB_PATH` / `QUIZ_DB_PATH`: Custom quiz database path
- `RESULTS_DB_PATH` / `QUIZ_RESULTS_DB_PATH`: Custom results database path
- `QUIZ_REPO_ROOT`: Custom quiz repository path
- `QUIZ_REPO_TARBALL`: Custom quiz tarball path

## Usage Examples

```javascript
const pathResolver = require('./services/pathResolver');

// Get project root
const projectRoot = pathResolver.getProjectRoot();

// Get database paths
const quizDb = pathResolver.getQuizDatabasePath();
const resultsDb = pathResolver.getResultsDatabasePath();

// Get repository paths
const repoPath = pathResolver.getQuizRepositoryPath();
const tarballPath = pathResolver.getQuizTarballPath();

// Get all paths at once
const allPaths = pathResolver.getAllPaths();

// Initialize at startup
const initResult = pathResolver.initialize();
if (!initResult.ok) {
  console.error('Path resolution failed:', initResult.errors);
}
```

## Testing

The service includes comprehensive unit tests covering:
- Path resolution accuracy
- Caching behavior
- Validation logic
- Environment variable support
- Error handling

Run tests with:
```bash
npm test tests/unit/pathResolver.test.js
```

## Migration Guide

To migrate from the old scattered path resolution functions:

1. Replace `resolveProjectRoot()` calls with `pathResolver.getProjectRoot()`
2. Replace `resolveRepoRoot()` calls with `pathResolver.getQuizRepositoryPath()`
3. Replace `resolveTarballPath()` calls with `pathResolver.getQuizTarballPath()`
4. Replace `getBackendProjectRoot()` calls with `pathResolver.getProjectRoot()`
5. Replace `getQuizProviderRepoRoot()` calls with `pathResolver.getQuizRepositoryPath()`
6. Replace `getQuizProviderTarballPath()` calls with `pathResolver.getQuizTarballPath()`
7. Replace database path resolution with `pathResolver.getQuizDatabasePath()` and `pathResolver.getResultsDatabasePath()`

## Benefits

- **Consistency**: All paths resolved the same way everywhere
- **Maintainability**: Single place to update path logic
- **Performance**: Paths cached after first resolution
- **Reliability**: Validation ensures paths are correct
- **Testability**: Easy to test path resolution logic
- **Flexibility**: Environment variable support for different deployments
