#!/bin/bash
# Compare and reconcile two versions of quizdb.sqlite
# Usage: ./compare-quiz-databases.sh <db1> <db2> [output_format]
# Example: ./compare-quiz-databases.sh quizdb.sqlite quizdb.latest.FLAGGED.NEEDS_ANALYSIS.20260108_121056.sqlite

set -e

DB1="${1:-quizdb.sqlite}"
DB2="${2:-quizdb.latest.FLAGGED.NEEDS_ANALYSIS.20260108_121056.sqlite}"
OUTPUT_FORMAT="${3:-detailed}"

if [ ! -f "$DB1" ]; then
    echo "⚠ Error: Database 1 not found: $DB1"
    exit 1
fi

if [ ! -f "$DB2" ]; then
    echo "⚠ Error: Database 2 not found: $DB2"
    exit 1
fi

echo "🔍 Comparing databases:"
echo "   DB1: $DB1"
echo "   DB2: $DB2"
echo ""

# Function to run query and return results
run_query() {
    local db="$1"
    local query="$2"
    sqlite3 "$db" "$query" 2>/dev/null || echo ""
}

# Function to get count
get_count() {
    local db="$1"
    local query="$2"
    run_query "$db" "$query" | head -1
}

echo "═══════════════════════════════════════════════════════════════"
echo "┼ SUMMARY STATISTICS"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Basic counts
DB1_TOPICS=$(get_count "$DB1" "SELECT COUNT(*) FROM quiz_topic")
DB2_TOPICS=$(get_count "$DB2" "SELECT COUNT(*) FROM quiz_topic")
DB1_QUIZZES=$(get_count "$DB1" "SELECT COUNT(*) FROM quiz")
DB2_QUIZZES=$(get_count "$DB2" "SELECT COUNT(*) FROM quiz")
DB1_QUESTIONS=$(get_count "$DB1" "SELECT COUNT(*) FROM question")
DB2_QUESTIONS=$(get_count "$DB2" "SELECT COUNT(*) FROM question")
DB1_CHOICES=$(get_count "$DB1" "SELECT COUNT(*) FROM choice")
DB2_CHOICES=$(get_count "$DB2" "SELECT COUNT(*) FROM choice")

printf "%-30s %15s %15s %15s\n" "Metric" "DB1" "DB2" "Difference"
echo "────────────────────────────────────────────────────────────────"
printf "%-30s %15s %15s %15s\n" "Topics (quiz_topic)" "$DB1_TOPICS" "$DB2_TOPICS" "$((DB2_TOPICS - DB1_TOPICS))"
printf "%-30s %15s %15s %15s\n" "Quizzes" "$DB1_QUIZZES" "$DB2_QUIZZES" "$((DB2_QUIZZES - DB1_QUIZZES))"
printf "%-30s %15s %15s %15s\n" "Questions" "$DB1_QUESTIONS" "$DB2_QUESTIONS" "$((DB2_QUESTIONS - DB1_QUESTIONS))"
printf "%-30s %15s %15s %15s\n" "Choices" "$DB1_CHOICES" "$DB2_CHOICES" "$((DB2_CHOICES - DB1_CHOICES))"
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "📋 TOPIC COMPARISON (quiz_topic table)"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Prepare topic lists for comparison
TMP_DB1_SLUGS=$(mktemp)
TMP_DB2_SLUGS=$(mktemp)
run_query "$DB1" "SELECT slug FROM quiz_topic ORDER BY slug" > "$TMP_DB1_SLUGS"
run_query "$DB2" "SELECT slug FROM quiz_topic ORDER BY slug" > "$TMP_DB2_SLUGS"
DB1_TOPIC_COUNT=$(wc -l < "$TMP_DB1_SLUGS" 2>/dev/null | tr -d ' ' || echo "0")
DB2_TOPIC_COUNT=$(wc -l < "$TMP_DB2_SLUGS" 2>/dev/null | tr -d ' ' || echo "0")

# Topics in DB1 but not DB2
echo "🔴 Topics in DB1 but NOT in DB2:"
MISSING_IN_DB2=$(comm -23 "$TMP_DB1_SLUGS" "$TMP_DB2_SLUGS" 2>/dev/null || true)
if [ -z "$MISSING_IN_DB2" ]; then
    echo "   (none)"
else
    echo "$MISSING_IN_DB2" | while read -r slug; do
        [ -n "$slug" ] && echo "   - $slug"
    done
fi
echo ""

# Topics in DB2 but not DB1
echo "🟢 Topics in DB2 but NOT in DB1:"
MISSING_IN_DB1=$(comm -13 "$TMP_DB1_SLUGS" "$TMP_DB2_SLUGS" 2>/dev/null || true)
if [ -z "$MISSING_IN_DB1" ]; then
    echo "   (none)"
else
    echo "$MISSING_IN_DB1" | while read -r slug; do
        [ -n "$slug" ] && echo "   - $slug"
    done
fi
echo ""

# Topic list comparison summary
echo "┼ Topic list summary:"
echo "   DB1 has $DB1_TOPIC_COUNT topics"
echo "   DB2 has $DB2_TOPIC_COUNT topics"
if [ "$DB1_TOPIC_COUNT" = "$DB2_TOPIC_COUNT" ]; then
    echo "   ✔ Same number of topics"
else
    echo "   [WARN]  Different number of topics (difference: $((DB2_TOPIC_COUNT - DB1_TOPIC_COUNT)))"
fi
rm -f "$TMP_DB1_SLUGS" "$TMP_DB2_SLUGS"
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "… QUESTION COUNT BY QUIZ (User's Query Format - Corrected)"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# User's query format (corrected for actual schema)
# Original: select a.quiz_id, b.slug, count(*) from question a join quiz_topic b on b.id = a.quiz_id
# Corrected: Need to join question -> quiz -> topic -> quiz_topic (by slug)

echo "DB1 - Questions per quiz (with topic slug):"
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
" | while IFS='|' read -r quiz_id slug count; do
    printf "   Quiz ID: %-6s | Topic: %-30s | Questions: %s\n" "$quiz_id" "$slug" "$count"
done
echo ""

echo "DB2 - Questions per quiz (with topic slug):"
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
" | while IFS='|' read -r quiz_id slug count; do
    printf "   Quiz ID: %-6s | Topic: %-30s | Questions: %s\n" "$quiz_id" "$slug" "$count"
done
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "┼ QUESTIONS BY TOPIC SLUG"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Create comparison table
TMP_COMPARE=$(mktemp)
{
    echo "topic_slug|db1_count|db2_count|difference"
    # Get all unique topic slugs from both DBs
    {
        run_query "$DB1" "SELECT DISTINCT COALESCE(qt.slug, t.slug) FROM question q JOIN quiz z ON z.id = q.quiz_id LEFT JOIN topic t ON t.id = z.topic_id LEFT JOIN quiz_topic qt ON qt.slug = t.slug ORDER BY 1"
        run_query "$DB2" "SELECT DISTINCT COALESCE(qt.slug, t.slug) FROM question q JOIN quiz z ON z.id = q.quiz_id LEFT JOIN topic t ON t.id = z.topic_id LEFT JOIN quiz_topic qt ON qt.slug = t.slug ORDER BY 1"
    } | sort -u | while read -r slug; do
        [ -z "$slug" ] && continue
        COUNT1=$(get_count "$DB1" "SELECT COUNT(*) FROM question q JOIN quiz z ON z.id = q.quiz_id LEFT JOIN topic t ON t.id = z.topic_id LEFT JOIN quiz_topic qt ON qt.slug = t.slug WHERE COALESCE(qt.slug, t.slug) = '$slug'")
        COUNT2=$(get_count "$DB2" "SELECT COUNT(*) FROM question q JOIN quiz z ON z.id = q.quiz_id LEFT JOIN topic t ON t.id = z.topic_id LEFT JOIN quiz_topic qt ON qt.slug = t.slug WHERE COALESCE(qt.slug, t.slug) = '$slug'")
        COUNT1=${COUNT1:-0}
        COUNT2=${COUNT2:-0}
        DIFF=$((COUNT2 - COUNT1))
        echo "$slug|$COUNT1|$COUNT2|$DIFF"
    done
} > "$TMP_COMPARE"

printf "%-40s %15s %15s %15s\n" "Topic Slug" "DB1 Questions" "DB2 Questions" "Difference"
echo "────────────────────────────────────────────────────────────────"
tail -n +2 "$TMP_COMPARE" | while IFS='|' read -r slug count1 count2 diff; do
    if [ "$diff" != "0" ]; then
        printf "%-40s %15s %15s %15s [WARN]\n" "$slug" "$count1" "$count2" "$diff"
    else
        printf "%-40s %15s %15s %15s\n" "$slug" "$count1" "$count2" "$diff"
    fi
done
rm -f "$TMP_COMPARE"
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "🔍 DUPLICATE CHECK"
echo "═══════════════════════════════════════════════════════════════"
echo ""

echo "DB1 - Duplicate external_uids:"
DUP1=$(run_query "$DB1" "SELECT external_uid, COUNT(*) as cnt FROM question GROUP BY external_uid HAVING cnt > 1 LIMIT 10")
if [ -z "$DUP1" ]; then
    echo "   ✔ No duplicates found"
else
    echo "$DUP1" | while IFS='|' read -r uid cnt; do
        echo "   [WARN]  $uid: $cnt occurrences"
    done
fi
echo ""

echo "DB2 - Duplicate external_uids:"
DUP2=$(run_query "$DB2" "SELECT external_uid, COUNT(*) as cnt FROM question GROUP BY external_uid HAVING cnt > 1 LIMIT 10")
if [ -z "$DUP2" ]; then
    echo "   ✔ No duplicates found"
else
    echo "$DUP2" | while IFS='|' read -r uid cnt; do
        echo "   [WARN]  $uid: $cnt occurrences"
    done
fi
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "📋 QUIZ DETAILS COMPARISON"
echo "═══════════════════════════════════════════════════════════════"
echo ""

echo "DB1 - Quiz slugs and question counts:"
run_query "$DB1" "
SELECT 
    z.slug as quiz_slug,
    COALESCE(qt.slug, t.slug) as topic_slug,
    COUNT(DISTINCT q.id) as question_count
FROM quiz z
LEFT JOIN topic t ON t.id = z.topic_id
LEFT JOIN quiz_topic qt ON qt.slug = t.slug
LEFT JOIN question q ON q.quiz_id = z.id
GROUP BY z.id, z.slug, topic_slug
ORDER BY z.slug
LIMIT 20;
" | while IFS='|' read -r quiz_slug topic_slug count; do
    printf "   Quiz: %-30s | Topic: %-30s | Questions: %s\n" "$quiz_slug" "$topic_slug" "$count"
done
echo ""

echo "DB2 - Quiz slugs and question counts:"
run_query "$DB2" "
SELECT 
    z.slug as quiz_slug,
    COALESCE(qt.slug, t.slug) as topic_slug,
    COUNT(DISTINCT q.id) as question_count
FROM quiz z
LEFT JOIN topic t ON t.id = z.topic_id
LEFT JOIN quiz_topic qt ON qt.slug = t.slug
LEFT JOIN question q ON q.quiz_id = z.id
GROUP BY z.id, z.slug, topic_slug
ORDER BY z.slug
LIMIT 20;
" | while IFS='|' read -r quiz_slug topic_slug count; do
    printf "   Quiz: %-30s | Topic: %-30s | Questions: %s\n" "$quiz_slug" "$topic_slug" "$count"
done
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "✔ Comparison complete!"
echo "═══════════════════════════════════════════════════════════════"

