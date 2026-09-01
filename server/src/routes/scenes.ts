// ─── Scene Image Routes ───
// مسیرهای API برای مدیریت تصاویر صحنه

import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { generateSceneImage, regenerateImage, generateImageVariations, generatePromptOnly } from '../utils/image-pipeline';
import { getAllProfiles, getProfile } from '../utils/image-profiles';
import { fetchAvailableModels, hasApiKey } from '../utils/image-gen';
import { buildImageContext } from '../utils/image-context';

const router = Router();

// GET /api/scenes/status - بررسی وضعیت API Key
router.get('/status', (req: Request, res: Response) => {
  res.json({
    hasApiKey: hasApiKey(),
    message: hasApiKey() ? 'API key configured' : 'No API key - use Perchance.org for free generation',
  });
});

// GET /api/scenes/models - دریافت لیست مدل‌های موجود
router.get('/models', async (req: Request, res: Response) => {
  try {
    const models = await fetchAvailableModels();
    
    // فیلتر کردن مدل‌های مناسب برای تولید تصویر
    const imageModels = models.filter(model => 
      model.output_modalities?.includes('image') ||
      model.id.includes('flux') ||
      model.id.includes('dreamshaper') ||
      model.id.includes('turbo')
    );
    
    res.json(imageModels);
  } catch (error: any) {
    console.error('Failed to fetch models:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/scenes/context - ساخت کانتکست برای پیش‌نمایش
router.post('/context', async (req: Request, res: Response) => {
  try {
    const { chat_id, profile_id } = req.body;
    
    if (!chat_id) {
      return res.status(400).json({ error: 'chat_id is required' });
    }
    
    const db = getDb();
    const chat = db.prepare('SELECT * FROM messages WHERE chat_id = ? ORDER BY rowid ASC').all(chat_id) as any[];
    const chatInfo = db.prepare('SELECT * FROM chats WHERE id = ?').get(chat_id) as any;
    let character = null;
    let persona = null;
    let lorebookEntries: any[] = [];
    let storyState = null;

    // دریافت کاراکتر
    if (chatInfo?.character_id) {
      character = db.prepare('SELECT * FROM characters WHERE id = ?').get(chatInfo.character_id) as any;
    }
    
    // دریافت پرسونا (اگر وجود داشته باشد)
    if (chatInfo?.persona_id) {
      persona = db.prepare('SELECT * FROM personas WHERE id = ?').get(chatInfo.persona_id) as any;
    }
    
    // دریافت لوربوک‌ها
    const lorebookIds: string[] = [];
    
    // از chat_lorebooks
    const chatLorebooks = db.prepare(
      'SELECT cl.lorebook_id FROM chat_lorebooks cl WHERE cl.chat_id = ? AND cl.is_active = 1'
    ).all(chat_id) as any[];
    
    for (const cl of chatLorebooks) {
      if (cl.lorebook_id) lorebookIds.push(cl.lorebook_id);
    }
    
    // fallback: lorebook_id چت
    if (lorebookIds.length === 0 && chatInfo?.lorebook_id) {
      lorebookIds.push(chatInfo.lorebook_id);
    }
    
    // fallback: lorebook_id کاراکتر
    if (lorebookIds.length === 0 && character?.lorebook_id) {
      lorebookIds.push(character.lorebook_id);
    }
    
    // دریافت entries لوربوک‌ها
    for (const lbId of lorebookIds) {
      const entries = db.prepare(
        'SELECT keys, content, comment FROM lorebook_entries WHERE lorebook_id = ? AND disable = 0 ORDER BY insertion_order ASC'
      ).all(lbId) as any[];
      lorebookEntries.push(...entries);
    }

    // دریافت Story State
    const storyStateRow = db.prepare('SELECT * FROM chat_story_state WHERE chat_id = ?').get(chat_id) as any;
    if (storyStateRow?.state_json) {
      try {
        storyState = JSON.parse(storyStateRow.state_json);
      } catch {}
    }

    // ساخت کانتکست
    const profile = getProfile(profile_id || 'scene') || getProfile('scene')!;
    const context = buildImageContext(chat, character, persona, lorebookEntries, storyState);

    res.json({
      context,
      profile: {
        id: profile.id,
        name: profile.name,
        instruction: profile.instruction,
      },
    });
  } catch (error: any) {
    console.error('Context generation failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/scenes/generate-prompt - تولید پرامپت تصویر از کانتکست ادیت شده
router.post('/generate-prompt', async (req: Request, res: Response) => {
  try {
    const { context, profile_id, prompt_template } = req.body;

    if (!context) {
      return res.status(400).json({ error: 'context is required' });
    }

    const profile = getProfile(profile_id || 'scene') || getProfile('scene')!;

    // ارسال کانتکست به LLM برای تولید پرامپت تصویر
    const { generateWithLLM } = await import('../utils/image-pipeline');
    const imagePrompt = await generateWithLLM(profile, context, prompt_template);

    res.json({ imagePrompt });
  } catch (error: any) {
    console.error('Prompt generation failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/scenes/profiles - دریافت لیست پروفایل‌ها
router.get('/profiles', (req: Request, res: Response) => {
  const profiles = getAllProfiles();
  res.json(profiles);
});

// GET /api/scenes/:chatId - دریافت صحنه‌های یک چت
router.get('/:chatId', (req: Request, res: Response) => {
  const db = getDb();
  const scenes = db.prepare(
    'SELECT * FROM scene_images WHERE chat_id = ? ORDER BY created_at DESC'
  ).all(req.params.chatId);
  
  res.json(scenes);
});

// GET /api/scenes/gallery/:chatId - دریافت صحنه‌های pin شده
router.get('/gallery/:chatId', (req: Request, res: Response) => {
  const db = getDb();
  const scenes = db.prepare(
    'SELECT * FROM scene_images WHERE chat_id = ? AND is_pinned = 1 ORDER BY created_at DESC'
  ).all(req.params.chatId);
  
  res.json(scenes);
});

// POST /api/scenes/prompt - تولید فقط پرامپت (بدون تصویر)
router.post('/prompt', async (req: Request, res: Response) => {
  try {
    const { chat_id, profile_id, custom_prompt } = req.body;

    if (!chat_id) {
      return res.status(400).json({ error: 'chat_id is required' });
    }

    // دریافت اطلاعات چت و کاراکتر از دیتابیس
    const db = getDb();
    const chat = db.prepare('SELECT * FROM messages WHERE chat_id = ? ORDER BY rowid ASC').all(chat_id) as any[];
    const chatInfo = db.prepare('SELECT * FROM chats WHERE id = ?').get(chat_id) as any;
    let character = null;
    let persona = null;
    let lorebookEntries: any[] = [];

    if (chatInfo?.character_id) {
      character = db.prepare('SELECT * FROM characters WHERE id = ?').get(chatInfo.character_id) as any;
    }

    // دریافت پرسونا
    if (chatInfo?.persona_id) {
      persona = db.prepare('SELECT * FROM personas WHERE id = ?').get(chatInfo.persona_id) as any;
    }

    // دریافت لوربوک‌ها
    const lorebookIds: string[] = [];
    const chatLorebooks = db.prepare(
      'SELECT cl.lorebook_id FROM chat_lorebooks cl WHERE cl.chat_id = ? AND cl.is_active = 1'
    ).all(chat_id) as any[];
    for (const cl of chatLorebooks) {
      if (cl.lorebook_id) lorebookIds.push(cl.lorebook_id);
    }
    if (lorebookIds.length === 0 && chatInfo?.lorebook_id) {
      lorebookIds.push(chatInfo.lorebook_id);
    }
    if (lorebookIds.length === 0 && character?.lorebook_id) {
      lorebookIds.push(character.lorebook_id);
    }
    for (const lbId of lorebookIds) {
      const entries = db.prepare(
        'SELECT keys, content, comment FROM lorebook_entries WHERE lorebook_id = ? AND disable = 0 ORDER BY insertion_order ASC'
      ).all(lbId) as any[];
      lorebookEntries.push(...entries);
    }

    // دریافت Story State
    let storyState = null;
    const storyStateRow = db.prepare('SELECT * FROM chat_story_state WHERE chat_id = ?').get(chat_id) as any;
    if (storyStateRow?.state_json) {
      try {
        storyState = JSON.parse(storyStateRow.state_json);
      } catch {}
    }

    const result = await generatePromptOnly(
      profile_id || 'scene',
      chat,
      character,
      custom_prompt,
      persona,
      lorebookEntries,
      storyState
    );

    res.json(result);
  } catch (error: any) {
    console.error('Prompt generation failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/scenes/generate - تولید تصویر صحنه
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { chat_id, message_id, profile_id, custom_prompt, width, height, model } = req.body;

    if (!chat_id) {
      return res.status(400).json({ error: 'chat_id is required' });
    }

    // دریافت اطلاعات چت و کاراکتر از دیتابیس
    const db = getDb();
    const chat = db.prepare('SELECT * FROM messages WHERE chat_id = ? ORDER BY rowid ASC').all(chat_id) as any[];
    const chatInfo = db.prepare('SELECT * FROM chats WHERE id = ?').get(chat_id) as any;
    let character = null;
    let persona = null;
    let lorebookEntries: any[] = [];

    if (chatInfo?.character_id) {
      character = db.prepare('SELECT * FROM characters WHERE id = ?').get(chatInfo.character_id) as any;
    }

    // دریافت پرسونا
    if (chatInfo?.persona_id) {
      persona = db.prepare('SELECT * FROM personas WHERE id = ?').get(chatInfo.persona_id) as any;
    }

    // دریافت لوربوک‌ها
    const lorebookIds: string[] = [];
    const chatLorebooks = db.prepare(
      'SELECT cl.lorebook_id FROM chat_lorebooks cl WHERE cl.chat_id = ? AND cl.is_active = 1'
    ).all(chat_id) as any[];
    for (const cl of chatLorebooks) {
      if (cl.lorebook_id) lorebookIds.push(cl.lorebook_id);
    }
    if (lorebookIds.length === 0 && chatInfo?.lorebook_id) {
      lorebookIds.push(chatInfo.lorebook_id);
    }
    if (lorebookIds.length === 0 && character?.lorebook_id) {
      lorebookIds.push(character.lorebook_id);
    }
    for (const lbId of lorebookIds) {
      const entries = db.prepare(
        'SELECT keys, content, comment FROM lorebook_entries WHERE lorebook_id = ? AND disable = 0 ORDER BY insertion_order ASC'
      ).all(lbId) as any[];
      lorebookEntries.push(...entries);
    }

    // دریافت Story State
    let storyState = null;
    const storyStateRow = db.prepare('SELECT * FROM chat_story_state WHERE chat_id = ?').get(chat_id) as any;
    if (storyStateRow?.state_json) {
      try {
        storyState = JSON.parse(storyStateRow.state_json);
      } catch {}
    }

    const result = await generateSceneImage(
      chat_id,
      profile_id || 'scene',
      chat,
      character,
      custom_prompt,
      persona,
      lorebookEntries,
      storyState
    );

    res.json(result);
  } catch (error: any) {
    console.error('Scene generation failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/scenes/direct - تولید مستقیم (بدون LLM)
router.post('/direct', async (req: Request, res: Response) => {
  try {
    const { chat_id, prompt, negative_prompt, model, width, height, seed } = req.body;
    
    if (!chat_id || !prompt) {
      return res.status(400).json({ error: 'chat_id and prompt are required' });
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
    const id = `scene-${uuidv4()}`;
    
    db.prepare(`
      INSERT INTO scene_images (id, chat_id, image_prompt, negative_prompt, image_url, model, seed, width, height)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, chat_id, prompt, negative_prompt || '', result.imageUrl, result.model, result.seed, width || 1024, height || 1024);
    
    res.json({ id, ...result });
  } catch (error: any) {
    console.error('Direct generation failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/scenes/:id/regenerate - ریجنریت با seed جدید
router.post('/:id/regenerate', async (req: Request, res: Response) => {
  try {
    const result = await regenerateImage(req.params.id, 'scene');
    res.json(result);
  } catch (error: any) {
    console.error('Regeneration failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/scenes/:id/variations - تولید variations
router.post('/:id/variations', async (req: Request, res: Response) => {
  try {
    const { count = 4 } = req.body;
    const variations = await generateImageVariations(req.params.id, 'scene', count);
    res.json({ variations });
  } catch (error: any) {
    console.error('Variations generation failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/scenes/:id - بروزرسانی صحنه (pin, metadata)
router.put('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const { is_pinned, metadata } = req.body;
  
  const updates: string[] = [];
  const values: any[] = [];
  
  if (is_pinned !== undefined) {
    updates.push('is_pinned = ?');
    values.push(is_pinned ? 1 : 0);
  }
  if (metadata !== undefined) {
    updates.push('metadata = ?');
    values.push(JSON.stringify(metadata));
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }
  
  values.push(req.params.id);
  db.prepare(`UPDATE scene_images SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  
  res.json({ success: true });
});

// DELETE /api/scenes/:id - حذف صحنه
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM scene_images WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
