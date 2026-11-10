process.env.RATE_LIMIT_MAX='3';
const request=require('supertest');
const app=require('../../app');
test('rate limiting returns useful JSON and cannot be reset with forged forwarded IP',async()=>{
 for(let n=0;n<3;n++)expect((await request(app).get('/missing').set('X-Forwarded-For',`10.0.0.${n}`)).status).toBe(404);
 const r=await request(app).get('/missing').set('X-Forwarded-For','203.0.113.11');
 expect(r.status).toBe(429);expect(r.body.errorCode).toBe('RATE_LIMITED');expect(Number(r.headers['retry-after'])).toBeGreaterThan(0);
});
