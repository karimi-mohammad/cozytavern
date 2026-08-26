import { describe, it, expect, beforeEach } from 'vitest';
import { testDb } from './mc-setup';
import request from 'supertest';
import app from '../app';

describe('Messages & Chats API', () => {
  let charId: string;
  let chatId: string;
  let msgSeq: number;

  beforeEach(() => {
    testDb.exec('DELETE FROM messages');
    testDb.exec('DELETE FROM chats');
    testDb.exec('DELETE FROM characters');
    msgSeq = 0;

    charId = `mc-char-${Date.now()}`;
    chatId = `mc-chat-${Date.now()}`;
    testDb.prepare(
      "INSERT INTO characters (id, name, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))"
    ).run(charId, 'تست');
    testDb.prepare(
      "INSERT INTO chats (id, character_id, name, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))"
    ).run(chatId, charId, 'چت تست');
  });

  const postMessage = (overrides: any = {}) =>
    request(app)
      .post('/api/messages')
      .send({ chat_id: chatId, role: 'user', content: 'سلام', ...overrides });

  const directMessage = (role: string, content: string, targetChatId?: string) => {
    msgSeq++;
    const id = `mc-msg-${msgSeq}`;
    const sendDate = new Date(Date.now() + msgSeq * 1000).toISOString();
    testDb.prepare(
      "INSERT INTO messages (id, chat_id, role, content, swipes, swipe_id, is_edited, is_system, send_date) VALUES (?, ?, ?, ?, '[]', 0, 0, 0, ?)"
    ).run(id, targetChatId || chatId, role, content, sendDate);
    return id;
  };

  // ─── Messages ───

  describe('POST /api/messages', () => {
    it('باید پیام جدید بسازه', async () => {
      const res = await postMessage().expect(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.chat_id).toBe(chatId);
      expect(res.body.role).toBe('user');
      expect(res.body.swipes).toEqual([]);
      expect(res.body.is_edited).toBe(false);
    });

    it('باید 400 برگردونه اگر chat_id نباشه', async () => {
      await request(app)
        .post('/api/messages')
        .send({ role: 'user', content: 'test' })
        .expect(400);
    });

    it('باید updated_at چت رو آپدیت کنه', async () => {
      const before = testDb.prepare('SELECT updated_at FROM chats WHERE id = ?').get(chatId) as any;
      await new Promise(r => setTimeout(r, 10));
      await postMessage();
      const after = testDb.prepare('SELECT updated_at FROM chats WHERE id = ?').get(chatId) as any;
      expect(after.updated_at >= before.updated_at).toBe(true);
    });
  });

  describe('PUT /api/messages/:id', () => {
    it('باید پیام رو ادیت کنه', async () => {
      const created = await postMessage();
      const res = await request(app)
        .put(`/api/messages/${created.body.id}`)
        .send({ content: 'ویرایش شده' })
        .expect(200);

      expect(res.body.content).toBe('ویرایش شده');
      expect(res.body.is_edited).toBe(true);
    });

    it('باید نسخه اصلی رو در swipes ذخیره کنه', async () => {
      const created = await postMessage({ content: 'اصلی' });
      const res = await request(app)
        .put(`/api/messages/${created.body.id}`)
        .send({ content: 'ویرایش' })
        .expect(200);

      expect(res.body.swipes).toContain('اصلی');
    });

    it('باید پیام‌های بعدی رو حذف کنه', async () => {
      const msg1 = await postMessage({ content: 'اول' });
      await postMessage({ content: 'دوم', role: 'assistant' });
      await postMessage({ content: 'سوم' });

      await request(app)
        .put(`/api/messages/${msg1.body.id}`)
        .send({ content: 'ویرایش اول' })
        .expect(200);

      const remaining = testDb.prepare(
        'SELECT * FROM messages WHERE chat_id = ? ORDER BY send_date ASC'
      ).all(chatId) as any[];

      expect(remaining).toHaveLength(1);
      expect(remaining[0].content).toBe('ویرایش اول');
    });

    it('باید 404 برگردونه برای پیام ناموجود', async () => {
      await request(app)
        .put('/api/messages/nonexistent')
        .send({ content: 'test' })
        .expect(404);
    });
  });

  describe('DELETE /api/messages/:id', () => {
    it('باید پیام رو حذف کنه', async () => {
      const msg = await postMessage({ content: 'قابل حذف' });
      const res = await request(app)
        .delete(`/api/messages/${msg.body.id}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const remaining = testDb.prepare('SELECT * FROM messages WHERE id = ?').get(msg.body.id);
      expect(remaining).toBeUndefined();
    });

    it('باید پیام‌های بعدی رو هم حذف کنه', async () => {
      const msg1 = await postMessage({ content: 'اول' });
      await postMessage({ content: 'دوم', role: 'assistant' });
      await postMessage({ content: 'سوم' });

      await request(app)
        .delete(`/api/messages/${msg1.body.id}`)
        .expect(200);

      const remaining = testDb.prepare(
        'SELECT * FROM messages WHERE chat_id = ? ORDER BY send_date ASC'
      ).all(chatId) as any[];

      expect(remaining).toHaveLength(0);
    });

    it('باید 404 برگردونه برای پیام ناموجود', async () => {
      await request(app)
        .delete('/api/messages/nonexistent')
        .expect(404);
    });
  });

  describe('POST /api/messages/regenerate/:chatId', () => {
    it('باید نسخه فعلی رو در swipes ذخیره کنه', async () => {
      await postMessage({ content: 'سلام', role: 'user' });
      await postMessage({ content: 'پاسخ اول', role: 'assistant' });

      const res = await request(app)
        .post(`/api/messages/regenerate/${chatId}`)
        .expect(200);

      expect(res.body.swipes).toContain('پاسخ اول');
      expect(res.body.swipe_id).toBe(0);
    });

    it('باید 404 برگردونه اگر پیام assistant نباشه', async () => {
      await postMessage({ content: 'سلام', role: 'user' });
      await request(app)
        .post(`/api/messages/regenerate/${chatId}`)
        .expect(404);
    });
  });

  describe('POST /api/messages/swipe/:id', () => {
    it('باید بین swipes جابجا بشه', async () => {
      const msg = await postMessage({ content: 'نسخه فعلی', role: 'assistant' });

      testDb.prepare(
        "UPDATE messages SET swipes = ?, swipe_id = 0 WHERE id = ?"
      ).run(JSON.stringify(['نسخه اول', 'نسخه دوم']), msg.body.id);

      const res1 = await request(app)
        .post(`/api/messages/swipe/${msg.body.id}`)
        .send({ direction: 'next' })
        .expect(200);
      expect(res1.body.swipe_id).toBe(1);
      expect(res1.body.content).toBe('نسخه دوم');

      const res2 = await request(app)
        .post(`/api/messages/swipe/${msg.body.id}`)
        .send({ direction: 'prev' })
        .expect(200);
      expect(res2.body.swipe_id).toBe(0);
      expect(res2.body.content).toBe('نسخه اول');
    });

    it('باید در boundary متوقف بشه', async () => {
      const msg = await postMessage({ content: 'محتوا', role: 'assistant' });
      testDb.prepare(
        "UPDATE messages SET swipes = ?, swipe_id = 0 WHERE id = ?"
      ).run(JSON.stringify(['نسخه 1']), msg.body.id);

      const res = await request(app)
        .post(`/api/messages/swipe/${msg.body.id}`)
        .send({ direction: 'prev' })
        .expect(200);
      expect(res.body.swipe_id).toBe(0);
    });

    it('باید 404 برگردونه برای پیام ناموجود', async () => {
      await request(app)
        .post('/api/messages/swipe/nonexistent')
        .send({ direction: 'next' })
        .expect(404);
    });
  });

  // ─── Chats ───

  describe('POST /api/chats', () => {
    it('باید چت جدید بسازه', async () => {
      const res = await request(app)
        .post('/api/chats')
        .send({ character_id: charId, name: 'چت تست' })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.character_id).toBe(charId);
      expect(res.body.name).toBe('چت تست');
    });

    it('باید نام پیش‌فرض بسازه اگر name نباشه', async () => {
      const res = await request(app)
        .post('/api/chats')
        .send({ character_id: charId })
        .expect(201);
      expect(res.body.name).toContain('Chat with');
    });

    it('باید 400 برگردونه اگر character_id نباشه', async () => {
      await request(app)
        .post('/api/chats')
        .send({ name: 'بدون کاراکتر' })
        .expect(400);
    });
  });

  describe('GET /api/chats', () => {
    it('باید لیست چت‌ها رو برگردونه', async () => {
      testDb.exec('DELETE FROM messages');
      testDb.exec('DELETE FROM chats');

      await request(app).post('/api/chats').send({ character_id: charId, name: 'چت ۱' }).expect(201);
      await request(app).post('/api/chats').send({ character_id: charId, name: 'چت ۲' }).expect(201);

      const res = await request(app)
        .get(`/api/chats/character/${charId}`)
        .expect(200);
      expect(res.body).toHaveLength(2);
    });

    it('باید چت با پیام‌ها رو برگردونه', async () => {
      testDb.exec('DELETE FROM messages');
      testDb.exec('DELETE FROM chats');

      const chat = await request(app)
        .post('/api/chats')
        .send({ character_id: charId })
        .expect(201);

      directMessage('user', 'سلام', chat.body.id);
      directMessage('assistant', 'سلام!', chat.body.id);

      const res = await request(app)
        .get(`/api/chats/${chat.body.id}`)
        .expect(200);

      expect(res.body.messages).toHaveLength(2);
      expect(res.body.messages[0].content).toBe('سلام');
      expect(res.body.messages[1].content).toBe('سلام!');
    });

    it('باید 404 برگردونه برای چت ناموجود', async () => {
      await request(app).get('/api/chats/nonexistent').expect(404);
    });
  });

  describe('DELETE /api/chats/:id', () => {
    it('باید چت و پیام‌ها رو حذف کنه', async () => {
      const chat = await request(app)
        .post('/api/chats')
        .send({ character_id: charId })
        .expect(201);
      directMessage('user', 'سلام');

      await request(app).delete(`/api/chats/${chat.body.id}`).expect(200);

      const msgs = testDb.prepare('SELECT * FROM messages WHERE chat_id = ?').all(chat.body.id);
      expect(msgs).toHaveLength(0);
    });
  });

  describe('PUT /api/chats/:id', () => {
    it('باید چت رو آپدیت کنه', async () => {
      const chat = await request(app)
        .post('/api/chats')
        .send({ character_id: charId })
        .expect(201);

      const res = await request(app)
        .put(`/api/chats/${chat.body.id}`)
        .send({ name: 'آپدیت شده' })
        .expect(200);
      expect(res.body.name).toBe('آپدیت شده');
    });
  });

  describe('Branching', () => {
    it('باید چت برانچ شده با پیام‌ها بسازه', async () => {
      const source = await request(app)
        .post('/api/chats')
        .send({ character_id: charId })
        .expect(201);

      // ساخت پیام‌ها با timestamp یکتا
      const m1Date = new Date(Date.now() + 1000).toISOString();
      const m2Date = new Date(Date.now() + 2000).toISOString();
      const m3Date = new Date(Date.now() + 3000).toISOString();

      testDb.prepare(
        "INSERT INTO messages (id, chat_id, role, content, swipes, swipe_id, is_edited, is_system, send_date) VALUES (?, ?, ?, ?, '[]', 0, 0, 0, ?)"
      ).run('br-msg1', source.body.id, 'user', 'پیام ۱', m1Date);
      testDb.prepare(
        "INSERT INTO messages (id, chat_id, role, content, swipes, swipe_id, is_edited, is_system, send_date) VALUES (?, ?, ?, ?, '[]', 0, 0, 0, ?)"
      ).run('br-msg2', source.body.id, 'assistant', 'پاسخ ۱', m2Date);
      testDb.prepare(
        "INSERT INTO messages (id, chat_id, role, content, swipes, swipe_id, is_edited, is_system, send_date) VALUES (?, ?, ?, ?, '[]', 0, 0, 0, ?)"
      ).run('br-msg3', source.body.id, 'user', 'پیام ۲', m3Date);

      const res = await request(app)
        .post('/api/chats')
        .send({
          character_id: charId,
          branch_from: source.body.id,
          branch_point: m2Date, // شامل پیام ۱ و پاسخ ۱
        })
        .expect(201);

      expect(res.body.branch_from).toBe(source.body.id);

      const branched = testDb.prepare(
        'SELECT * FROM messages WHERE chat_id = ? ORDER BY send_date ASC'
      ).all(res.body.id) as any[];

      expect(branched).toHaveLength(2);
      expect(branched[0].content).toBe('پیام ۱');
      expect(branched[1].content).toBe('پاسخ ۱');
    });

    it('باید همه پیام‌ها رو کپی کنه اگر branch_point نباشه', async () => {
      testDb.exec('DELETE FROM messages');
      testDb.exec('DELETE FROM chats');

      const source = await request(app)
        .post('/api/chats')
        .send({ character_id: charId })
        .expect(201);

      directMessage('user', 'پیام ۱', source.body.id);
      directMessage('assistant', 'پاسخ ۱', source.body.id);

      const res = await request(app)
        .post('/api/chats')
        .send({ character_id: charId, branch_from: source.body.id })
        .expect(201);

      const branched = testDb.prepare(
        'SELECT * FROM messages WHERE chat_id = ?'
      ).all(res.body.id);
      expect(branched).toHaveLength(2);
    });

    it('باید چت خالی بسازه اگر branch_from ناموجود باشه', async () => {
      const res = await request(app)
        .post('/api/chats')
        .send({ character_id: charId, branch_from: 'nonexistent' })
        .expect(201);

      const msgs = testDb.prepare('SELECT * FROM messages WHERE chat_id = ?').all(res.body.id);
      expect(msgs).toHaveLength(0);
    });
  });
});
