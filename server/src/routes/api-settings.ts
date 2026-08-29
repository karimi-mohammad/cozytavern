import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// دریافت تنظیمات
router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const setting = db.prepare('SELECT * FROM api_settings LIMIT 1').get() as any;
  if (!setting) {
    res.json({
      base_url: '',
      api_key: '',
      model: '',
      temperature: 0.7,
      max_tokens: 2048,
      max_context: 0,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      stream: true,
      stop: [],
      system_prompt: '',
    });
    return;
  }
  res.json({ ...setting, stream: !!setting.stream, stop: JSON.parse(setting.stop || '[]'), system_prompt: setting.system_prompt || '' });
});

// ذخیره تنظیمات
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const { base_url, api_key, model, temperature, max_tokens, max_context, top_p, frequency_penalty, presence_penalty, stream, stop, system_prompt } = req.body;

  const existing = db.prepare('SELECT id FROM api_settings LIMIT 1').get() as any;

  if (existing) {
    db.prepare(`
      UPDATE api_settings SET base_url=?, api_key=?, model=?, temperature=?, max_tokens=?, max_context=?, top_p=?, frequency_penalty=?, presence_penalty=?, stream=?, stop=?, system_prompt=?
      WHERE id=?
    `).run(
      base_url || '', api_key || '', model || '',
      temperature ?? 0.7, max_tokens ?? 2048, max_context ?? 0, top_p ?? 1,
      frequency_penalty ?? 0, presence_penalty ?? 0,
      stream ? 1 : 0, JSON.stringify(stop || []),
      system_prompt || '',
      existing.id
    );
  } else {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO api_settings (id, provider, base_url, api_key, model, temperature, max_tokens, max_context, top_p, frequency_penalty, presence_penalty, stream, stop, system_prompt)
      VALUES (?, 'openai', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, base_url || '', api_key || '', model || '',
      temperature ?? 0.7, max_tokens ?? 2048, max_context ?? 0, top_p ?? 1,
      frequency_penalty ?? 0, presence_penalty ?? 0,
      stream ? 1 : 0, JSON.stringify(stop || []),
      system_prompt || ''
    );
  }

  res.json({ success: true });
});

export default router;
