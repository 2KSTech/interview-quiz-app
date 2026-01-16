# Topic Name Conventions - Complete Documentation

## Overview

Topic names are derived from multiple sources with different priority orders depending on context. This document maps all conventions to prevent inconsistencies.

## The Slug-to-Name Transformation (Used Everywhere)

**Pattern**: `slug.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())`

**Examples**:
- `bash` → `Bash`
- `adobe-acrobat` → `Adobe Acrobat`
- `microsoft-azure` → `Microsoft Azure`
- `aws` → `Aws` (not "AWS" - that's the bug we fixed)

**Location**: Used in:
- `localTopicScanner.js` (line 19)
- `import-bash-quiz.js` (line 378)
- `quiz-api.js` (lines 275, 333)
- `api.js` (lines 888, 953)

## Markdown Extraction Pattern

**Pattern**: `mdContent.match(/^##\s+(.+)$/m)`

**Extracts**: First `## Topic Name` heading from markdown file

**Examples**:
- `## Amazon Web Services (AWS)` → `Amazon Web Services (AWS)`
- `## Accounting` → `Accounting`
- `## Bash` → `Bash`

**Location**: Used in:
- `import-bash-quiz.js` (line 362)
- `quiz-api.js` (lines 265, 324)
- `api.js` (lines 878, 943)

## Name Resolution Priority Orders

### 1. Import Script (`import-bash-quiz.js` lines 352-379)

**Priority Order**:
1. Extract from markdown file (`## Topic Name`)
2. Use `TOPIC_NAME` env var (if provided)
3. Default to `'Bash'`
4. **Validation**: If name equals uppercased slug or equals slug, regenerate from slug

**Code Flow**:
```javascript
let topicName = process.env.TOPIC_NAME || 'Bash';
// Try markdown extraction
if (FILE_PATH && fs.existsSync(FILE_PATH)) {
  const mdContent = fs.readFileSync(FILE_PATH, 'utf8');
  const topicMatch = mdContent.match(/^##\s+(.+)$/m);
  if (topicMatch) {
    const extractedName = topicMatch[1].trim();
    if (extractedName && extractedName.toLowerCase() !== topicSlug.toLowerCase()) {
      topicName = extractedName;  // Override with markdown
    }
  }
}
// Reject uppercased slugs
if (topicName === topicSlug.toUpperCase() || (topicName === topicSlug && topicSlug.length > 3)) {
  topicName = topicSlug.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
```

**For Existing Topics** (lines 397-420):
- **NEVER updates name if it already exists** (only if NULL/empty/'null')
- Only updates `industry_specific` if it changed

**For New Topics** (lines 421-426):
- Uses the resolved `topicName` from above

### 2. Auto-Import Routes (`quiz-api.js` lines 258-276, 319-338)

**Priority Order**:
1. Get from database (`topicInfo.name`)
2. Extract from markdown file
3. Generate from slug (slug-to-name transformation)

**Code Flow**:
```javascript
let topicName = topicInfo.name;  // From DB
if (!topicName || topicName === topicSlug) {
  // Try markdown
  const mdContent = fs.readFileSync(localFile, 'utf8');
  const topicMatch = mdContent.match(/^##\s+(.+)$/m);
  if (topicMatch) {
    topicName = topicMatch[1].trim();
  }
}
// Fallback to slug generation
if (!topicName || topicName === topicSlug) {
  topicName = topicSlug.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
```

**Note**: This is used when auto-importing missing quizzes, NOT for manual imports.

### 3. Manual Import Route (`quiz-api.js` line 156)

**Priority Order**:
1. Use `topic_name` from request body (frontend provides it)
2. Pass directly to import script as `TOPIC_NAME` env var

**Code Flow**:
```javascript
const { topic_slug, topic_name, local_file, industry_specific } = req.body;
TOPIC_NAME: String(topic_name),  // Used as-is
```

**Note**: The import script will still extract from markdown and override if better name found.

### 4. Local Topic Scanner (`localTopicScanner.js` line 19)

**Priority Order**:
1. Generate from directory name (slug-to-name transformation)

**Code Flow**:
```javascript
const topic = entry.name;  // Directory name, e.g., "adobe-acrobat"
topic_name: topic.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
```

**Purpose**: Used for displaying available topics in UI before import. This is a **preview** name, not the final stored name.

### 5. Vendor Init (`vendorInit.js` line 80)

**Priority Order**:
1. Hardcoded names: `'Bash'`, `'AWS'`

**Code Flow**:
```javascript
const candidates = [
  { slug: 'bash', name: 'Bash', ... },
  { slug: 'aws', name: 'AWS', ... },
];
TOPIC_NAME: c.name,
```

**Note**: This is only for initial preseed. The import script will extract from markdown and override.

## Database Update Rules

### `quiz_topic` Table Updates

**Rule**: Topic names are **immutable** once set (except if NULL/empty/'null')

**When Name is Updated**:
- Only if `existing.name` is NULL, empty string, or `'null'`
- Never overwrites an existing valid name

**When Name is NOT Updated**:
- If name already exists and is not NULL/empty/'null'
- Even if a "better" name is available from markdown

**Code** (`import-bash-quiz.js` lines 397-420):
```javascript
if (existing) {
  const existingName = existing.name;
  const needsNameUpdate = !existingName || existingName === 'null' || existingName === '';
  
  if (needsNameUpdate) {
    // Only update if missing
    UPDATE quiz_topic SET name = ? WHERE slug = ?
  }
  // Otherwise, name is preserved
}
```

## Inconsistencies Found

### 1. Different Priority Orders

- **Import script**: Markdown → Env var → Default
- **Auto-import routes**: DB → Markdown → Slug generation
- **Manual import**: Request body → Import script (which then does markdown → env var)

**Impact**: Same topic might get different names depending on import path.

### 2. Uppercased Slug Detection

- **Import script**: Checks `topicName === topicSlug.toUpperCase()` and regenerates
- **Auto-import routes**: No explicit check (relies on markdown extraction)

**Impact**: If markdown has uppercased slug, auto-import might use it.

### 3. Name Validation

- **Import script**: Validates and rejects uppercased slugs
- **Other places**: No validation

**Impact**: Inconsistent validation across code paths.

### 4. Frontend vs Backend

- **Frontend** (`localTopicScanner`): Generates preview names from directory names
- **Backend import**: Uses markdown extraction or provided name

**Impact**: UI might show different name than what gets stored.

## Recommended Standard Convention

### Single Source of Truth Priority

1. **Database** (`quiz_topic.name`) - if exists and valid
2. **Markdown file** (`## Topic Name`) - extract from first heading
3. **Slug generation** - transform slug using standard pattern
4. **Never use**: Uppercased slugs, env vars directly, or request body names without validation

### Standard Slug-to-Name Function

```javascript
function slugToName(slug) {
  return slug.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
```

### Standard Markdown Extraction

```javascript
function extractTopicNameFromMarkdown(mdContent) {
  const match = mdContent.match(/^##\s+(.+)$/m);
  return match ? match[1].trim() : null;
}
```

### Standard Name Resolution

```javascript
function resolveTopicName(slug, dbName, markdownContent, providedName) {
  // 1. Use DB name if valid
  if (dbName && dbName !== 'null' && dbName !== '' && dbName !== slug) {
    return dbName;
  }
  
  // 2. Extract from markdown
  const mdName = extractTopicNameFromMarkdown(markdownContent);
  if (mdName && mdName.toLowerCase() !== slug.toLowerCase()) {
    return mdName;
  }
  
  // 3. Generate from slug
  return slugToName(slug);
}
```

## Current State After Fixes

 **Fixed**: Import script extracts from markdown and rejects uppercased slugs
 **Fixed**: Existing topic names are preserved (never overwritten)
 **Fixed**: Auto-import routes use same priority order
[WARN] **Remaining**: Manual import route still passes request body name directly (but import script will override if markdown has better name)

## Testing Checklist

When testing topic name handling:

1. **New topic import**: Should extract from markdown
2. **Existing topic re-import**: Should preserve existing name
3. **Uppercased slug in env var**: Should be rejected and regenerated
4. **Missing markdown heading**: Should generate from slug
5. **NULL name in DB**: Should be updated with extracted/generated name
