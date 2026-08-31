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

// ─── Chat Lorebooks (چند لور بوک به ازای هر چت) ───

// لیست لور بوک‌های یک چت
router.get('/:chatId/lorebooks', (req: Request, res: Response) => {
  const db = getDb();
  const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(req.params.chatId) as any;
  if (!chat) {
    res.status(404).json({ error: 'Chat not found' });
    return;
  }

  const lorebooks = db.prepare(`
    SELECT cl.*, l.name as lorebook_name, l.scan_depth, l.token_budget,
      (SELECT COUNT(*) FROM lorebook_entries WHERE lorebook_id = l.id AND disable = 0) as active_entries,
      (SELECT COUNT(*) FROM lorebook_entries WHERE lorebook_id = l.id) as total_entries
    FROM chat_lorebooks cl
    JOIN lorebooks l ON cl.lorebook_id = l.id
    WHERE cl.chat_id = ?
    ORDER BY cl.insertion_order ASC
  `).all(req.params.chatId).map((cl: any) => ({
    ...cl,
    is_active: !!cl.is_active,
  }));

  res.json(lorebooks);
});

// اضافه کردن لور بوک به چت
router.post('/:chatId/lorebooks', (req: Request, res: Response) => {
  const db = getDb();
  const { lorebook_id, insertion_order } = req.body;

  if (!lorebook_id) {
    res.status(400).json({ error: 'lorebook_id is required' });
    return;
  }

  const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(req.params.chatId) as any;
  if (!chat) {
    res.status(404).json({ error: 'Chat not found' });
    return;
  }

  const lorebook = db.prepare('SELECT * FROM lorebooks WHERE id = ?').get(lorebook_id) as any;
  if (!lorebook) {
    res.status(404).json({ error: 'Lorebook not found' });
    return;
  }

  // بررسی تکراری نبودن
  const existing = db.prepare('SELECT * FROM chat_lorebooks WHERE chat_id = ? AND lorebook_id = ?')
    .get(req.params.chatId, lorebook_id) as any;
  if (existing) {
    res.status(400).json({ error: 'Lorebook already assigned to this chat' });
    return;
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  // محاسبه insertion_order بعدی
  const maxOrder = db.prepare('SELECT MAX(insertion_order) as max_order FROM chat_lorebooks WHERE chat_id = ?')
    .get(req.params.chatId) as any;
  const order = typeof insertion_order === 'number' ? insertion_order : ((maxOrder?.max_order || 0) + 100);

  db.prepare(`
    INSERT INTO chat_lorebooks (id, chat_id, lorebook_id, is_active, insertion_order, created_at)
    VALUES (?, ?, ?, 1, ?, ?)
  `).run(id, req.params.chatId, lorebook_id, order, now);

  const result = db.prepare(`
    SELECT cl.*, l.name as lorebook_name, l.scan_depth, l.token_budget,
      (SELECT COUNT(*) FROM lorebook_entries WHERE lorebook_id = l.id AND disable = 0) as active_entries,
      (SELECT COUNT(*) FROM lorebook_entries WHERE lorebook_id = l.id) as total_entries
    FROM chat_lorebooks cl
    JOIN lorebooks l ON cl.lorebook_id = l.id
    WHERE cl.id = ?
  `).get(id) as any;

  res.status(201).json({ ...result, is_active: !!result.is_active });
});

// تغییر وضعیت لور بوک در چت (فعال/غیرفعال)
router.put('/:chatId/lorebooks/:id', (req: Request, res: Response) => {
  const db = getDb();
  const { is_active, insertion_order } = req.body;

  const existing = db.prepare('SELECT * FROM chat_lorebooks WHERE id = ? AND chat_id = ?')
    .get(req.params.id, req.params.chatId) as any;
  if (!existing) {
    res.status(404).json({ error: 'Chat lorebook not found' });
    return;
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE chat_lorebooks SET is_active = ?, insertion_order = ?, created_at = created_at
    WHERE id = ?
  `).run(
    typeof is_active === 'boolean' ? (is_active ? 1 : 0) : existing.is_active,
    typeof insertion_order === 'number' ? insertion_order : existing.insertion_order,
    req.params.id,
  );

  const result = db.prepare(`
    SELECT cl.*, l.name as lorebook_name, l.scan_depth, l.token_budget,
      (SELECT COUNT(*) FROM lorebook_entries WHERE lorebook_id = l.id AND disable = 0) as active_entries,
      (SELECT COUNT(*) FROM lorebook_entries WHERE lorebook_id = l.id) as total_entries
    FROM chat_lorebooks cl
    JOIN lorebooks l ON cl.lorebook_id = l.id
    WHERE cl.id = ?
  `).get(req.params.id) as any;

  res.json({ ...result, is_active: !!result.is_active });
});

// حذف لور بوک از چت
router.delete('/:chatId/lorebooks/:id', (req: Request, res: Response) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM chat_lorebooks WHERE id = ? AND chat_id = ?')
    .run(req.params.id, req.params.chatId);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Chat lorebook not found' });
    return;
  }
  res.json({ success: true });
});

// ─── Export/Import چت ───

// خروجی چت به JSON — شامل تنظیمات کامل، پیام‌ها، فصل‌ها، لوربوک‌ها، story state و ...
router.get('/:id/export', (req: Request, res: Response) => {
  const db = getDb();
  const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(req.params.id) as any;
  if (!chat) {
    res.status(404).json({ error: 'Chat not found' });
    return;
  }

  const messages = db.prepare(
    'SELECT role, content, swipes, swipe_id, is_edited, is_system, send_date, sender_name, sender_avatar, sender_character_id FROM messages WHERE chat_id = ? ORDER BY rowid ASC'
  ).all(req.params.id) as any[];

  // نگاشت message id → index برای فصل‌ها
  const idToIndex = new Map<string, number>();
  const msgIds = db.prepare('SELECT id FROM messages WHERE chat_id = ? ORDER BY rowid ASC').all(req.params.id) as any[];
  msgIds.forEach((m: any, i: number) => idToIndex.set(m.id, i));

  const chapters = db.prepare(
    'SELECT start_message_id, end_message_id, title, summary FROM chapters WHERE chat_id = ? ORDER BY created_at ASC'
  ).all(req.params.id) as any[];

  // ─── Story State ───
  const storyStateRow = db.prepare('SELECT * FROM chat_story_state WHERE chat_id = ?').get(req.params.id) as any;
  let storyState = null;
  if (storyStateRow) {
    try { storyState = JSON.parse(storyStateRow.state_json); } catch {}
  }

  // ─── Chat Lorebooks (لوربوک‌های متصل + entryها) ───
  const chatLorebookLinks = db.prepare(`
    SELECT cl.lorebook_id, cl.is_active, cl.insertion_order,
           l.name, l.scan_depth, l.token_budget
    FROM chat_lorebooks cl
    JOIN lorebooks l ON cl.lorebook_id = l.id
    WHERE cl.chat_id = ?
    ORDER BY cl.insertion_order ASC
  `).all(req.params.id) as any[];

  const lorebooks: any[] = [];
  for (const link of chatLorebookLinks) {
    const entries = db.prepare('SELECT * FROM lorebook_entries WHERE lorebook_id = ?').all(link.lorebook_id) as any[];
    lorebooks.push({
      name: link.name,
      scan_depth: link.scan_depth,
      token_budget: link.token_budget,
      is_active: !!link.is_active,
      insertion_order: link.insertion_order,
      entries: entries.map((e) => ({
        keys: JSON.parse(e.keys || '[]'),
        keys_secondary: JSON.parse(e.keys_secondary || '[]'),
        content: e.content,
        constant: !!e.constant,
        selective: !!e.selective,
        insertion_order: e.insertion_order,
        position: e.position,
        disable: !!e.disable,
        comment: e.comment,
        case_sensitive: !!e.case_sensitive,
        use_regex: !!e.use_regex,
        probability: e.probability ?? 100,
      })),
    });
  }

  // ─── Group Chat Participants ───
  let participants: any[] | undefined;
  if (chat.is_group_chat) {
    participants = db.prepare(`
      SELECT cp.character_id, cp.display_name, cp.is_active
      FROM chat_participants cp
      WHERE cp.chat_id = ?
      ORDER BY cp.created_at ASC
    `).all(req.params.id) as any[];
    participants = participants.map((p) => {
      const char = db.prepare('SELECT name FROM characters WHERE id = ?').get(p.character_id) as any;
      return { ...p, character_name: char?.name || p.display_name || '' };
    });
  }

  // ─── Character Info (برای قابلیت حمل) ───
  const character = db.prepare(
    'SELECT name, description, personality, scenario, first_mes, mes_example, creator_notes, system_prompt, post_history_instructions, alternate_greetings, tags, creator, character_version, nickname FROM characters WHERE id = ?'
  ).get(chat.character_id) as any;

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="chat-${encodeURIComponent(chat.name || req.params.id)}.json"`);
  res.json({
    format: 'cozytavern-chat',
    version: 2,
    exported_at: new Date().toISOString(),
    character: character || null,
    chat: {
      name: chat.name,
      folder: chat.folder || '',
      authors_note: chat.authors_note || '',
      authors_note_depth: chat.authors_note_depth ?? 4,
      authors_note_position: chat.authors_note_position || 'in_chat',
      is_group_chat: !!chat.is_group_chat,
      group_chat_name: chat.group_chat_name || '',
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
    story_state: storyState,
    lorebooks,
    ...(participants && participants.length > 0 ? { participants } : {}),
  });
});

// ورودی چت — بدنه: { character_id, data } که data خروجی export است (version 1 و 2)
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

  // ─── ایجاد چت ───
  db.prepare(`
    INSERT INTO chats (id, character_id, name, branch_from, lorebook_id, folder, authors_note, authors_note_depth, authors_note_position, is_group_chat, group_chat_name, created_at, updated_at)
    VALUES (?, ?, ?, NULL, '', ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    chatId, character_id,
    String(srcChat.name || 'Imported Chat'),
    String(srcChat.folder || ''),
    String(srcChat.authors_note || ''),
    typeof srcChat.authors_note_depth === 'number' ? srcChat.authors_note_depth : 4,
    srcChat.authors_note_position === 'after_char' ? 'after_char' : 'in_chat',
    srcChat.is_group_chat ? 1 : 0,
    String(srcChat.group_chat_name || ''),
    now, now,
  );

  // ─── درج پیام‌ها ───
  const insertMsg = db.prepare(`
    INSERT INTO messages (id, chat_id, role, content, swipes, swipe_id, is_edited, is_system, send_date, sender_name, sender_avatar, sender_character_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      String(m.sender_name || ''),
      String(m.sender_avatar || ''),
      String(m.sender_character_id || ''),
    );
    indexToId.set(count, msgId);
    count++;
  }

  // ─── بازسازی فصل‌ها ───
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

  // ─── بازسازی Story State ───
  if (data.story_state && typeof data.story_state === 'object') {
    db.prepare('INSERT INTO chat_story_state (id, chat_id, state_json, updated_at) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), chatId, JSON.stringify(data.story_state), now);
  }

  // ─── بازسازی Chat Lorebooks ───
  if (Array.isArray(data.lorebooks) && data.lorebooks.length > 0) {
    const insertLorebook = db.prepare(`
      INSERT INTO lorebooks (id, name, scan_depth, token_budget, created_at) VALUES (?, ?, ?, ?, ?)
    `);
    const insertEntry = db.prepare(`
      INSERT INTO lorebook_entries (id, lorebook_id, keys, keys_secondary, content, constant, selective, insertion_order, position, disable, comment, case_sensitive, use_regex, probability)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertChatLorebook = db.prepare(`
      INSERT INTO chat_lorebooks (id, chat_id, lorebook_id, is_active, insertion_order, created_at) VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const lb of data.lorebooks) {
      const lbId = uuidv4();
      insertLorebook.run(lbId, String(lb.name || 'Imported Lorebook'), lb.scan_depth || 50, lb.token_budget || 500, now);

      // درج entryها
      if (Array.isArray(lb.entries)) {
        for (const entry of lb.entries) {
          insertEntry.run(
            uuidv4(), lbId,
            JSON.stringify(Array.isArray(entry.keys) ? entry.keys : []),
            JSON.stringify(Array.isArray(entry.keys_secondary) ? entry.keys_secondary : []),
            String(entry.content || ''),
            entry.constant ? 1 : 0,
            entry.selective ? 1 : 0,
            typeof entry.insertion_order === 'number' ? entry.insertion_order : 100,
            String(entry.position || 'before_main'),
            entry.disable ? 1 : 0,
            String(entry.comment || ''),
            entry.case_sensitive ? 1 : 0,
            entry.use_regex ? 1 : 0,
            typeof entry.probability === 'number' ? entry.probability : 100,
          );
        }
      }

      // لینک به چت
      insertChatLorebook.run(uuidv4(), chatId, lbId, lb.is_active !== false ? 1 : 0, lb.insertion_order || 100, now);
    }
  }

  const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(chatId) as any;
  res.status(201).json({ ...chat, imported_messages: count });
});

// ─── Duplicate Chat ───
router.post('/:id/duplicate', (req: Request, res: Response) => {
  const db = getDb();
  const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(req.params.id) as any;
  if (!chat) {
    res.status(404).json({ error: 'Chat not found' });
    return;
  }

  const now = new Date().toISOString();
  const newChatId = uuidv4();
  const newName = req.body?.name || `${chat.name} (Copy)`;

  const duplicate = db.transaction(() => {
    // ─── کپی چت ───
    db.prepare(`
      INSERT INTO chats (id, character_id, name, branch_from, lorebook_id, folder, authors_note, authors_note_depth, authors_note_position, is_group_chat, group_chat_name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      newChatId, chat.character_id, newName, chat.branch_from, chat.lorebook_id || '',
      chat.folder || '', chat.authors_note || '', chat.authors_note_depth ?? 4,
      chat.authors_note_position || 'in_chat', chat.is_group_chat || 0,
      chat.group_chat_name || '', now, now,
    );

    // ─── کپی پیام‌ها با نگاشت id قدیم → جدید ───
    const messages = db.prepare(
      'SELECT * FROM messages WHERE chat_id = ? ORDER BY rowid ASC'
    ).all(req.params.id) as any[];

    const oldToNewMsgId = new Map<string, string>();
    const insertMsg = db.prepare(`
      INSERT INTO messages (id, chat_id, role, content, swipes, swipe_id, is_edited, is_system, send_date, sender_name, sender_avatar, sender_character_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const m of messages) {
      const newMsgId = uuidv4();
      oldToNewMsgId.set(m.id, newMsgId);
      insertMsg.run(
        newMsgId, newChatId, m.role, m.content,
        m.swipes || '[]', m.swipe_id || 0, m.is_edited || 0,
        m.is_system || 0, m.send_date, m.sender_name || '',
        m.sender_avatar || '', m.sender_character_id || '',
      );
    }

    // ─── کپی فصل‌ها ───
    const chapters = db.prepare(
      'SELECT * FROM chapters WHERE chat_id = ? ORDER BY created_at ASC'
    ).all(req.params.id) as any[];

    const insertChapter = db.prepare(`
      INSERT INTO chapters (id, chat_id, start_message_id, end_message_id, title, summary, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const c of chapters) {
      const newStartId = oldToNewMsgId.get(c.start_message_id);
      const newEndId = oldToNewMsgId.get(c.end_message_id);
      if (newStartId && newEndId) {
        insertChapter.run(uuidv4(), newChatId, newStartId, newEndId, c.title || '', c.summary || '', now, now);
      }
    }

    // ─── کپی Story State ───
    const storyState = db.prepare('SELECT * FROM chat_story_state WHERE chat_id = ?').get(req.params.id) as any;
    if (storyState) {
      db.prepare('INSERT INTO chat_story_state (id, chat_id, state_json, updated_at) VALUES (?, ?, ?, ?)')
        .run(uuidv4(), newChatId, storyState.state_json, now);
    }

    // ─── کپی Chat Lorebooks ───
    const chatLorebooks = db.prepare(
      'SELECT * FROM chat_lorebooks WHERE chat_id = ?'
    ).all(req.params.id) as any[];

    const insertChatLorebook = db.prepare(`
      INSERT INTO chat_lorebooks (id, chat_id, lorebook_id, is_active, insertion_order, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const cl of chatLorebooks) {
      insertChatLorebook.run(uuidv4(), newChatId, cl.lorebook_id, cl.is_active, cl.insertion_order, now);
    }

    // ─── کپی Group Chat Participants ───
    if (chat.is_group_chat) {
      const participants = db.prepare(
        'SELECT * FROM chat_participants WHERE chat_id = ?'
      ).all(req.params.id) as any[];

      const insertParticipant = db.prepare(`
        INSERT INTO chat_participants (id, chat_id, character_id, display_name, display_avatar, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const p of participants) {
        insertParticipant.run(uuidv4(), newChatId, p.character_id, p.display_name || '', p.display_avatar || '', p.is_active, now);
      }
    }
  });

  try {
    duplicate();
    const newChat = db.prepare('SELECT * FROM chats WHERE id = ?').get(newChatId);
    res.status(201).json(newChat);
  } catch (err: any) {
    console.error('Chat duplicate failed:', err);
    res.status(500).json({ error: `Duplicate failed: ${err.message}` });
  }
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
