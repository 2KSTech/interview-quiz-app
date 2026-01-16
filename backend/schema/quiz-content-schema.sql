-- Quiz Content Database Schema
-- This schema defines the tables for quiz content, topics, questions, and related data

PRAGMA foreign_keys = ON;

-- Topics table - represents quiz categories/topics
CREATE TABLE IF NOT EXISTS topic (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  industry_specific INTEGER NOT NULL DEFAULT 0 CHECK (industry_specific IN (0,1))
);

-- Source table - tracks where quiz content came from (GitHub repos, etc.)
CREATE TABLE IF NOT EXISTS source (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  repo_url TEXT,
  source_url TEXT,
  license_spdx TEXT,
  attribution TEXT,
  commit_sha TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Import batch table - tracks batches of imported quiz content
CREATE TABLE IF NOT EXISTS import_batch (
  id INTEGER PRIMARY KEY,
  source_id INTEGER NOT NULL REFERENCES source(id) ON DELETE CASCADE,
  fetched_at TEXT NOT NULL,
  parser_version TEXT NOT NULL,
  raw_hash TEXT,
  notes TEXT
);

-- Quiz table - represents individual quizzes
CREATE TABLE IF NOT EXISTS quiz (
  id INTEGER PRIMARY KEY,
  topic_id INTEGER NOT NULL REFERENCES topic(id) ON DELETE CASCADE,
  source_id INTEGER REFERENCES source(id) ON DELETE SET NULL,
  import_batch_id INTEGER REFERENCES import_batch(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Question table - represents individual quiz questions
CREATE TABLE IF NOT EXISTS question (
  id INTEGER PRIMARY KEY,
  quiz_id INTEGER NOT NULL REFERENCES quiz(id) ON DELETE CASCADE,
  external_uid TEXT UNIQUE,
  number_in_source INTEGER,
  question_type TEXT NOT NULL CHECK (question_type IN ('single','multiple','true_false','short_answer')),
  prompt_md TEXT NOT NULL,
  code_md TEXT,
  code_language TEXT,
  explanation_md TEXT,
  difficulty TEXT,
  reference_url TEXT,
  position INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Choice table - represents answer choices for questions
CREATE TABLE IF NOT EXISTS choice (
  id INTEGER PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES question(id) ON DELETE CASCADE,
  label_md TEXT NOT NULL,
  is_correct INTEGER NOT NULL CHECK (is_correct IN (0,1)),
  position INTEGER NOT NULL
);

-- Question reference table - additional references/links for questions
CREATE TABLE IF NOT EXISTS question_reference (
  id INTEGER PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES question(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  note_md TEXT
);

-- Tag table - for categorizing questions
CREATE TABLE IF NOT EXISTS tag (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- Question-tag relationship table
CREATE TABLE IF NOT EXISTS question_tag (
  question_id INTEGER NOT NULL REFERENCES question(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
  PRIMARY KEY (question_id, tag_id)
);

-- Quiz topic table - simplified topic info for quick lookups
CREATE TABLE IF NOT EXISTS quiz_topic (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT,
  industry_specific INTEGER NOT NULL DEFAULT 0 CHECK (industry_specific IN (0,1))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_quiz_topic_id ON quiz(topic_id);
CREATE INDEX IF NOT EXISTS idx_question_quiz_pos ON question(quiz_id, position);
CREATE INDEX IF NOT EXISTS idx_choice_question_pos ON choice(question_id, position);
