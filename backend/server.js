require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');

// Import only quiz-related services
const quizContentDb = require('./services/quizContentDb');
const quizResultsDb = require('./services/quizResultsDb');

// Import only quiz routes
const quizApiRoutes = require('./routes/quiz-api');

const app = express();
const PORT = process.env.PORT || 3010;

// CORS configuration - allow localhost for development
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3010',
  'http://localhost:4173',
];

if (process.env.CORS_ORIGINS) {
  const envOrigins = process.env.CORS_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean);
  allowedOrigins.push(...envOrigins);
}

const uniqueOrigins = [...new Set(allowedOrigins.filter(Boolean))];
console.log('[CORS] Allowed origins:', uniqueOrigins);

app.use(cors({
  origin: uniqueOrigins,
  credentials: true
}));

// Static files (for quiz assets)
app.use(express.static(path.join(__dirname, 'public')));

// Body parsing middleware
app.use(bodyParser.urlencoded({ extended: false, limit: '10mb' }));
app.use(bodyParser.json({ limit: '10mb' }));

// Quiz API routes
app.use('/api', quizApiRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    service: 'quiz-app',
    timestamp: new Date().toISOString()
  });
});

// Initialize quiz databases and start server
async function startServer() {
  try {
    // Initialize quiz content database
    quizContentDb.connect();
    console.log('[server] Quiz content database connected');
    
    // Initialize quiz results database
    quizResultsDb.connect();
    console.log('[server] Quiz results database connected');
    
    // Vendor init: unpack quizzes tarball and preseed DB if needed
    try {
      const { initOnce } = require('./services/vendorInit');
      initOnce().then((res) => {
        if (res?.ok) {
          console.log('[vendorInit] Local quizzes ready at', res.repoRoot || process.env.QUIZ_REPO_ROOT);
        } else {
          console.log('[vendorInit] Skipped or not available:', res?.reason);
        }
      }).catch((e) => console.warn('[vendorInit] init error', e?.message));
    } catch (_) {
      console.log('[vendorInit] Not available');
    }
    
    app.listen(PORT, () => {
      console.log(`[server - startServer] Quiz server running on http://localhost:${PORT}`);
      console.log(`[server - startServer]   Health check: GET /health`);
      console.log(`[server - startServer]   Quiz API: GET /api/quiz/*`);
    });
  } catch (error) {
    console.error('[server] Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[server] Shutting down gracefully...');
  quizContentDb.close();
  quizResultsDb.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n[server] Shutting down gracefully...');
  quizContentDb.close();
  quizResultsDb.close();
  process.exit(0);
});

startServer();
