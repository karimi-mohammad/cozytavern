import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { initDb } from './db';
import charactersRouter from './routes/characters';
import chatsRouter from './routes/chats';
import messagesRouter from './routes/messages';
import apiSettingsRouter from './routes/api-settings';
import personasRouter from './routes/personas';
import lorebooksRouter from './routes/lorebooks';
import { buildEndpoint, buildHeaders, buildRequestBody, createLineBuffer, parseStreamChunk, parseNonStreamingResponse } from './utils/providers';
import { buildPrompt, activateWorldInfo } from './utils/prompt-builder';
import { getDb } from './db';
import { v4 as uuidv4 } from 'uuid';

const app = express();

// رجیستری پاسخ‌های streaming فعال — کلید: message_id
const activeStreams = new Map<string, AbortController>();

// مطمئن شدن از وجود پوشه data
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// مقداردهی دیتابیس
initDb();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API Routes
app.use('/api/characters', charactersRouter);
app.use('/api/chats', chatsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/api-settings', apiSettingsRouter);
app.use('/api/personas', personasRouter);
app.use('/api/lorebooks', lorebooksRouter);

// Chat API endpoint (ارسال پیام به AI با streaming)
app.post('/api/chat', async (req, res) => {
  const { chat_id, character_id, persona_id, lorebook_id, update_message_id, continue_mode, impersonate } = req.body;

  const db = getDb();
  const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(character_id) as any;
  const persona = persona_id ? db.prepare('SELECT * FROM personas WHERE id = ?').get(persona_id) as any : null;
  const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(chat_id) as any;
  const messages = db.prepare('SELECT * FROM messages WHERE chat_id = ? ORDER BY rowid ASC').all(chat_id) as any[];

  if (!character) {
    res.status(400).json({ error: 'کاراکتر پیدا نشد' });
    return;
  }
  if (!chat) {
    res.status(400).json({ error: 'چت پیدا نشد' });
    return;
  }
  if (persona_id && !persona) {
    res.status(400).json({ error: 'پرسونا پیدا نشد' });
    return;
  }

  // دریافت تنظیمات API
  const settings = db.prepare("SELECT * FROM api_settings ORDER BY ROWID DESC LIMIT 1").get() as any;
  if (!settings) {
    res.status(400).json({ error: 'تنظیمات API یافت نشد. لطفاً ابتدا تنظیمات API را وارد کنید.' });
    return;
  }

  // لوربوک (اولویت: lorebook_id مستقیم > لینک چت > لینک کاراکتر)
  const effectiveLorebookId = lorebook_id || chat?.lorebook_id || character?.lorebook_id;
  let lorebookEntries: any[] = [];
  if (effectiveLorebookId) {
    const lorebook = db.prepare('SELECT * FROM lorebooks WHERE id = ?').get(effectiveLorebookId) as any;
    if (lorebook) {
      const entries = db.prepare('SELECT * FROM lorebook_entries WHERE lorebook_id = ?').all(effectiveLorebookId).map((e: any) => ({
        ...e,
        key: JSON.parse(e.keys || '[]'),
        keysecondary: JSON.parse(e.keys_secondary || '[]'),
        constant: !!e.constant,
        selective: !!e.selective,
        disable: !!e.disable,
      }));
      lorebookEntries = activateWorldInfo(messages, { ...lorebook, entries });
    }
  }

  // ساخت prompt
  const promptParts = buildPrompt(character, persona, messages, lorebookEntries, settings.system_prompt || '', {
    impersonate: !!impersonate,
    continueMode: !!continue_mode,
  });

  try {
    const endpoint = buildEndpoint(settings.base_url);
    const headers = buildHeaders(settings.api_key);
    const requestBody = buildRequestBody(promptParts, {
      model: settings.model,
      temperature: settings.temperature,
      max_tokens: settings.max_tokens,
      top_p: settings.top_p,
      frequency_penalty: settings.frequency_penalty,
      presence_penalty: settings.presence_penalty,
      stream: !!settings.stream,
      stop: JSON.parse(settings.stop || '[]'),
    });

    const controller = new AbortController();
    // لغو درخواست اگر کلاینت اتصال را قطع کند
    req.on('close', () => controller.abort());

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: requestBody,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      res.status(response.status).json({ error: `خطا از API: ${errorText}` });
      return;
    }

    if (settings.stream) {
      // Streaming response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // ایجاد یا بروزرسانی پیام
      let msgId: string;
      const now = new Date().toISOString();
      const msgRole = impersonate ? 'user' : 'assistant';
      if (update_message_id) {
        msgId = update_message_id;
        db.prepare('UPDATE messages SET content = ? WHERE id = ?').run('', msgId);
      } else {
        msgId = uuidv4();
        db.prepare(`
          INSERT INTO messages (id, chat_id, role, content, swipes, swipe_id, is_edited, is_system, send_date)
          VALUES (?, ?, ?, '', '[]', 0, 0, 0, ?)
        `).run(msgId, chat_id, msgRole, now);
      }
      res.write(`data: ${JSON.stringify({ message_id: msgId })}\n\n`);

      // لغو فعال: کاربر از طریق /api/chat/abort یا قطع اتصال
      const abortController = new AbortController();
      activeStreams.set(msgId, abortController);
      res.on('close', () => {
        abortController.abort();
        activeStreams.delete(msgId);
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let streamAborted = false;

      if (reader) {
        try {
          const lineBuffer = createLineBuffer();
          let done = false;
          while (!done) {
            const { done: streamDone, value } = await (reader as any).read({ signal: abortController.signal });
            if (streamDone) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = lineBuffer.push(chunk);
            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith('data: ')) {
                const data = trimmed.slice(6);
                if (data === '[DONE]') {
                  done = true;
                  break;
                }
                const token = parseStreamChunk(data);
                if (token) {
                  fullContent += token;
                  res.write(`data: ${JSON.stringify({ token })}\n\n`);
                }
              }
            }
          }
        } catch (streamError: any) {
          // Abort از طرف کاربر یا قطع اتصال — متن partial ذخیره می‌شود
          if (streamError?.name === 'AbortError') {
            streamAborted = true;
            console.log(`Stream aborted for message ${msgId} after ${fullContent.length} chars`);
          } else {
            console.error('Stream error:', streamError);
          }
        }
      }

      // بروزرسانی محتوای پیام (حتی اگر abort شده باشد — متن partial حفظ می‌شود)
      db.prepare('UPDATE messages SET content = ? WHERE id = ?').run(fullContent, msgId);
      db.prepare('UPDATE chats SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), chat_id);

      if (!streamAborted) {
        res.write('data: [DONE]\n\n');
      }
      activeStreams.delete(msgId);
      res.end();
    } else {
      // Non-streaming response
      const data = await response.json();
      const content = parseNonStreamingResponse(data);

      // ذخیره یا بروزرسانی پیام
      let msgId: string;
      const now = new Date().toISOString();
      const msgRole = impersonate ? 'user' : 'assistant';
      if (update_message_id) {
        msgId = update_message_id;
        db.prepare('UPDATE messages SET content = ? WHERE id = ?').run(content, msgId);
      } else {
        msgId = uuidv4();
        db.prepare(`
          INSERT INTO messages (id, chat_id, role, content, swipes, swipe_id, is_edited, is_system, send_date)
          VALUES (?, ?, ?, ?, '[]', 0, 0, 0, ?)
        `).run(msgId, chat_id, msgRole, content, now);
      }

      db.prepare('UPDATE chats SET updated_at = ? WHERE id = ?').run(now, chat_id);

      res.json({ content, message_id: msgId });
    }
  } catch (error: any) {
    // اگر کلاینت اتصال را قطع کرده، نیازی به پاسخ نیست
    if (error?.name === 'AbortError') {
      console.log('Request aborted (client disconnected)');
      return;
    }
    console.error('API Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'خطا در اتصال به API' });
    }
  }
});

// لغو پاسخ streaming فعال (Stop در UI)
app.post('/api/chat/abort', (req, res) => {
  const { message_id } = req.body;
  if (!message_id) {
    res.status(400).json({ error: 'message_id الزامی است' });
    return;
  }
  const controller = activeStreams.get(message_id);
  if (controller) {
    controller.abort();
    res.json({ success: true, aborted: true });
  } else {
    res.json({ success: true, aborted: false });
  }
});

export default app;
