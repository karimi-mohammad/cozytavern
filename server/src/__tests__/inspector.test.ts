import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { testDb } from './chat-setup';
import request from 'supertest';
import app from '../app';

// ─── تست‌های Prompt Inspector (حالت dry-run) ───
// وقتی inspect:true در body باشد، سرور باید payload را بسازد ولی
// نه fetch بزند و نه دیتابیس را تغییر دهد.

describe('Prompt Inspector', () => {
  let charId: string;
  let chatId: string;
  const now = () => new Date().toISOString();

  const insertMessage = (id: string, role: 'user' | 'assistant' | 'system', content: string) =>
    testDb.prepare(
      "INSERT INTO messages (id, chat_id, role, content, swipes, swipe_id, is_edited, is_system, send_date) VALUES (?, ?, ?, ?, '[]', 0, 0, 0, ?)"
    ).run(id, chatId, role, content, now());

  const saveSettings = () =>
    testDb.prepare(`
      INSERT INTO api_settings (id, provider, base_url, api_key, model, temperature, max_tokens, top_p, frequency_penalty, presence_penalty, stream, stop, system_prompt)
      VALUES ('s1', 'openai', 'http://mock.local/v1/chat/completions', 'test-key', 'mock-model', 0.7, 2048, 1, 0, 0, 1, '[]', '')
    `).run();

  const messageCount = () =>
    (testDb.prepare('SELECT COUNT(*) as cnt FROM messages WHERE chat_id = ?').get(chatId) as any).cnt;

  beforeEach(() => {
    testDb.exec('DELETE FROM messages');
    testDb.exec('DELETE FROM chapters');
    testDb.exec('DELETE FROM plugin_settings');
    testDb.exec('DELETE FROM chats');
    testDb.exec('DELETE FROM characters');
    testDb.exec('DELETE FROM api_settings');

    charId = `insp-char-${Date.now()}`;
    chatId = `insp-cht-${Date.now()}`;
    testDb.prepare(
      "INSERT INTO characters (id, name, description, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))"
    ).run(charId, 'الیسا', 'یک شکارچی هیولا');
    testDb.prepare(
      "INSERT INTO chats (id, character_id, name, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))"
    ).run(chatId, charId, 'چت تست');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('باید /api/chat با inspect payload برگرداند بدون فراخوانی fetch یا درج پیام', async () => {
    saveSettings();
    insertMessage('m1', 'user', 'سلام');

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const res = await request(app)
      .post('/api/chat')
      .send({ chat_id: chatId, character_id: charId, inspect: true })
      .expect(200);

    expect(res.body.inspect).toBe(true);
    expect(res.body.source).toBe('chat');
    expect(res.body.mode).toBe('send');
    expect(res.body.endpoint).toBe('http://mock.local/v1/chat/completions');
    expect(res.body.model).toBe('mock-model');
    expect(res.body.messages.length).toBeGreaterThan(0);

    // پارامترهای sampling
    expect(res.body.params.model).toBeUndefined();
    expect(res.body.params.temperature).toBe(0.7);
    expect(res.body.params.max_tokens).toBe(2048);

    // هیچ fetch انجام نشده
    expect(fetchMock).not.toHaveBeenCalled();

    // هیچ پیام جدیدی درج نشده (تعداد ثابت)
    expect(messageCount()).toBe(1);
  });

  it('باید regenerate dry-run بدون تغییر محتوای پیام assistant انجام شود', async () => {
    saveSettings();
    insertMessage('m1', 'user', 'سلام');
    insertMessage('m2', 'assistant', 'پاسخ قدیمی');

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const res = await request(app)
      .post('/api/chat')
      .send({ chat_id: chatId, character_id: charId, update_message_id: 'm2', inspect: true })
      .expect(200);

    expect(res.body.inspect).toBe(true);
    expect(res.body.mode).toBe('regenerate');
    // کل تاریخچه از جمله پاسخ قبلی در payload است
    const contents = res.body.messages.map((m: any) => m.content);
    expect(contents).toContain('پاسخ قدیمی');

    expect(fetchMock).not.toHaveBeenCalled();

    // محتوای پیام دست‌نخورده (در مسیر واقعی اول خالی می‌شود)
    const saved = testDb.prepare('SELECT content FROM messages WHERE id = ?').get('m2') as any;
    expect(saved.content).toBe('پاسخ قدیمی');
  });

  it('باید impersonate dry-run منعکس‌کننده حالت جعل هویت باشد', async () => {
    saveSettings();
    insertMessage('m1', 'user', 'سلام');

    vi.stubGlobal('fetch', vi.fn());

    const res = await request(app)
      .post('/api/chat')
      .send({ chat_id: chatId, character_id: charId, impersonate: true, inspect: true })
      .expect(200);

    expect(res.body.mode).toBe('impersonate');
    // دستورالعمل impersonate باید در prompt ظاهر شود
    const joined = res.body.messages.map((m: any) => m.content).join('\n');
    expect(joined).toContain('[Special Instruction]');
  });

  it('باید auto-name با inspect دو پیام برگرداند و نام چت تغییر نکند', async () => {
    saveSettings();
    insertMessage('m1', 'user', 'سلام، حالت چطوره؟');
    insertMessage('m2', 'assistant', 'خوبم ممنون!');

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const res = await request(app)
      .post(`/api/chats/${chatId}/auto-name`)
      .send({ inspect: true })
      .expect(200);

    expect(res.body.inspect).toBe(true);
    expect(res.body.source).toBe('title');
    expect(res.body.endpoint).toContain('/v1/chat/completions');
    expect(res.body.model).toBe('mock-model');
    expect(res.body.messages.length).toBe(2);
    expect(res.body.messages[0].role).toBe('system');
    expect(res.body.params.stream).toBe(false);

    expect(fetchMock).not.toHaveBeenCalled();

    const chat = testDb.prepare('SELECT name FROM chats WHERE id = ?').get(chatId) as any;
    expect(chat.name).toBe('چت تست'); // نام عوض نشده
  });

  it('باید create chapter با inspect payload برگرداند و chapters خالی بماند', async () => {
    saveSettings();
    // raw_window پیش‌فرض 10 — برای عبور validation حداقل 12 پیام لازم است
    for (let i = 1; i <= 12; i++) {
      insertMessage(`m${i}`, i % 2 === 1 ? 'user' : 'assistant', `پیام شماره ${i}`);
    }
    testDb.prepare(
      `INSERT INTO plugin_settings (plugin_id, settings_json) VALUES ('chapters', '{"raw_window":10,"auto_detect_enabled":true}')`
    ).run();

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const res = await request(app)
      .post('/api/chapters')
      .send({ chat_id: chatId, start_message_id: 'm1', end_message_id: 'm2', inspect: true })
      .expect(200);

    expect(res.body.inspect).toBe(true);
    expect(res.body.source).toBe('chapter');
    expect(res.body.messages.length).toBe(2); // system + user
    expect(res.body.messages[0].role).toBe('system');

    expect(fetchMock).not.toHaveBeenCalled();

    const cnt = (testDb.prepare('SELECT COUNT(*) as cnt FROM chapters').get() as any).cnt;
    expect(cnt).toBe(0); // هیچ فصلی ساخته نشد
  });

  it('باید regenerate chapter با inspect payload برگرداند و summary تغییری نکند', async () => {
    saveSettings();
    for (let i = 1; i <= 12; i++) {
      insertMessage(`m${i}`, i % 2 === 1 ? 'user' : 'assistant', `پیام شماره ${i}`);
    }
    testDb.prepare(
      `INSERT INTO plugin_settings (plugin_id, settings_json) VALUES ('chapters', '{"raw_window":10,"auto_detect_enabled":true}')`
    ).run();

    const chapterId = `insp-ch-${Date.now()}`;
    testDb.prepare(`
      INSERT INTO chapters (id, chat_id, start_message_id, end_message_id, summary, created_at, updated_at)
      VALUES (?, ?, 'm1', 'm2', '', datetime('now'), datetime('now'))
    `).run(chapterId, chatId);

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const res = await request(app)
      .post(`/api/chapters/${chapterId}/regenerate`)
      .send({ inspect: true })
      .expect(200);

    expect(res.body.inspect).toBe(true);
    expect(res.body.source).toBe('chapter');
    expect(fetchMock).not.toHaveBeenCalled();

    const ch = testDb.prepare('SELECT summary FROM chapters WHERE id = ?').get(chapterId) as any;
    expect(ch.summary).toBe('');
  });

  it('باید بدون inspect رفتار عادی حفظ شود (fetch زده می‌شود)', async () => {
    // stream=0 تا مسیر non-streaming (JSON) تست شود
    testDb.prepare(`
      INSERT INTO api_settings (id, provider, base_url, api_key, model, temperature, max_tokens, top_p, frequency_penalty, presence_penalty, stream, stop, system_prompt)
      VALUES ('s1', 'openai', 'http://mock.local/v1/chat/completions', 'test-key', 'mock-model', 0.7, 2048, 1, 0, 0, 0, '[]', '')
    `).run();
    insertMessage('m1', 'user', 'سلام');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'پاسخ تست' } }] }),
    }));

    const res = await request(app)
      .post('/api/chat')
      .send({ chat_id: chatId, character_id: charId }) // بدون inspect
      .expect(200);

    // مسیر non-streaming: JSON معمولی برمی‌گردد
    expect(res.body.content).toBe('پاسخ تست');
    expect(res.body.message_id).toBeTruthy();
    expect(vi.mocked(fetch).mock.calls.length).toBe(1);

    // پیام assistant ذخیره شده
    const saved = testDb.prepare("SELECT * FROM messages WHERE id = ?").get(res.body.message_id) as any;
    expect(saved?.content).toBe('پاسخ تست');
  });
});
