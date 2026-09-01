// ─── Image Profile System ───
// سیستم مدیریت پروفایل‌های تولید تصویر

import { getDb } from '../db';

export interface ImageProfile {
  id: string;
  name: string;
  instruction: string;
  negativePrompt: string;
  width: number;
  height: number;
  model: string;
  isBuiltin: boolean;
  createdAt: string;
}

/**
 * دریافت تمام پروفایل‌ها (پیش‌فرض + سفارشی)
 */
export function getAllProfiles(): ImageProfile[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM image_profiles ORDER BY is_builtin DESC, name').all() as any[];
  
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    instruction: row.instruction,
    negativePrompt: row.negative_prompt,
    width: row.width,
    height: row.height,
    model: row.model,
    isBuiltin: row.is_builtin === 1,
    createdAt: row.created_at,
  }));
}

/**
 * دریافت یک پروفایل با ID
 */
export function getProfile(id: string): ImageProfile | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM image_profiles WHERE id = ?').get(id) as any;
  
  if (!row) return null;
  
  return {
    id: row.id,
    name: row.name,
    instruction: row.instruction,
    negativePrompt: row.negative_prompt,
    width: row.width,
    height: row.height,
    model: row.model,
    isBuiltin: row.is_builtin === 1,
    createdAt: row.created_at,
  };
}

/**
 * ایجاد پروفایل جدید
 */
export function createProfile(data: {
  name: string;
  instruction: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  model?: string;
}): ImageProfile {
  const db = getDb();
  const id = `user-${Date.now()}`;
  
  db.prepare(`
    INSERT INTO image_profiles (id, name, instruction, negative_prompt, width, height, model, is_builtin)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `).run(
    id,
    data.name,
    data.instruction,
    data.negativePrompt || 'text, watermark, logo, blurry, deformed',
    data.width || 1024,
    data.height || 1024,
    data.model || 'flux'
  );
  
  return getProfile(id)!;
}

/**
 * بروزرسانی پروفایل سفارشی (پروفایل‌های پیش‌فرض قابل ویرایش نیستند)
 */
export function updateProfile(id: string, data: Partial<{
  name: string;
  instruction: string;
  negativePrompt: string;
  width: number;
  height: number;
  model: string;
}>): ImageProfile | null {
  const db = getDb();
  const existing = getProfile(id);
  
  if (!existing || existing.isBuiltin) {
    return null;
  }
  
  const updates: string[] = [];
  const values: any[] = [];
  
  if (data.name !== undefined) {
    updates.push('name = ?');
    values.push(data.name);
  }
  if (data.instruction !== undefined) {
    updates.push('instruction = ?');
    values.push(data.instruction);
  }
  if (data.negativePrompt !== undefined) {
    updates.push('negative_prompt = ?');
    values.push(data.negativePrompt);
  }
  if (data.width !== undefined) {
    updates.push('width = ?');
    values.push(data.width);
  }
  if (data.height !== undefined) {
    updates.push('height = ?');
    values.push(data.height);
  }
  if (data.model !== undefined) {
    updates.push('model = ?');
    values.push(data.model);
  }
  
  if (updates.length === 0) return existing;
  
  values.push(id);
  db.prepare(`UPDATE image_profiles SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  
  return getProfile(id);
}

/**
 * حذف پروفایل سفارشی (پروفایل‌های پیش‌فرض قابل حذف نیستند)
 */
export function deleteProfile(id: string): boolean {
  const db = getDb();
  const existing = getProfile(id);
  
  if (!existing || existing.isBuiltin) {
    return false;
  }
  
  const result = db.prepare('DELETE FROM image_profiles WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * کلون کردن پروفایل
 */
export function cloneProfile(id: string, newName?: string): ImageProfile | null {
  const db = getDb();
  const existing = getProfile(id);
  
  if (!existing) return null;
  
  return createProfile({
    name: newName || `${existing.name} (Copy)`,
    instruction: existing.instruction,
    negativePrompt: existing.negativePrompt,
    width: existing.width,
    height: existing.height,
    model: existing.model,
  });
}
