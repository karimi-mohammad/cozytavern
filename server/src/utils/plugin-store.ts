// ─── Plugin Settings Store ───
// منبع واحد تنظیمات پلاگین‌ها. هر پلاگین با defaults و sanitize (whitelist) تعریف می‌شود
// و در جدول plugin_settings به صورت JSON ذخیره می‌شود.

export interface PluginDefinition<T = Record<string, any>> {
  defaults: T;
  // partial را روی current اعمال و فقط کلیدهای معتبر را برمی‌گرداند؛ خطا در صورت نامعتبر بودن
  sanitize(partial: Partial<T>, current: T): T;
}

export class PluginSettingsError extends Error {}

const asInt = (v: any): number | null => {
  const n = typeof v === 'string' && v.trim() !== '' ? parseInt(v, 10) : v;
  return typeof n === 'number' && Number.isFinite(n) ? Math.trunc(n) : null;
};

// ─── Chapters plugin ───

interface ChaptersSettings {
  raw_window: number;
  auto_detect_enabled: boolean;
  trigger_phrases: string[];
  summarizer_model: string;
  summarizer_base_url: string;
  summarizer_api_key: string;
}

const CHAPTERS_DEFAULT_TRIGGER_PHRASES = ['next day', 'next morning', 'later that day', 'meanwhile'];

function sanitizeChapters(partial: Partial<ChaptersSettings>, current: ChaptersSettings): ChaptersSettings {
  const next: ChaptersSettings = { ...current };

  if (partial.raw_window !== undefined) {
    const n = asInt(partial.raw_window);
    if (n === null || n < 1 || n > 100) {
      throw new PluginSettingsError('raw_window must be a number between 1 and 100');
    }
    next.raw_window = n;
  }
  if (partial.auto_detect_enabled !== undefined) {
    next.auto_detect_enabled = !!partial.auto_detect_enabled;
  }
  if (partial.trigger_phrases !== undefined) {
    if (!Array.isArray(partial.trigger_phrases)) {
      throw new PluginSettingsError('trigger_phrases must be an array of strings');
    }
    const seen = new Set<string>();
    next.trigger_phrases = partial.trigger_phrases
      .map((p) => String(p ?? '').trim())
      .filter((p) => {
        if (!p || seen.has(p.toLowerCase())) return false;
        seen.add(p.toLowerCase());
        return true;
      });
  }
  for (const key of ['summarizer_model', 'summarizer_base_url', 'summarizer_api_key'] as const) {
    if ((partial as any)[key] !== undefined) {
      (next as any)[key] = String((partial as any)[key] ?? '');
    }
  }

  return next;
}

// ─── Lorebook Scanner plugin ───

export interface LorebookScannerSettings {
  default_scan_depth: number;
  default_token_budget: number;
}

function sanitizeLorebookScanner(
  partial: Partial<LorebookScannerSettings>,
  current: LorebookScannerSettings,
): LorebookScannerSettings {
  const next = { ...current };

  if (partial.default_scan_depth !== undefined) {
    const n = asInt(partial.default_scan_depth);
    if (n === null || n < 1 || n > 100) {
      throw new PluginSettingsError('default_scan_depth must be a number between 1 and 100');
    }
    next.default_scan_depth = n;
  }
  if (partial.default_token_budget !== undefined) {
    const n = asInt(partial.default_token_budget);
    if (n === null || n < 50 || n > 4000) {
      throw new PluginSettingsError('default_token_budget must be a number between 50 and 4000');
    }
    next.default_token_budget = n;
  }

  return next;
}

// ─── Registry ───

export const PLUGIN_REGISTRY: Record<string, PluginDefinition<any>> = {
  chapters: {
    defaults: {
      raw_window: 10,
      auto_detect_enabled: true,
      trigger_phrases: [...CHAPTERS_DEFAULT_TRIGGER_PHRASES],
      summarizer_model: '',
      summarizer_base_url: '',
      summarizer_api_key: '',
    },
    sanitize: sanitizeChapters,
  },
  lorebook_scanner: {
    defaults: {
      default_scan_depth: 50,
      default_token_budget: 500,
    },
    sanitize: sanitizeLorebookScanner,
  },
};

export function getPluginSettings(db: any, pluginId: string): Record<string, any> | null {
  const def = PLUGIN_REGISTRY[pluginId];
  if (!def) return null;

  const row = db.prepare('SELECT settings_json FROM plugin_settings WHERE plugin_id = ?').get(pluginId) as any;
  let stored: Record<string, any> = {};
  try {
    stored = row ? JSON.parse(row.settings_json || '{}') : {};
  } catch {
    stored = {};
  }

  // فقط کلیدهای شناخته‌شده، merge شده روی defaults
  const merged: Record<string, any> = { ...def.defaults };
  for (const key of Object.keys(def.defaults)) {
    if (stored[key] !== undefined) merged[key] = stored[key];
  }
  return def.sanitize({}, merged);
}

export function updatePluginSettings(db: any, pluginId: string, partial: Record<string, any>): Record<string, any> {
  const def = PLUGIN_REGISTRY[pluginId];
  if (!def) throw new PluginSettingsError('Plugin not found');

  ensureRow(db, pluginId);
  const current = getPluginSettings(db, pluginId)!;
  const next = def.sanitize(partial, current);

  db.prepare(`
    INSERT INTO plugin_settings (plugin_id, settings_json) VALUES (?, ?)
    ON CONFLICT(plugin_id) DO UPDATE SET settings_json = excluded.settings_json
  `).run(pluginId, JSON.stringify(next));

  return next;
}

// اطمینان از وجود ردیف پلاگین (seed '{}') — برای خواندن هم بی‌ضرر است
function ensureRow(db: any, pluginId: string): void {
  if (!PLUGIN_REGISTRY[pluginId]) return;
  db.prepare('INSERT OR IGNORE INTO plugin_settings (plugin_id, settings_json) VALUES (?, ?)')
    .run(pluginId, '{}');
}

// ─── Compat: شکل قدیمی chapter_settings برای مصرف‌کننده‌های موجود ───

export function getChapterSettingsCompat(db: any) {
  return getPluginSettings(db, 'chapters');
}

// ─── Migration: انتقال chapter_settings قدیمی به plugin_settings ───
// توسط initDb صدا زده می‌شود؛ idempotent است (فقط اگر ردیف 'chapters' نباشد اجرا می‌شود)

export function migrateLegacyChapterSettings(database: any): void {
  const hasChaptersPlugin = database.prepare(
    "SELECT 1 FROM plugin_settings WHERE plugin_id = 'chapters'"
  ).get();
  if (hasChaptersPlugin) return;

  const legacy = database.prepare("SELECT * FROM chapter_settings WHERE id = 'default'").get() as any;
  const migrated = legacy
    ? JSON.stringify({
        raw_window: legacy.raw_window ?? 10,
        auto_detect_enabled: !!legacy.auto_detect_enabled,
        trigger_phrases: JSON.parse(legacy.trigger_phrases || '[]'),
        summarizer_model: legacy.summarizer_model ?? '',
        summarizer_base_url: legacy.summarizer_base_url ?? '',
        summarizer_api_key: legacy.summarizer_api_key ?? '',
      })
    : '{}';
  database.prepare(
    "INSERT OR IGNORE INTO plugin_settings (plugin_id, settings_json) VALUES ('chapters', ?)"
  ).run(migrated);
}
