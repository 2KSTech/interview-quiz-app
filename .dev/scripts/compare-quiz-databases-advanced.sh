#!/bin/bash
# Advanced database comparison tool with CSV export
# Usage: ./compare-quiz-databases-advanced.sh <db1> <db2> [output_dir]
# Example: ./compare-quiz-databases-advanced.sh quizdb.sqlite quizdb.latest.FLAGGED.NEEDS_ANALYSIS.20260108_121056.sqlite ./comparison-report

set -e

DB1="${1:-quizdb.sqlite}"
DB2="${2:-quizdb.latest.FLAGGED.NEEDS_ANALYSIS.20260108_121056.sqlite}"
OUTPUT_DIR="${3:-./db-comparison-$(date +%Y%m%d_%H%M%S)}"

if [ ! -f "$DB1" ]; then
    echo "⚠ Error: Database 1 not found: $DB1"
    exit 1
fi

if [ ! -f "$DB2" ]; then
    echo "⚠ Error: Database 2 not found: $DB2"
    exit 1
fi

mkdir -p "$OUTPUT_DIR"

echo "🔍 Advanced Database Comparison"
echo "   DB1: $DB1"
echo "   DB2: $DB2"
echo "   Output: $OUTPUT_DIR"
echo ""

# Function to run query and return results
run_query() {
    local db="$1"
    local query="$2"
    sqlite3 -header -csv "$db" "$query" 2>/dev/null || echo ""
}

# Function to run query without CSV header
run_query_no_header() {
    local db="$1"
    local query="$2"
    sqlite3 "$db" "$query" 2>/dev/null || echo ""
}

# Function to get count
get_count() {
    local db="$1"
    local query="$2"
    local result
    result=$(sqlite3 "$db" "$query" 2>/dev/null || echo "0")
    echo "${result:-0}"
}

echo "═══════════════════════════════════════════════════════════════"
echo "┼ GENERATING REPORTS"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# 1. Summary Statistics
echo "   📈 Generating summary statistics..."
DB1_TOPICS=$(get_count "$DB1" 'SELECT COUNT(*) FROM quiz_topic' || echo "0")
DB2_TOPICS=$(get_count "$DB2" 'SELECT COUNT(*) FROM quiz_topic' || echo "0")
DB1_TOPICS=${DB1_TOPICS:-0}
DB2_TOPICS=${DB2_TOPICS:-0}
TOPICS_DIFF=$((DB2_TOPICS - DB1_TOPICS))

DB1_QUIZZES=$(get_count "$DB1" 'SELECT COUNT(*) FROM quiz' || echo "0")
DB2_QUIZZES=$(get_count "$DB2" 'SELECT COUNT(*) FROM quiz' || echo "0")
DB1_QUIZZES=${DB1_QUIZZES:-0}
DB2_QUIZZES=${DB2_QUIZZES:-0}
QUIZZES_DIFF=$((DB2_QUIZZES - DB1_QUIZZES))

DB1_QUESTIONS=$(get_count "$DB1" 'SELECT COUNT(*) FROM question' || echo "0")
DB2_QUESTIONS=$(get_count "$DB2" 'SELECT COUNT(*) FROM question' || echo "0")
DB1_QUESTIONS=${DB1_QUESTIONS:-0}
DB2_QUESTIONS=${DB2_QUESTIONS:-0}
QUESTIONS_DIFF=$((DB2_QUESTIONS - DB1_QUESTIONS))

DB1_CHOICES=$(get_count "$DB1" 'SELECT COUNT(*) FROM choice' || echo "0")
DB2_CHOICES=$(get_count "$DB2" 'SELECT COUNT(*) FROM choice' || echo "0")
DB1_CHOICES=${DB1_CHOICES:-0}
DB2_CHOICES=${DB2_CHOICES:-0}
CHOICES_DIFF=$((DB2_CHOICES - DB1_CHOICES))

{
    echo "metric,db1_value,db2_value,difference"
    echo "topics,$DB1_TOPICS,$DB2_TOPICS,$TOPICS_DIFF"
    echo "quizzes,$DB1_QUIZZES,$DB2_QUIZZES,$QUIZZES_DIFF"
    echo "questions,$DB1_QUESTIONS,$DB2_QUESTIONS,$QUESTIONS_DIFF"
    echo "choices,$DB1_CHOICES,$DB2_CHOICES,$CHOICES_DIFF"
} > "$OUTPUT_DIR/summary.csv"
echo "      ✔ Saved: $OUTPUT_DIR/summary.csv"

# 2. Questions by Quiz (User's Query Format)
echo "   … Generating questions by quiz report..."
run_query "$DB1" "
SELECT 
    q.quiz_id, 
    COALESCE(qt.slug, t.slug, 'unknown') as topic_slug,
    COUNT(*) as question_count
FROM question q
JOIN quiz z ON z.id = q.quiz_id
LEFT JOIN topic t ON t.id = z.topic_id
LEFT JOIN quiz_topic qt ON qt.slug = t.slug
GROUP BY q.quiz_id, topic_slug
ORDER BY q.quiz_id;
" > "$OUTPUT_DIR/db1_questions_by_quiz.csv"
echo "      ✔ Saved: $OUTPUT_DIR/db1_questions_by_quiz.csv"

run_query "$DB2" "
SELECT 
    q.quiz_id, 
    COALESCE(qt.slug, t.slug, 'unknown') as topic_slug,
    COUNT(*) as question_count
FROM question q
JOIN quiz z ON z.id = q.quiz_id
LEFT JOIN topic t ON t.id = z.topic_id
LEFT JOIN quiz_topic qt ON qt.slug = t.slug
GROUP BY q.quiz_id, topic_slug
ORDER BY q.quiz_id;
" > "$OUTPUT_DIR/db2_questions_by_quiz.csv"
echo "      ✔ Saved: $OUTPUT_DIR/db2_questions_by_quiz.csv"

# 3. Questions by Topic Slug (Comparison)
echo "   ┼ Generating questions by topic comparison..."
{
    echo "topic_slug,db1_count,db2_count,difference"
    # Get all unique topic slugs from both DBs
    {
        sqlite3 "$DB1" 'SELECT DISTINCT COALESCE(qt.slug, t.slug) FROM question q JOIN quiz z ON z.id = q.quiz_id LEFT JOIN topic t ON t.id = z.topic_id LEFT JOIN quiz_topic qt ON qt.slug = t.slug WHERE COALESCE(qt.slug, t.slug) IS NOT NULL ORDER BY 1' 2>/dev/null
        sqlite3 "$DB2" 'SELECT DISTINCT COALESCE(qt.slug, t.slug) FROM question q JOIN quiz z ON z.id = q.quiz_id LEFT JOIN topic t ON t.id = z.topic_id LEFT JOIN quiz_topic qt ON qt.slug = t.slug WHERE COALESCE(qt.slug, t.slug) IS NOT NULL ORDER BY 1' 2>/dev/null
    } | sort -u | while read -r slug; do
        [ -z "$slug" ] && continue
        COUNT1=$(get_count "$DB1" "SELECT COUNT(*) FROM question q JOIN quiz z ON z.id = q.quiz_id LEFT JOIN topic t ON t.id = z.topic_id LEFT JOIN quiz_topic qt ON qt.slug = t.slug WHERE COALESCE(qt.slug, t.slug) = '${slug}'")
        COUNT2=$(get_count "$DB2" "SELECT COUNT(*) FROM question q JOIN quiz z ON z.id = q.quiz_id LEFT JOIN topic t ON t.id = z.topic_id LEFT JOIN quiz_topic qt ON qt.slug = t.slug WHERE COALESCE(qt.slug, t.slug) = '${slug}'")
        COUNT1=${COUNT1:-0}
        COUNT2=${COUNT2:-0}
        DIFF=$((COUNT2 - COUNT1))
        echo "$slug,$COUNT1,$COUNT2,$DIFF"
    done
} > "$OUTPUT_DIR/questions_by_topic_comparison.csv"
echo "      ✔ Saved: $OUTPUT_DIR/questions_by_topic_comparison.csv"

# 4. Topic List Comparison
echo "   📋 Generating topic list comparison..."
run_query "$DB1" "SELECT slug, name, industry_specific FROM quiz_topic ORDER BY slug" > "$OUTPUT_DIR/db1_topics.csv"
run_query "$DB2" "SELECT slug, name, industry_specific FROM quiz_topic ORDER BY slug" > "$OUTPUT_DIR/db2_topics.csv"
echo "      ✔ Saved: $OUTPUT_DIR/db1_topics.csv"
echo "      ✔ Saved: $OUTPUT_DIR/db2_topics.csv"

# Find topics only in DB1
run_query_no_header "$DB1" "SELECT slug FROM quiz_topic ORDER BY slug" > "$OUTPUT_DIR/tmp_db1_slugs.txt"
run_query_no_header "$DB2" "SELECT slug FROM quiz_topic ORDER BY slug" > "$OUTPUT_DIR/tmp_db2_slugs.txt"
comm -23 "$OUTPUT_DIR/tmp_db1_slugs.txt" "$OUTPUT_DIR/tmp_db2_slugs.txt" > "$OUTPUT_DIR/topics_only_in_db1.txt" 2>/dev/null || touch "$OUTPUT_DIR/topics_only_in_db1.txt"
comm -13 "$OUTPUT_DIR/tmp_db1_slugs.txt" "$OUTPUT_DIR/tmp_db2_slugs.txt" > "$OUTPUT_DIR/topics_only_in_db2.txt" 2>/dev/null || touch "$OUTPUT_DIR/topics_only_in_db2.txt"
rm -f "$OUTPUT_DIR/tmp_db1_slugs.txt" "$OUTPUT_DIR/tmp_db2_slugs.txt"
echo "      ✔ Saved: $OUTPUT_DIR/topics_only_in_db1.txt"
echo "      ✔ Saved: $OUTPUT_DIR/topics_only_in_db2.txt"

# 5. Quiz Details
echo "   … Generating quiz details..."
run_query "$DB1" "
SELECT 
    z.id as quiz_id,
    z.slug as quiz_slug,
    z.title as quiz_title,
    COALESCE(qt.slug, t.slug) as topic_slug,
    COUNT(DISTINCT q.id) as question_count,
    z.created_at
FROM quiz z
LEFT JOIN topic t ON t.id = z.topic_id
LEFT JOIN quiz_topic qt ON qt.slug = t.slug
LEFT JOIN question q ON q.quiz_id = z.id
GROUP BY z.id, z.slug, z.title, topic_slug, z.created_at
ORDER BY z.slug;
" > "$OUTPUT_DIR/db1_quiz_details.csv"
echo "      ✔ Saved: $OUTPUT_DIR/db1_quiz_details.csv"

run_query "$DB2" "
SELECT 
    z.id as quiz_id,
    z.slug as quiz_slug,
    z.title as quiz_title,
    COALESCE(qt.slug, t.slug) as topic_slug,
    COUNT(DISTINCT q.id) as question_count,
    z.created_at
FROM quiz z
LEFT JOIN topic t ON t.id = z.topic_id
LEFT JOIN quiz_topic qt ON qt.slug = t.slug
LEFT JOIN question q ON q.quiz_id = z.id
GROUP BY z.id, z.slug, z.title, topic_slug, z.created_at
ORDER BY z.slug;
" > "$OUTPUT_DIR/db2_quiz_details.csv"
echo "      ✔ Saved: $OUTPUT_DIR/db2_quiz_details.csv"

# 6. Duplicate Check
echo "   🔍 Checking for duplicates..."
run_query "$DB1" "
SELECT external_uid, COUNT(*) as occurrence_count 
FROM question 
WHERE external_uid IS NOT NULL
GROUP BY external_uid 
HAVING COUNT(*) > 1
ORDER BY occurrence_count DESC;
" > "$OUTPUT_DIR/db1_duplicates.csv"
echo "      ✔ Saved: $OUTPUT_DIR/db1_duplicates.csv"

run_query "$DB2" "
SELECT external_uid, COUNT(*) as occurrence_count 
FROM question 
WHERE external_uid IS NOT NULL
GROUP BY external_uid 
HAVING COUNT(*) > 1
ORDER BY occurrence_count DESC;
" > "$OUTPUT_DIR/db2_duplicates.csv"
echo "      ✔ Saved: $OUTPUT_DIR/db2_duplicates.csv"

# 7. External UID Comparison (to find missing/mismatched questions)
echo "   🔗 Generating external UID comparison..."
run_query_no_header "$DB1" "SELECT DISTINCT external_uid FROM question WHERE external_uid IS NOT NULL ORDER BY external_uid" > "$OUTPUT_DIR/tmp_db1_uids.txt"
run_query_no_header "$DB2" "SELECT DISTINCT external_uid FROM question WHERE external_uid IS NOT NULL ORDER BY external_uid" > "$OUTPUT_DIR/tmp_db2_uids.txt"
comm -23 "$OUTPUT_DIR/tmp_db1_uids.txt" "$OUTPUT_DIR/tmp_db2_uids.txt" > "$OUTPUT_DIR/uids_only_in_db1.txt" 2>/dev/null || touch "$OUTPUT_DIR/uids_only_in_db1.txt"
comm -13 "$OUTPUT_DIR/tmp_db1_uids.txt" "$OUTPUT_DIR/tmp_db2_uids.txt" > "$OUTPUT_DIR/uids_only_in_db2.txt" 2>/dev/null || touch "$OUTPUT_DIR/uids_only_in_db2.txt"
rm -f "$OUTPUT_DIR/tmp_db1_uids.txt" "$OUTPUT_DIR/tmp_db2_uids.txt"
echo "      ✔ Saved: $OUTPUT_DIR/uids_only_in_db1.txt"
echo "      ✔ Saved: $OUTPUT_DIR/uids_only_in_db2.txt"

# 8. Generate a reconciliation report
echo "   📄 Generating reconciliation report..."
{
    echo "# Database Reconciliation Report"
    echo ""
    echo "Generated: $(date)"
    echo "DB1: $DB1"
    echo "DB2: $DB2"
    echo ""
    echo "## Summary"
    echo ""
    echo "| Metric | DB1 | DB2 | Difference |"
    echo "|--------|-----|-----|------------|"
    echo "| Topics | $DB1_TOPICS | $DB2_TOPICS | $TOPICS_DIFF |"
    echo "| Quizzes | $DB1_QUIZZES | $DB2_QUIZZES | $QUIZZES_DIFF |"
    echo "| Questions | $DB1_QUESTIONS | $DB2_QUESTIONS | $QUESTIONS_DIFF |"
    echo "| Choices | $DB1_CHOICES | $DB2_CHOICES | $CHOICES_DIFF |"
    echo ""
    echo "## Files Generated"
    echo ""
    echo "- \`summary.csv\` - Overall statistics"
    echo "- \`questions_by_topic_comparison.csv\` - Question counts by topic (side-by-side)"
    echo "- \`db1_questions_by_quiz.csv\` - Questions per quiz in DB1"
    echo "- \`db2_questions_by_quiz.csv\` - Questions per quiz in DB2"
    echo "- \`db1_quiz_details.csv\` - Full quiz details from DB1"
    echo "- \`db2_quiz_details.csv\` - Full quiz details from DB2"
    echo "- \`topics_only_in_db1.txt\` - Topics present only in DB1"
    echo "- \`topics_only_in_db2.txt\` - Topics present only in DB2"
    echo "- \`uids_only_in_db1.txt\` - Question external_uids only in DB1"
    echo "- \`uids_only_in_db2.txt\` - Question external_uids only in DB2"
    echo "- \`db1_duplicates.csv\` - Duplicate external_uids in DB1"
    echo "- \`db2_duplicates.csv\` - Duplicate external_uids in DB2"
    echo ""
    echo "## Analysis"
    echo ""
    echo "### Topics with Question Count Differences"
    echo ""
    echo "See \`questions_by_topic_comparison.csv\` for detailed breakdown."
    echo ""
    if [ -s "$OUTPUT_DIR/topics_only_in_db2.txt" ]; then
        echo "### New Topics in DB2"
        echo ""
        cat "$OUTPUT_DIR/topics_only_in_db2.txt" | while read -r slug; do
            echo "- $slug"
        done
        echo ""
    fi
    if [ -s "$OUTPUT_DIR/topics_only_in_db1.txt" ]; then
        echo "### Topics Removed in DB2"
        echo ""
        cat "$OUTPUT_DIR/topics_only_in_db1.txt" | while read -r slug; do
            echo "- $slug"
        done
        echo ""
    fi
} > "$OUTPUT_DIR/RECONCILIATION_REPORT.md"
echo "      ✔ Saved: $OUTPUT_DIR/RECONCILIATION_REPORT.md"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "✔ Advanced comparison complete!"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "📁 All reports saved to: $OUTPUT_DIR"
echo ""
echo "Quick view:"
echo "  cat $OUTPUT_DIR/RECONCILIATION_REPORT.md"
echo "  cat $OUTPUT_DIR/summary.csv"
echo "  cat $OUTPUT_DIR/questions_by_topic_comparison.csv | grep -v ',0,0,0$'"

