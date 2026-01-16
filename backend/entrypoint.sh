#!/bin/sh

# Minimal init: ensure /app/data exists, copy seed if present, create results DB from schema, then start the server.
# This script is intentionally forgiving: it will not exit on initialization errors.

DATA_DIR="/app/data"
SEEDS_DIR="/app/seeds"
CONTENT_SCHEMA="/app/schema/quiz-content-schema.sql"
RESULTS_SCHEMA="/app/schema/quiz-results-schema.sql"
QUIZ_DB="$DATA_DIR/quizdb.sqlite"
RESULTS_DB="$DATA_DIR/quiz_results.sqlite"

# Ensure data directory exists
mkdir -p "$DATA_DIR"

# Initialize quiz content DB if missing
if [ ! -f "$QUIZ_DB" ]; then
  echo "[entrypoint] quizdb.sqlite not found; attempting initialization"
  if [ -f "$SEEDS_DIR/seed.db" ]; then
    echo "[entrypoint] Found seed at $SEEDS_DIR/seed.db; copying to $QUIZ_DB"
    cp -f "$SEEDS_DIR/seed.db" "$QUIZ_DB" 2>/dev/null || echo "[entrypoint] WARN: failed to copy seed.db"
    chmod 664 "$QUIZ_DB" 2>/dev/null || true
  elif [ -f "$CONTENT_SCHEMA" ]; then
    echo "[entrypoint] No seed.db; initializing from schema $CONTENT_SCHEMA"
    sqlite3 "$QUIZ_DB" < "$CONTENT_SCHEMA" 2>/dev/null || echo "[entrypoint] WARN: failed to initialize quiz DB from schema"
  else
    echo "[entrypoint] WARN: Neither seed.db nor schema found; skipping quiz DB initialization"
  fi
fi

# Initialize results DB if missing (schema-only; no seed)
if [ ! -f "$RESULTS_DB" ]; then
  if [ -f "$RESULTS_SCHEMA" ]; then
    echo "[entrypoint] Initializing results DB from schema $RESULTS_SCHEMA"
    sqlite3 "$RESULTS_DB" < "$RESULTS_SCHEMA" 2>/dev/null || echo "[entrypoint] WARN: failed to initialize results DB from schema"
  else
    echo "[entrypoint] WARN: Results schema missing; creating empty results DB"
    sqlite3 "$RESULTS_DB" "VACUUM;" 2>/dev/null || true
  fi
fi

# Start the application
exec node server.js
