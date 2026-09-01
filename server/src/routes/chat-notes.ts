import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// دریافت تمام یادداشت‌های یک چت
router.get('/:chatId', (req: Request, res: Response) => {
  const db = getDb();
  const notes = db.prepare(
    'SELECT * FROM chat_notes WHERE chat_id = ? ORDER BY updated_at DESC'
  ).all(req.params.chatId);
  res.json(notes);
});

// ایجاد یادداشت جدید
router.post('/:chatId', (req: Request, res: Response) => {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  const { content } = req.body;

  if (!content || !content.trim()) {
    res.status(400).json({ error: 'content is required' });
    return;
  }

  db.prepare(`
    INSERT INTO chat_notes (id, chat_id, content, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, req.params.chatId, content.trim(), now, now);

  const note = db.prepare('SELECT * FROM chat_notes WHERE id = ?').get(id);
  res.status(201).json(note);
});

// بروزرسانی یادداشت
router.put('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const { content } = req.body;
  const now = new Date().toISOString();

  if (!content || !content.trim()) {
    res.status(400).json({ error: 'content is required' });
    return;
  }

  const result = db.prepare(
    'UPDATE chat_notes SET content = ?, updated_at = ? WHERE id = ?'
  ).run(content.trim(), now, req.params.id);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Note not found' });
    return;
  }

  const note = db.prepare('SELECT * FROM chat_notes WHERE id = ?').get(req.params.id);
  res.json(note);
});

// حذف یادداشت
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM chat_notes WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Note not found' });
    return;
  }
  res.json({ success: true });
});

export default router;
