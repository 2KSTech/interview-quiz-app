# Database Reconciliation Report

Generated: Thu Jan  8 17:39:52 EST 2026
DB1: quizdb.sqlite
DB2: quizdb.clean.20260108_171043.sqlite

## Summary

| Metric | DB1 | DB2 | Difference |
|--------|-----|-----|------------|
| Topics | 91 | 91 | 0 |
| Quizzes | 90 | 91 | 1 |
| Questions | 7478 | 9331 | 1853 |
| Choices | 33204 | 37959 | 4755 |

## Files Generated

- `summary.csv` - Overall statistics
- `questions_by_topic_comparison.csv` - Question counts by topic (side-by-side)
- `db1_questions_by_quiz.csv` - Questions per quiz in DB1
- `db2_questions_by_quiz.csv` - Questions per quiz in DB2
- `db1_quiz_details.csv` - Full quiz details from DB1
- `db2_quiz_details.csv` - Full quiz details from DB2
- `topics_only_in_db1.txt` - Topics present only in DB1
- `topics_only_in_db2.txt` - Topics present only in DB2
- `uids_only_in_db1.txt` - Question external_uids only in DB1
- `uids_only_in_db2.txt` - Question external_uids only in DB2
- `db1_duplicates.csv` - Duplicate external_uids in DB1
- `db2_duplicates.csv` - Duplicate external_uids in DB2

## Analysis

### Topics with Question Count Differences

See `questions_by_topic_comparison.csv` for detailed breakdown.

### New Topics in DB2

- typescript

### Topics Removed in DB2

- assets

