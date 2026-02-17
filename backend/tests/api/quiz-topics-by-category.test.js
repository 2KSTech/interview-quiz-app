// require('dotenv').config(); 
// Load environment variables from env.template
require('dotenv').config({ path: 'env.template' });
const request = require('supertest');
const express = require('express');
const quizApiRoutes = require('../../routes/quiz-api');
const quizContentDb = require('../../services/quizContentDb');

const app = express();
app.use(express.json());
app.use('/api', quizApiRoutes);

describe('Quiz topics by category endpoint', () => {
  let originalTopics = [];
  
  // Capture original state - DO NOT MODIFY
  beforeAll(async () => {
    quizContentDb.connect();
    // Read existing topics to verify they exist
    originalTopics = await quizContentDb.all(
      `SELECT slug, name, industry_specific FROM quiz_topic ORDER BY slug`
    );
  });

  afterAll(async () => {
    quizContentDb.close();
  });

  test('endpoint exists and returns array', async () => {
    const res = await request(app)
      .get('/api/quiz/topics/by-category-with-files?industry_specific=0')
      .expect(200);
    
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('returns only technical topics when industry_specific=0', async () => {
    const res = await request(app)
      .get('/api/quiz/topics/by-category-with-files?industry_specific=0')
      .expect(200);
    
    expect(Array.isArray(res.body)).toBe(true);
    
    // Verify all returned topics are actually technical (industry_specific = 0)
    const returnedSlugs = res.body.map(t => t.topic_slug?.toLowerCase());
    
    // Check against database to verify category
    for (const topic of res.body) {
      const dbTopic = originalTopics.find(t => 
        t.slug?.toLowerCase() === topic.topic_slug?.toLowerCase()
      );
      if (dbTopic) {
        expect(dbTopic.industry_specific).toBe(0);
      }
    }
    
    // Verify no industry-specific topics are in the result
    const industryTopics = originalTopics.filter(t => t.industry_specific === 1);
    for (const industryTopic of industryTopics) {
      expect(returnedSlugs).not.toContain(industryTopic.slug?.toLowerCase());
    }
  });

  test('returns only industry-specific topics when industry_specific=1', async () => {
    const res = await request(app)
      .get('/api/quiz/topics/by-category-with-files?industry_specific=1')
      .expect(200);
    
    expect(Array.isArray(res.body)).toBe(true);
    
    // Verify all returned topics are actually industry-specific (industry_specific = 1)
    const returnedSlugs = res.body.map(t => t.topic_slug?.toLowerCase());
    
    // Check against database to verify category
    for (const topic of res.body) {
      const dbTopic = originalTopics.find(t => 
        t.slug?.toLowerCase() === topic.topic_slug?.toLowerCase()
      );
      if (dbTopic) {
        expect(dbTopic.industry_specific).toBe(1);
      }
    }
    
    // Verify no technical topics are in the result
    const technicalTopics = originalTopics.filter(t => t.industry_specific === 0);
    for (const technicalTopic of technicalTopics) {
      expect(returnedSlugs).not.toContain(technicalTopic.slug?.toLowerCase());
    }
  });

  test('handles string "true" parameter for industry-specific', async () => {
    const res = await request(app)
      .get('/api/quiz/topics/by-category-with-files?industry_specific=true')
      .expect(200);
    
    expect(Array.isArray(res.body)).toBe(true);
    
    // Should return industry-specific topics (same as industry_specific=1)
    const returnedSlugs = res.body.map(t => t.topic_slug?.toLowerCase());
    
    // Verify all are industry-specific
    for (const topic of res.body) {
      const dbTopic = originalTopics.find(t => 
        t.slug?.toLowerCase() === topic.topic_slug?.toLowerCase()
      );
      if (dbTopic) {
        expect(dbTopic.industry_specific).toBe(1);
      }
    }
  });

  test('handles string "1" parameter for industry-specific', async () => {
    const res = await request(app)
      .get('/api/quiz/topics/by-category-with-files?industry_specific=1')
      .expect(200);
    
    expect(Array.isArray(res.body)).toBe(true);
    
    // Should return industry-specific topics
    for (const topic of res.body) {
      const dbTopic = originalTopics.find(t => 
        t.slug?.toLowerCase() === topic.topic_slug?.toLowerCase()
      );
      if (dbTopic) {
        expect(dbTopic.industry_specific).toBe(1);
      }
    }
  });

  test('response includes required fields', async () => {
    const res = await request(app)
      .get('/api/quiz/topics/by-category-with-files?industry_specific=0')
      .expect(200);
    
    if (res.body.length > 0) {
      const firstTopic = res.body[0];
      expect(firstTopic).toHaveProperty('topic_slug');
      expect(firstTopic).toHaveProperty('topic_name');
      expect(firstTopic).toHaveProperty('file');
      expect(firstTopic).toHaveProperty('cached');
      expect(typeof firstTopic.topic_slug).toBe('string');
      expect(typeof firstTopic.topic_name).toBe('string');
    }
  });

  test('topic names are not uppercased slugs', async () => {
    const res = await request(app)
      .get('/api/quiz/topics/by-category-with-files?industry_specific=0')
      .expect(200);
    
    for (const topic of res.body) {
      const slug = topic.topic_slug?.toLowerCase();
      const name = topic.topic_name;
      
      // Name should not be just the uppercased slug
      if (slug && name) {
        expect(name).not.toBe(slug.toUpperCase());
        
        // If name matches slug (case-insensitive), that's also wrong for multi-char slugs
        if (slug.length > 3 && name.toLowerCase() === slug) {
          // This would indicate name wasn't properly set
          console.warn(`Topic ${slug} has name that matches slug: ${name}`);
        }
      }
    }
  });

  test('technical and industry-specific lists are mutually exclusive', async () => {
    const technicalRes = await request(app)
      .get('/api/quiz/topics/by-category-with-files?industry_specific=0')
      .expect(200);
    
    const industryRes = await request(app)
      .get('/api/quiz/topics/by-category-with-files?industry_specific=1')
      .expect(200);
    
    const technicalSlugs = new Set(technicalRes.body.map(t => t.topic_slug?.toLowerCase()));
    const industrySlugs = new Set(industryRes.body.map(t => t.topic_slug?.toLowerCase()));
    
    // No topic should appear in both lists
    const intersection = [...technicalSlugs].filter(slug => industrySlugs.has(slug));
    expect(intersection).toHaveLength(0);
  });
});
