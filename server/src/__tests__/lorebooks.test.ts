import { describe, it, expect, beforeEach } from 'vitest';
import { testDb } from './global-setup';
import request from 'supertest';
import app from '../app';

describe('Lorebooks API', () => {
  beforeEach(() => {
    testDb.exec('DELETE FROM lorebook_entries');
    testDb.exec('DELETE FROM lorebooks');
  });

  it('باید لوربوک جدید بسازه', async () => {
    const res = await request(app)
      .post('/api/lorebooks')
      .send({ name: 'دنیای تست' })
      .expect(201);

    expect(res.body.name).toBe('دنیای تست');
    expect(res.body.id).toBeDefined();
  });

  it('باید لیست لوربوک‌ها رو برگردونه', async () => {
    await request(app).post('/api/lorebooks').send({ name: 'دنیای 1' });
    await request(app).post('/api/lorebooks').send({ name: 'دنیای 2' });

    const res = await request(app).get('/api/lorebooks').expect(200);
    expect(res.body).toHaveLength(2);
  });

  it('باید لوربوک رو با entries بگیره', async () => {
    const lorebook = await request(app)
      .post('/api/lorebooks')
      .send({ name: 'تست' });

    await request(app)
      .post(`/api/lorebooks/${lorebook.body.id}/entries`)
      .send({
        key: ['گربه', 'cat'],
        content: 'گربه حیوان خانگی است',
      });

    const res = await request(app)
      .get(`/api/lorebooks/${lorebook.body.id}`)
      .expect(200);

    expect(res.body.entries).toHaveLength(1);
    expect(res.body.entries[0].key).toEqual(['گربه', 'cat']);
  });

  it('باید entry اضافه کنه', async () => {
    const lorebook = await request(app)
      .post('/api/lorebooks')
      .send({ name: 'تست' });

    const res = await request(app)
      .post(`/api/lorebooks/${lorebook.body.id}/entries`)
      .send({
        key: ['سگ', 'dog'],
        keysecondary: ['سفید'],
        content: 'سگ سفید حیوان وفاداری است',
        constant: false,
        selective: true,
        position: 'before_main',
      })
      .expect(201);

    expect(res.body.key).toEqual(['سگ', 'dog']);
    expect(res.body.content).toBe('سگ سفید حیوان وفاداری است');
  });

  it('باید entry رو حذف کنه', async () => {
    const lorebook = await request(app)
      .post('/api/lorebooks')
      .send({ name: 'تست' });

    const entry = await request(app)
      .post(`/api/lorebooks/${lorebook.body.id}/entries`)
      .send({ key: ['تست'], content: 'محتوا' });

    await request(app)
      .delete(`/api/lorebooks/entries/${entry.body.id}`)
      .expect(200);

    const res = await request(app)
      .get(`/api/lorebooks/${lorebook.body.id}`)
      .expect(200);

    expect(res.body.entries).toHaveLength(0);
  });

  it('باید لوربوک رو حذف کنه', async () => {
    const lorebook = await request(app)
      .post('/api/lorebooks')
      .send({ name: 'تست' });

    await request(app)
      .delete(`/api/lorebooks/${lorebook.body.id}`)
      .expect(200);

    const res = await request(app).get('/api/lorebooks').expect(200);
    expect(res.body).toHaveLength(0);
  });

  it('باید entry با constant=true بسازه', async () => {
    const lorebook = await request(app)
      .post('/api/lorebooks')
      .send({ name: 'تست' });

    const res = await request(app)
      .post(`/api/lorebooks/${lorebook.body.id}/entries`)
      .send({
        key: [],
        content: 'همیشه فعال',
        constant: true,
      })
      .expect(201);

    expect(res.body.constant).toBe(true);
  });
});
