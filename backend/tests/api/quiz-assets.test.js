const request = require('supertest');
const express = require('express');
const path = require('path');
const fs = require('fs');

// Mount only the quiz-assets route for fast testing by stubbing router
const realRouter = require('../../routes/api');

const app = express();
app.use(express.json());
app.use('/api', realRouter);

describe('Quiz assets endpoint', () => {
  const arcImage = path.resolve(__dirname, '..', '..', 'vendor', 'quizzes', 'arc-gis', 'images', 'Q6.png');
  const bashImageA = path.resolve(__dirname, '..', '..', 'vendor', 'quizzes', 'bash', 'images', 'Q30', 'A.png');

  test('serves PNG from images subfolder', async () => {
    if (!fs.existsSync(arcImage)) return; // skip if not present in workspace
    const res = await request(app)
      .get('/api/quiz-assets/arc-gis/Q6.png')
      .expect(200);
    expect(res.headers['content-type']).toMatch(/image\/png/);
    expect(res.body).toBeInstanceOf(Buffer);
  });

  test('serves nested image path and ignores querystring in md links', async () => {
    if (!fs.existsSync(bashImageA)) return; // skip if not present
    const res = await request(app)
      .get('/api/quiz-assets/bash/images/Q30/A.png?raw=png')
      .expect(200);
    expect(res.headers['content-type']).toMatch(/image\/png/);
  });

  test('rejects traversal outside images directory (400 or 404 acceptable)', async () => {
    const res = await request(app)
      .get('/api/quiz-assets/bash/../bash/bash-quiz.md');
    expect([400, 404]).toContain(res.statusCode);
  });
});


