import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Default state structure
const defaultState = {
  characters: {},
  relationships: {},
  current_situation: '',
  rules: [],
};

// دریافت state یک چت
router.get('/chat/:chatId', (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM chat_story_state WHERE chat_id = ?').get(req.params.chatId) as any;

  if (!row) {
    res.json({ ...defaultState, chat_id: req.params.chatId });
    return;
  }

  try {
    const state = JSON.parse(row.state_json);
    res.json({ ...state, chat_id: req.params.chatId, updated_at: row.updated_at });
  } catch {
    res.json({ ...defaultState, chat_id: req.params.chatId });
  }
});

// بروزرسانی state (partial update - merge با state موجود)
router.put('/chat/:chatId', (req: Request, res: Response) => {
  const db = getDb();
  const { chatId } = req.params;
  const delta = req.body;

  // دریافت state موجود
  const existing = db.prepare('SELECT * FROM chat_story_state WHERE chat_id = ?').get(chatId) as any;
  let currentState = { ...defaultState };
  if (existing) {
    try {
      currentState = JSON.parse(existing.state_json);
    } catch {
      currentState = { ...defaultState };
    }
  }

  // Deep merge کردن delta با state موجود
  const newState = deepMerge(currentState, delta);

  // ذخیره
  const now = new Date().toISOString();
  if (existing) {
    db.prepare('UPDATE chat_story_state SET state_json = ?, updated_at = ? WHERE chat_id = ?')
      .run(JSON.stringify(newState), now, chatId);
  } else {
    db.prepare('INSERT INTO chat_story_state (id, chat_id, state_json, updated_at) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), chatId, JSON.stringify(newState), now);
  }

  res.json({ ...newState, chat_id: chatId, updated_at: now });
});

// جایگزینی کامل state
router.post('/chat/:chatId', (req: Request, res: Response) => {
  const db = getDb();
  const { chatId } = req.params;
  const newState = req.body;

  const now = new Date().toISOString();
  const existing = db.prepare('SELECT * FROM chat_story_state WHERE chat_id = ?').get(chatId) as any;

  if (existing) {
    db.prepare('UPDATE chat_story_state SET state_json = ?, updated_at = ? WHERE chat_id = ?')
      .run(JSON.stringify(newState), now, chatId);
  } else {
    db.prepare('INSERT INTO chat_story_state (id, chat_id, state_json, updated_at) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), chatId, JSON.stringify(newState), now);
  }

  res.json({ ...newState, chat_id: chatId, updated_at: now });
});

// حذف state یک چت
router.delete('/chat/:chatId', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM chat_story_state WHERE chat_id = ?').run(req.params.chatId);
  db.prepare('DELETE FROM chat_state_snapshots WHERE chat_id = ?').run(req.params.chatId);
  res.json({ success: true });
});

// ─── Snapshot Management ───

// ذخیره snapshot (قبل از آپدیت state)
router.post('/chat/:chatId/snapshot', (req: Request, res: Response) => {
  const db = getDb();
  const { chatId } = req.params;
  const { message_id } = req.body;

  // دریافت state فعلی
  const existing = db.prepare('SELECT * FROM chat_story_state WHERE chat_id = ?').get(chatId) as any;
  const currentState = existing ? existing.state_json : JSON.stringify(defaultState);

  const now = new Date().toISOString();
  const snapshotId = uuidv4();

  db.prepare(`
    INSERT INTO chat_state_snapshots (id, chat_id, message_id, state_json, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(snapshotId, chatId, message_id || '', currentState, now);

  // حذف snapshot های قدیمی (فقط ۱۰ تا آخرین رو نگه دار)
  db.prepare(`
    DELETE FROM chat_state_snapshots
    WHERE chat_id = ? AND id NOT IN (
      SELECT id FROM chat_state_snapshots
      WHERE chat_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    )
  `).run(chatId, chatId);

  res.json({ id: snapshotId, created_at: now });
});

// دریافت snapshot بر اساس message_id (برای rollback)
router.get('/chat/:chatId/snapshot/:messageId', (req: Request, res: Response) => {
  const db = getDb();
  const { chatId, messageId } = req.params;

  const snapshot = db.prepare(
    'SELECT * FROM chat_state_snapshots WHERE chat_id = ? AND message_id = ? ORDER BY created_at DESC LIMIT 1'
  ).get(chatId, messageId) as any;

  if (!snapshot) {
    res.status(404).json({ error: 'Snapshot not found' });
    return;
  }

  try {
    const state = JSON.parse(snapshot.state_json);
    res.json({ ...state, snapshot_id: snapshot.id, message_id: snapshot.message_id });
  } catch {
    res.json({ ...defaultState, snapshot_id: snapshot.id });
  }
});

// دریافت آخرین snapshot یک چت
router.get('/chat/:chatId/snapshot', (req: Request, res: Response) => {
  const db = getDb();
  const { chatId } = req.params;

  const snapshot = db.prepare(
    'SELECT * FROM chat_state_snapshots WHERE chat_id = ? ORDER BY created_at DESC LIMIT 1'
  ).get(chatId) as any;

  if (!snapshot) {
    res.json({ ...defaultState });
    return;
  }

  try {
    const state = JSON.parse(snapshot.state_json);
    res.json({ ...state, snapshot_id: snapshot.id, message_id: snapshot.message_id });
  } catch {
    res.json({ ...defaultState });
  }
});

// Rollback به snapshot (بازگردانی state)
router.post('/chat/:chatId/rollback', (req: Request, res: Response) => {
  const db = getDb();
  const { chatId } = req.params;
  const { message_id } = req.body;

  let snapshot;
  if (message_id) {
    // Rollback به snapshot خاص
    snapshot = db.prepare(
      'SELECT * FROM chat_state_snapshots WHERE chat_id = ? AND message_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(chatId, message_id) as any;
  } else {
    // Rollback به آخرین snapshot
    snapshot = db.prepare(
      'SELECT * FROM chat_state_snapshots WHERE chat_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(chatId) as any;
  }

  if (!snapshot) {
    res.status(404).json({ error: 'No snapshot found to rollback' });
    return;
  }

  try {
    const state = JSON.parse(snapshot.state_json);
    const now = new Date().toISOString();

    // ذخیره state فعلی به عنوان snapshot (برای undo احتمالی)
    const currentRow = db.prepare('SELECT * FROM chat_story_state WHERE chat_id = ?').get(chatId) as any;
    if (currentRow) {
      db.prepare(`
        INSERT INTO chat_state_snapshots (id, chat_id, message_id, state_json, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(uuidv4(), chatId, 'pre-rollback', currentRow.state_json, now);
    }

    // بازگردانی state
    db.prepare('UPDATE chat_story_state SET state_json = ?, updated_at = ? WHERE chat_id = ?')
      .run(snapshot.state_json, now, chatId);

    res.json({ ...state, rolled_back_from: snapshot.message_id });
  } catch (e) {
    res.status(500).json({ error: 'Rollback failed' });
  }
});

// Deep merge helper
function deepMerge(target: any, source: any): any {
  if (!source || typeof source !== 'object') return target;
  if (!target || typeof target !== 'object') return source;

  const result = { ...target };

  for (const key of Object.keys(source)) {
    if (source[key] === null || source[key] === undefined) {
      continue;
    }

    if (typeof source[key] === 'object' && !Array.isArray(source[key]) && source[key] !== null) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

export default router;
