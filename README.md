# Interview Quiz Testing App

A standalone single-page application for practicing interview questions, including behavioral, technical, and industry-specific quizzes.

## Features

- **Behavioral Interviews**: Practice common behavioral questions with STAR method guidance
- **Technical Interviews**: Multiple-choice technical quizzes on various topics (Bash, JavaScript, React, etc.)
- **Industry-Specific Interviews**: Role-specific technical questions (AWS, etc.)
- **Topic Selection**: Choose from available quiz topics
- **Timer**: Track your interview session time
- **Review Mode**: See correct answers while practicing

## Prerequisites

- Node.js 18+ and npm
- Backend API server running (see Backend Setup below)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Configure the API endpoint (optional):
   - Create a `.env` file in the root directory
   - Add: `VITE_API_BASE_URL=http://localhost:3010/api`
   - Defaults to `http://localhost:3010/api` if not set

## Development

Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Backend Setup

This app requires a backend API server that provides quiz data. The backend should expose the following endpoints:

- `GET /quiz/:topicSlug/random10` - Get 10 random questions for a topic
- `GET /quiz/:topicSlug/latest` - Get the latest quiz for a topic
- `GET /quiz/:quizSlug/questions` - Get questions for a specific quiz
- `GET /quiz/topics/local` - Get locally available topics
- `GET /quiz/topics` - Get cached topics
- `POST /quiz/import-local` - Import a topic from local files
- `GET /quiz-assets/:topicSlug/*` - Serve quiz assets (images, etc.)
- `POST /quiz/session/start` - Start a quiz session (optional)
- `POST /quiz/session/:id/answer` - Submit an answer (optional)
- `POST /quiz/session/:id/complete` - Complete a session (optional)

The session endpoints are optional - the app will work without them, but won't track progress.

## Project Structure

```
src/
  components/
    MockInterviews.tsx    # Main interview component
  config/
    environment.ts        # API configuration
  data/
    mockData.ts          # Mock interview data
  services/
    api.ts               # API client (no auth required)
  types/
    index.ts             # TypeScript types
```

## Technologies

- React 18
- TypeScript
- Vite
- Tailwind CSS
- React Markdown
- Lucide React (icons)

## License

MIT

## Contributing

This is a standalone extraction from a larger application. To contribute:

1. Ensure the backend API is running
2. Test with various quiz topics
3. Submit improvements via pull requests

## Notes

- No authentication is required - this is a public testing app
- Quiz content is sourced from the LinkedIn Skill Assessments community repository collected by Evgenii Bazhanov et al [ref: https://github.com/Ebazhanov/]
- The app is designed to work with a compatible backend API server

