import { testDb } from './global-setup';
import request from 'supertest';
import app from '../app';
// توجه: ../db با vi.mock جایگزین شده، پس migration را مستقیم از plugin-store صدا می‌زنیم
import { migrateLegacyChapterSettings } from '../utils/plugin-store';

describe('Plugins Settings API', () => {
  beforeEach(() => {
    testDb.exec('DELETE FROM plugin_settings');
    // جدول legacy برای تست migration
    testDb.exec('DELETE FROM chapter_settings');
  });

  it('باید پیش‌فرض‌های پلاگین chapters رو برگرداند', async () => {
    const res = await request(app)
      .get('/api/plugins/chapters/settings')
      .expect(200);

    expect(res.body.raw_window).toBe(10);
    expect(res.body.auto_detect_enabled).toBe(true);
    expect(Array.isArray(res.body.trigger_phrases)).toBe(true);
    expect(res.body.trigger_phrases.length).toBeGreaterThan(0);
    expect(res.body.summarizer_model).toBe('');
  });

  it('باید پیش‌فرض‌های پلاگین lorebook_scanner رو برگرداند', async () => {
    const res = await request(app)
      .get('/api/plugins/lorebook_scanner/settings')
      .expect(200);

    expect(res.body.default_scan_depth).toBe(50);
    expect(res.body.default_token_budget).toBe(500);
  });

  it('برای پلاگین ناشناخته باید 404 برگرداند', async () => {
    const res = await request(app)
      .get('/api/plugins/nonexistent/settings')
      .expect(404);
    expect(res.body.error).toBeDefined();

    await request(app)
      .put('/api/plugins/nonexistent/settings')
      .send({ foo: 1 })
      .expect(404);
  });

  it('باید تنظیمات رو ذخیره و merge جزئی انجام دهد', async () => {
    const res = await request(app)
      .put('/api/plugins/chapters/settings')
      .send({ raw_window: 25 })
      .expect(200);

    // فیلد تغییر کرده
    expect(res.body.raw_window).toBe(25);
    // بقیه فیلدها حفظ شده‌اند (defaults)
    expect(res.body.auto_detect_enabled).toBe(true);

    // persist شده باشد
    const again = await request(app)
      .get('/api/plugins/chapters/settings')
      .expect(200);
    expect(again.body.raw_window).toBe(25);
  });

  it('باید کلیدهای ناشناخته را نادیده بگیرد', async () => {
    const res = await request(app)
      .put('/api/plugins/lorebook_scanner/settings')
      .send({ default_scan_depth: 80, evil_key: 'hack' })
      .expect(200);

    expect(res.body.default_scan_depth).toBe(80);
    expect((res.body as any).evil_key).toBeUndefined();
  });

  it('برای raw_window نامعتبر باید 400 برگرداند', async () => {
    await request(app)
      .put('/api/plugins/chapters/settings')
      .send({ raw_window: 0 })
      .expect(400);

    await request(app)
      .put('/api/plugins/chapters/settings')
      .send({ raw_window: 'abc' })
      .expect(400);
  });

  it('برای trigger_phrases غیر آرایه باید 400 برگرداند', async () => {
    const res = await request(app)
      .put('/api/plugins/chapters/settings')
      .send({ trigger_phrases: 'not-an-array' })
      .expect(400);
    expect(res.body.error).toContain('trigger_phrases');
  });

  it('trigger_phrases باید trim/dedupe/حذف خالی انجام دهد', async () => {
    const res = await request(app)
      .put('/api/plugins/chapters/settings')
      .send({ trigger_phrases: ['فصل بعد', ' فصل بعد ', '', 'روز بعد'] })
      .expect(200);

    expect(res.body.trigger_phrases).toEqual(['فصل بعد', 'روز بعد']);
  });

  it('برای default_token_budget خارج از محدوده باید 400 برگرداند', async () => {
    await request(app)
      .put('/api/plugins/lorebook_scanner/settings')
      .send({ default_token_budget: 10 })
      .expect(400);
  });

  describe('quick_replies plugin', () => {
    it('باید پیش‌فرض‌ها (فعال، بدون دکمه) را برگرداند', async () => {
      const res = await request(app)
        .get('/api/plugins/quick_replies/settings')
        .expect(200);
      expect(res.body.enabled).toBe(true);
      expect(res.body.replies).toEqual([]);
    });

    it('باید replies معتبر را ذخیره کند', async () => {
      const res = await request(app)
        .put('/api/plugins/quick_replies/settings')
        .send({
          enabled: true,
          replies: [
            { label: 'ادامه بده', message: 'داستان را ادامه بده' },
            { label: 'خلاصه کن', message: 'تا اینجا رو خلاصه کن' },
          ],
        })
        .expect(200);

      expect(res.body.replies).toHaveLength(2);
      expect(res.body.replies[0].label).toBe('ادامه بده');

      // persist
      const again = await request(app)
        .get('/api/plugins/quick_replies/settings')
        .expect(200);
      expect(again.body.replies).toHaveLength(2);
    });

    it('ردیف‌های بدون label یا message خالی باید حذف بشوند', async () => {
      const res = await request(app)
        .put('/api/plugins/quick_replies/settings')
        .send({
          replies: [
            { label: 'خوب', message: 'محتوا' },
            { label: '', message: 'بی‌برچسب' },
            { label: 'بی‌متن', message: '   ' },
          ],
        })
        .expect(200);
      expect(res.body.replies).toHaveLength(1);
      expect(res.body.replies[0].label).toBe('خوب');
    });

    it('replies غیر آرایه باید 400 بدهد', async () => {
      const res = await request(app)
        .put('/api/plugins/quick_replies/settings')
        .send({ replies: 'not-an-array' })
        .expect(400);
      expect(res.body.error).toContain('replies');
    });
  });

  describe('migration از chapter_settings قدیمی', () => {
    const runMigration = () => {
      // ردیف legacy در جدول قدیمی
      testDb.exec(`
        INSERT INTO chapter_settings (id, raw_window, auto_detect_enabled, trigger_phrases, summarizer_model)
        VALUES ('default', 7, 0, '["شب شد"]', 'gpt-mini')
      `);
      migrateLegacyChapterSettings(testDb);
    };

    it('باید ردیف legacy را به plugin_settings کپی کند', async () => {
      runMigration();

      const res = await request(app)
        .get('/api/plugins/chapters/settings')
        .expect(200);

      expect(res.body.raw_window).toBe(7);
      expect(res.body.auto_detect_enabled).toBe(false);
      expect(res.body.trigger_phrases).toEqual(['شب شد']);
      expect(res.body.summarizer_model).toBe('gpt-mini');

      // اجرای مجدد idempotent باشد
      migrateLegacyChapterSettings(testDb);
      const again = await request(app)
        .get('/api/plugins/chapters/settings')
        .expect(200);
      expect(again.body.raw_window).toBe(7);
    });

    it('وقتی ردیف legacy نباشد باید seed {} شود', () => {
      migrateLegacyChapterSettings(testDb);
      const row = testDb.prepare("SELECT settings_json FROM plugin_settings WHERE plugin_id = 'chapters'").get() as any;
      expect(row).toBeDefined();
      expect(JSON.parse(row.settings_json)).toEqual({});
    });
  });
});
