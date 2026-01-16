#!/bin/bash
# Diff/reconcile two versions of quizdb.sqlite
# Usage: ./diff-quizdb.sh <db1.sqlite> <db2.sqlite>
# Example: ./diff-quizdb.sh quizdb.sqlite quizdb.latest.clean.20241201_120000.sqlite

set -e

DB1="${1:-quizdb.sqlite}"
DB2="${2}"

if [ -z "$DB2" ]; then
    echo "Usage: $0 <db1.sqlite> <db2.sqlite>"
    echo ""
    echo "This script compares two quizdb.sqlite databases and shows:"
    echo "  - Quiz counts per topic/slug"
    echo "  - Question counts per quiz"
    echo "  - Topic differences"
    echo "  - Overall statistics"
    echo ""
    echo "Example:"
    echo "  $0 quizdb.sqlite quizdb.latest.clean.20241201_120000.sqlite"
    exit 1
fi

if [ ! -f "$DB1" ]; then
    echo "⚠ Error: $DB1 not found"
    exit 1
fi

if [ ! -f "$DB2" ]; then
    echo "⚠ Error: $DB2 not found"
    exit 1
fi

echo "🔍 Comparing databases:"
echo "   DB1: $DB1"
echo "   DB2: $DB2"
echo ""

# Function to run query on a database
run_query() {
    local db="$1"
    local query="$2"
    sqlite3 "$db" "$query" 2>/ll || echo ""
}

# Overall statistics
echo "═══════════════════════════════════════════════════════════"
echo "┼ OVERALL STATISTICS"
echo "═══════════════════════════════════════════════════════════"
echo ""

echo "DB1 ($DB1):"
DB1_TOPICS=$(run_query "$DB1" "SELECT COUNT(*) FROM quiz_topic"
echo ""

echo "DB2 ($DB2):"
DB2_TOPICS=$(run_query "$DB2" "SELECT COUNT(*) FROM quiz_topic;")
DB2_QUIZZES=$(run_query "$DB2" "SELECT COUNT(DISTINCT id) FROM quiz;")
DB2_QUESTIONS=$(run_query "$DB2" "SELECT COUNT(*) FROM question;")
echo "  Topics:   $DB2_TOPICS"
echo "  Quizzes:  $DB2_QUIZZES"
echo "  Questions: $DB2_QUESTIONS"
echo ""

TOPIC_DIFF=$((DB2_TOPICS - DB1_TOPICS))
QUIZ_DIFF=$((DB2_QUIZZES - DB1_QUIZZES))
QUESTION_DIFF=$((DB2_QUESTIONS - DB1_QUESTIONS))

echo "Difference (DB2 - DB1):"
if [ "$TOPIC_DIFF" -gt 0 ]; then
    echo "  Topics:   +$TOPIC_DIFF [WARN]"
elif [ "$TOPIC_DIFF" -lt 0 ]; then
    echo "  Topics:   $TOPIC_DIFF [WARN]"
else
    echo "  Topics:   $TOPIC_DIFF ✓"
fi

if [ "$QUIZ_DIFF" -gt 0 ]; then
    echo "  Quizzes:  +$QUIZ_DIFF [WARN]"
elif [ "$QUIZ_DIFF" -lt 0 ]; then
    echo "  Quizzes:  $QUIZ_DIFF [WARN]"
else
    echo "  Quizzes:  $QUIZ_DIFF ✓"
fi

if [ "$QUESTION_DIFF" -gt 0 ]; then
    echo "  Questions: +$QUESTION_DIFF [WARN]"
elif [ "$QUESTION_DIFF" -lt 0 ]; then
    echo "  Questions: $QUESTION_DIFF [WARN]"
else
    echo "  Questions: $QUESTION_DIFF ✓"
fi
echo ""

# Quiz counts ery pattern, corrected)
echo "═══════════════════════════════════════════════════════════"
echo "📋 QUIZ COUNTS PER TOPIC/SLUG"
echo "═════════════════════════════════════════════ slug match)
run_query "$DB1" "SELECT a.quiz_id, b.slug, COUNT(*) as cnt FROM question a JOIN quiz b ON a.quiz_id = b.id GROUP BY a.quiz_id, b.slug ORDER BY a.quiz_id;" > "$TMP1"
run_query "$DB2" "SELECT a.quiz_id, b.slug, COUNT(*) as cnt FROM question a JOIN quiz b ON a.quiz_id = b.id GROUP BY a.quiz_id, b.slug ORDER BY a.quiz_id;" > "$TMP2"

echo "DB1 quiz counts (first 20):"
head -20 "$TMP1" | while IFS='|' read -r quiz_id slug cnt; do
    printf "  Quiz ID %3s | %-30s | %4s questions\n" "$quiz_id" "$slug" "$cnt"
done
echo ""

echo "DB2 quiz counts (first 20):"
head -20 "$TMP2" | while IFS='|' read -r quiz_id slug cnt; do
    printf "  Quiz ID %3s | %-30s | %4s questions\n" "$quiz_id" "$slug" "$cnt"
done
echo ""

# Find differences in quiz counts
echo "═══════════════════════════════════════════════════════════"
echo "🔍 QUIZ COUNT DIFFERENCES (by slug)"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Create slug-basa.quiz_id = b.id GROUP BY b.slug ORDER BY b.slug;" > "$TMP1_SLUG"
run_query "$DB2" "SELECT b.slug, COUNT(DISTINCT a.quiz_id) as quiz_count, COUNT(*) as question_count FROM question a JOIN quiz b ON a.quiz_id = b.id GROUP BY b.slug ORDER BY b.slug;" > "$TMP2_SLUG"

echo "Slugs in DB1 but not in DB2:"
comm -23 <(cut -d'|' -f1 "$TMP1_SLUG") <(cut -d'|' -f1 "$TMP2_SLUG") | while read slug; do
    if [ -n "$slug" ]; then
        line=$(grep "^$slug|" "$TMP1_SLUG")
        echo "  - $line"
    fi
done
echo ""

echo "Slugs in DB2 but not in DB1:"
comm -13 <(cut -d'|' -f1 "$TMP1_SLUG") <(cut -d'|' -f1 "$TMP2_SLUG") | while read slug; do
    if [ -n "$slug" ]; then
        line=$(grep "^$slug|" "$TMP2_SLUG")
        echo "  + $line"
    fi
done
echo ""

echo "Slugs with different question counts:"
join -t'|' -1 1 -2 1 <(sort "$TMP1_SLUG") <(sort "$TMP2_SLUG") | while IFS='|' read -r slug q1_cnt1 q1_cnt2 q2_cnt1 q2_cnt2; do
    if [ "$q1_cnt2" != "$q2_cnt2" ]; then
        diff=$((q2_cnt2 - q1_cnt2))
        printf "  %-30s | DB1: %4s questions | DB2: %4s questions | Diff: %+5d\n" "$slug" "$q1_cnt2" "$q2_cnt2" "$diff"
    fi
done
echo ""

# Topic differences
echo "═══════════════════════════════════════════════════════════"
echo "… TOPIC DIFFERENCES (quiz_topic table)"
echo "══MP1 $TMP2 $TMP1_SLUG $TMP2_SLUG $TMP_TOPICS1 $TMP_TOPICS2" EXIT

run_query "$DB1" "SELECT slug FROM quiz_topic ORDER BY slug;" > "$TMP_TOPICS1"
run_query "$DB2" "SELECT slug FROM quiz_topic ORDER BY slug;" > "$TMP_TOPICS2"

echo "Topics in DB1 but not in DB2:"
comm -23 "$TMP_TOPICS1" "$TMP_TOPICS2" | while read slug; do
    if [ -n "$slug" ]; then
        echo "  - $slug"
    fi
done
echo ""

echo "Topics in DB2 but not in DB1:"
comm -13 "$TMP_TOPICS1" "$TMP_TOPICS2" | while read slug; do
    if [ -n "$slug" ]; then
        echo "  + $slug"
    fi
done
echo ""

# Duplicate check
echo "═══════════════════════════════════════════════════════════"
echo "🔎 DUPLICATE CHECK (DB2)"
echo "═══════════════════════════════════════════════════════════"
echo ""

echo "Checking for duplicate questions (same slug/number_in_source with multiple external_uids) in DB2:"
run_query "$DB2" "WITH d AS (SELECT t.slug, q.number_in_source, COUNT(DISTINCT q.external_uid) dup FROM question q JOIN quiz z ON q.quiz_id=z.id JOIN topic t ON z.topic_id=t.id GROUP OMPARISON COMPLETE"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "To see fuluiz_id = b.id GROUP BY a.quiz_id, b.slug ORDER BY a.quiz_id;\""
echo ""
echo "To see full quiz counts for DB2:"
echo "  sqlite3 '$DB2' \"SELECT a.quiz_id, b.slug, COUNT(*) FROM question a JOIN quiz b ON a.quiz_id = b.id GROUP BY a.quiz_id, b.slug ORDER BY a.quiz_id;\""
echo ""


