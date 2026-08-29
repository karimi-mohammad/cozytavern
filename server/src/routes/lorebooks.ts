import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { getPluginSettings } from '../utils/plugin-store';

const router = Router();

// مپ کردن ردیف entry به فرمت کلاینت — شامل فیلدهای موتور پیشرفته
function mapEntry(e: any) {
  return {
    ...e,
    key: JSON.parse(e.keys || '[]'),
    keysecondary: JSON.parse(e.keys_secondary || '[]'),
    constant: !!e.constant,
    selective: !!e.selective,
    disable: !!e.disable,
    case_sensitive: !!(e.case_sensitive ?? 0),
    use_regex: !!(e.use_regex ?? 0),
    probability: e.probability ?? 100,
  };
}

// لیست لوربوک‌ها
router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const lorebooks = db.prepare('SELECT * FROM lorebooks ORDER BY created_at DESC').all();
  res.json(lorebooks);
});

// ─── Entry routes (باید قبل از /:id باشند تا تداخل نداشته باشند) ───

// اضافه کردن entry
router.post('/:id/entries', (req: Request, res: Response) => {
  const db = getDb();
  const entryId = uuidv4();
  const { key, keysecondary, content, constant, selective, insertion_order, position, disable, comment, case_sensitive, use_regex, probability } = req.body;

  db.prepare(`
    INSERT INTO lorebook_entries (id, lorebook_id, keys, keys_secondary, content, constant, selective, insertion_order, position, disable, comment, case_sensitive, use_regex, probability)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    entryId, req.params.id,
    JSON.stringify(key || []), JSON.stringify(keysecondary || []),
    content || '', constant ? 1 : 0, selective ? 1 : 0,
    insertion_order ?? 100, position || 'before_main',
    disable ? 1 : 0, comment || '',
    case_sensitive ? 1 : 0, use_regex ? 1 : 0,
    typeof probability === 'number' ? Math.min(100, Math.max(0, Math.trunc(probability))) : 100,
  );

  const entry = db.prepare('SELECT * FROM lorebook_entries WHERE id = ?').get(entryId) as any;
  res.status(201).json(mapEntry(entry));
});

// بروزرسانی entry
router.put('/entries/:entryId', (req: Request, res: Response) => {
  const db = getDb();
  const { key, keysecondary, content, constant, selective, insertion_order, position, disable, comment, case_sensitive, use_regex, probability } = req.body;
  const existing = db.prepare('SELECT * FROM lorebook_entries WHERE id = ?').get(req.params.entryId) as any;
  if (!existing) {
    res.status(404).json({ error: 'Entry not found' });
    return;
  }

  db.prepare(`
    UPDATE lorebook_entries SET keys=?, keys_secondary=?, content=?, constant=?, selective=?, insertion_order=?, position=?, disable=?, comment=?, case_sensitive=?, use_regex=?, probability=?
    WHERE id=?
  `).run(
    JSON.stringify(key || []), JSON.stringify(keysecondary || []),
    content || '', constant ? 1 : 0, selective ? 1 : 0,
    insertion_order ?? 100, position || 'before_main',
    disable ? 1 : 0, comment || '',
    case_sensitive !== undefined ? (case_sensitive ? 1 : 0) : (existing.case_sensitive ?? 0),
    use_regex !== undefined ? (use_regex ? 1 : 0) : (existing.use_regex ?? 0),
    probability !== undefined
      ? Math.min(100, Math.max(0, Math.trunc(probability)))
      : (existing.probability ?? 100),
    req.params.entryId
  );

  const entry = db.prepare('SELECT * FROM lorebook_entries WHERE id = ?').get(req.params.entryId) as any;
  res.json(mapEntry(entry));
});

// حذف entry
router.delete('/entries/:entryId', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM lorebook_entries WHERE id = ?').run(req.params.entryId);
  res.json({ success: true });
});

// ─── Lorebook CRUD (بعد از entry routes) ───

// دریافت لوربوک با entries
router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const lorebook = db.prepare('SELECT * FROM lorebooks WHERE id = ?').get(req.params.id) as any;
  if (!lorebook) {
    res.status(404).json({ error: 'Lorebook not found' });
    return;
  }
  const entries = db.prepare('SELECT * FROM lorebook_entries WHERE lorebook_id = ? ORDER BY insertion_order ASC')
    .all(req.params.id).map(mapEntry);
  res.json({ ...lorebook, entries });
});

// ایجاد لوربوک جدید (پیش‌فرض‌های scan_depth/token_budget از پلاگین lorebook_scanner)
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  const { name, scan_depth, token_budget } = req.body;
  const scannerDefaults = getPluginSettings(db, 'lorebook_scanner');

  db.prepare(`
    INSERT INTO lorebooks (id, name, scan_depth, token_budget, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    id,
    name || 'New Lorebook',
    scan_depth ?? scannerDefaults?.default_scan_depth ?? 50,
    token_budget ?? scannerDefaults?.default_token_budget ?? 500,
    now,
  );

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

export default router;
