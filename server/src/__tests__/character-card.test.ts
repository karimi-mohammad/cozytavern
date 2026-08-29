import { describe, it, expect, beforeEach } from 'vitest';
import { testDb } from './global-setup';
import request from 'supertest';
import app from '../app';
import {
  buildCardJson,
  parseCardFields,
  parseCardBook,
  extractCardFromPng,
  embedCardInPng,
  makePlaceholderPng,
  isValidPng,
} from '../utils/character-card';

describe('Character Card Utils', () => {
  describe('parseCardFields', () => {
    it('کارت V2 با data باید parse بشه', () => {
      const card = {
        spec: 'chara_card_v2',
        data: { name: 'الیسا', description: 'توضیحات', tags: ['الف'] },
      };
      const fields = parseCardFields(card);
      expect(fields).not.toBeNull();
      expect(fields!.name).toBe('الیسا');
      expect(fields!.tags).toEqual(['الف']);
    });

    it('کارت V1 flat باید parse بشه', () => {
      const fields = parseCardFields({ name: 'قدیمی', first_mes: 'سلام' });
      expect(fields).not.toBeNull();
      expect(fields!.name).toBe('قدیمی');
      expect(fields!.first_mes).toBe('سلام');
    });

    it('بدون name باید null برگردونه', () => {
      expect(parseCardFields({ description: 'بی‌نام' })).toBeNull();
      expect(parseCardFields(null)).toBeNull();
      expect(parseCardFields('رشته')).toBeNull();
    });
  });

  describe('buildCardJson + parseCardBook', () => {
    it('باید کارت V2 با لوربوک بسازه و book قابل خواندن باشه', () => {
      const character = {
        name: 'کتاب‌دار',
        description: 'دوست کتاب',
        tags: '["خواننده"]',
      };
      const lorebook = {
        name: 'کتابخانه',
        scan_depth: 20,
        token_budget: 300,
        entries: [
          { keys: '["کتاب","مطالعه"]', keys_secondary: '[]', content: 'عاشق کتاب است', constant: 0, selective: 0, insertion_order: 50, disable: 0, comment: '', position: 'before_main' },
        ],
      };

      const card = buildCardJson(character, lorebook);
      expect(card.spec).toBe('chara_card_v2');
      expect(card.data.name).toBe('کتاب‌دار');
      expect(card.data.tags).toEqual(['خواننده']);
      expect(card.data.character_book.entries).toHaveLength(1);

      const entries = parseCardBook(card);
      expect(entries[0].key).toEqual(['کتاب', 'مطالعه']);
      expect(entries[0].content).toBe('عاشق کتاب است');
      expect(entries[0].disable).toBe(false);
    });
  });

  describe('PNG embed/extract round-trip', () => {
    it('placeholder معتبر باشه', () => {
      const png = makePlaceholderPng(64, 64);
      expect(isValidPng(png)).toBe(true);
    });

    it('جاسازی و استخراج کارت در PNG', () => {
      const png = makePlaceholderPng();
      const card = { spec: 'chara_card_v2', data: { name: 'تستی' } };
      const embedded = embedCardInPng(png, card);
      expect(embedded).not.toBeNull();

      // PNG اصلی بدون کارت است
      expect(extractCardFromPng(png!)).toBeNull();

      // PNG جاسازی‌شده کارت را برمی‌گرداند
      const extracted = extractCardFromPng(embedded!);
      expect(extracted).toEqual(card);

      // ساختار chunk ها همچنان معتبر است
      expect(isValidPng(embedded!)).toBe(true);
    });

    it('فایل غیر PNG باید null برگردونه', () => {
      const fake = Buffer.from('this is not a png at all........');
      expect(extractCardFromPng(fake)).toBeNull();
      expect(embedCardInPng(fake, { a: 1 })).toBeNull();
      expect(isValidPng(fake)).toBe(false);
    });
  });
});

describe('Character Import/Export API', () => {
  beforeEach(() => {
    testDb.exec('DELETE FROM messages');
    testDb.exec('DELETE FROM chapters');
    testDb.exec('DELETE FROM chats');
    testDb.exec('DELETE FROM lorebook_entries');
    testDb.exec('DELETE FROM lorebooks');
    testDb.exec('DELETE FROM characters');
  });

  it('باید کاراکتر JSON بگیره (export/json)', async () => {
    const created = await request(app)
      .post('/api/characters')
      .send({ name: 'صادراتی', description: 'کاراکتر تست صادرات', tags: ['تست'] })
      .expect(201);

    const res = await request(app)
      .get(`/api/characters/${created.body.id}/export/json`)
      .expect(200);

    expect(res.headers['content-type']).toContain('application/json');
    expect(res.body.spec).toBe('chara_card_v2');
    expect(res.body.data.name).toBe('صادراتی');
    expect(res.body.data.description).toBe('کاراکتر تست صادرات');
    expect(res.body.data.tags).toEqual(['تست']);
  });

  it('باید PNG با کارت جاسازی‌شده بده (export/png)', async () => {
    const created = await request(app)
      .post('/api/characters')
      .send({ name: 'پیکسلی', description: 'با آواتار' })
      .expect(201);

    const res = await request(app)
      .get(`/api/characters/${created.body.id}/export/png`)
      .expect(200);

    expect(res.headers['content-type']).toBe('image/png');

    const extracted = extractCardFromPng(res.body as Buffer);
    expect(extracted).not.toBeNull();
    expect(extracted.data.name).toBe('پیکسلی');
  });

  it('باید کاراکتر از JSON وارد کنه (import)', async () => {
    const res = await request(app)
      .post('/api/characters/import')
      .send({
        json: {
          spec: 'chara_card_v2',
          data: { name: 'وارداتی', description: 'از SillyTavern', personality: 'شوخ', tags: ['واردات'] },
        },
      })
      .expect(201);

    expect(res.body.name).toBe('وارداتی');
    expect(res.body.personality).toBe('شوخ');

    // در لیست هم باشد
    const list = await request(app).get('/api/characters').expect(200);
    expect(list.body.some((c: any) => c.name === 'وارداتی')).toBe(true);
  });

  it('باید کاراکتر را همراه character_book وارد کنه و لوربوک بسازه', async () => {
    const res = await request(app)
      .post('/api/characters/import')
      .send({
        json: {
          spec: 'chara_card_v2',
          data: {
            name: 'کتاب‌خوان',
            character_book: {
              name: 'دنیای کتاب',
              scan_depth: 25,
              token_budget: 400,
              entries: [
                { keys: ['کتاب'], content: 'دنیای پر از کتاب', enabled: true, insertion_order: 10 },
                { keys: ['جادو'], content: 'جادو ممنوع', enabled: false },
              ],
            },
          },
        },
      })
      .expect(201);

    expect(res.body.imported_lorebook_id).toBeDefined();

    const lorebook = await request(app)
      .get(`/api/lorebooks/${res.body.imported_lorebook_id}`)
      .expect(200);
    expect(lorebook.body.name).toBe('دنیای کتاب');
    expect(lorebook.body.entries).toHaveLength(2);
    expect(lorebook.body.entries[0].key).toEqual(['کتاب']);
    // enabled:false → disable:true
    expect(lorebook.body.entries[1].disable).toBe(true);
  });

  it('باید کارت داخل PNG را وارد کنه (file_b64)', async () => {
    const png = makePlaceholderPng(32, 32);
    const embedded = embedCardInPng(png, {
      spec: 'chara_card_v2',
      data: { name: 'تصویری', first_mes: 'سلام تصویری!' },
    })!;

    const res = await request(app)
      .post('/api/characters/import')
      .send({ file_b64: embedded.toString('base64') })
      .expect(201);

    expect(res.body.name).toBe('تصویری');
    expect(res.body.first_mes).toBe('سلام تصویری!');
  });

  it('PNG بدون کارت باید خطا بده', async () => {
    const png = makePlaceholderPng(8, 8);
    const res = await request(app)
      .post('/api/characters/import')
      .send({ file_b64: png.toString('base64') })
      .expect(400);
    expect(res.body.error).toContain('No character card');
  });

  it('JSON نامعتبر باید خطا بده', async () => {
    await request(app)
      .post('/api/characters/import')
      .send({ json: { foo: 'bar' } })
      .expect(400);
  });

  it('چرخه کامل export → import باید همان داده را بازگرداند', async () => {
    const created = await request(app)
      .post('/api/characters')
      .send({
        name: 'چرخشی',
        description: 'تست چرخه',
        scenario: 'سناریو',
        first_mes: 'اول',
        mes_example: 'مثال',
        creator_notes: 'یادداشت',
        tags: ['یک', 'دو'],
      })
      .expect(201);

    const exported = await request(app)
      .get(`/api/characters/${created.body.id}/export/json`)
      .expect(200);

    const reImported = await request(app)
      .post('/api/characters/import')
      .send({ json: exported.body })
      .expect(201);

    expect(reImported.body.name).toBe('چرخشی');
    expect(reImported.body.scenario).toBe('سناریو');
    expect(reImported.body.first_mes).toBe('اول');
    expect(reImported.body.mes_example).toBe('مثال');
    expect(reImported.body.creator_notes).toBe('یادداشت');
    expect(reImported.body.tags).toEqual(['یک', 'دو']);
  });
});
