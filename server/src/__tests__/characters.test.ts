import { describe, it, expect, beforeEach } from 'vitest';
import { testDb } from './global-setup';
import request from 'supertest';
import app from '../app';

describe('Characters API', () => {
  beforeEach(() => {
    testDb.exec('DELETE FROM characters');
  });

  const sampleCharacter = {
    name: 'الیسا',
    description: 'دختر 25 ساله با موهای بلند',
    personality: 'مهربان، باهوش',
    scenario: 'در یک کافه',
    first_mes: 'سلام! حالت چطوره؟',
    mes_example: '<START>\n{{char}}: سلام\n{{user}}: سلام\n<END>',
    tags: ['دوستانه', 'فارسی'],
    creator_notes: 'کاراکتر تست',
  };

  it('باید کاراکتر جدید بسازه', async () => {
    const res = await request(app)
      .post('/api/characters')
      .send(sampleCharacter)
      .expect(201);

    expect(res.body.name).toBe('الیسا');
    expect(res.body.description).toBe('دختر 25 ساله با موهای بلند');
    expect(res.body.tags).toEqual(['دوستانه', 'فارسی']);
    expect(res.body.id).toBeDefined();
  });

  it('باید لیست کاراکترها رو برگردونه', async () => {
    await request(app).post('/api/characters').send(sampleCharacter);
    await request(app).post('/api/characters').send({ ...sampleCharacter, name: 'محمد' });

    const res = await request(app).get('/api/characters').expect(200);
    expect(res.body).toHaveLength(2);
  });

  it('باید کاراکتر رو با ID بگیره', async () => {
    const created = await request(app).post('/api/characters').send(sampleCharacter);
    const res = await request(app).get(`/api/characters/${created.body.id}`).expect(200);
    expect(res.body.name).toBe('الیسا');
  });

  it('باید کاراکتر رو آپدیت کنه', async () => {
    const created = await request(app).post('/api/characters').send(sampleCharacter);
    const res = await request(app)
      .put(`/api/characters/${created.body.id}`)
      .send({ name: 'الیسا 2', personality: 'شنونده' })
      .expect(200);

    expect(res.body.name).toBe('الیسا 2');
    expect(res.body.personality).toBe('شنونده');
  });

  it('باید کاراکتر رو حذف کنه', async () => {
    const created = await request(app).post('/api/characters').send(sampleCharacter);
    await request(app).delete(`/api/characters/${created.body.id}`).expect(200);

    const res = await request(app).get('/api/characters').expect(200);
    expect(res.body).toHaveLength(0);
  });

  it('باید 404 برگردونه برای کاراکتر ناموجود', async () => {
    await request(app).get('/api/characters/nonexistent').expect(404);
  });

  it('باید lorebook_id رو ذخیره کنه', async () => {
    const res = await request(app)
      .post('/api/characters')
      .send({ ...sampleCharacter, lorebook_id: 'test-lorebook-id' })
      .expect(201);

    expect(res.body.lorebook_id).toBe('test-lorebook-id');
  });
});
