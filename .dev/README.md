# Development and Maintenance Tools

This folder contains critical tools and documentation for maintaining the wip-quiz-app.

## Structure

- **`scripts/`** - Import, comparison, and testing scripts for quiz data
- **`docs/`** - Documentation for database initialization, topic naming conventions, and analysis
- **`db-analysis/`** - Database comparison and reconciliation reports

## Scripts

### Import Scripts
- `README.md` - Instructions for importing quiz data from LinkedIn Skill Assessments repository
- `test-import-*.sh` - Test scripts for import functionality
- `compare-quiz-databases*.sh` - Database comparison utilities
- `diff-dbs.sh` - Database diff tool

**Note**: The actual import script (`import-bash-quiz.js`) remains in `backend/scripts/` as it is used by the API.

## Documentation

- `DB_INITIALIZATION_ANALYSIS.md` - Database initialization procedures
- `TOPIC_NAME_ANALYSIS.md` - Topic naming analysis
- `TOPIC_NAME_CONVENTIONS.md` - Topic naming conventions
- `TOPIC_NAME_STANDARDIZATION.md` - Topic name standardization procedures
- `ANSWERS.md` - Analysis document
- `REPO_ANALYSIS.md` - Repository analysis

## Database Analysis

- `db-analysis/db-comparison-20260108_173949/` - Database comparison results and reconciliation reports

## Usage

These tools are essential for:
- Re-importing quiz data from source repositories
- Validating database integrity
- Comparing database states
- Understanding topic naming conventions
- Troubleshooting import issues

**Important**: These files are required for maintainers to properly import, re-import, and validate quiz data.

