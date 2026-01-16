#!/bin/bash
# Simple working import script
set -e

COMMIT_HASH="${1:-cb7c9a5eea171be3ac0e5ca2ecc9fab7de775a91}"
BACKUP_SUFFIX=$(date +%Y%m%d_%H%M%S)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$BACKEND_DIR" || exit 1

TARBALL_DIR="/tmp/quizzes-import-${BACKUP_SUFFIX}"
TARBALL_FILE="${TARBALL_DIR}/quizzes.tar.gz"
EXTRACT_DIR="${TARBALL_DIR}/extracted"
CLEAN_DB="${BACKEND_DIR}/quizdb.clean.${BACKUP_SUFFIX}.sqlite"

echo "Downloading tarball..."
mkdir -p "$TARBALL_DIR"
[ ! -f "$TARBALL_FILE" ] && curl -L "https://github.com/Ebazhanov/linkedin-skill-assessments-quizzes/archive/${COMMIT_HASH}.tar.gz" -o "$TARBALL_FILE"

echo "Extracting..."
mkdir -p "$EXTRACT_DIR"
tar -xzf "$TARBALL_FILE" -C "$EXTRACT_DIR" --strip-components=1

echo "Creating clean database..."
rm -f "$CLEAN_DB"
sqlite3 "$CLEAN_DB" "CREATE TABLE _init (id INTEGER); DROP TABLE _init;"

echo "Finding topics..."
find "$EXTRACT_DIR" -maxdepth 2 -name "*-quiz.md" -type f | \
    sed 's|/[^/]*$||' | sed "s|^${EXTRACT_DIR}/||" | sort -u > "${TARBALL_DIR}/topics.txt"

TOTAL=$(wc -l < "${TARBALL_DIR}/topics.txt" | tr -d ' ')
echo "Found $TOTAL topics. Importing..."

# Backup and swap DB
[ -f quizdb.sqlite ] && mv quizdb.sqlite "${BACKEND_DIR}/quizdb.sqlite.temp.${BACKUP_SUFFIX}"
cp "$CLEAN_DB" quizdb.sqlite

IMPORTED=0
while IFS= read -r topic_dir; do
    [ -z "$topic_dir" ] && continue
    topic_slug=$(basename "$topic_dir")
    quiz_file=$(find "$EXTRACT_DIR/$topic_dir" -maxdepth 1 -name "*-quiz.md" -type f | head -1)
    [ ! -f "$quiz_file" ] && continue
    
    topic_name=$(grep -m1 "^## " "$quiz_file" 2>/dev/null | sed 's/^## //' || echo "$topic_slug")
    
    cd "$BACKEND_DIR"
    QUIZ_COMMIT="$COMMIT_HASH" \
    LOCAL_FILE="$quiz_file" \
    TOPIC_SLUG="$topic_slug" \
    TOPIC_NAME="$topic_name" \
    SOURCE_NAME="Clean Import" \
    INDUSTRY_SPECIFIC=0 \
    node scripts/import-bash-quiz.js >/dev/null 2>&1 && ((IMPORTED++)) || true
    
    echo "[$IMPORTED/$TOTAL] $topic_slug"
done < "${TARBALL_DIR}/topics.txt"

mv quizdb.sqlite "$CLEAN_DB"
[ -f "${BACKEND_DIR}/quizdb.sqlite.temp.${BACKUP_SUFFIX}" ] && mv "${BACKEND_DIR}/quizdb.sqlite.temp.${BACKUP_SUFFIX}" quizdb.sqlite

echo ""
echo "Done. Database: $CLEAN_DB"
sqlite3 "$CLEAN_DB" "SELECT 'Topics: ' || COUNT(*) FROM quiz_topic UNION ALL SELECT 'Questions: ' || COUNT(*) FROM question;"

