import { describe, it, expect, beforeEach } from 'vitest';
import { testDb } from './global-setup';
import request from 'supertest';
import app from '../app';

describe('Personas API', () => {
  beforeEach(() => {
    testDb.exec('DELETE FROM personas');
  });

  it('باید پرسونای جدید بسازه', async () => {
    const res = await request(app)
      .post('/api/personas')
      .send({
        name: 'محمد',
        description: 'برنامه‌نویس',
        personality: 'کنجکاو',
      })
      .expect(201);

    expect(res.body.name).toBe('محمد');
    expect(res.body.description).toBe('برنامه‌نویس');
    expect(res.body.id).toBeDefined();
  });

  it('باید لیست پرسوناها رو برگردونه', async () => {
    await request(app).post('/api/personas').send({ name: 'محمد' });
    await request(app).post('/api/personas').send({ name: 'علی' });

    const res = await request(app).get('/api/personas').expect(200);
    expect(res.body).toHaveLength(2);
  });

  it('باید پرسونا رو آپدیت کنه', async () => {
    const persona = await request(app)
      .post('/api/personas')
      .send({ name: 'محمد' });

    const res = await request(app)
      .put(`/api/personas/${persona.body.id}`)
      .send({ name: 'محمد رضایی', description: 'توسعه‌دهنده' })
      .expect(200);

    expect(res.body.name).toBe('محمد رضایی');
    expect(res.body.description).toBe('توسعه‌دهنده');
  });

  it('باید پرسونا رو حذف کنه', async () => {
    const persona = await request(app)
      .post('/api/personas')
      .send({ name: 'محمد' });

    await request(app).delete(`/api/personas/${persona.body.id}`).expect(200);

    const res = await request(app).get('/api/personas').expect(200);
    expect(res.body).toHaveLength(0);
  });
});
