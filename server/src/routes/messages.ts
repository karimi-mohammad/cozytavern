import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ─── Search Messages ───
// GET /api/messages/search?q=...&chat_id=...&role=...&limit=20&offset=0
router.get('/search', (req: Request, res: Response) => {
  const db = getDb();
  const query = (req.query.q as string || '').trim();
  const chatId = req.query.chat_id as string || '';
  const role = req.query.role as string || '';
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const offset = Math.max(0, parseInt(req.query.offset as string) || 0);

  if (!query) {
    res.status(400).json({ error: 'Search query is required' });
    return;
  }

  // Build SQL query with LIKE for full-text search
  const conditions: string[] = ['m.content LIKE ?'];
  const params: any[] = [`%${query}%`];

  if (chatId) {
    conditions.push('m.chat_id = ?');
    params.push(chatId);
  }

  if (role && ['user', 'assistant', 'system'].includes(role)) {
    conditions.push('m.role = ?');
    params.push(role);
  }

  const whereClause = conditions.join(' AND ');

  // Get total count
  const countRow = db.prepare(
    `SELECT COUNT(*) as total FROM messages m WHERE ${whereClause}`
  ).get(...params) as any;

  // Get results with chat and character info
  const results = db.prepare(`
    SELECT
      m.id, m.chat_id, m.role, m.content, m.send_date, m.is_edited, m.is_system,
      c.name as chat_name,
      ch.name as character_name, ch.avatar as character_avatar
    FROM messages m
    LEFT JOIN chats c ON m.chat_id = c.id
    LEFT JOIN characters ch ON c.character_id = ch.id
    WHERE ${whereClause}
    ORDER BY m.send_date DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  // Build context snippets (text before and after the match)
  const enriched = results.map((msg: any) => {
    const idx = msg.content.toLowerCase().indexOf(query.toLowerCase());
    const snippetStart = Math.max(0, idx - 60);
    const snippetEnd = Math.min(msg.content.length, idx + query.length + 60);
    const snippet = (snippetStart > 0 ? '...' : '') +
      msg.content.slice(snippetStart, snippetEnd) +
      (snippetEnd < msg.content.length ? '...' : '');

    return {
      id: msg.id,
      chat_id: msg.chat_id,
      chat_name: msg.chat_name,
      character_name: msg.character_name,
      character_avatar: msg.character_avatar,
      role: msg.role,
      content: msg.content,
      snippet,
      send_date: msg.send_date,
      is_edited: !!msg.is_edited,
    };
  });

  res.json({
    results: enriched,
    total: countRow.total,
    limit,
    offset,
  });
});

// اضافه کردن پیام
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const id = uuidv4();
  const { chat_id, role, content, is_system } = req.body;

  if (!chat_id || !role) {
    res.status(400).json({ error: 'chat_id and role are required' });
    return;
  }

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO messages (id, chat_id, role, content, swipes, swipe_id, is_edited, is_system, send_date)
    VALUES (?, ?, ?, ?, '[]', 0, 0, ?, ?)
  `).run(id, chat_id, role, content || '', is_system ? 1 : 0, now);

  // بروزرسانی updated_at چت
  db.prepare('UPDATE chats SET updated_at = ? WHERE id = ?').run(now, chat_id);

  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as any;
  res.status(201).json({
    ...message,
    swipes: JSON.parse(message.swipes || '[]'),
    is_edited: !!message.is_edited,
    is_system: !!message.is_system,
  });
});

// ادیت کردن پیام — فقط همون پیام تغییر می‌کنه، بقیه پیام‌ها دست‌نخورده باقی می‌مونن
router.put('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id) as any;
  if (!message) {
    res.status(404).json({ error: 'Message not found' });
    return;
  }

  const { content } = req.body;
  const now = new Date().toISOString();

  // ذخیره نسخه اصلی در swipes اگر ادیت نشده
  let swipes = JSON.parse(message.swipes || '[]');
  if (!message.is_edited && message.content) {
    swipes = [...swipes, message.content];
  }

  db.prepare(`
    UPDATE messages SET content=?, swipes=?, is_edited=1, send_date=? WHERE id=?
  `).run(content, JSON.stringify(swipes), now, req.params.id);

  const updated = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id) as any;
  res.json({
    ...updated,
    swipes: JSON.parse(updated.swipes || '[]'),
    is_edited: !!updated.is_edited,
    is_system: !!updated.is_system,
  });
});

// حذف پیام — فقط همون پیام حذف می‌شه، بقیه پیام‌ها دست‌نخورده باقی می‌مونن
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id) as any;
  if (!message) {
    res.status(404).json({ error: 'Message not found' });
    return;
  }

  db.prepare('DELETE FROM messages WHERE id = ?').run(req.params.id);

  res.json({ success: true });
});

// Regenerate - بازسازی آخرین پاسخ
router.post('/regenerate/:chatId', (req: Request, res: Response) => {
  const db = getDb();
  const lastMsg = db.prepare(
    "SELECT * FROM messages WHERE chat_id = ? AND role = 'assistant' ORDER BY rowid DESC LIMIT 1"
  ).get(req.params.chatId) as any;

  if (!lastMsg) {
    res.status(404).json({ error: 'No message to regenerate was found' });
    return;
  }

  let swipes = JSON.parse(lastMsg.swipes || '[]');
  swipes.push(lastMsg.content);

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE messages SET swipes=?, swipe_id=?, send_date=? WHERE id=?
  `).run(JSON.stringify(swipes), swipes.length - 1, now, lastMsg.id);

  const updated = db.prepare('SELECT * FROM messages WHERE id = ?').get(lastMsg.id) as any;
  res.json({
    ...updated,
    swipes: JSON.parse(updated.swipes || '[]'),
    is_edited: !!updated.is_edited,
    is_system: !!updated.is_system,
  });
});

// Swipe بین پاسخ‌ها
router.post('/swipe/:id', (req: Request, res: Response) => {
  const db = getDb();
  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id) as any;
  if (!message) {
    res.status(404).json({ error: 'Message not found' });
    return;
  }

  const { direction } = req.body; // 'next' or 'prev'
  const swipes = JSON.parse(message.swipes || '[]');
  if (swipes.length === 0) {
    res.json({ ...message, swipes, is_edited: !!message.is_edited, is_system: !!message.is_system });
    return;
  }

  let newSwipeId = message.swipe_id;
  if (direction === 'next' && newSwipeId < swipes.length - 1) {
    newSwipeId++;
  } else if (direction === 'prev' && newSwipeId > 0) {
    newSwipeId--;
  }

  // اگر swipe_id تغییر نکرده، نیازی به آپدیت نیست
  if (newSwipeId !== message.swipe_id) {
    const newContent = swipes[newSwipeId];
    db.prepare('UPDATE messages SET content=?, swipe_id=? WHERE id=?').run(newContent, newSwipeId, req.params.id);
  }

  const updated = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id) as any;
  res.json({
    ...updated,
    swipes: JSON.parse(updated.swipes || '[]'),
    is_edited: !!updated.is_edited,
    is_system: !!updated.is_system,
  });
});

export default router;
