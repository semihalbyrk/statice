const request = require('supertest');
const app = require('../index.js');

describe('GET /api/health', () => {
  it('returns status ok with a timestamp', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('timestamp');
    expect(new Date(res.body.timestamp).getTime()).not.toBeNaN();
  });

  it('responds with JSON content-type', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});
