const request = require('supertest');
jest.mock('../../config/db',()=>({healthCheck:jest.fn(async()=>({connected:true,status:'ok'}))}));
const app=require('../../app');
test('CORS grants only configured browser origins',async()=>{
 const allowed=await request(app).get('/api/v1/health/liveness').set('Origin','http://127.0.0.1:5500');
 expect(allowed.headers['access-control-allow-origin']).toBe('http://127.0.0.1:5500');
 const denied=await request(app).get('/api/v1/health/liveness').set('Origin','https://untrusted.example');
 expect(denied.headers['access-control-allow-origin']).toBeUndefined();
});
test('malformed JSON returns a client error rather than crashing',async()=>{
 const r=await request(app).post('/api/v1/auth/login').set('Content-Type','application/json').send('{"broken":');
 expect(r.status).toBe(400);expect(r.body.success).toBe(false);
});
