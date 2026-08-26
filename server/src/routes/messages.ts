import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

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

// ادیت کردن پیام
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

  // حذف پیام‌های بعدی (چون context تغییر کرده)
  db.prepare(
    'DELETE FROM messages WHERE chat_id = ? AND send_date > ?'
  ).run(message.chat_id, message.send_date);

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

// حذف پیام - پیام‌های بعدی هم حذف می‌شوند (چون context تغییر کرده)
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id) as any;
  if (!message) {
    res.status(404).json({ error: 'Message not found' });
    return;
  }

  db.prepare(
    'DELETE FROM messages WHERE chat_id = ? AND send_date >= ?'
  ).run(message.chat_id, message.send_date);

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

  const newContent = swipes[newSwipeId];
  db.prepare('UPDATE messages SET content=?, swipe_id=? WHERE id=?').run(newContent, newSwipeId, req.params.id);

  const updated = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id) as any;
  res.json({
    ...updated,
    swipes: JSON.parse(updated.swipes || '[]'),
    is_edited: !!updated.is_edited,
    is_system: !!updated.is_system,
  });
});

export default router;
