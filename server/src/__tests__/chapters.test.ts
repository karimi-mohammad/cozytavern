import { describe, it, expect, beforeEach } from 'vitest';
import { testDb } from './global-setup';
import request from 'supertest';
import app from '../app';
import { buildPrompt } from '../utils/prompt-builder';
import { detectChapterTrigger } from '../utils/chapter-generator';

// ─── buildPrompt with chapters ───

describe('Prompt Builder — Chapter Support', () => {
  const character = { name: 'الیسا', description: 'شخصیت تست', personality: '', scenario: '', mes_example: '' };
  const persona = { name: 'محمد', description: 'تست' };

  const messages = [
    { id: 'm1', role: 'user', content: 'سلام' },
    { id: 'm2', role: 'assistant', content: 'سلام محمد!' },
    { id: 'm3', role: 'user', content: 'حالت چطوره؟' },
    { id: 'm4', role: 'assistant', content: 'خوبم ممنون' },
    { id: 'm5', role: 'user', content: 'چه خبر؟' },
    { id: 'm6', role: 'assistant', content: 'هیچی، همون...' },
    { id: 'm7', role: 'user', content: 'باشه' },
    { id: 'm8', role: 'assistant', content: 'اوکی' },
    { id: 'm9', role: 'user', content: 'پس کجا میریم؟' },
    { id: 'm10', role: 'assistant', content: 'هر جا تو بخوای' },
  ];

  const chapters = [
    {
      id: 'ch1',
      title: 'فصل اول',
      summary: 'خلاصه فصل اول: گفتگوی مقدماتی',
      start_message_id: 'm1',
      end_message_id: 'm5',
    },
  ];

  it('بدون chapter — همه پیام‌ها خام ارسال بشن', () => {
    const result = buildPrompt(character, persona, messages, [], '', {});
    const historyParts = result.filter(p => p.role === 'user' || p.role === 'assistant');
    expect(historyParts.length).toBe(messages.length);
  });

  it('با chapter — خلاصه فصل جایگزین پیام‌های قدیمی بشه', () => {
    const result = buildPrompt(character, persona, messages, [], '', {
      chapters,
      rawWindow: 3,
    });

    // باید خلاصه فصل وجود داشته باشه
    const summaryPart = result.find(p => p.content.includes('فصل اول'));
    expect(summaryPart).toBeDefined();
    expect(summaryPart?.content).toContain('گفتگوی مقدماتی');

    // فقط 3 پیام آخر خام باشن
    const rawParts = result.filter(p =>
      (p.role === 'user' || p.role === 'assistant') &&
      !p.content.includes('فصل') &&
      !p.content.includes('اطلاعات') &&
      !p.content.includes('مثال') &&
      !p.content.includes('کاربر') &&
      p.content !== 'سلام محمد!' &&
      p.content !== 'سلام' &&
      p.content !== 'حالت چطوره؟' &&
      p.content !== 'خوبم ممنون' &&
      p.content !== 'چه خبر؟'
    );
    // m8, m9, m10 = 3 raw messages
    expect(rawParts.length).toBe(3);
  });

  it('rawWindow بزرگتر از تعداد پیام — همه خام باشن', () => {
    const result = buildPrompt(character, persona, messages, [], '', {
      chapters,
      rawWindow: 100,
    });

    // وقتی rawWindow بزرگتره، پیام‌های داخل raw window همگی خامن
    // ولی چون chapter end_message_id = m5 هست، پیام‌های m1-m5 خارج از raw window نیستن
    // پس chapter summary نباید باشه
    const summaryPart = result.find(p => p.content.includes('فصل اول'));
    expect(summaryPart).toBeUndefined();
  });

  it('چند فصل — هر دو خلاصه اضافه بشه', () => {
    const chaptersMultiple = [
      { id: 'ch1', title: 'فصل ۱', summary: 'خلاصه ۱', start_message_id: 'm1', end_message_id: 'm3' },
      { id: 'ch2', title: 'فصل ۲', summary: 'خلاصه ۲', start_message_id: 'm4', end_message_id: 'm7' },
    ];

    const result = buildPrompt(character, persona, messages, [], '', {
      chapters: chaptersMultiple,
      rawWindow: 3,
    });

    const summary1 = result.find(p => p.content.includes('خلاصه ۱'));
    const summary2 = result.find(p => p.content.includes('خلاصه ۲'));
    expect(summary1).toBeDefined();
    expect(summary2).toBeDefined();
  });
});

// ─── detectChapterTrigger ───

describe('Chapter Trigger Detection', () => {
  const defaultSettings = {
    raw_window: 5,
    trigger_phrases: ['روز بعد', 'صبح روز بعد', ' meanwhile'],
  };

  it('باید trigger در پیام پیدا کنه', () => {
    const messages = Array.from({ length: 15 }, (_, i) => ({
      id: `m${i + 1}`,
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: i === 8 ? 'صبح روز بعد، آلیسا بیدار شد' : `پیام شماره ${i + 1}`,
    }));

    const result = detectChapterTrigger(messages, [], defaultSettings.raw_window, defaultSettings.trigger_phrases);
    expect(result.suggested).toBe(true);
    // "روز بعد" زودتر match میشه چون substring "صبح روز بعد" هست
    expect(result.trigger_phrase).toBe('روز بعد');
    expect(result.trigger_message_id).toBe('m9');
  });

  it('بدون trigger — suggested=false', () => {
    const messages = Array.from({ length: 15 }, (_, i) => ({
      id: `m${i + 1}`,
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `پیام معمولی ${i + 1}`,
    }));

    const result = detectChapterTrigger(messages, [], defaultSettings.raw_window, defaultSettings.trigger_phrases);
    expect(result.suggested).toBe(false);
  });

  it('trigger در raw window — باز هم شناسایی بشه (محدودیت raw_window موقع ساخت فصل اعمال می‌شه)', () => {
    const messages = Array.from({ length: 15 }, (_, i) => ({
      id: `m${i + 1}`,
      role: i % 2 === 0 ? 'user' : 'assistant',
      // trigger در پیام آخر (داخل raw window) باشه
      content: i === 14 ? 'صبح روز بعد' : `پیام ${i + 1}`,
    }));

    const result = detectChapterTrigger(messages, [], defaultSettings.raw_window, defaultSettings.trigger_phrases);
    expect(result.suggested).toBe(true);
    expect(result.trigger_message_id).toBe('m15');
  });

  it('فاصله کافی از آخرین فصل نباشه — suggested=false', () => {
    const messages = Array.from({ length: 15 }, (_, i) => ({
      id: `m${i + 1}`,
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: i === 11 ? 'روز بعد' : `پیام ${i + 1}`,
    }));

    // آخرین فصل تا m12 ادامه داشته — فاصله فقط 3 پیامه (< raw_window=5)
    const chapters = [{ id: 'ch1', end_message_id: 'm12' }];

    const result = detectChapterTrigger(messages, chapters, defaultSettings.raw_window, defaultSettings.trigger_phrases);
    expect(result.suggested).toBe(false);
  });

  it('بعد از ساخت فصل با trigger_message_id — trigger دوباره شناسایی نشه', () => {
    const messages = Array.from({ length: 15 }, (_, i) => ({
      id: `m${i + 1}`,
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: i === 8 ? 'صبح روز بعد' : `پیام ${i + 1}`,
    }));

    // فصل با trigger_message_id ذخیره شده — باید از m10 به بعد اسکن کنه
    const chapters = [{ id: 'ch1', end_message_id: 'm9', trigger_message_id: 'm9' }];

    const result = detectChapterTrigger(messages, chapters, defaultSettings.raw_window, defaultSettings.trigger_phrases);
    expect(result.suggested).toBe(false);
  });

  it('تریگر جدید بعد از فصل قبلی — suggested=true', () => {
    const messages = Array.from({ length: 20 }, (_, i) => ({
      id: `m${i + 1}`,
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: i === 15 ? 'روز بعد' : `پیام ${i + 1}`,
    }));

    // فصل قبلی تا m9 با trigger در m9 — تریگر جدید در m16
    const chapters = [{ id: 'ch1', end_message_id: 'm9', trigger_message_id: 'm9' }];

    const result = detectChapterTrigger(messages, chapters, defaultSettings.raw_window, defaultSettings.trigger_phrases);
    expect(result.suggested).toBe(true);
    expect(result.trigger_message_id).toBe('m16');
  });

  it('پیام کمتر از raw_window — suggested=false', () => {
    const messages = [
      { id: 'm1', role: 'user' as const, content: 'سلام' },
      { id: 'm2', role: 'assistant' as const, content: 'روز بعد...' },
    ];

    const result = detectChapterTrigger(messages, [], defaultSettings.raw_window, defaultSettings.trigger_phrases);
    expect(result.suggested).toBe(false);
  });

  it('trigger list خالی — suggested=false', () => {
    const messages = Array.from({ length: 15 }, (_, i) => ({
      id: `m${i + 1}`,
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: i === 8 ? 'روز بعد' : `پیام ${i + 1}`,
    }));

    const result = detectChapterTrigger(messages, [], defaultSettings.raw_window, []);
    expect(result.suggested).toBe(false);
  });

  it('case-insensitive trigger matching', () => {
    const messages = Array.from({ length: 15 }, (_, i) => ({
      id: `m${i + 1}`,
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: i === 8 ? 'Meanwhile, something happened' : `msg ${i + 1}`,
    }));

    const result = detectChapterTrigger(messages, [], defaultSettings.raw_window, ['meanwhile']);
    expect(result.suggested).toBe(true);
  });
});

// ─── Chapters API Routes ───

describe('Chapters API', () => {
  let character: any;
  let chat: any;
  let messages: any[] = [];

  beforeEach(async () => {
    messages = [];
    testDb.exec('DELETE FROM chapters');
    testDb.exec('DELETE FROM messages');
    testDb.exec('DELETE FROM chats');
    testDb.exec('DELETE FROM characters');

    // reset chapter plugin settings برای هر تست (raw_window کوچک برای تست راحت‌تر)
    testDb.exec(`INSERT OR REPLACE INTO plugin_settings (plugin_id, settings_json) VALUES ('chapters', '{"raw_window":3,"auto_detect_enabled":true}')`);

    // ساخت کاراکتر و چت تست
    const charRes = await request(app)
      .post('/api/characters')
      .send({ name: 'تست', description: 'تست فصل' });
    character = charRes.body;

    const chatRes = await request(app)
      .post('/api/chats')
      .send({ character_id: character.id, name: 'چت تست' });
    chat = chatRes.body;

    // ساخت 15 پیام تست
    for (let i = 0; i < 15; i++) {
      const msgRes = await request(app)
        .post('/api/messages')
        .send({
          chat_id: chat.id,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `پیام تست شماره ${i + 1}`,
        });
      messages.push(msgRes.body);
    }
  });

  it('باید فصل جدید بسازه', async () => {
    const res = await request(app)
      .post('/api/chapters')
      .send({
        chat_id: chat.id,
        start_message_id: messages[0].id,
        end_message_id: messages[5].id,
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.chat_id).toBe(chat.id);
    expect(res.body.start_message_id).toBe(messages[0].id);
    expect(res.body.end_message_id).toBe(messages[5].id);
  });

  it('باید لیست فصل‌ها رو برگردونه', async () => {
    await request(app)
      .post('/api/chapters')
      .send({ chat_id: chat.id, start_message_id: messages[0].id, end_message_id: messages[5].id });

    const res = await request(app)
      .get(`/api/chapters/chat/${chat.id}`)
      .expect(200);

    expect(res.body).toHaveLength(1);
  });

  it('باید فصل رو با ID بگیره و آپدیت کنه', async () => {
    const created = await request(app)
      .post('/api/chapters')
      .send({ chat_id: chat.id, start_message_id: messages[0].id, end_message_id: messages[5].id });

    const res = await request(app)
      .put(`/api/chapters/${created.body.id}`)
      .send({ title: 'فصل تست', summary: 'خلاصه تست' })
      .expect(200);

    expect(res.body.title).toBe('فصل تست');
    expect(res.body.summary).toBe('خلاصه تست');
    expect(res.body.manually_edited).toBe(true);
  });

  it('باید فصل رو حذف کنه', async () => {
    const created = await request(app)
      .post('/api/chapters')
      .send({ chat_id: chat.id, start_message_id: messages[0].id, end_message_id: messages[5].id });

    await request(app)
      .delete(`/api/chapters/${created.body.id}`)
      .expect(200);

    const res = await request(app)
      .get(`/api/chapters/chat/${chat.id}`)
      .expect(200);

    expect(res.body).toHaveLength(0);
  });

  it('باید boundary validation انجام بده — start بعد از end', async () => {
    const res = await request(app)
      .post('/api/chapters')
      .send({
        chat_id: chat.id,
        start_message_id: messages[10].id,
        end_message_id: messages[5].id,
      })
      .expect(400);

    expect(res.body.error).toBeDefined();
  });

  it('باید boundary validation انجام بده — خیلی نزدیک به آخر', async () => {
    const res = await request(app)
      .post('/api/chapters')
      .send({
        chat_id: chat.id,
        start_message_id: messages[0].id,
        end_message_id: messages[14].id, // آخرین پیام
      })
      .expect(400);

    expect(res.body.error).toContain('messages before the last message');
  });

  it('باید overlap detection انجام بده', async () => {
    await request(app)
      .post('/api/chapters')
      .send({ chat_id: chat.id, start_message_id: messages[0].id, end_message_id: messages[5].id });

    const res = await request(app)
      .post('/api/chapters')
      .send({ chat_id: chat.id, start_message_id: messages[3].id, end_message_id: messages[8].id })
      .expect(400);

    expect(res.body.error).toContain('overlap');
  });

  it('باید تنظیمات فصل رو برگردونه', async () => {
    const res = await request(app)
      .get('/api/chapters/settings')
      .expect(200);

    expect(res.body.raw_window).toBeDefined();
    expect(res.body.auto_detect_enabled).toBeDefined();
    expect(Array.isArray(res.body.trigger_phrases)).toBe(true);
  });

  it('باید تنظیمات فصل رو آپدیت کنه و در endpoint پلاگین هم دیده بشه', async () => {
    const res = await request(app)
      .put('/api/chapters/settings')
      .send({ raw_window: 15, auto_detect_enabled: false })
      .expect(200);

    expect(res.body.raw_window).toBe(15);
    expect(res.body.auto_detect_enabled).toBe(false);

    // wrapper باید هم‌نما با استور پلاگین باشه
    const viaPlugin = await request(app)
      .get('/api/plugins/chapters/settings')
      .expect(200);
    expect(viaPlugin.body.raw_window).toBe(15);
    expect(viaPlugin.body.auto_detect_enabled).toBe(false);
  });
});
