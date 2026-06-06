const request = require('supertest');

jest.mock('../../config/db', () => ({
  healthCheck: jest.fn().mockResolvedValue({ configured: false, connected: false, status: 'missing_config', message: 'missing db config' }),
}));

const app = require('../../app');

describe('health endpoints', () => {
  test('GET /api/v1/health returns 200 and database health without crashing', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.service).toBe('smartbus-backend');
    expect(res.body.database.status).toBe('missing_config');
  });

  test('GET /api/v1/health/liveness returns app alive', async () => {
    const res = await request(app).get('/api/v1/health/liveness');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('GET /api/v1/health/db returns degraded without crashing when DB config is missing', async () => {
    const res = await request(app).get('/api/v1/health/db');
    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.status).toBe('degraded');
  });
});
