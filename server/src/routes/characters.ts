import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// لیست همه کاراکترها
router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const characters = db.prepare('SELECT * FROM characters ORDER BY updated_at DESC').all();
  const parsed = characters.map((c: any) => ({
    ...c,
    tags: JSON.parse(c.tags || '[]'),
  }));
  res.json(parsed);
});

// دریافت یک کاراکتر
router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(req.params.id) as any;
  if (!character) {
    res.status(404).json({ error: 'کاراکتر پیدا نشد' });
    return;
  }
  res.json({ ...character, tags: JSON.parse(character.tags || '[]') });
});

// ایجاد کاراکتر جدید
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  const { name, description, personality, scenario, first_mes, mes_example, creator_notes, tags, avatar, lorebook_id } = req.body;

  db.prepare(`
    INSERT INTO characters (id, name, description, personality, scenario, first_mes, mes_example, creator_notes, tags, avatar, lorebook_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name || '', description || '', personality || '', scenario || '', first_mes || '', mes_example || '', creator_notes || '', JSON.stringify(tags || []), avatar || '', lorebook_id || '', now, now);

  const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(id) as any;
  res.status(201).json({ ...character, tags: JSON.parse(character.tags || '[]') });
});

// بروزرسانی کاراکتر
router.put('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM characters WHERE id = ?').get(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'کاراکتر پیدا نشد' });
    return;
  }

  const now = new Date().toISOString();
  const { name, description, personality, scenario, first_mes, mes_example, creator_notes, tags, avatar, lorebook_id } = req.body;

  db.prepare(`
    UPDATE characters SET name=?, description=?, personality=?, scenario=?, first_mes=?, mes_example=?, creator_notes=?, tags=?, avatar=?, lorebook_id=?, updated_at=?
    WHERE id=?
  `).run(
    name ?? (existing as any).name,
    description ?? (existing as any).description,
    personality ?? (existing as any).personality,
    scenario ?? (existing as any).scenario,
    first_mes ?? (existing as any).first_mes,
    mes_example ?? (existing as any).mes_example,
    creator_notes ?? (existing as any).creator_notes,
    JSON.stringify(tags ?? JSON.parse((existing as any).tags || '[]')),
    avatar ?? (existing as any).avatar,
    lorebook_id ?? (existing as any).lorebook_id ?? '',
    now,
    req.params.id
  );

  const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(req.params.id) as any;
  res.json({ ...character, tags: JSON.parse(character.tags || '[]') });
});

// حذف کاراکتر
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM characters WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'کاراکتر پیدا نشد' });
    return;
  }
  res.json({ success: true });
});

export default router;
