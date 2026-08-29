import { describe, it, expect, beforeEach } from 'vitest';
import { testDb } from './global-setup';
import request from 'supertest';
import app from '../app';

// ─── Chat Export/Import + Full Backup ───

async function createCharacter(name: string) {
  const res = await request(app).post('/api/characters').send({ name });
  return res.body;
}

describe('Chat Export/Import API', () => {
  beforeEach(() => {
    testDb.exec('DELETE FROM messages');
    testDb.exec('DELETE FROM chapters');
    testDb.exec('DELETE FROM chats');
    testDb.exec('DELETE FROM lorebook_entries');
    testDb.exec('DELETE FROM lorebooks');
    testDb.exec('DELETE FROM characters');
  });

  it('باید چت را با پیام‌ها و فصل‌ها صادر کنه', async () => {
    const character = await createCharacter('نویسنده');
    const chat = await request(app)
      .post('/api/chats')
      .send({ character_id: character.id, name: 'چت قابل حمل' })
      .expect(201);

    await request(app).post('/api/messages')
      .send({ chat_id: chat.body.id, role: 'user', content: 'پیام اول' })
      .expect(201);
    await request(app).post('/api/messages')
      .send({ chat_id: chat.body.id, role: 'assistant', content: 'پاسخ اول' })
      .expect(201);

    // قانون raw_window (پیش‌فرض ۱۰): فصل باید حداقل ۱۰ پیام از آخر فاصله داشته باشد
    for (let i = 0; i < 10; i++) {
      await request(app).post('/api/messages')
        .send({ chat_id: chat.body.id, role: i % 2 === 0 ? 'user' : 'assistant', content: `پُرکن ${i}` })
        .expect(201);
    }

    // یک فصل دستی بساز (بین پیام ۱ تا ۲)
    const msgs = await request(app).get(`/api/chats/${chat.body.id}`).expect(200);
    const startId = msgs.body.messages[0].id;
    const endId = msgs.body.messages[1].id;
    await request(app).post('/api/chapters')
      .send({ chat_id: chat.body.id, start_message_id: startId, end_message_id: endId, title: 'فصل یک' })
      .expect(201);

    const exported = await request(app)
      .get(`/api/chats/${chat.body.id}/export`)
      .expect(200);

    expect(exported.body.format).toBe('cozytavern-chat');
    expect(exported.body.chat.name).toBe('چت قابل حمل');
    expect(exported.body.messages).toHaveLength(12);
    expect(exported.body.messages[0].content).toBe('پیام اول');
    expect(exported.body.messages[1].content).toBe('پاسخ اول');
    expect(exported.body.chapters).toHaveLength(1);
    expect(exported.body.chapters[0].title).toBe('فصل یک');
    expect(exported.body.chapters[0].start_index).toBe(0);
    expect(exported.body.chapters[0].end_index).toBe(1);
  });

  it('باید چت وارد کنه و پیام‌ها و فصل‌ها بازسازی بشن', async () => {
    const character = await createCharacter('میزبان');

    const payload = {
      format: 'cozytavern-chat',
      version: 1,
      chat: { name: 'وارداتی', authors_note: 'یادداشت نویسنده', authors_note_depth: 6 },
      messages: [
        { role: 'user', content: 'سلام' },
        { role: 'assistant', content: 'درود!' },
        { role: 'user', content: 'خداحافظ' },
      ],
      chapters: [
        { start_index: 0, end_index: 1, title: 'آغاز', summary: 'سلام و درود' },
      ],
    };

    const res = await request(app)
      .post('/api/chats/import')
      .send({ character_id: character.id, data: payload })
      .expect(201);

    expect(res.body.name).toBe('وارداتی');
    expect(res.body.imported_messages).toBe(3);
    expect(res.body.authors_note).toBe('یادداشت نویسنده');
    expect(res.body.authors_note_depth).toBe(6);

    // پیام‌ها
    const full = await request(app).get(`/api/chats/${res.body.id}`).expect(200);
    expect(full.body.messages).toHaveLength(3);
    expect(full.body.messages.map((m: any) => m.content)).toEqual(['سلام', 'درود!', 'خداحافظ']);

    // فصل‌ها با id های جدید ولی همان ترتیب
    const chapters = await request(app).get(`/api/chapters/chat/${res.body.id}`).expect(200);
    expect(chapters.body).toHaveLength(1);
    expect(chapters.body[0].title).toBe('آغاز');
    expect(chapters.body[0].start_message_id).toBe(full.body.messages[0].id);
    expect(chapters.body[0].end_message_id).toBe(full.body.messages[1].id);
  });

  it('ورودی نامعتبر باید رد بشه', async () => {
    const character = await createCharacter('میزبان');
    await request(app)
      .post('/api/chats/import')
      .send({ character_id: character.id, data: { format: 'دیگر' } })
      .expect(400);
    await request(app)
      .post('/api/chats/import')
      .send({ data: { format: 'cozytavern-chat', messages: [] } })
      .expect(400);
  });

  it('چرخه کامل export → import باید معادل باشه', async () => {
    const character = await createCharacter('گردشی');
    const chat = await request(app)
      .post('/api/chats')
      .send({ character_id: character.id, name: 'گردش' })
      .expect(201);
    await request(app).post('/api/messages')
      .send({ chat_id: chat.body.id, role: 'user', content: 'یک' })
      .expect(201);
    await request(app).post('/api/messages')
      .send({ chat_id: chat.body.id, role: 'assistant', content: 'دو' })
      .expect(201);

    const exported = await request(app).get(`/api/chats/${chat.body.id}/export`).expect(200);
    const imported = await request(app)
      .post('/api/chats/import')
      .send({ character_id: character.id, data: exported.body })
      .expect(201);

    const fullImported = await request(app).get(`/api/chats/${imported.body.id}`).expect(200);
    expect(fullImported.body.messages).toHaveLength(2);
    expect(fullImported.body.messages.map((m: any) => m.content)).toEqual(['یک', 'دو']);
  });
});

describe('Backup API', () => {
  beforeEach(() => {
    testDb.exec('DELETE FROM messages');
    testDb.exec('DELETE FROM chapters');
    testDb.exec('DELETE FROM chats');
    testDb.exec('DELETE FROM lorebook_entries');
    testDb.exec('DELETE FROM lorebooks');
    testDb.exec('DELETE FROM personas');
    testDb.exec('DELETE FROM characters');
    testDb.exec('DELETE FROM plugin_settings');
    testDb.exec("DELETE FROM api_settings");
  });

  it('باید کل دیتابیس را صادر کنه', async () => {
    await createCharacter('بکاپی');
    await request(app).post('/api/personas')
      .send({ name: 'پرسونای بکاپ' })
      .expect(201);

    const res = await request(app).get('/api/backup/export').expect(200);
    expect(res.body.format).toBe('cozytavern-backup');
    expect(res.body.tables.characters).toHaveLength(1);
    expect(res.body.tables.personas).toHaveLength(1);
  });

  it('restore باید داده‌ها را کامل بازگرداند', async () => {
    // آماده‌سازی داده اولیه
    await createCharacter('اصلی');
    const settingsRes = await request(app).get('/api/backup/export').expect(200);
    const backup = settingsRes.body;

    // همه چیز را پاک کن
    testDb.exec('DELETE FROM messages');
    testDb.exec('DELETE FROM chats');
    testDb.exec('DELETE FROM characters');
    const emptyList = await request(app).get('/api/characters').expect(200);
    expect(emptyList.body).toHaveLength(0);

    // بازگردانی
    await request(app).post('/api/backup/restore').send(backup).expect(200);
    const restored = await request(app).get('/api/characters').expect(200);
    expect(restored.body).toHaveLength(1);
    expect(restored.body[0].name).toBe('اصلی');
    // همان id اصلی حفظ شده باشد
    expect(restored.body[0].id).toBe(backup.tables.characters[0].id);
  });

  it('restore با فایل نامعتبر باید خطا بده و چیزی را پاک نکنه', async () => {
    await createCharacter('مانده');
    await request(app)
      .post('/api/backup/restore')
      .send({ format: 'غلط' })
      .expect(400);

    const list = await request(app).get('/api/characters').expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].name).toBe('مانده');
  });

  it('restore تراکنشی است — خطای وسط کار نباید دیتا را خراب کنه', async () => {
    await createCharacter('سالم');

    // بکاپ با جدول chats که FK به کاراکتر ناموجود دارد → خطای FK وسط restore
    const badBackup = {
      format: 'cozytavern-backup',
      version: 1,
      tables: {
        characters: [],
        personas: [],
        chats: [{ id: 'c1', character_id: 'نا-موجود', name: 'یتیم', created_at: '', updated_at: '' }],
        messages: [],
        lorebooks: [],
        lorebook_entries: [],
        chapters: [],
        api_settings: [],
        plugin_settings: [],
      },
    };

    await request(app).post('/api/backup/restore').send(badBackup).expect(500);

    // کاراکتر قبلی هنوز باید موجود باشد (تراکنش rollback شده)
    const list = await request(app).get('/api/characters').expect(200);
    expect(list.body.some((c: any) => c.name === 'سالم')).toBe(true);
  });
});
