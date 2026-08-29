import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';
import {
  buildCardJson,
  parseCardFields,
  parseCardBook,
  extractCardFromPng,
  embedCardInPng,
  makePlaceholderPng,
  isValidPng,
} from '../utils/character-card';

const router = Router();

// ─── Import/Export (Character Card V2/V3) ───

// خروجی JSON — فرمت استاندارد chara_card_v2 با character_book لینک‌شده
router.get('/:id/export/json', (req: Request, res: Response) => {
  const db = getDb();
  const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(req.params.id) as any;
  if (!character) {
    res.status(404).json({ error: 'Character not found' });
    return;
  }

  let lorebook: any = null;
  if (character.lorebook_id) {
    lorebook = db.prepare('SELECT * FROM lorebooks WHERE id = ?').get(character.lorebook_id);
    if (lorebook) {
      lorebook.entries = db.prepare('SELECT * FROM lorebook_entries WHERE lorebook_id = ? ORDER BY insertion_order ASC')
        .all(character.lorebook_id);
    }
  }

  const card = buildCardJson(character, lorebook);
  const safeName = (character.name || 'character').replace(/[^a-zA-Z0-9\u0600-\u06FF_-]+/g, '_');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeName)}.json"`);
  res.json(card);
});

// خروجی PNG — کارت داخل آواتار (یا PNG جایگزین) جاسازی می‌شود
router.get('/:id/export/png', (req: Request, res: Response) => {
  const db = getDb();
  const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(req.params.id) as any;
  if (!character) {
    res.status(404).json({ error: 'Character not found' });
    return;
  }

  let lorebook: any = null;
  if (character.lorebook_id) {
    lorebook = db.prepare('SELECT * FROM lorebooks WHERE id = ?').get(character.lorebook_id);
    if (lorebook) {
      lorebook.entries = db.prepare('SELECT * FROM lorebook_entries WHERE lorebook_id = ? ORDER BY insertion_order ASC')
        .all(character.lorebook_id);
    }
  }

  // پایه: آواتار اگر data URL از نوع PNG باشد، وگرنه placeholder
  let basePng: Buffer | null = null;
  const avatar: string = character.avatar || '';
  if (avatar.startsWith('data:image/png;base64,')) {
    try {
      basePng = Buffer.from(avatar.slice('data:image/png;base64,'.length), 'base64');
      if (!basePng || !isValidPng(basePng)) basePng = null;
    } catch {
      basePng = null;
    }
  }
  if (!basePng) {
    basePng = makePlaceholderPng();
  }

  const card = buildCardJson(character, lorebook);
  const png = embedCardInPng(basePng!, card);
  if (!png) {
    res.status(500).json({ error: 'Failed to embed card in PNG' });
    return;
  }

  const safeName = (character.name || 'character').replace(/[^a-zA-Z0-9\u0600-\u06FF_-]+/g, '_');
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeName)}.png"`);
  res.send(png);
});

// ورودی کاراکتر — بدنه: { json } یا { file_b64 } (PNG یا JSON به‌صورت base64)
// اگر کارت character_book داشته باشد، به یک لوربوک جدید لینک می‌شود.
router.post('/import', (req: Request, res: Response) => {
  const db = getDb();
  const { json, file_b64 } = req.body ?? {};

  let cardJson: any = null;

  if (file_b64 && typeof file_b64 === 'string') {
    let buf: Buffer;
    try {
      buf = Buffer.from(file_b64, 'base64');
    } catch {
      res.status(400).json({ error: 'Invalid base64 file data' });
      return;
    }
    if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      // فایل PNG — استخراج کارت از tEXt
      cardJson = extractCardFromPng(buf);
      if (!cardJson) {
        res.status(400).json({ error: 'No character card embedded in this PNG' });
        return;
      }
    } else {
      // فایل JSON (متن)
      try {
        cardJson = JSON.parse(buf.toString('utf8'));
      } catch {
        res.status(400).json({ error: 'File is neither a valid PNG nor valid JSON' });
        return;
      }
    }
  } else if (json && typeof json === 'object') {
    cardJson = json;
  }

  const fields = parseCardFields(cardJson);
  if (!fields) {
    res.status(400).json({ error: 'Unrecognized character card format (V1/V2/V3 with a name is required)' });
    return;
  }

  // depth_prompt از V3 — اگر post_history_instructions خالی باشد از depth_prompt استفاده کن
  if (!fields.post_history_instructions && fields.depth_prompt?.prompt) {
    fields.post_history_instructions = fields.depth_prompt.prompt;
  }

  const now = new Date().toISOString();

  // لوربوک داخلی کارت
  let lorebookId = '';
  const bookEntries = parseCardBook(cardJson);
  if (bookEntries.length > 0) {
    const bookSrc = (cardJson.data?.character_book) || cardJson.character_book || {};
    lorebookId = uuidv4();
    db.prepare(`
      INSERT INTO lorebooks (id, name, scan_depth, token_budget, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      lorebookId,
      String(bookSrc.name || `${fields.name} Lorebook`),
      typeof bookSrc.scan_depth === 'number' ? bookSrc.scan_depth : 50,
      typeof bookSrc.token_budget === 'number' ? bookSrc.token_budget : 500,
      now,
    );
    const insertEntry = db.prepare(`
      INSERT INTO lorebook_entries (id, lorebook_id, keys, keys_secondary, content, constant, selective, insertion_order, position, disable, comment, case_sensitive, use_regex, probability)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const e of bookEntries) {
      insertEntry.run(
        uuidv4(), lorebookId,
        JSON.stringify(e.key), JSON.stringify(e.keysecondary),
        e.content, e.constant ? 1 : 0, e.selective ? 1 : 0,
        e.insertion_order, e.position, e.disable ? 1 : 0, e.comment,
        e.case_sensitive ? 1 : 0, e.use_regex ? 1 : 0, e.probability,
      );
    }
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO characters (id, name, nickname, description, personality, scenario, first_mes, mes_example, creator_notes, system_prompt, post_history_instructions, alternate_greetings, group_only_greetings, creator, character_version, tags, avatar, lorebook_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, fields.name, fields.nickname, fields.description, fields.personality, fields.scenario,
    fields.first_mes, fields.mes_example, fields.creator_notes,
    fields.system_prompt, fields.post_history_instructions,
    JSON.stringify(fields.alternate_greetings), JSON.stringify(fields.group_only_greetings),
    fields.creator, fields.character_version,
    JSON.stringify(fields.tags), '', lorebookId, now, now,
  );

  const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(id) as any;
  res.status(201).json({
    ...character,
    tags: JSON.parse(character.tags || '[]'),
    alternate_greetings: JSON.parse(character.alternate_greetings || '[]'),
    group_only_greetings: JSON.parse(character.group_only_greetings || '[]'),
    imported_lorebook_id: lorebookId || undefined,
  });
});

// لیست همه کاراکترها
router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const characters = db.prepare('SELECT * FROM characters ORDER BY updated_at DESC').all();
  const parsed = characters.map((c: any) => ({
    ...c,
    tags: JSON.parse(c.tags || '[]'),
    alternate_greetings: JSON.parse(c.alternate_greetings || '[]'),
    group_only_greetings: JSON.parse(c.group_only_greetings || '[]'),
  }));
  res.json(parsed);
});

// دریافت یک کاراکتر
router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(req.params.id) as any;
  if (!character) {
    res.status(404).json({ error: 'Character not found' });
    return;
  }
  res.json({
    ...character,
    tags: JSON.parse(character.tags || '[]'),
    alternate_greetings: JSON.parse(character.alternate_greetings || '[]'),
    group_only_greetings: JSON.parse(character.group_only_greetings || '[]'),
  });
});

// ایجاد کاراکتر جدید
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  const {
    name, nickname, description, personality, scenario, first_mes, mes_example,
    creator_notes, system_prompt, post_history_instructions, alternate_greetings,
    group_only_greetings, creator, character_version, tags, avatar, lorebook_id,
  } = req.body;

  db.prepare(`
    INSERT INTO characters (id, name, nickname, description, personality, scenario, first_mes, mes_example, creator_notes, system_prompt, post_history_instructions, alternate_greetings, group_only_greetings, creator, character_version, tags, avatar, lorebook_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, name || '', nickname || '', description || '', personality || '', scenario || '',
    first_mes || '', mes_example || '', creator_notes || '',
    system_prompt || '', post_history_instructions || '',
    JSON.stringify(alternate_greetings || []),
    JSON.stringify(group_only_greetings || []),
    creator || '', character_version || '',
    JSON.stringify(tags || []), avatar || '', lorebook_id || '', now, now,
  );

  const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(id) as any;
  res.status(201).json({
    ...character,
    tags: JSON.parse(character.tags || '[]'),
    alternate_greetings: JSON.parse(character.alternate_greetings || '[]'),
    group_only_greetings: JSON.parse(character.group_only_greetings || '[]'),
  });
});

// بروزرسانی کاراکتر
router.put('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM characters WHERE id = ?').get(req.params.id) as any;
  if (!existing) {
    res.status(404).json({ error: 'Character not found' });
    return;
  }

  const now = new Date().toISOString();
  const {
    name, nickname, description, personality, scenario, first_mes, mes_example,
    creator_notes, system_prompt, post_history_instructions, alternate_greetings,
    group_only_greetings, creator, character_version, tags, avatar, lorebook_id,
  } = req.body;

  db.prepare(`
    UPDATE characters SET name=?, nickname=?, description=?, personality=?, scenario=?, first_mes=?, mes_example=?, creator_notes=?, system_prompt=?, post_history_instructions=?, alternate_greetings=?, group_only_greetings=?, creator=?, character_version=?, tags=?, avatar=?, lorebook_id=?, updated_at=?
    WHERE id=?
  `).run(
    name ?? existing.name,
    nickname ?? existing.nickname ?? '',
    description ?? existing.description,
    personality ?? existing.personality,
    scenario ?? existing.scenario,
    first_mes ?? existing.first_mes,
    mes_example ?? existing.mes_example,
    creator_notes ?? existing.creator_notes,
    system_prompt ?? existing.system_prompt ?? '',
    post_history_instructions ?? existing.post_history_instructions ?? '',
    JSON.stringify(alternate_greetings ?? JSON.parse(existing.alternate_greetings || '[]')),
    JSON.stringify(group_only_greetings ?? JSON.parse(existing.group_only_greetings || '[]')),
    creator ?? existing.creator ?? '',
    character_version ?? existing.character_version ?? '',
    JSON.stringify(tags ?? JSON.parse(existing.tags || '[]')),
    avatar ?? existing.avatar,
    lorebook_id ?? existing.lorebook_id ?? '',
    now,
    req.params.id
  );

  const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(req.params.id) as any;
  res.json({
    ...character,
    tags: JSON.parse(character.tags || '[]'),
    alternate_greetings: JSON.parse(character.alternate_greetings || '[]'),
    group_only_greetings: JSON.parse(character.group_only_greetings || '[]'),
  });
});

// حذف کاراکتر
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM characters WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Character not found' });
    return;
  }
  res.json({ success: true });
});

export default router;
