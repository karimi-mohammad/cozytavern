// ─── Image Presets Routes ───
// مسیرهای API برای مدیریت پریست‌های تولید تصویر

import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET /api/image-presets - دریافت تمام پریست‌ها
router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const presets = db.prepare(
    'SELECT * FROM image_presets ORDER BY is_builtin DESC, name'
  ).all();
  
  // تبدیل is_builtin به boolean
  const result = presets.map((p: any) => ({
    ...p,
    isBuiltin: p.is_builtin === 1,
  }));
  
  res.json(result);
});

// GET /api/image-presets/:id - دریافت یک پریست
router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const preset = db.prepare(
    'SELECT * FROM image_presets WHERE id = ?'
  ).get(req.params.id) as any;
  
  if (!preset) {
    return res.status(404).json({ error: 'Preset not found' });
  }
  
  res.json({
    ...preset,
    isBuiltin: preset.is_builtin === 1,
  });
});

// POST /api/image-presets - ایجاد پریست جدید
router.post('/', (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      profile_id,
      model,
      width,
      height,
      auto_use_last_prompt,
      prompt_template,
      negative_prompt,
    } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    const id = `preset-${uuidv4()}`;
    
    const db = getDb();
    db.prepare(`
      INSERT INTO image_presets (id, name, description, profile_id, model, width, height, auto_use_last_prompt, prompt_template, negative_prompt, is_builtin)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(
      id,
      name,
      description || '',
      profile_id || 'scene',
      model || 'flux',
      width || 1024,
      height || 1024,
      auto_use_last_prompt ? 1 : 0,
      prompt_template || '',
      negative_prompt || 'text, watermark, logo, blurry, deformed',
    );
    
    const preset = db.prepare('SELECT * FROM image_presets WHERE id = ?').get(id) as any;
    
    res.status(201).json({
      ...preset,
      isBuiltin: preset.is_builtin === 1,
    });
  } catch (error: any) {
    console.error('Failed to create preset:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/image-presets/:id - بروزرسانی پریست
router.put('/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM image_presets WHERE id = ?').get(req.params.id) as any;
    
    if (!existing) {
      return res.status(404).json({ error: 'Preset not found' });
    }
    
    // پروفایل‌های built-in قابل ویرایش نیستند
    if (existing.is_builtin) {
      return res.status(403).json({ error: 'Cannot edit built-in preset' });
    }
    
    const {
      name,
      description,
      profile_id,
      model,
      width,
      height,
      auto_use_last_prompt,
      prompt_template,
      negative_prompt,
    } = req.body;
    
    const updates: string[] = [];
    const values: any[] = [];
    
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (profile_id !== undefined) {
      updates.push('profile_id = ?');
      values.push(profile_id);
    }
    if (model !== undefined) {
      updates.push('model = ?');
      values.push(model);
    }
    if (width !== undefined) {
      updates.push('width = ?');
      values.push(width);
    }
    if (height !== undefined) {
      updates.push('height = ?');
      values.push(height);
    }
    if (auto_use_last_prompt !== undefined) {
      updates.push('auto_use_last_prompt = ?');
      values.push(auto_use_last_prompt ? 1 : 0);
    }
    if (prompt_template !== undefined) {
      updates.push('prompt_template = ?');
      values.push(prompt_template);
    }
    if (negative_prompt !== undefined) {
      updates.push('negative_prompt = ?');
      values.push(negative_prompt);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    values.push(req.params.id);
    db.prepare(`UPDATE image_presets SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    
    const preset = db.prepare('SELECT * FROM image_presets WHERE id = ?').get(req.params.id) as any;
    
    res.json({
      ...preset,
      isBuiltin: preset.is_builtin === 1,
    });
  } catch (error: any) {
    console.error('Failed to update preset:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/image-presets/:id - حذف پریست
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM image_presets WHERE id = ?').get(req.params.id) as any;
    
    if (!existing) {
      return res.status(404).json({ error: 'Preset not found' });
    }
    
    // پروفایل‌های built-in قابل حذف نیستند
    if (existing.is_builtin) {
      return res.status(403).json({ error: 'Cannot delete built-in preset' });
    }
    
    db.prepare('DELETE FROM image_presets WHERE id = ?').run(req.params.id);
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete preset:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/image-presets/:id/clone - کلون کردن پریست
router.post('/:id/clone', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM image_presets WHERE id = ?').get(req.params.id) as any;
    
    if (!existing) {
      return res.status(404).json({ error: 'Preset not found' });
    }
    
    const { name } = req.body;
    const newId = `preset-${uuidv4()}`;
    
    db.prepare(`
      INSERT INTO image_presets (id, name, description, profile_id, model, width, height, auto_use_last_prompt, prompt_template, negative_prompt, is_builtin)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(
      newId,
      name || `${existing.name} (Copy)`,
      existing.description,
      existing.profile_id,
      existing.model,
      existing.width,
      existing.height,
      existing.auto_use_last_prompt,
      existing.prompt_template,
      existing.negative_prompt,
    );
    
    const preset = db.prepare('SELECT * FROM image_presets WHERE id = ?').get(newId) as any;
    
    res.status(201).json({
      ...preset,
      isBuiltin: preset.is_builtin === 1,
    });
  } catch (error: any) {
    console.error('Failed to clone preset:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
