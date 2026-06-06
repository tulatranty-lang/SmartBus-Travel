const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const env = require('../../config/env');

const mockUser = { id: 1, email: 'admin@smartbus.local', fullName: 'Admin SmartBus', role: 'admin', passwordHash: bcrypt.hashSync('123456', 4), isActive: true };
let mockSavedRefreshHash = null;

jest.mock('../../modules/auth/auth.repository', () => ({
  findUserByEmail: jest.fn(async (email) => email === 'admin@smartbus.local' ? mockUser : null),
  findUserById: jest.fn(async (id) => Number(id) === 1 ? mockUser : null),
  createUser: jest.fn(async (input) => ({ id: 2, ...input })),
  saveRefreshToken: jest.fn(async ({ tokenHash }) => { mockSavedRefreshHash = tokenHash; return { id: 1, tokenHash }; }),
  findActiveRefreshToken: jest.fn(async (tokenHash) => tokenHash === mockSavedRefreshHash ? { id: 1, userId: 1, tokenHash } : null),
  revokeRefreshToken: jest.fn(async () => ({ id: 1 })),
}));

describe('auth API', () => {
  test('rejects wrong credentials with 401', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'wrong@smartbus.local', password: 'bad' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
  test('logs in and does not expose password hash', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'admin@smartbus.local', password: '123456' });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.refreshToken).toBeTruthy();
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });
  test('refresh token rotates token and invalid token is rejected', async () => {
    const refreshToken = jwt.sign({ id: 1, email: mockUser.email, role: 'admin', typ: 'refresh' }, env.jwtRefreshSecret, { expiresIn: '7d' });
    const crypto = require('crypto');
    mockSavedRefreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const ok = await request(app).post('/api/v1/auth/refresh-token').send({ refreshToken });
    expect(ok.status).toBe(200);
    const bad = await request(app).post('/api/v1/auth/refresh-token').send({ refreshToken: 'bad.token' });
    expect(bad.status).toBe(401);
  });
  test('logout handles refresh token', async () => {
    const res = await request(app).post('/api/v1/auth/logout').send({ refreshToken: 'anything' });
    expect(res.status).toBe(200);
    expect(res.body.data.loggedOut).toBe(true);
  });
});
