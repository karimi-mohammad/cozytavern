import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { buildEndpoint, buildHeaders } from '../utils/providers';

const router = Router();

// لیست چت‌های یک کاراکتر
router.get('/character/:characterId', (req: Request, res: Response) => {
  const db = getDb();
  const chats = db.prepare(
    'SELECT * FROM chats WHERE character_id = ? ORDER BY updated_at DESC'
  ).all(req.params.characterId);
  res.json(chats);
});

// دریافت یک چت با پیام‌ها
router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(req.params.id) as any;
  if (!chat) {
    res.status(404).json({ error: 'Chat not found' });
    return;
  }
  const messages = db.prepare(
    'SELECT * FROM messages WHERE chat_id = ? ORDER BY rowid ASC'
  ).all(req.params.id).map((m: any) => ({
    ...m,
    swipes: JSON.parse(m.swipes || '[]'),
    is_edited: !!m.is_edited,
    is_system: !!m.is_system,
  }));
  res.json({ ...chat, messages });
});

// ایجاد چت جدید
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  const { character_id, name, branch_from, lorebook_id } = req.body;

  if (!character_id) {
    res.status(400).json({ error: 'character_id is required' });
    return;
  }

  const character = db.prepare('SELECT name, first_mes, alternate_greetings FROM characters WHERE id = ?').get(character_id) as any;
  const chatName = name || (character ? `Chat with ${character.name}` : 'New Chat');

  db.prepare(`
    INSERT INTO chats (id, character_id, name, branch_from, lorebook_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, character_id, chatName, branch_from || null, lorebook_id || '', now, now);

  // اگر branch باشد، پیام‌ها رو کپی کن
  if (branch_from) {
    const sourceMessages = db.prepare(
      'SELECT * FROM messages WHERE chat_id = ? ORDER BY rowid ASC'
    ).all(branch_from) as any[];

    const branchPoint = req.body.branch_point;
    const messagesToCopy = branchPoint
      ? sourceMessages.filter((m: any) => {
          const msgDate = new Date(m.send_date);
          const pointDate = new Date(branchPoint);
          return msgDate <= pointDate;
        })
      : sourceMessages;

    const insertMsg = db.prepare(`
      INSERT INTO messages (id, chat_id, role, content, swipes, swipe_id, is_edited, is_system, send_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const msg of messagesToCopy) {
      insertMsg.run(
        uuidv4(), id, msg.role, msg.content,
        msg.swipes, msg.swipe_id, msg.is_edited, msg.is_system, msg.send_date
      );
    }
  } else if (character) {
    // درج greeting (first_mes یا یکی از alternate_greetings) به عنوان پیام اول assistant
    const greetings: string[] = [];
    if (character.first_mes) greetings.push(character.first_mes);
    try {
      const altGreetings = JSON.parse(character.alternate_greetings || '[]');
      if (Array.isArray(altGreetings)) {
        altGreetings.forEach((g: string) => { if (g) greetings.push(g); });
      }
    } catch {}

    if (greetings.length > 0) {
      const rawGreeting = greetings[Math.floor(Math.random() * greetings.length)];
      // جایگزینی ماکروها {{char}} و {{user}}
      const greetingContent = rawGreeting
        .replace(/\{\{char\}\}/g, character.name || 'Character')
        .replace(/\{\{user\}\}/g, req.body.user_name || 'User');
      const greetingMsgId = uuidv4();
      db.prepare(`
        INSERT INTO messages (id, chat_id, role, content, swipes, swipe_id, is_edited, is_system, send_date)
        VALUES (?, ?, 'assistant', ?, '[]', 0, 0, 1, ?)
      `).run(greetingMsgId, id, greetingContent, now);
    }
  }

  const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(id);
  res.status(201).json(chat);
});

// حذف چت
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM chats WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Chat not found' });
    return;
  }
  res.json({ success: true });
});

// نام‌گذاری خودکار چت توسط AI
router.post('/:id/auto-name', async (req: Request, res: Response) => {
  const db = getDb();
  const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(req.params.id) as any;
  if (!chat) {
    res.status(404).json({ error: 'Chat not found' });
    return;
  }

  const messages = db.prepare(
    'SELECT * FROM messages WHERE chat_id = ? ORDER BY rowid ASC'
  ).all(req.params.id) as any[];

  if (messages.length === 0) {
    res.status(400).json({ error: 'Chat has no messages' });
    return;
  }

  const settings = db.prepare("SELECT * FROM api_settings ORDER BY ROWID DESC LIMIT 1").get() as any;
  if (!settings) {
    res.status(400).json({ error: 'API settings not found' });
    return;
  }

  // ساخت مکالمه برای مدل
  const conversation = messages.slice(0, 10).map((m: any) =>
    `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, 200)}`
  ).join('\n');

  const endpoint = buildEndpoint(settings.base_url);
  const headers = buildHeaders(settings.api_key);

  // اگر کاربر پیام‌ها را ویرایش کرده باشد، از آن‌ها استفاده می‌شود
  const editedMessages = req.body?.edited_messages;
  const defaultMessages = [
    { role: 'system', content: 'Generate a short title (max 5 words) for this conversation. Reply ONLY with the title text.' },
    { role: 'user', content: conversation },
  ];

  const llmBody = {
    model: settings.model,
    messages: (editedMessages && Array.isArray(editedMessages) && editedMessages.length > 0)
      ? editedMessages.map((m: any) => ({ role: m.role, content: m.content }))
      : defaultMessages,
    max_tokens: 500,
    temperature: 0.3,
    stream: false,
  };

  // حالت بازرسی (Prompt Inspector): فقط ساخت payload، بدون فراخوانی LLM و بدون تغییر دیتابیس
  if (req.body?.inspect) {
    return res.json({
      inspect: true,
      source: 'title',
      endpoint,
      model: llmBody.model,
      params: { temperature: llmBody.temperature, max_tokens: llmBody.max_tokens, stream: false },
      messages: llmBody.messages,
    });
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(llmBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      res.status(500).json({ error: `API error: ${response.status}` });
      return;
    }

    const data = await response.json() as any;
    const newName = (data.choices?.[0]?.message?.content || '').trim().replace(/^["']|["']$/g, '');

    if (newName) {
      const now = new Date().toISOString();
      db.prepare('UPDATE chats SET name=?, updated_at=? WHERE id=?').run(newName, now, req.params.id);
      const updated = db.prepare('SELECT * FROM chats WHERE id = ?').get(req.params.id);
      res.json(updated);
    } else {
      res.status(500).json({ error: 'Failed to generate a name' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error auto-naming chat' });
  }
});

// ─── Export/Import چت ───

// خروجی چت به JSON — پیام‌ها با index ارجاع می‌شوند تا قابل حمل باشد
router.get('/:id/export', (req: Request, res: Response) => {
  const db = getDb();
  const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(req.params.id) as any;
  if (!chat) {
    res.status(404).json({ error: 'Chat not found' });
    return;
  }

  const messages = db.prepare(
    'SELECT role, content, swipes, swipe_id, is_edited, is_system, send_date FROM messages WHERE chat_id = ? ORDER BY rowid ASC'
  ).all(req.params.id) as any[];

  // نگاشت message id → index برای فصل‌ها
  const idToIndex = new Map<string, number>();
  const msgIds = db.prepare('SELECT id FROM messages WHERE chat_id = ? ORDER BY rowid ASC').all(req.params.id) as any[];
  msgIds.forEach((m: any, i: number) => idToIndex.set(m.id, i));

  const chapters = db.prepare(
    'SELECT start_message_id, end_message_id, title, summary FROM chapters WHERE chat_id = ? ORDER BY created_at ASC'
  ).all(req.params.id) as any[];

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="chat-${encodeURIComponent(chat.name || req.params.id)}.json"`);
  res.json({
    format: 'cozytavern-chat',
    version: 1,
    exported_at: new Date().toISOString(),
    chat: {
      name: chat.name,
      folder: chat.folder || '',
      authors_note: chat.authors_note || '',
      authors_note_depth: chat.authors_note_depth ?? 4,
      authors_note_position: chat.authors_note_position || 'in_chat',
      created_at: chat.created_at,
    },
    messages: messages.map((m) => ({
      ...m,
      swipes: JSON.parse(m.swipes || '[]'),
    })),
    chapters: chapters
      .map((c) => ({
        start_index: idToIndex.get(c.start_message_id),
        end_index: idToIndex.get(c.end_message_id),
        title: c.title,
        summary: c.summary,
      }))
      .filter((c) => c.start_index !== undefined && c.end_index !== undefined),
  });
});

// ورودی چت — بدنه: { character_id, data } که data خروجی export است
router.post('/import', (req: Request, res: Response) => {
  const db = getDb();
  const { character_id, data } = req.body ?? {};

  if (!character_id) {
    res.status(400).json({ error: 'character_id is required' });
    return;
  }
  if (!data || data.format !== 'cozytavern-chat' || !Array.isArray(data.messages)) {
    res.status(400).json({ error: 'Invalid chat export file' });
    return;
  }
  const character = db.prepare('SELECT name FROM characters WHERE id = ?').get(character_id) as any;
  if (!character) {
    res.status(400).json({ error: 'Character not found' });
    return;
  }

  const now = new Date().toISOString();
  const chatId = uuidv4();
  const srcChat = data.chat || {};

  db.prepare(`
    INSERT INTO chats (id, character_id, name, branch_from, lorebook_id, folder, authors_note, authors_note_depth, authors_note_position, created_at, updated_at)
    VALUES (?, ?, ?, NULL, '', ?, ?, ?, ?, ?, ?)
  `).run(
    chatId, character_id,
    String(srcChat.name || 'Imported Chat'),
    String(srcChat.folder || ''),
    String(srcChat.authors_note || ''),
    typeof srcChat.authors_note_depth === 'number' ? srcChat.authors_note_depth : 4,
    srcChat.authors_note_position === 'after_char' ? 'after_char' : 'in_chat',
    now, now,
  );

  const insertMsg = db.prepare(`
    INSERT INTO messages (id, chat_id, role, content, swipes, swipe_id, is_edited, is_system, send_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // نگاشت index → id جدید برای بازسازی فصل‌ها
  const indexToId = new Map<number, string>();
  let count = 0;
  for (const m of data.messages) {
    if (!m || typeof m.content !== 'string') continue;
    const role = ['user', 'assistant', 'system'].includes(m.role) ? m.role : 'user';
    const msgId = uuidv4();
    insertMsg.run(
      msgId, chatId, role, m.content,
      JSON.stringify(Array.isArray(m.swipes) ? m.swipes : []),
      typeof m.swipe_id === 'number' ? m.swipe_id : 0,
      m.is_edited ? 1 : 0,
      m.is_system ? 1 : 0,
      String(m.send_date || now),
    );
    indexToId.set(count, msgId);
    count++;
  }

  // بازسازی فصل‌ها با نگاشت اندیس‌ها (اگر معتبر باشند)
  if (Array.isArray(data.chapters)) {
    const insertChapter = db.prepare(`
      INSERT INTO chapters (id, chat_id, start_message_id, end_message_id, title, summary, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const c of data.chapters) {
      const startId = indexToId.get(c.start_index);
      const endId = indexToId.get(c.end_index);
      if (startId && endId && c.start_index <= c.end_index) {
        insertChapter.run(uuidv4(), chatId, startId, endId, String(c.title || ''), String(c.summary || ''), now, now);
      }
    }
  }

  const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(chatId) as any;
  res.status(201).json({ ...chat, imported_messages: count });
});

// بروزرسانی چت
router.put('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const { name, lorebook_id, folder, authors_note, authors_note_depth, authors_note_position } = req.body;
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT * FROM chats WHERE id = ?').get(req.params.id) as any;
  if (!existing) {
    res.status(404).json({ error: 'Chat not found' });
    return;
  }
  db.prepare(`
    UPDATE chats SET name=?, lorebook_id=?, folder=?, authors_note=?, authors_note_depth=?, authors_note_position=?, updated_at=?
    WHERE id=?
  `).run(
    name ?? existing.name ?? 'Chat',
    lorebook_id ?? existing.lorebook_id ?? '',
    folder ?? existing.folder ?? '',
    typeof authors_note === 'string' ? authors_note : (existing.authors_note ?? ''),
    typeof authors_note_depth === 'number'
      ? Math.min(100, Math.max(0, Math.trunc(authors_note_depth)))
      : (existing.authors_note_depth ?? 4),
    authors_note_position === 'after_char' || authors_note_position === 'in_chat'
      ? authors_note_position
      : (existing.authors_note_position || 'in_chat'),
    now, req.params.id
  );
  const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(req.params.id);
  res.json(chat);
});

export default router;
