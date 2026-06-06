const request = require('supertest');
const jwt = require('jsonwebtoken');
const env = require('../../config/env');

jest.mock('../../config/db', () => ({
  healthCheck: jest.fn().mockResolvedValue({ configured: false, connected: false, status: 'missing_config' }),
}));

const app = require('../../app');

function token(role = 'user') {
  return jwt.sign({ id: role === 'admin' ? 1 : 2, email: `${role}@smartbus.local`, role, roles: [role], permissions: [] }, env.jwtAccessSecret, { expiresIn: '15m' });
}

describe('security auth/rbac smoke tests', () => {
  test('reports list requires login and rejects normal users', async () => {
    const noAuth = await request(app).get('/api/v1/reports');
    expect(noAuth.status).toBe(401);
    const user = await request(app).get('/api/v1/reports').set('Authorization', `Bearer ${token('user')}`);
    expect(user.status).toBe(403);
  });

  test('analytics summary requires admin/moderator', async () => {
    const noAuth = await request(app).get('/api/v1/analytics/summary');
    expect(noAuth.status).toBe(401);
    const user = await request(app).get('/api/v1/analytics/summary').set('Authorization', `Bearer ${token('user')}`);
    expect(user.status).toBe(403);
  });

  test('notifications and import are not public', async () => {
    const notifications = await request(app).get('/api/v1/notifications');
    expect(notifications.status).toBe(401);
    const importHistory = await request(app).get('/api/v1/import/history').set('Authorization', `Bearer ${token('user')}`);
    expect(importHistory.status).toBe(403);
  });

  test('review and post vote require login', async () => {
    const reviewVote = await request(app).post('/api/v1/reviews/1/vote');
    expect(reviewVote.status).toBe(401);
    const postVote = await request(app).post('/api/v1/community/posts/1/vote');
    expect(postVote.status).toBe(401);
  });
});
