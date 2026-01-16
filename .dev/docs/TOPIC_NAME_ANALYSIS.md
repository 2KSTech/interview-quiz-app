# Comprehensive Analysis: Why Topic Names Are Being Changed

## Executive Summary

**The core issue**: Topic names are being unnecessarily updated during import operations, and in some cases are being overwritten with uppercased slugs instead of preserving existing valid names. There is **no legitimate reason** for topic names to be changed once they exist in the database, since topic names are already unique identifiers.

## Root Cause Analysis

### 1. The Smoking Gun: Uppercased Slug Used as Topic Name

**Location**: `backend/routes/quiz-api.js` lines 250 and 288

```javascript
TOPIC_NAME: String(topicSlug).toUpperCase(),
```

**Problem**: When auto-importing quizzes (when a quiz is missing or has zero questions), the code sets `TOPIC_NAME` to the **uppercased slug** (e.g., "aws" → "AWS", "bash" → "BASH"). This is then passed to the import script and written to the database.

**Impact**: Every time an auto-import happens, if the topic name doesn't exist or matches the slug, it gets overwritten with the uppercased slug.

### 2. Flawed Update Logic in Import Script

**Location**: `backend/scripts/import-bash-quiz.js` lines 373-395

The import script has logic to "preserve existing names" but the condition is flawed:

```javascript
if (existing) {
  let updateName = topicName;  // Defaults to the new value from env var
  let updateIndustry = isIndustrySpecific;
  
  // Only update name if existing is NULL, empty, 'null', or appears to be incorrectly uppercased slug
  const existingName = existing.name;
  if (existingName && existingName !== 'null' && existingName !== '' && 
      existingName.toLowerCase() !== topicSlug.toLowerCase()) {
    // Existing name looks valid - preserve it
    updateName = existingName;
  }
  
  // ... then updates the database with updateName
  await run(db, `
    UPDATE quiz_topic 
    SET name = ?, industry_specific = ?
    WHERE slug = ?
  `, [updateName, updateIndustry, topicSlug]);
}
```

**Problems**:
1. **Always updates**: Even when preserving the name, it still runs an UPDATE statement
2. **Weak validation**: The check `existingName.toLowerCase() !== topicSlug.toLowerCase()` means if the existing name is NULL or matches the slug, it will be overwritten with whatever is in `TOPIC_NAME` env var
3. **No check for uppercased slugs**: If the existing name is an uppercased slug (from a previous bad import), it will be preserved as-is, not fixed

### 3. Inconsistent Behavior Across Routes

**Location**: `backend/routes/api.js` vs `backend/routes/quiz-api.js`

- **`api.js` (lines 872-958)**: Has better logic that:
  - First tries to get topic name from DB (`topicInfo.name`)
  - Then tries to extract from markdown file
  - Then falls back to generating from slug
  - Uses the actual topic name, not uppercased slug
  
- **`quiz-api.js` (lines 250, 288)**: Just uppercases the slug directly:
  ```javascript
  TOPIC_NAME: String(topicSlug).toUpperCase(),
  ```

This inconsistency means the same operation behaves differently depending on which route is called.

### 4. The updateTopicSlug Method

**Location**: `backend/services/quizContentDb.js` lines 282-290

```javascript
async updateTopicSlug(topicName, slug) {
  await this.run(
    `INSERT INTO quiz_topic (slug, name, industry_specific) 
     VALUES (?, ?, 0)
     ON CONFLICT(slug) DO UPDATE SET name = ?`,
    [slug, topicName, topicName]
  );
}
```

**Problem**: This method **always updates the name** on conflict, with no preservation logic. However, I couldn't find where this method is actually called in the codebase, so it may be dead code.

## Why Are Topic Names Being Changed At All?

### The Answer: There's No Good Reason

1. **Topic names are already unique**: The user confirmed this - topic names serve as unique identifiers
2. **No business requirement**: There's no feature that requires updating topic names
3. **Defensive programming gone wrong**: The code tries to "fill in" missing names, but:
   - It doesn't need to - names should be set once during initial import
   - It's overwriting valid names with bad data (uppercased slugs)
   - It's running unnecessary UPDATE statements even when nothing changes

### The Real Intent (Inferred)

Looking at the code comments and logic, it seems the original intent was:
- **Initial import**: Set the topic name from the markdown file or environment variable
- **Subsequent imports**: Preserve the existing name

But the implementation is flawed because:
1. It still runs UPDATE statements even when preserving
2. The validation logic is too permissive
3. Some code paths (quiz-api.js) don't even try to preserve - they just uppercase the slug

## Data Flow: How Uppercased Names Get Into Database

### Scenario 1: Auto-Import via quiz-api.js (The Bad Path)

1. User requests `/api/quiz/:topicSlug/random10`
2. Quiz not found or has zero questions
3. Code auto-imports from local file
4. **Sets `TOPIC_NAME: String(topicSlug).toUpperCase()`** ← BUG HERE
5. Import script runs with uppercased slug as topic name
6. If `quiz_topic` entry doesn't exist or name is NULL/matches slug:
   - **Writes uppercased slug to database** ← DATA CORRUPTION

### Scenario 2: Manual Import via /quiz/import-local

1. Frontend calls `/api/quiz/import-local` with `topic_name` from UI
2. Route passes `TOPIC_NAME: String(topic_name)` to import script
3. Import script checks existing entry
4. If existing name is NULL or matches slug → overwrites with provided name
5. If existing name is valid → preserves it (but still runs UPDATE)

### Scenario 3: Auto-Import via api.js (The Better Path)

1. Similar to Scenario 1, but:
2. Code tries to get topic name from DB first
3. Falls back to extracting from markdown
4. Only generates from slug as last resort
5. Still has the same update logic issues, but at least uses better source data

## The Fix Logic Already Exists (But Isn't Used)

**Location**: `backend/services/quizContentDb.js` lines 435-481

There's a `fixTopicIntegrity()` method that:
- Detects uppercased names that match slugs
- Tries to get the correct name from the `topic` table
- Generates a proper name from the slug if needed

**Problem**: This is a **reactive fix** - it cleans up after the damage is done, rather than preventing it in the first place.

## Recommendations

### Immediate Fixes

1. **Remove the uppercasing in quiz-api.js**:
   - Lines 250 and 288: Don't uppercase the slug
   - Instead, use the same logic as `api.js` to get the actual topic name

2. **Fix the import script update logic**:
   - Only update if the name is actually NULL or empty
   - Don't update if a valid name already exists
   - Don't run UPDATE statements when nothing changes

3. **Make topic name updates explicit, not automatic**:
   - Topic names should only be set during initial import
   - Subsequent imports should NEVER update the name unless explicitly requested

### Long-term Improvements

1. **Separate concerns**:
   - Initial import: Set topic name
   - Subsequent imports: Only update quiz content, never topic metadata
   
2. **Add validation**:
   - Reject uppercased slugs as topic names
   - Validate topic names match expected format

3. **Remove unnecessary updates**:
   - Check if value actually changed before running UPDATE
   - Use INSERT OR IGNORE for initial creation, not UPDATE

## Conclusion

**Why are topic names being changed?** Because the code is trying to be "helpful" by filling in missing names, but:
1. It's using bad data (uppercased slugs) as the source
2. It's running updates even when names already exist
3. It's not properly validating what constitutes a "valid" name

**The fundamental issue**: There's no business requirement to update topic names. They should be set once during initial import and never changed. The current code violates this principle by attempting to "fix" or "update" names during every import operation.
