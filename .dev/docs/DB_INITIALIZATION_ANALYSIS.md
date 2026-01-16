# Database Initialization Analysis

## Current State (Problems)

### 1. Lazy Schema Creation (Antipattern)
- **Location**: `import-bash-quiz.js` line 59 - `ensureSchema()`
- **Problem**: Schema is created "if not exists" during import, not during intentional initialization
- **Impact**: No versioning, no intentional initialization, schema scattered across code

### 2. Table Creation on Connect (Antipattern)
- **Location**: `quizContentDb.js` line 22 - `ensureQuizTopicTableSync()`
- **Problem**: `quiz_topic` table created every time DB connects, not during proper init
- **Impact**: Assumes table might not exist (migration mindset), but this is a new app

### 3. No Proper Initialization Script
- **Current**: No dedicated script to initialize `quizdb.sqlite` database
- **Problem**: Relies on lazy creation during imports
- **Impact**: No control over when/how DB is created

### 4. quiz_topic Table Not Imported
- **Current**: `quiz_topic` table is created empty, populated only during imports
- **Problem**: Your custom category flags (industry_specific) are not preserved/imported
- **Impact**: Data loss when DB is deleted (as happened)

## What Should Happen

### Proper Initialization Flow

1. **Dedicated Init Script** (`scripts/init-quiz-db.js` or similar)
   - Creates database file
   - Creates ALL tables with proper schema (no "IF NOT EXISTS")
   - Imports `quiz_topic` table from CSV/config file
   - Versioned schema (e.g., schema_v1.sql)

2. **Schema Versioning**
   - Schema in versioned file: `schema/quizdb_v1.sql`
   - Migration system if schema changes
   - No lazy "if not exists" checks

3. **quiz_topic Import**
   - CSV file or config: `data/quiz_topics.csv` or `data/quiz_topics.json`
   - Imported during DB initialization
   - This is YOUR data, separate from repo data

4. **Separation of Concerns**
   - **Static repo data** (questions, quizzes): Imported from markdown files, versioned by repo hash
   - **Your custom data** (quiz_topic): Imported from CSV/config during init
   - **User data** (quiz results): Created during runtime

## Proposed Structure

```
backend/
  scripts/
    init-quiz-db.js          # Intentional DB initialization
    import-bash-quiz.js       # Import quiz content (repo data)
  schema/
    quizdb_v1.sql  # Versioned schema
  data/
    quiz_topics.csv          # Your quiz_topic table data
```

## Current Antipatterns to Remove

1. ⚠ `ensureQuizTopicTableSync()` in `quizContentDb.connect()` - Remove
2. ⚠ `ensureSchema()` with "CREATE TABLE IF NOT EXISTS" - Replace with proper init
3. ⚠ Lazy table creation during imports - Move to init script
4. ⚠ No versioning - Add schema versioning

## What Needs to Be Done

1. **Create proper init script** that:
   - Creates database
   - Runs schema file
   - Imports quiz_topic from CSV/config
   - Does NOT use "IF NOT EXISTS"

2. **Create schema file** (`schema/quizdb_v1.sql`):
   - All CREATE TABLE statements
   - No "IF NOT EXISTS"
   - Versioned

3. **Create quiz_topic data file** (`data/quiz_topics.csv`):
   - Export current quiz_topic table
   - This becomes source of truth
   - Imported during init

4. **Remove lazy creation**:
   - Remove `ensureQuizTopicTableSync()` from connect()
   - Remove `ensureSchema()` from import script
   - Make init script required before first use

## Questions for You

1. **Where should quiz_topic data live?** CSV file? JSON? Separate SQL file?
2. **When should init run?** On first server start? Manual command? Both?
3. **Schema versioning**: How do you want to handle schema changes? Migration files?
4. **Repo hash versioning**: Should imports check repo hash and re-import if changed?
