// ─── Full Database Backup ───
// خروجی/ورودی کل داده‌ها به‌صورت JSON — بدون فایل‌های سیستمی، فقط جداول

import { Router, Request, Response } from 'express';
import { getDb } from '../db';

const router = Router();

// ترتیب جدول‌ها برای restore — اول فرزندان تا FK نقض نشود
const BACKUP_TABLES = [
  { name: 'characters', order: 2 },
  { name: 'personas', order: 2 },
  { name: 'chats', order: 3 },
  { name: 'messages', order: 4 },
  { name: 'lorebooks', order: 3 },
  { name: 'lorebook_entries', order: 4 },
  { name: 'chapters', order: 5 },
  { name: 'api_settings', order: 6 },
  { name: 'plugin_settings', order: 6 },
] as const;

const DELETE_ORDER = [
  'messages', 'chapters', 'chats', 'lorebook_entries', 'lorebooks',
  'personas', 'characters', 'api_settings', 'plugin_settings', 'chapter_settings',
];

// خروجی کامل — همه جداول با idهای اصلی
router.get('/export', (_req: Request, res: Response) => {
  const db = getDb();
  const tables: Record<string, any[]> = {};
  for (const t of BACKUP_TABLES) {
    tables[t.name] = db.prepare(`SELECT * FROM ${t.name} ORDER BY rowid ASC`).all();
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="cozytavern-backup.json"`);
  res.json({
    format: 'cozytavern-backup',
    version: 1,
    exported_at: new Date().toISOString(),
    tables,
  });
});

// ورودی کامل — همه داده‌های فعلی پاک و از فایل بازسازی می‌شود (تراکنشی)
router.post('/restore', (req: Request, res: Response) => {
  const db = getDb();
  const data = req.body;

  if (!data || data.format !== 'cozytavern-backup' || typeof data.tables !== 'object' || !data.tables) {
    res.status(400).json({ error: 'Invalid backup file' });
    return;
  }

  // پیش از هر تغییری، ساختار را اعتبارسنجی کن
  for (const t of BACKUP_TABLES) {
    const rows = data.tables[t.name];
    if (rows !== undefined && !Array.isArray(rows)) {
      res.status(400).json({ error: `Table "${t.name}" must be an array` });
      return;
    }
  }

  try {
    const restore = db.transaction(() => {
      // پاک کردن به ترتیب امن برای foreign key ها
      for (const table of DELETE_ORDER) {
        db.prepare(`DELETE FROM ${table}`).run();
      }

      // درج به ترتیب والد → فرزند
      const ordered = [...BACKUP_TABLES].sort((a, b) => a.order - b.order);
      const counts: Record<string, number> = {};
      for (const t of ordered) {
        const rows = data.tables[t.name];
        if (!Array.isArray(rows) || rows.length === 0) {
          counts[t.name] = 0;
          continue;
        }
        // union ستون‌های همه ردیف‌ها — مقاوم در برابر ردیف‌هایی با ستون‌های ناهماهنگ
        const colSet = new Set<string>();
        for (const row of rows) {
          for (const k of Object.keys(row)) colSet.add(k);
        }
        const cols = [...colSet];
        const placeholders = cols.map(() => '?').join(', ');
        const stmt = db.prepare(
          `INSERT INTO ${t.name} (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders})`
        );
        for (const row of rows) {
          // ردیف‌هایی که ستون کمتری دارند (اسکیمای قدیمی) — فقط مقادیر موجود
          const values = cols.map((c) => {
            const v = row[c];
            return v === undefined ? null : v;
          });
          stmt.run(...values);
        }
        counts[t.name] = rows.length;
      }
      return counts;
    });

    const counts = restore();
    res.json({ success: true, restored: counts });
  } catch (err: any) {
    console.error('Backup restore failed:', err);
    res.status(500).json({ error: `Restore failed: ${err.message}` });
  }
});

export default router;
