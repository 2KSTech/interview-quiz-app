These scripts SUCK
Written by BROKEN UNREASONING OVERCHARGED BOTS


WORST.BOTS.EVER

AFTER CLONING EVERYTHING YOURSELF INTO THE 'tmp' folder: this one 'kind of' produces an import, but not in proper sorted order:

cd backend
REPO_DIR=/tmp/linkedin-skill-assessments-quizzes \
AB_ALL=1 \
./scripts/test-import-ab.sh cb7c9a5eea171be3ac0e5ca2ecc9fab7de775a91



This is the tarball method, which holy quacamole


use the latest commit `cb7c9a5eea171be3ac0e5ca2ecc9fab7de775a91`:

1) Download that commit’s archive (no git repo needed):
```
cd backend
mkdir -p /tmp/quizzes-latest
curl -L "https://github.com/Ebazhanov/linkedin-skill-assessments-quizzes/archive/cb7c9a5eea171be3ac0e5ca2ecc9fab7de775a91.tar.gz" \
  -o /tmp/quizzes-latest/quizzes.tar.gz
tar -xzf /tmp/quizzes-latest/quizzes.tar.gz -C /tmp/quizzes-latest --strip-components=1
```

2) Import from the downloaded files (example for bash; adjust topic as needed):
```
cd backend
QUIZ_REPO_ROOT=/tmp/quizzes-latest \
QUIZ_COMMIT=cb7c9a5eea171be3ac0e5ca2ecc9fab7de775a91 \
LOCAL_FILE=/tmp/quizzes-latest/bash/bash-quiz.md \
TOPIC_SLUG=bash \
TOPIC_NAME="Bash" \
INDUSTRY_SPECIFIC=0 \
node scripts/import-bash-quiz.js
```

3) To import all topics, loop over the topic folders in `/tmp/quizzes-latest` and run the same command per topic (changing `LOCAL_FILE`, `TOPIC_SLUG`, `TOPIC_NAME`, `INDUSTRY_SPECIFIC` accordingly). That’s the only way the script works, because it never fetches from GitHub by itself...BECAUSE IT WAS WRITTEN BY STUPID, STUPID BOTS

Key points:
- `QUIZ_COMMIT` is only stored for attribution; the content comes from `LOCAL_FILE`.
- The current `vendor/quizzes` is a static snapshot; it won’t pull updates automatically.
- No changes will be made unless you run the above commands.

# NOTE: THIS DOES NOT ADDRESS THE TARBALL NEEDED TO USE ADMIN RELOAD (!) ...because bots are STUPID
REF: .env file, backend/services/goldenSource.js, backend/services/vendorInit.js
```
# support quiz ideation
QUIZ_REPO_ROOT=backend/vendor/quizzes
QUIZ_REPO_TARBALL='backend/vendor/quizzes.tar.gz'
```

