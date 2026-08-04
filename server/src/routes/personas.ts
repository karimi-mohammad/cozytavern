import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const personas = db.prepare('SELECT * FROM personas ORDER BY created_at DESC').all();
  res.json(personas);
});

router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const persona = db.prepare('SELECT * FROM personas WHERE id = ?').get(req.params.id);
  if (!persona) {
    res.status(404).json({ error: 'پرسونا پیدا نشد' });
    return;
  }
  res.json(persona);
});

router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  const { name, description, personality, avatar } = req.body;

  db.prepare(`
    INSERT INTO personas (id, name, description, personality, avatar, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, name || '', description || '', personality || '', avatar || '', now);

  const persona = db.prepare('SELECT * FROM personas WHERE id = ?').get(id);
  res.status(201).json(persona);
});

router.put('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const { name, description, personality, avatar } = req.body;
  db.prepare(`
    UPDATE personas SET name=?, description=?, personality=?, avatar=? WHERE id=?
  `).run(name, description, personality, avatar, req.params.id);
  const persona = db.prepare('SELECT * FROM personas WHERE id = ?').get(req.params.id);
  res.json(persona);
});

router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM personas WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
