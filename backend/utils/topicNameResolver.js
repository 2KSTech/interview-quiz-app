const fs = require('fs');

/**
 * Standard slug-to-name transformation
 * Converts a slug like "adobe-acrobat" to "Adobe Acrobat"
 * 
 * @param {string} slug - The topic slug (e.g., "adobe-acrobat")
 * @returns {string} - Formatted name (e.g., "Adobe Acrobat")
 */
function slugToName(slug) {
  if (!slug) return slug;
  return slug.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Extract topic name from markdown file
 * Looks for the first ## Topic Name heading
 * 
 * @param {string} markdownContent - The markdown file content
 * @returns {string|null} - The extracted topic name, or null if not found
 */
function extractTopicNameFromMarkdown(markdownContent) {
  if (!markdownContent) return null;
  const match = markdownContent.match(/^##\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

/**
 * Extract topic name from markdown file by path
 * 
 * @param {string} filePath - Path to the markdown file
 * @returns {string|null} - The extracted topic name, or null if not found
 */
function extractTopicNameFromFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    const mdContent = fs.readFileSync(filePath, 'utf8');
    return extractTopicNameFromMarkdown(mdContent);
  } catch (e) {
    return null;
  }
}

/**
 * Validate if a name is valid (not just an uppercased slug or equals slug)
 * 
 * @param {string} name - The name to validate
 * @param {string} slug - The topic slug to compare against
 * @returns {boolean} - True if name is valid, false if it's just an uppercased slug
 */
function isValidTopicName(name, slug) {
  if (!name || !slug) return false;
  const nameLower = name.toLowerCase();
  const slugLower = slug.toLowerCase();
  
  // Reject if name is exactly the uppercased slug
  if (name === slug.toUpperCase()) return false;
  
  // Reject if name equals slug (for slugs longer than 3 chars)
  if (nameLower === slugLower && slug.length > 3) return false;
  
  // Reject if name is just the slug with spaces/dashes removed and uppercased
  const nameNormalized = nameLower.replace(/[-_\s]/g, '');
  const slugNormalized = slugLower.replace(/[-_\s]/g, '');
  if (nameNormalized === slugNormalized && name === name.toUpperCase()) return false;
  
  return true;
}

/**
 * Resolve topic name using standard priority order:
 * 1. Database name (if exists and valid)
 * 2. Markdown extraction (if file available)
 * 3. Slug generation (fallback)
 * 
 * This function enforces data integrity by:
 * - Never using uppercased slugs as names
 * - Validating all names before use
 * - Using consistent transformation rules
 * 
 * @param {Object} options - Resolution options
 * @param {string} options.slug - The topic slug (required)
 * @param {string|null} options.dbName - Name from database (optional)
 * @param {string|null} options.markdownContent - Markdown file content (optional)
 * @param {string|null} options.markdownFilePath - Path to markdown file (optional, used if content not provided)
 * @param {string|null} options.providedName - Name provided via env var or request (optional)
 * @returns {string} - Resolved topic name
 */
function resolveTopicName(options) {
  const { slug, dbName, markdownContent, markdownFilePath, providedName } = options;
  
  if (!slug) {
    throw new Error('Topic slug is required');
  }
  
  const slugLower = slug.toLowerCase();
  
  // 1. Use database name if it exists and is valid
  if (dbName && dbName !== 'null' && dbName !== '' && isValidTopicName(dbName, slug)) {
    return dbName;
  }
  
  // 2. Extract from markdown (try content first, then file path)
  let mdName = null;
  if (markdownContent) {
    mdName = extractTopicNameFromMarkdown(markdownContent);
  } else if (markdownFilePath) {
    mdName = extractTopicNameFromFile(markdownFilePath);
  }
  
  if (mdName && isValidTopicName(mdName, slug)) {
    return mdName;
  }
  
  // 3. Use provided name if valid
  if (providedName && isValidTopicName(providedName, slug)) {
    return providedName;
  }
  
  // 4. Generate from slug (final fallback)
  return slugToName(slug);
}

/**
 * Resolve topic name for import operations
 * Used when importing a topic - prioritizes markdown extraction
 * 
 * @param {Object} options - Resolution options
 * @param {string} options.slug - The topic slug (required)
 * @param {string|null} options.markdownFilePath - Path to markdown file (required for imports)
 * @param {string|null} options.providedName - Name from env var or request (optional)
 * @param {string|null} options.dbName - Name from database (optional, for existing topics)
 * @returns {string} - Resolved topic name
 */
function resolveTopicNameForImport(options) {
  const { slug, markdownFilePath, providedName, dbName } = options;
  
  if (!slug) {
    throw new Error('Topic slug is required');
  }
  
  // For imports, we prioritize markdown extraction
  // But still validate everything
  
  // 1. Extract from markdown first (most reliable source)
  let mdName = null;
  if (markdownFilePath) {
    mdName = extractTopicNameFromFile(markdownFilePath);
  }
  
  if (mdName && isValidTopicName(mdName, slug)) {
    return mdName;
  }
  
  // 2. Use database name if valid (preserve existing)
  if (dbName && dbName !== 'null' && dbName !== '' && isValidTopicName(dbName, slug)) {
    return dbName;
  }
  
  // 3. Use provided name if valid
  if (providedName && isValidTopicName(providedName, slug)) {
    return providedName;
  }
  
  // 4. Generate from slug (final fallback)
  return slugToName(slug);
}

module.exports = {
  slugToName,
  extractTopicNameFromMarkdown,
  extractTopicNameFromFile,
  isValidTopicName,
  resolveTopicName,
  resolveTopicNameForImport
};
