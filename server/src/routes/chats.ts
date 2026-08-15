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
    res.status(404).json({ error: 'چت پیدا نشد' });
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
    res.status(400).json({ error: 'character_id الزامی است' });
    return;
  }

  const character = db.prepare('SELECT name FROM characters WHERE id = ?').get(character_id) as any;
  const chatName = name || (character ? `چت با ${character.name}` : 'چت جدید');

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
  }

  const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(id);
  res.status(201).json(chat);
});

// حذف چت
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM chats WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'چت پیدا نشد' });
    return;
  }
  res.json({ success: true });
});

// نام‌گذاری خودکار چت توسط AI
router.post('/:id/auto-name', async (req: Request, res: Response) => {
  const db = getDb();
  const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(req.params.id) as any;
  if (!chat) {
    res.status(404).json({ error: 'چت پیدا نشد' });
    return;
  }

  const messages = db.prepare(
    'SELECT * FROM messages WHERE chat_id = ? ORDER BY rowid ASC'
  ).all(req.params.id) as any[];

  if (messages.length === 0) {
    res.status(400).json({ error: 'چت پیامی ندارد' });
    return;
  }

  const settings = db.prepare("SELECT * FROM api_settings ORDER BY ROWID DESC LIMIT 1").get() as any;
  if (!settings) {
    res.status(400).json({ error: 'تنظیمات API یافت نشد' });
    return;
  }

  // ساخت مکالمه برای مدل
  const conversation = messages.slice(0, 10).map((m: any) =>
    `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, 200)}`
  ).join('\n');

  const endpoint = buildEndpoint(settings.base_url);
  const headers = buildHeaders(settings.api_key);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: settings.model,
        messages: [
          { role: 'system', content: 'Generate a short title (max 5 words) for this conversation. Reply ONLY with the title text.' },
          { role: 'user', content: conversation },
        ],
        max_tokens: 500,
        temperature: 0.3,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      res.status(500).json({ error: `خطا از API: ${response.status}` });
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
      res.status(500).json({ error: 'نامی تولید نشد' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'خطا در نام‌گذاری' });
  }
});

// بروزرسانی چت
router.put('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const { name, lorebook_id, folder } = req.body;
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT * FROM chats WHERE id = ?').get(req.params.id) as any;
  if (!existing) {
    res.status(404).json({ error: 'چت پیدا نشد' });
    return;
  }
  db.prepare('UPDATE chats SET name=?, lorebook_id=?, folder=?, updated_at=? WHERE id=?').run(
    name ?? existing.name ?? 'چت',
    lorebook_id ?? existing.lorebook_id ?? '',
    folder ?? existing.folder ?? '',
    now, req.params.id
  );
  const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(req.params.id);
  res.json(chat);
});

export default router;
