// ─── Image Generation Pipeline ───
// پایپ‌لاین کامل تولید تصویر: Context → Profile → LLM → Pollinations

import { generateImage, ImageGenResult } from './image-gen';
import { getProfile, ImageProfile } from './image-profiles';
import { buildImageContext, buildPortraitContext } from './image-context';
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { buildEndpoint, buildHeaders, buildRequestBody, parseNonStreamingResponse } from './providers';

export interface PipelineResult {
  id: string;
  llmPrompt: string;
  imagePrompt: string;
  imageUrl: string;
  model: string;
  seed: number;
  width: number;
  height: number;
}

/**
 * تولید پرامپت تصویر با LLM
 * از همان LLM اصلی چت استفاده می‌کند
 */
export async function generateWithLLM(
  profile: ImageProfile,
  context: string,
  promptTemplate?: string
): Promise<string> {
  // دریافت تنظیمات API از دیتابیس
  const db = getDb();
  const settings = db.prepare("SELECT * FROM api_settings ORDER BY ROWID DESC LIMIT 1").get() as any;
  
  if (!settings) {
    throw new Error('API settings not found. Please configure the API first.');
  }

  // استفاده از promptTemplate اگر ارائه شده باشد، در غیر این صورت از profile.instruction
  const instruction = promptTemplate?.trim() || profile.instruction;

  // ساخت پرامپت برای LLM
  const llmPrompt = `${instruction}

Use the context below to write only one final image generation prompt.
Do not include explanations, markdown, labels, or quotes.
Make the result concise, visual, and directly usable by an image generation model.

Context:
${context}`;

  // ساخت درخواست برای LLM
  const endpoint = buildEndpoint(settings.base_url);
  const headers = buildHeaders(settings.api_key);
  
  const requestBody = buildRequestBody([
    { role: 'user', content: llmPrompt }
  ], {
    model: settings.model,
    temperature: 0.7,
    max_tokens: 2048,
    stream: false,
  });

  // ارسال درخواست به LLM
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: requestBody,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const result = parseNonStreamingResponse(data);
  
  return result.trim();
}

/**
 * تولید تصویر صحنه (پایپ‌لاین کامل)
 */
export async function generateSceneImage(
  chatId: string,
  profileId: string,
  chat: any[],
  character: any,
  customPrompt?: string,
  persona?: any,
  lorebookEntries?: any[],
  storyState?: any
): Promise<PipelineResult> {
  // دریافت پروفایل
  const profile = getProfile(profileId) || getProfile('scene')!;

  // ساخت کانتکست
  const context = buildImageContext(chat, character, persona, lorebookEntries, storyState);

  // تولید پرامپت تصویر از طریق LLM
  let imagePrompt: string;
  if (customPrompt) {
    imagePrompt = customPrompt;
  } else {
    imagePrompt = await generateWithLLM(profile, context);
  }

  // تولید تصویر
  const result = await generateImage({
    prompt: imagePrompt,
    width: profile.width,
    height: profile.height,
    model: profile.model,
    nologo: true,
    negative: profile.negativePrompt,
  });

  // ذخیره در دیتابیس
  const db = getDb();
  const id = `scene-${uuidv4()}`;

  db.prepare(`
    INSERT INTO scene_images (id, chat_id, profile_id, llm_prompt, image_prompt, negative_prompt, image_url, model, seed, width, height)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    chatId,
    profileId,
    context, // ذخیره کانتکست به عنوان llm_prompt برای مراجعه
    imagePrompt,
    profile.negativePrompt,
    result.imageUrl,
    result.model,
    result.seed,
    profile.width,
    profile.height
  );

  return {
    id,
    llmPrompt: context,
    imagePrompt,
    imageUrl: result.imageUrl,
    model: result.model,
    seed: result.seed,
    width: profile.width,
    height: profile.height,
  };
}

/**
 * تولید پرتره کاراکتر (پایپ‌لاین کامل)
 */
export async function generatePortrait(
  characterId: string,
  profileId: string,
  character: any,
  options: {
    width?: number;
    height?: number;
    model?: string;
    extras?: string;
  } = {}
): Promise<PipelineResult> {
  // دریافت پروفایل
  const profile = getProfile(profileId) || getProfile('portrait')!;
  
  // ساخت کانتکست
  const context = buildPortraitContext(character, options.extras);
  
  // تولید پرامپت تصویر از طریق LLM
  const imagePrompt = await generateWithLLM(profile, context);
  
  // تولید تصویر
  const result = await generateImage({
    prompt: imagePrompt,
    width: options.width || profile.width,
    height: options.height || profile.height,
    model: options.model || profile.model,
    nologo: true,
    negative: profile.negativePrompt,
  });
  
  // ذخیره در دیتابیس
  const db = getDb();
  const id = `portrait-${uuidv4()}`;
  
  // حذف is_current از پرتره‌های قبلی این کاراکتر
  db.prepare('UPDATE character_portraits SET is_current = 0 WHERE character_id = ?').run(characterId);
  
  db.prepare(`
    INSERT INTO character_portraits (id, character_id, profile_id, llm_prompt, image_prompt, negative_prompt, image_url, model, seed, width, height, is_current)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    id,
    characterId,
    profileId,
    context,
    imagePrompt,
    profile.negativePrompt,
    result.imageUrl,
    result.model,
    result.seed,
    options.width || profile.width,
    options.height || profile.height
  );
  
  // بروزرسانی avatar کاراکتر
  db.prepare('UPDATE characters SET avatar = ? WHERE id = ?').run(result.imageUrl, characterId);
  
  return {
    id,
    llmPrompt: context,
    imagePrompt,
    imageUrl: result.imageUrl,
    model: result.model,
    seed: result.seed,
    width: options.width || profile.width,
    height: options.height || profile.height,
  };
}

/**
 * تولید فقط پرامپت (بدون تولید تصویر)
 * این تابع نیازی به API Key ندارد
 */
export async function generatePromptOnly(
  profileId: string,
  chat: any[],
  character: any,
  customPrompt?: string,
  persona?: any,
  lorebookEntries?: any[],
  storyState?: any
): Promise<{ imagePrompt: string; profileId: string }> {
  // دریافت پروفایل
  const profile = getProfile(profileId) || getProfile('scene')!;

  // ساخت کانتکست
  const context = buildImageContext(chat, character, persona, lorebookEntries, storyState);

  // تولید پرامپت تصویر از طریق LLM
  let imagePrompt: string;
  if (customPrompt) {
    imagePrompt = customPrompt;
  } else {
    imagePrompt = await generateWithLLM(profile, context);
  }

  return {
    imagePrompt,
    profileId: profile.id,
  };
}

/**
 * ریجنریت تصویر با همان پرامپت اما seed جدید
 */
export async function regenerateImage(
  imageId: string,
  type: 'scene' | 'portrait'
): Promise<PipelineResult> {
  const db = getDb();
  const table = type === 'scene' ? 'scene_images' : 'character_portraits';
  
  const existing = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(imageId) as any;
  if (!existing) {
    throw new Error(`${type} image not found`);
  }
  
  // تولید با seed جدید
  const result = await generateImage({
    prompt: existing.image_prompt,
    width: existing.width,
    height: existing.height,
    model: existing.model,
    nologo: true,
    negative: existing.negative_prompt,
  });
  
  // ذخیره به عنوان رکورد جدید
  const newId = `${type}-${uuidv4()}`;
  const parentId = existing.parent_id || existing.id;
  
  const idField = type === 'scene' ? 'chat_id' : 'character_id';
  
  db.prepare(`
    INSERT INTO ${table} (id, ${idField}, profile_id, llm_prompt, image_prompt, negative_prompt, image_url, model, seed, width, height, ${type === 'portrait' ? 'parent_id' : 'is_auto_generated'})
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    newId,
    existing[idField],
    existing.profile_id,
    existing.llm_prompt,
    existing.image_prompt,
    existing.negative_prompt,
    result.imageUrl,
    result.model,
    result.seed,
    existing.width,
    existing.height,
    type === 'portrait' ? parentId : existing.is_auto_generated
  );
  
  return {
    id: newId,
    llmPrompt: existing.llm_prompt,
    imagePrompt: existing.image_prompt,
    imageUrl: result.imageUrl,
    model: result.model,
    seed: result.seed,
    width: existing.width,
    height: existing.height,
  };
}

/**
 * تولید variations تصویر
 */
export async function generateImageVariations(
  imageId: string,
  type: 'scene' | 'portrait',
  count: number = 4
): Promise<{ id: string; seed: number; imageUrl: string }[]> {
  const db = getDb();
  const table = type === 'scene' ? 'scene_images' : 'character_portraits';
  
  const existing = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(imageId) as any;
  if (!existing) {
    throw new Error(`${type} image not found`);
  }
  
  const results: { id: string; seed: number; imageUrl: string }[] = [];
  
  for (let i = 0; i < count; i++) {
    const seed = Math.floor(Math.random() * 1000000);
    const result = await generateImage({
      prompt: existing.image_prompt,
      width: existing.width,
      height: existing.height,
      model: existing.model,
      seed,
      nologo: true,
      negative: existing.negative_prompt,
    });
    
    const newId = `${type}-${uuidv4()}`;
    const idField = type === 'scene' ? 'chat_id' : 'character_id';
    
    db.prepare(`
      INSERT INTO ${table} (id, ${idField}, profile_id, image_prompt, negative_prompt, image_url, model, seed, width, height, ${type === 'portrait' ? 'is_variation, parent_id' : 'is_auto_generated'})
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${type === 'portrait' ? '1, ?' : '1'})
    `).run(
      newId,
      existing[idField],
      existing.profile_id,
      existing.image_prompt,
      existing.negative_prompt,
      result.imageUrl,
      result.model,
      result.seed,
      existing.width,
      existing.height,
      ...(type === 'portrait' ? [existing.id] : [])
    );
    
    results.push({ id: newId, seed: result.seed, imageUrl: result.imageUrl });
  }
  
  return results;
}
