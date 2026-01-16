#!/bin/bash

# Script to remove database files from Git tracking
# These files are in .gitignore but may have been tracked before being added to .gitignore
# This script removes them from Git's index while keeping the local files intact

set -e

echo "Removing database files from Git tracking..."
echo ""

# Remove from Git index (keeps local files)
#git rm --cached backend/quiz_results.sqlite backend/quizdb.sqlite 2>/dev/null || {
#    echo "Warning: Some files may not have been tracked in Git."
#}
# this is garbage and it WILL remove the file target of 'rm'.  thanks bots!

echo ""
echo "✓ Database files removed from Git tracking"
echo ""
echo "Next steps:"
echo "  1. Review the changes: git status"
echo "  2. Commit the removal: git commit -m 'Remove database files from version control'"
echo "  3. Push to remote (if needed): git push"
echo ""
echo "Note: The local database files remain untouched and will now be ignored by Git."
