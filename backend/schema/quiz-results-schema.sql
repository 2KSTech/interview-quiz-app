-- Quiz Results Database Schema
-- This schema defines the tables for storing user quiz sessions and responses

PRAGMA foreign_keys = ON;

-- Quiz session table - tracks user quiz attempts
CREATE TABLE IF NOT EXISTS quiz_session (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL,
  topic_slug TEXT NOT NULL,
  quiz_slug TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  duration_ms INTEGER,
  score_correct INTEGER DEFAULT 0,
  score_total INTEGER DEFAULT 0
);

-- Question response table - tracks individual question responses within a session
CREATE TABLE IF NOT EXISTS question_response (
  id INTEGER PRIMARY KEY,
  session_id INTEGER NOT NULL,
  question_id INTEGER NOT NULL,
  is_correct INTEGER NOT NULL CHECK (is_correct IN (0,1)),
  response_time_ms INTEGER,
  answered_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES quiz_session(id) ON DELETE CASCADE
);

-- Response choice table - tracks which choices were selected for each response
CREATE TABLE IF NOT EXISTS response_choice (
  id INTEGER PRIMARY KEY,
  response_id INTEGER NOT NULL,
  choice_id INTEGER NOT NULL,
  selected INTEGER NOT NULL CHECK (selected IN (0,1)),
  FOREIGN KEY (response_id) REFERENCES question_response(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_session_user ON quiz_session(user_id, started_at);
CREATE INDEX IF NOT EXISTS idx_resp_session ON question_response(session_id);
CREATE INDEX IF NOT EXISTS idx_resp_choice_resp ON response_choice(response_id);
