// ─── Character Portrait Routes ───
// مسیرهای API برای مدیریت پرتره‌های کاراکتر

import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { generatePortrait, regenerateImage, generateImageVariations } from '../utils/image-pipeline';
import { getAllProfiles } from '../utils/image-profiles';

const router = Router();

// GET /api/portraits/profiles - دریافت لیست پروفایل‌ها
router.get('/profiles', (req: Request, res: Response) => {
  const profiles = getAllProfiles();
  res.json(profiles);
});

// GET /api/portraits/:characterId - دریافت تمام پرتره‌های یک کاراکتر
router.get('/:characterId', (req: Request, res: Response) => {
  const db = getDb();
  const portraits = db.prepare(
    'SELECT * FROM character_portraits WHERE character_id = ? ORDER BY created_at DESC'
  ).all(req.params.characterId);
  
  res.json(portraits);
});

// POST /api/portraits/generate - تولید پرتره
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { character_id, profile_id, model, width, height, custom_prompt_append } = req.body;
    
    if (!character_id) {
      return res.status(400).json({ error: 'character_id is required' });
    }
    
    // دریافت اطلاعات کاراکتر از دیتابیس
    const db = getDb();
    const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(character_id) as any;
    
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }
    
    const result = await generatePortrait(
      character_id,
      profile_id || 'portrait',
      character,
      {
        width,
        height,
        model,
        extras: custom_prompt_append,
      }
    );
    
    res.json(result);
  } catch (error: any) {
    console.error('Portrait generation failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/portraits/direct - تولید مستقیم (بدون LLM)
router.post('/direct', async (req: Request, res: Response) => {
  try {
    const { character_id, prompt, negative_prompt, model, width, height, seed } = req.body;
    
    if (!character_id || !prompt) {
      return res.status(400).json({ error: 'character_id and prompt are required' });
    }
    
    const { generateImage } = await import('../utils/image-gen');
    
    const result = await generateImage({
      prompt,
      width: width || 1024,
      height: height || 1024,
      model: model || 'flux',
      seed,
      nologo: true,
      negative: negative_prompt,
    });
    
    // ذخیره در دیتابیس
    const db = getDb();
    const { v4: uuidv4 } = await import('uuid');
    const id = `portrait-${uuidv4()}`;
    
    // حذف is_current از پرتره‌های قبلی
    db.prepare('UPDATE character_portraits SET is_current = 0 WHERE character_id = ?').run(character_id);
    
    db.prepare(`
      INSERT INTO character_portraits (id, character_id, image_prompt, negative_prompt, image_url, model, seed, width, height, is_current)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(id, character_id, prompt, negative_prompt || '', result.imageUrl, result.model, result.seed, width || 1024, height || 1024);
    
    // بروزرسانی avatar کاراکتر
    db.prepare('UPDATE characters SET avatar = ? WHERE id = ?').run(result.imageUrl, character_id);
    
    res.json({ id, ...result });
  } catch (error: any) {
    console.error('Direct generation failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/portraits/:id/regenerate - ریجنریت با seed جدید
router.post('/:id/regenerate', async (req: Request, res: Response) => {
  try {
    const result = await regenerateImage(req.params.id, 'portrait');
    res.json(result);
  } catch (error: any) {
    console.error('Regeneration failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/portraits/:id/variations - تولید variations
router.post('/:id/variations', async (req: Request, res: Response) => {
  try {
    const { count = 4 } = req.body;
    const variations = await generateImageVariations(req.params.id, 'portrait', count);
    res.json({ variations });
  } catch (error: any) {
    console.error('Variations generation failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/portraits/:id/use - استفاده از پرتره به عنوان avatar
router.put('/:id/use', (req: Request, res: Response) => {
  const db = getDb();
  
  // دریافت پرتره
  const portrait = db.prepare('SELECT * FROM character_portraits WHERE id = ?').get(req.params.id) as any;
  if (!portrait) {
    return res.status(404).json({ error: 'Portrait not found' });
  }
  
  // غیرفعال کردن تمام پرتره‌های فعلی این کاراکتر
  db.prepare('UPDATE character_portraits SET is_current = 0 WHERE character_id = ?').run(portrait.character_id);
  
  // فعال کردن این پرتره
  db.prepare('UPDATE character_portraits SET is_current = 1 WHERE id = ?').run(req.params.id);
  
  // بروزرسانی avatar کاراکتر
  db.prepare('UPDATE characters SET avatar = ? WHERE id = ?').run(portrait.image_url, portrait.character_id);
  
  res.json({ success: true });
});

// DELETE /api/portraits/:id - حذف پرتره
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  
  // دریافت پرتره قبل از حذف
  const portrait = db.prepare('SELECT * FROM character_portraits WHERE id = ?').get(req.params.id) as any;
  
  db.prepare('DELETE FROM character_portraits WHERE id = ?').run(req.params.id);
  
  // اگر این پرتره فعلی بود، avatar کاراکتر رو پاک کن
  if (portrait?.is_current) {
    db.prepare('UPDATE characters SET avatar = "" WHERE id = ?').run(portrait.character_id);
  }
  
  res.json({ success: true });
});

// POST /api/portraits/batch - تولید دسته‌ای پرتره
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { character_ids, profile_id, model, width, height } = req.body;
    
    if (!Array.isArray(character_ids) || character_ids.length === 0) {
      return res.status(400).json({ error: 'character_ids array is required' });
    }
    
    const results = [];
    
    for (const character_id of character_ids) {
      try {
        // دریافت اطلاعات کاراکتر
        const db = getDb();
        const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(character_id) as any;
        
        if (!character) {
          results.push({ character_id, success: false, error: 'Character not found' });
          continue;
        }
        
        const result = await generatePortrait(
          character_id,
          profile_id || 'portrait',
          character,
          { width, height, model }
        );
        
        results.push({ character_id, success: true, ...result });
      } catch (error: any) {
        results.push({ character_id, success: false, error: error.message });
      }
    }
    
    res.json({ results });
  } catch (error: any) {
    console.error('Batch generation failed:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
