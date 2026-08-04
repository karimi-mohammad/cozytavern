import { describe, it, expect, beforeEach } from 'vitest';
import { testDb } from './global-setup';
import request from 'supertest';
import app from '../app';

describe('API Settings', () => {
  beforeEach(() => {
    testDb.exec('DELETE FROM api_settings');
  });

  it('باید تنظیمات پیش‌فرض برگردونه وقتی خالیه', async () => {
    const res = await request(app).get('/api/api-settings').expect(200);
    expect(res.body.base_url).toBe('');
    expect(res.body.model).toBe('');
    expect(res.body.temperature).toBe(0.7);
  });

  it('باید تنظیمات رو ذخیره کنه', async () => {
    const res = await request(app)
      .post('/api/api-settings')
      .send({
        base_url: 'http://localhost:11434/v1/chat/completions',
        api_key: 'test-key',
        model: 'llama3',
        temperature: 0.8,
      })
      .expect(200);

    expect(res.body.success).toBe(true);

    const getRes = await request(app).get('/api/api-settings').expect(200);
    expect(getRes.body.base_url).toBe('http://localhost:11434/v1/chat/completions');
    expect(getRes.body.model).toBe('llama3');
  });

  it('باید تنظیمات رو آپدیت کنه', async () => {
    await request(app)
      .post('/api/api-settings')
      .send({ base_url: 'http://old.com', model: 'old-model' });

    await request(app)
      .post('/api/api-settings')
      .send({ base_url: 'http://new.com', model: 'new-model' });

    const res = await request(app).get('/api/api-settings').expect(200);
    expect(res.body.base_url).toBe('http://new.com');
    expect(res.body.model).toBe('new-model');
  });

  it('باید stream رو ذخیره کنه', async () => {
    await request(app)
      .post('/api/api-settings')
      .send({ stream: false });

    const res = await request(app).get('/api/api-settings').expect(200);
    expect(res.body.stream).toBe(false);
  });
});
