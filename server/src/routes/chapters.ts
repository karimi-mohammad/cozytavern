import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { generateChapterSummary, buildChapterSummaryRequest, detectChapterTrigger } from '../utils/chapter-generator';
import { getChapterSettingsCompat, updatePluginSettings } from '../utils/plugin-store';

const router = Router();

// ─── Helpers ───

function rowToChapter(row: any) {
  return {
    ...row,
    manually_edited: !!row.manually_edited,
  };
}

// بارگذاری transcript محدوده فصل + کاراکتر (مشترک بین create/regenerate/inspect)
function loadTranscript(db: any, chatId: string, startMsgId: string, endMsgId: string) {
  const startRow = db.prepare('SELECT rowid as r FROM messages WHERE id = ?').get(startMsgId) as any;
  const endRow = db.prepare('SELECT rowid as r FROM messages WHERE id = ?').get(endMsgId) as any;
  if (!startRow || !endRow) return null;
  const transcript = db.prepare(
    'SELECT * FROM messages WHERE chat_id = ? AND rowid >= ? AND rowid <= ? ORDER BY rowid ASC'
  ).all(chatId, startRow.r, endRow.r) as any[];
  const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(chatId) as any;
  const character = chat ? db.prepare('SELECT * FROM characters WHERE id = ?').get(chat.character_id) as any : null;
  return { transcript, character };
}

// پاسخ حالت بازرسی (Prompt Inspector): payload ساخته‌شده بدون فراخوانی LLM
function inspectResponse(res: Response, info: ReturnType<typeof buildChapterSummaryRequest>) {
  const parsed = JSON.parse(info.requestBody);
  const { model, messages, ...params } = parsed;
  res.json({
    inspect: true,
    source: 'chapter',
    endpoint: info.endpoint,
    model,
    params,
    messages,
  });
}

function getChapterSettings(db: any) {
  return getChapterSettingsCompat(db);
}

// ─── Validation ───

function validateChapterRange(db: any, chatId: string, startMsgId: string, endMsgId: string): string | null {
  // Check messages exist and are in the right order
  const startMsg = db.prepare('SELECT rowid FROM messages WHERE id = ? AND chat_id = ?').get(startMsgId, chatId) as any;
  const endMsg = db.prepare('SELECT rowid FROM messages WHERE id = ? AND chat_id = ?').get(endMsgId, chatId) as any;

  if (!startMsg || !endMsg) {
    return 'One of the messages was not found';
  }
  if (startMsg.rowid >= endMsg.rowid) {
    return 'Start message must come before end message';
  }

  // Check raw_window boundary
  const settings = getChapterSettings(db);
  const totalMessages = db.prepare('SELECT COUNT(*) as cnt FROM messages WHERE chat_id = ?').get(chatId) as any;
  const endMsgIndex = db.prepare(
    'SELECT COUNT(*) as cnt FROM messages WHERE chat_id = ? AND rowid <= (SELECT rowid FROM messages WHERE id = ?)'
  ).get(chatId, endMsgId) as any;

  if (totalMessages.cnt - endMsgIndex.cnt < settings.raw_window) {
    return `Chapter must end at least ${settings.raw_window} messages before the last message`;
  }

  // Check overlap with existing chapters (مقایسه بر اساس rowid چون id ها UUID هستن)
  const overlap = db.prepare(`
    SELECT c.id FROM chapters c
    WHERE c.chat_id = ?
      AND NOT (
        COALESCE((SELECT m.rowid FROM messages m WHERE m.id = c.end_message_id), -1) <
          (SELECT m.rowid FROM messages m WHERE m.id = ?)
        OR
        COALESCE((SELECT m.rowid FROM messages m WHERE m.id = c.start_message_id), 999999999999) >
          (SELECT m.rowid FROM messages m WHERE m.id = ?)
      )
  `).get(chatId, startMsgId, endMsgId);

  if (overlap) {
    return 'This range overlaps with another chapter';
  }

  return null; // valid
}

// ─── GET /chat/:chatId — List chapters for a chat ───

router.get('/chat/:chatId', (req: Request, res: Response) => {
  const db = getDb();
  const chapters = db.prepare(
    'SELECT * FROM chapters WHERE chat_id = ? ORDER BY created_at ASC'
  ).all(req.params.chatId).map(rowToChapter);

  res.json(chapters);
});

// ─── GET /settings — Get global chapter settings ───

router.get('/settings', (_req: Request, res: Response) => {
  const db = getDb();
  res.json(getChapterSettings(db));
});

// ─── PUT /settings — Update global chapter settings (delegate به استور پلاگین) ───

router.put('/settings', (req: Request, res: Response) => {
  const db = getDb();
  res.json(updatePluginSettings(db, 'chapters', req.body ?? {}));
});

// ─── POST / — Create chapter ───

router.post('/', async (req: Request, res: Response) => {
  const db = getDb();
  const { chat_id, start_message_id, end_message_id, title } = req.body;

  if (!chat_id || !start_message_id || !end_message_id) {
    res.status(400).json({ error: 'chat_id, start_message_id and end_message_id are required' });
    return;
  }

  const error = validateChapterRange(db, chat_id, start_message_id, end_message_id);
  if (error) {
    res.status(400).json({ error });
    return;
  }

  // حالت بازرسی: قبل از INSERT تا لغو بازرسی ردیف فصل یتیم نسازد
  if (req.body?.inspect) {
    const loaded = loadTranscript(db, chat_id, start_message_id, end_message_id);
    if (!loaded) {
      res.status(400).json({ error: 'Range messages not found' });
      return;
    }
    try {
      inspectResponse(res, buildChapterSummaryRequest(loaded.transcript, loaded.character, db));
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
    return;
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO chapters (id, chat_id, start_message_id, end_message_id, title, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, chat_id, start_message_id, end_message_id, title || '', now, now);

  // تولید خودکار خلاصه با LLM
  let summary = '';
  let generationModel = '';
  let generationTime = 0;
  let generationTokens = 0;
  try {
    const loaded = loadTranscript(db, chat_id, start_message_id, end_message_id);
    if (loaded) {
      const result = await generateChapterSummary(loaded.transcript, loaded.character, null, db, req.body?.edited_messages);
      summary = result.summary;
      generationModel = result.model;
      generationTime = result.generation_time;
      generationTokens = result.generation_tokens;
    }
  } catch (err: any) {
    console.error('Auto chapter summary generation failed:', err.message);
    // خلاصه خالی می‌مونه — کاربر می‌تونه بعداً Regenerate بزنه
  }

  db.prepare(`
    UPDATE chapters SET summary = ?, generation_model = ?, summary_generation_time = ?, summary_generation_tokens = ?, generated_at = ? WHERE id = ?
  `).run(summary, generationModel, generationTime, generationTokens, now, id);

  const chapter = db.prepare('SELECT * FROM chapters WHERE id = ?').get(id);
  res.status(201).json(rowToChapter(chapter));
});

// ─── PUT /:id — Update chapter (title / summary) ───

router.put('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const chapter = db.prepare('SELECT * FROM chapters WHERE id = ?').get(req.params.id) as any;
  if (!chapter) {
    res.status(404).json({ error: 'Chapter not found' });
    return;
  }

  const { title, summary } = req.body;
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE chapters
    SET title = ?, summary = ?, manually_edited = 1, updated_at = ?
    WHERE id = ?
  `).run(
    title !== undefined ? title : chapter.title,
    summary !== undefined ? summary : chapter.summary,
    now,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM chapters WHERE id = ?').get(req.params.id);
  res.json(rowToChapter(updated));
});

// ─── DELETE /:id — Delete chapter (messages stay) ───

router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const chapter = db.prepare('SELECT * FROM chapters WHERE id = ?').get(req.params.id) as any;
  if (!chapter) {
    res.status(404).json({ error: 'Chapter not found' });
    return;
  }

  db.prepare('DELETE FROM chapters WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ─── POST /:id/regenerate — Regenerate summary from original transcript ───

router.post('/:id/regenerate', async (req: Request, res: Response) => {
  const db = getDb();
  const chapter = db.prepare('SELECT * FROM chapters WHERE id = ?').get(req.params.id) as any;
  if (!chapter) {
    res.status(404).json({ error: 'Chapter not found' });
    return;
  }

  // Fetch original messages by rowid range
  const startRow = db.prepare('SELECT rowid as r FROM messages WHERE id = ?').get(chapter.start_message_id) as any;
  const endRow = db.prepare('SELECT rowid as r FROM messages WHERE id = ?').get(chapter.end_message_id) as any;

  if (!startRow || !endRow) {
    res.status(400).json({ error: 'Original chapter messages not found' });
    return;
  }

  const transcript = db.prepare(`
    SELECT * FROM messages
    WHERE chat_id = ? AND rowid >= ? AND rowid <= ?
    ORDER BY rowid ASC
  `).all(chapter.chat_id, startRow.r, endRow.r) as any[];

  // Get character and persona for context
  const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(chapter.chat_id) as any;
  const character = chat ? db.prepare('SELECT * FROM characters WHERE id = ?').get(chat.character_id) as any : null;

  // حالت بازرسی (Prompt Inspector)
  if (req.body?.inspect) {
    try {
      inspectResponse(res, buildChapterSummaryRequest(transcript, character, db));
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
    return;
  }

  try {
    const result = await generateChapterSummary(transcript, character, null, db, req.body?.edited_messages);
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE chapters
      SET summary = ?, generation_model = ?, summary_generation_time = ?, summary_generation_tokens = ?,
          generated_at = ?, regeneration_count = regeneration_count + 1, updated_at = ?
      WHERE id = ?
    `).run(result.summary, result.model, result.generation_time, result.generation_tokens, now, now, req.params.id);

    const updated = db.prepare('SELECT * FROM chapters WHERE id = ?').get(req.params.id);
    res.json(rowToChapter(updated));
  } catch (err: any) {
    console.error('Chapter generation failed:', err);
    res.status(500).json({ error: err.message || 'Error regenerating chapter summary' });
  }
});

// ─── POST /chat/:chatId/detect — Detect chapter trigger in recent messages ───

router.post('/chat/:chatId/detect', (req: Request, res: Response) => {
  const db = getDb();
  const settings = getChapterSettings(db);

  if (!settings.auto_detect_enabled) {
    res.json({ suggested: false });
    return;
  }

  const chatId = req.params.chatId;
  const rawWindow = settings.raw_window;

  // Get all messages for this chat in order
  const messages = db.prepare(
    'SELECT * FROM messages WHERE chat_id = ? ORDER BY rowid ASC'
  ).all(chatId) as any[];

  // Get existing chapters
  const chapters = db.prepare(
    'SELECT * FROM chapters WHERE chat_id = ? ORDER BY created_at ASC'
  ).all(chatId) as any[];

  const result = detectChapterTrigger(messages, chapters, rawWindow, settings.trigger_phrases);
  res.json(result);
});

export default router;
