import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { testDb } from './chat-setup';
import request from 'supertest';
import app from '../app';

// ساخت Response-like از یک ReadableStream
function streamResponse(chunks: string[], contentType = 'text/event-stream') {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return {
    ok: true,
    status: 200,
    body: stream,
    headers: new Headers({ 'Content-Type': contentType }),
    json: async () => ({}),
    text: async () => chunks.join(''),
  } as unknown as Response;
}

describe('Chat API', () => {
  let charId: string;
  let chatId: string;

  const saveSettings = (overrides: any = {}) =>
    testDb.prepare(`
      INSERT INTO api_settings (id, provider, base_url, api_key, model, temperature, max_tokens, top_p, frequency_penalty, presence_penalty, stream, stop, system_prompt)
      VALUES ('s1', 'openai', 'http://mock.local/v1/chat/completions', 'test-key', 'mock-model', 0.7, 2048, 1, 0, 0, ?, '[]', '')
    `).run(overrides.stream ?? 1);

  beforeEach(() => {
    testDb.exec('DELETE FROM messages');
    testDb.exec('DELETE FROM chats');
    testDb.exec('DELETE FROM characters');
    testDb.exec('DELETE FROM api_settings');

    charId = `chat-char-${Date.now()}`;
    chatId = `chat-cht-${Date.now()}`;
    testDb.prepare(
      "INSERT INTO characters (id, name, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))"
    ).run(charId, 'الیسا');
    testDb.prepare(
      "INSERT INTO chats (id, character_id, name, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))"
    ).run(chatId, charId, 'چت تست');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('باید 400 برگردونه اگر تنظیمات API نباشه', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ chat_id: chatId, character_id: charId })
      .expect(400);
    expect(res.body.error).toContain('API settings');
  });

  it('باید با streaming پاسخ بده و توکن‌ها رو پارس کنه', async () => {
    saveSettings({ stream: 1 });

    // دو chunk: اولی یک خط کامل، دومی دو خط data در یک buffer (بدون newline جدا)
    const sseBody =
      'data: {"choices":[{"delta":{"content":"سلام"}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":" دنیا"}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"!"}}]}\n\n' +
      'data: [DONE]\n\n';
    const mid = Math.floor(sseBody.length / 2);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      streamResponse([sseBody.slice(0, mid), sseBody.slice(mid)])
    ));

    const res = await request(app)
      .post('/api/chat')
      .send({ chat_id: chatId, character_id: charId })
      .expect('Content-Type', /text\/event-stream/)
      .expect(200);

    const tokens = res.text
      .split('\n')
      .filter(l => l.startsWith('data: ') && l.includes('"token"'))
      .map(l => JSON.parse(l.slice(6)).token);
    expect(tokens.join('')).toBe('سلام دنیا!');

    // پیام ذخیره شده
    const saved = testDb.prepare(
      "SELECT * FROM messages WHERE chat_id = ? AND role = 'assistant'"
    ).get(chatId) as any;
    expect(saved.content).toBe('سلام دنیا!');
  });

  it('باید chunk های بدون newline رو هم درست پارس کنه', async () => {
    saveSettings({ stream: 1 });

    // یک chunk که چند خط data را بدون \n جدا می‌کند — بدترین حالت
    const sseBody =
      'data: {"choices":[{"delta":{"content":"a"}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"b"}}]}\n\n' +
      'data: [DONE]\n\n';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      streamResponse([sseBody])
    ));

    const res = await request(app)
      .post('/api/chat')
      .send({ chat_id: chatId, character_id: charId })
      .expect(200);

    const tokens = res.text
      .split('\n')
      .filter(l => l.startsWith('data: ') && l.includes('"token"'))
      .map(l => JSON.parse(l.slice(6)).token);
    expect(tokens.join('')).toBe('ab');
  });

  it('باید پاسخ non-streaming رو ذخیره کنه', async () => {
    saveSettings({ stream: 0 });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'پاسخ مستقیم' } }] }),
    } as unknown as Response));

    const res = await request(app)
      .post('/api/chat')
      .send({ chat_id: chatId, character_id: charId })
      .expect(200);

    expect(res.body.content).toBe('پاسخ مستقیم');

    const saved = testDb.prepare(
      "SELECT * FROM messages WHERE chat_id = ? AND role = 'assistant'"
    ).get(chatId) as any;
    expect(saved.content).toBe('پاسخ مستقیم');
  });

  it('باید خطای API رو با status مناسب برگردونه', async () => {
    saveSettings({ stream: 1 });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'invalid api key',
    } as unknown as Response));

    const res = await request(app)
      .post('/api/chat')
      .send({ chat_id: chatId, character_id: charId })
      .expect(401);
    expect(res.body.error).toContain('invalid api key');
  });

  it('باید با update_message_id پیام قبلی رو آپدیت کنه', async () => {
    saveSettings({ stream: 1 });

    const msgId = 'upd-msg-1';
    testDb.prepare(
      "INSERT INTO messages (id, chat_id, role, content, swipes, swipe_id, is_edited, is_system, send_date) VALUES (?, ?, 'assistant', 'قدیمی', '[]', 0, 0, 0, datetime('now'))"
    ).run(msgId, chatId);

    const sseBody =
      'data: {"choices":[{"delta":{"content":"جدید"}}]}\n\n' +
      'data: [DONE]\n\n';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse([sseBody])));

    await request(app)
      .post('/api/chat')
      .send({ chat_id: chatId, character_id: charId, update_message_id: msgId })
      .expect(200);

    const saved = testDb.prepare('SELECT * FROM messages WHERE id = ?').get(msgId) as any;
    expect(saved.content).toBe('جدید');
  });

  it('باید پاسخ partial رو موقع abort ذخیره کنه', async () => {
    saveSettings({ stream: 1 });

    // یک stream که بلافاصله abort می‌شود — سرور باید متن partial را حفظ کند
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"نیمه"}}]}\n\n'));
        // بعد از اولین chunk، abort می‌کنیم
        setTimeout(() => controller.error(new DOMException('The operation was aborted.', 'AbortError')), 10);
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: stream,
      headers: new Headers({ 'Content-Type': 'text/event-stream' }),
    } as unknown as Response));

    const res = await request(app)
      .post('/api/chat')
      .send({ chat_id: chatId, character_id: charId })
      .expect(200);

    // با وجود abort، پیام ذخیره شده
    const saved = testDb.prepare(
      "SELECT * FROM messages WHERE chat_id = ? AND role = 'assistant'"
    ).get(chatId) as any;
    expect(saved).toBeDefined();
    expect(saved.content).toContain('نیمه');
  });
});
