import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// لیست لوربوک‌ها
router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const lorebooks = db.prepare('SELECT * FROM lorebooks ORDER BY created_at DESC').all();
  res.json(lorebooks);
});

// دریافت لوربوک با entries
router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const lorebook = db.prepare('SELECT * FROM lorebooks WHERE id = ?').get(req.params.id) as any;
  if (!lorebook) {
    res.status(404).json({ error: 'لوربوک پیدا نشد' });
    return;
  }
  const entries = db.prepare('SELECT * FROM lorebook_entries WHERE lorebook_id = ? ORDER BY insertion_order ASC')
    .all(req.params.id).map((e: any) => ({
      ...e,
      key: JSON.parse(e.keys || '[]'),
      keysecondary: JSON.parse(e.keys_secondary || '[]'),
      constant: !!e.constant,
      selective: !!e.selective,
      disable: !!e.disable,
    }));
  res.json({ ...lorebook, entries });
});

// ایجاد لوربوک جدید
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  const { name, scan_depth, token_budget } = req.body;

  db.prepare(`
    INSERT INTO lorebooks (id, name, scan_depth, token_budget, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, name || 'لوربوک جدید', scan_depth ?? 50, token_budget ?? 500, now);

  const lorebook = db.prepare('SELECT * FROM lorebooks WHERE id = ?').get(id);
  res.status(201).json(lorebook);
});

// بروزرسانی لوربوک
router.put('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const { name, scan_depth, token_budget } = req.body;
  db.prepare('UPDATE lorebooks SET name=?, scan_depth=?, token_budget=? WHERE id=?')
    .run(name, scan_depth, token_budget, req.params.id);
  const lorebook = db.prepare('SELECT * FROM lorebooks WHERE id = ?').get(req.params.id);
  res.json(lorebook);
});

// حذف لوربوک
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM lorebooks WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// اضافه کردن entry
router.post('/:id/entries', (req: Request, res: Response) => {
  const db = getDb();
  const entryId = uuidv4();
  const { key, keysecondary, content, constant, selective, insertion_order, position, disable, comment } = req.body;

  db.prepare(`
    INSERT INTO lorebook_entries (id, lorebook_id, keys, keys_secondary, content, constant, selective, insertion_order, position, disable, comment)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    entryId, req.params.id,
    JSON.stringify(key || []), JSON.stringify(keysecondary || []),
    content || '', constant ? 1 : 0, selective ? 1 : 0,
    insertion_order ?? 100, position || 'before_main',
    disable ? 1 : 0, comment || ''
  );

  const entry = db.prepare('SELECT * FROM lorebook_entries WHERE id = ?').get(entryId) as any;
  res.status(201).json({
    ...entry,
    key: JSON.parse(entry.keys || '[]'),
    keysecondary: JSON.parse(entry.keys_secondary || '[]'),
    constant: !!entry.constant,
    selective: !!entry.selective,
    disable: !!entry.disable,
  });
});

// بروزرسانی entry
router.put('/entries/:entryId', (req: Request, res: Response) => {
  const db = getDb();
  const { key, keysecondary, content, constant, selective, insertion_order, position, disable, comment } = req.body;

  db.prepare(`
    UPDATE lorebook_entries SET keys=?, keys_secondary=?, content=?, constant=?, selective=?, insertion_order=?, position=?, disable=?, comment=?
    WHERE id=?
  `).run(
    JSON.stringify(key || []), JSON.stringify(keysecondary || []),
    content || '', constant ? 1 : 0, selective ? 1 : 0,
    insertion_order ?? 100, position || 'before_main',
    disable ? 1 : 0, comment || '',
    req.params.entryId
  );

  const entry = db.prepare('SELECT * FROM lorebook_entries WHERE id = ?').get(req.params.entryId) as any;
  res.json({
    ...entry,
    key: JSON.parse(entry.keys || '[]'),
    keysecondary: JSON.parse(entry.keys_secondary || '[]'),
    constant: !!entry.constant,
    selective: !!entry.selective,
    disable: !!entry.disable,
  });
});

// حذف entry
router.delete('/entries/:entryId', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM lorebook_entries WHERE id = ?').run(req.params.entryId);
  res.json({ success: true });
});

export default router;
