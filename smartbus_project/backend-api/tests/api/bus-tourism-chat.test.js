const request = require('supertest');
const jwt = require('jsonwebtoken');
const env = require('../../config/env');

jest.mock('../../services/data.service', () => ({
  getRoutes: jest.fn(async () => [{ id: 'DN-03', routeCode: 'DN-03', displayCode: 'DN-03', name: 'Đà Nẵng - Bà Nà', originName: 'Trung tâm', destinationName: 'Bà Nà', time: '05:30-18:00', interval: '20 phút', fare: '20.000đ', provinceCode: 'DN', provinceName: 'Đà Nẵng', path: [[16.047,108.206],[16.02,108.19]] }]),
  getRoute: jest.fn(async (id) => id === 'DN-03' ? { id: 'DN-03', routeCode: 'DN-03', displayCode: 'DN-03', name: 'Đà Nẵng - Bà Nà', fare: '20.000đ', time: '05:30-18:00', interval: '20 phút', path: [[16.047,108.206],[16.02,108.19]] } : null),
  getStops: jest.fn(async () => [{ id: '1', name: 'Bến trung tâm', address: 'Đà Nẵng', lat: 16.047, lng: 108.206, provinceCode: 'DN', provinceName: 'Đà Nẵng', routeId: 'DN-03' }]),
  getBuses: jest.fn(async () => [{ id: 'BUS-1', routeId: 'DN-03', status: 'active', lat: 16.047, lng: 108.206 }]),
  getVehicles: jest.fn(async () => []),
  addChatLog: jest.fn(async (log) => ({ id: 1, ...log })),
  getChatHistory: jest.fn(async (userId) => [{ id: 1, userId, message: 'Tôi muốn đến Hội An', reply: 'Gợi ý tuyến' }]),
}));

jest.mock('../../modules/tourism/tourism.repository', () => ({
  listCategories: jest.fn(async () => [{ id: 1, code: 'heritage', name: 'Di sản' }]),
  findPlaces: jest.fn(async () => [{ id: 1, name: 'Phố cổ Hội An', provinceCode: 'QN_CU', provinceName: 'Quảng Nam cũ', description: 'Di sản', category: 'heritage', latitude: 15.8801, longitude: 108.338, averageRating: 4.8, reviewCount: 10 }]),
  findById: jest.fn(async (id) => Number(id) === 1 ? { id: 1, name: 'Phố cổ Hội An', provinceCode: 'QN_CU', provinceName: 'Quảng Nam cũ', description: 'Di sản', category: 'heritage', latitude: 15.8801, longitude: 108.338 } : null),
  nearbyStops: jest.fn(async () => []),
  nearbyStopsForPlaces: jest.fn(async () => new Map([[1, []]])),
  reviews: jest.fn(async () => []),
  favoritePlace: jest.fn(),
  unfavoritePlace: jest.fn(),
  myFavorites: jest.fn(async () => []),
}));

const app = require('../../app');

describe('bus/tourism/chat API', () => {
  test('GET /api/v1/routes has pagination and DTO', async () => {
    const res = await request(app).get('/api/v1/routes?page=1&limit=20');
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toHaveProperty('code', 'DN-03');
    expect(res.body.pagination.total).toBe(1);
  });
  test('GET /api/v1/stops/nearest validates coordinates', async () => {
    const res = await request(app).get('/api/v1/stops/nearest?lat=16.047&lng=108.206');
    expect(res.status).toBe(200);
    expect(res.body.data.nearestStop.name).toBe('Bến trung tâm');
  });
  test('GET /api/v1/map/overview returns layer pointers', async () => {
    const res = await request(app).get('/api/v1/map/overview');
    expect(res.status).toBe(200);
    expect(res.body.data.counts.routes).toBe(1);
  });
  test('GET /api/v1/tourism/places returns tourism data with pagination', async () => {
    const res = await request(app).get('/api/v1/tourism/places?provinceCode=QN_CU');
    expect(res.status).toBe(200);
    expect(res.body.data[0].name).toContain('Hội An');
    expect(res.body.pagination.total).toBe(1);
  });
  test('tourism detail 404 for missing id', async () => {
    const res = await request(app).get('/api/v1/tourism/places/999');
    expect(res.status).toBe(404);
  });
  test('POST /api/v1/chatbot/ask rejects empty and answers basic question', async () => {
    const empty = await request(app).post('/api/v1/chatbot/ask').send({ message: '' });
    expect(empty.status).toBeGreaterThanOrEqual(400);
    const ok = await request(app).post('/api/v1/chatbot/ask').send({ message: 'Tuyến DN-03 đi đâu?', lat: 16.047, lng: 108.206 });
    expect(ok.status).toBe(200);
    expect(ok.body.reply || ok.body.data.reply).toBeTruthy();
  });
  test('GET /api/v1/chat/history requires login and returns personal history', async () => {
    const noAuth = await request(app).get('/api/v1/chat/history');
    expect(noAuth.status).toBe(401);
    const token = jwt.sign({ id: 10, email: 'user@smartbus.local', role: 'user' }, env.jwtAccessSecret, { expiresIn: '15m' });
    const auth = await request(app).get('/api/v1/chat/history').set('Authorization', `Bearer ${token}`);
    expect(auth.status).toBe(200);
    expect(auth.body.data[0].userId).toBe(10);
  });
});
