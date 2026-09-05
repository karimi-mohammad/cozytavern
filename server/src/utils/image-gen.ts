// ─── Pollinations.ai API Client ───
// کلاینت API برای تولید تصویر از طریق Pollinations.ai

import { getDb } from '../db';

const POLLINATIONS_BASE_URL = 'https://gen.pollinations.ai';

export interface ImageGenRequest {
  prompt: string;
  width?: number;      // default 1024
  height?: number;     // default 1024
  model?: string;      // default "flux"
  seed?: number;       // random if not set
  nologo?: boolean;    // default true
  enhance?: boolean;   // default false
  negative?: string;
}

export interface ImageGenResult {
  imageUrl: string;     // direct URL to generated image
  buffer: Buffer;       // raw image bytes
  seed: number;         // actual seed used
  model: string;
}

export interface PollinationsModel {
  id: string;
  name?: string;
  description?: string;
  input_modalities?: string[];
  output_modalities?: string[];
  supported_endpoints?: string[];
}

/**
 * دریافت API Key از دیتابیس
 */
function getApiKey(): string | null {
  try {
    const db = getDb();
    const settings = db.prepare("SELECT pollinations_api_key FROM api_settings ORDER BY ROWID DESC LIMIT 1").get() as any;
    return settings?.pollinations_api_key || null;
  } catch {
    return null;
  }
}

/**
 * بررسی وجود API Key
 */
export function hasApiKey(): boolean {
  return !!getApiKey();
}

/**
 * تنظیم API Key
 */
export function setApiKey(apiKey: string): void {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM api_settings ORDER BY ROWID DESC LIMIT 1").get() as any;
  
  if (existing) {
    db.prepare("UPDATE api_settings SET pollinations_api_key = ? WHERE id = ?").run(apiKey, existing.id);
  } else {
    db.prepare("INSERT INTO api_settings (id, pollinations_api_key) VALUES (?, ?)").run('default', apiKey);
  }
}

/**
 * تولید تصویر از طریق Pollinations.ai API
 * از GET endpoint استفاده می‌کند که تصویر باینری برمی‌گرداند
 */
export async function generateImage(req: ImageGenRequest): Promise<ImageGenResult> {
  const apiKey = getApiKey();
  
  // بررسی API Key فقط هنگام استفاده
  if (!apiKey) {
    throw new Error('POLLINATIONS_API_KEY is not configured. Please set it in Settings or use Perchance.org instead.');
  }
  
  const prompt = encodeURIComponent(req.prompt);
  const params = new URLSearchParams();

  if (req.width) params.set('width', String(req.width));
  if (req.height) params.set('height', String(req.height));
  if (req.model) params.set('model', req.model);
  if (req.seed) params.set('seed', String(req.seed));
  if (req.nologo !== undefined) params.set('nologo', String(req.nologo));
  if (req.enhance) params.set('enhance', 'true');
  if (req.negative) params.set('negative', req.negative);

  // استفاده از GET endpoint که تصویر باینری برمی‌گرداند
  const url = `${POLLINATIONS_BASE_URL}/image/${prompt}?${params.toString()}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Pollinations API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  return {
    imageUrl: url,
    buffer,
    seed: req.seed || 0,
    model: req.model || 'flux'
  };
}

/**
 * دریافت لیست مدل‌های موجود از Pollinations
 */
export async function fetchAvailableModels(): Promise<PollinationsModel[]> {
  const apiKey = getApiKey();
  
  // اگر API Key نباشد، مدل‌های پیش‌فرض رو برگردون
  if (!apiKey) {
    return [
      { id: 'flux', name: 'Flux (Default)' },
      { id: 'flux-realism', name: 'Flux Realism' },
      { id: 'flux-anime', name: 'Flux Anime' },
      { id: 'dreamshaper', name: 'DreamShaper' },
    ];
  }
  
  try {
    const response = await fetch(`${POLLINATIONS_BASE_URL}/v1/models`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      // اگر خطا بود، مدل‌های پیش‌فرض رو برگردون
      return [
        { id: 'flux', name: 'Flux (Default)' },
        { id: 'flux-realism', name: 'Flux Realism' },
        { id: 'flux-anime', name: 'Flux Anime' },
        { id: 'dreamshaper', name: 'DreamShaper' },
      ];
    }

    const data = await response.json() as { data: PollinationsModel[] };
    return data.data || [];
  } catch {
    return [
      { id: 'flux', name: 'Flux (Default)' },
      { id: 'flux-realism', name: 'Flux Realism' },
      { id: 'flux-anime', name: 'Flux Anime' },
      { id: 'dreamshaper', name: 'DreamShaper' },
    ];
  }
}

/**
 * تولید variations تصویر با seedهای مختلف
 */
export async function generateVariations(
  prompt: string,
  count: number = 4,
  options: Partial<ImageGenRequest> = {}
): Promise<ImageGenResult[]> {
  const results: ImageGenResult[] = [];
  
  for (let i = 0; i < count; i++) {
    const seed = Math.floor(Math.random() * 1000000);
    const result = await generateImage({
      prompt,
      seed,
      ...options,
    });
    results.push(result);
  }
  
  return results;
}

/**
 * بررسی در دسترس بودن API
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const models = await fetchAvailableModels();
    return models.length > 0;
  } catch {
    return false;
  }
}
