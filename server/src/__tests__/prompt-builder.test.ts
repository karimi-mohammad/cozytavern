import { describe, it, expect } from 'vitest';
import { buildPrompt, activateWorldInfo } from '../utils/prompt-builder';

describe('Prompt Builder', () => {
  describe('buildPrompt', () => {
    const character = {
      name: 'الیسا',
      description: 'دختر 25 ساله',
      personality: 'مهربان',
      scenario: 'در کافه',
      mes_example: '<START>\nالیسا: سلام\nکاربر: سلام\n<END>',
    };

    const persona = {
      name: 'محمد',
      description: 'برنامه‌نویس',
    };

    const chatHistory = [
      { role: 'user', content: 'سلام' },
      { role: 'assistant', content: 'سلام محمد! حالت چطوره؟' },
    ];

    it('باید prompt ساده بسازه', () => {
      const result = buildPrompt(character, null, chatHistory, [], '');

      expect(result.length).toBeGreaterThan(0);
      expect(result.some(p => p.content.includes('الیسا'))).toBe(true);
      expect(result.some(p => p.content.includes('سلام'))).toBe(true);
    });

    it('باید system prompt اضافه کنه', () => {
      const result = buildPrompt(character, null, chatHistory, [], 'دستورات مهم');
      expect(result[0].content).toBe('دستورات مهم');
    });

    it('باید اطلاعات پرسونا رو اضافه کنه', () => {
      const result = buildPrompt(character, persona, chatHistory, [], '');
      const personaPart = result.find(p => p.content.includes('محمد'));
      expect(personaPart).toBeDefined();
      expect(personaPart?.content).toContain('برنامه‌نویس');
    });

    it('باید ماکرو {{char}} رو جایگزین کنه', () => {
      const charWithMacro = { ...character, description: '{{char}} یک شخصیت است' };
      const result = buildPrompt(charWithMacro, null, chatHistory, [], '');
      const descPart = result.find(p => p.content.includes('الیسا'));
      expect(descPart?.content).toContain('الیسا');
      expect(descPart?.content).not.toContain('{{char}}');
    });

    it('باید مثال‌های دیالوگ رو اضافه کنه', () => {
      const result = buildPrompt(character, null, chatHistory, [], '');
      const examplePart = result.find(p => p.content.includes('Example Dialogues'));
      expect(examplePart).toBeDefined();
    });

    describe("Author's Note", () => {
      it('حالت in_chat باید در depth مشخص تزریق بشه', () => {
        const history = [
          { role: 'user', content: '۱' },
          { role: 'assistant', content: '۲' },
          { role: 'user', content: '۳' },
          { role: 'assistant', content: '۴' },
        ];
        const result = buildPrompt(character, null, history, [], '', {
          authorsNote: { content: 'نکته مهم', depth: 2, position: 'in_chat' },
        });

        // درج قبل از دو پیام آخر
        const noteIdx = result.findIndex(p => p.content.includes("[Author's Note]"));
        expect(noteIdx).toBeGreaterThan(-1);
        expect(result[noteIdx + 1].content).toBe('۳');
        expect(result[noteIdx + 2].content).toBe('۴');
      });

      it('depth بزرگ‌تر از طول تاریخچه باید اول تاریخچه درج بشه', () => {
        const result = buildPrompt(character, null, chatHistory, [], '', {
          authorsNote: { content: 'یادداشت', depth: 100 },
        });
        const noteIdx = result.findIndex(p => p.content.includes('یادداشت'));
        expect(noteIdx).toBeGreaterThan(-1);
        // اولین پیام تاریخچه بلافاصله بعد از یادداشت
        expect(result[noteIdx + 1].content).toBe('سلام');
      });

      it('حالت after_char باید بعد از بلوک کاراکتر و قبل از مثال‌ها باشه', () => {
        const result = buildPrompt(character, null, chatHistory, [], '', {
          authorsNote: { content: 'دستور نویسنده', position: 'after_char' },
        });

        const charIdx = result.findIndex(p => p.content.includes('[Character Info]'));
        const noteIdx = result.findIndex(p => p.content.includes('دستور نویسنده'));
        const exampleIdx = result.findIndex(p => p.content.includes('Example Dialogues'));

        expect(noteIdx).toBe(charIdx + 1);
        expect(noteIdx).toBeLessThan(exampleIdx);
      });

      it('محتوای خالی نباید چیزی اضافه کنه', () => {
        const result = buildPrompt(character, null, chatHistory, [], '', {
          authorsNote: { content: '   ' },
        });
        expect(result.some(p => p.content.includes("[Author's Note]"))).toBe(false);
      });

      it('ماکرو {{user}} در Author\'s Note جایگزین بشه', () => {
        const result = buildPrompt(character, persona, chatHistory, [], '', {
          authorsNote: { content: 'به {{user}} توجه کن' },
        });
        const notePart = result.find(p => p.content.includes('توجه کن'));
        expect(notePart?.content).toContain('محمد');
        expect(notePart?.content).not.toContain('{{user}}');
      });
    });
  });

  describe('activateWorldInfo', () => {
    it('باید entry های constant رو فعال کنه', () => {
      const entries = [{
        id: '1',
        key: ['چیزی'],
        content: 'همیشه فعال',
        constant: true,
        disable: false,
        selective: false,
        insertion_order: 100,
      }];

      const result = activateWorldInfo([], { entries, scan_depth: 50 });
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('همیشه فعال');
    });

    it('باید entry غیرفعال رو نادیده بگیره', () => {
      const entries = [{
        id: '1',
        key: ['سلام'],
        content: 'غیرفعال',
        constant: true,
        disable: true,
        selective: false,
        insertion_order: 100,
      }];

      const result = activateWorldInfo([], { entries, scan_depth: 50 });
      expect(result).toHaveLength(0);
    });

    it('باید key اصلی رو در پیام‌ها جستجو کنه', () => {
      const entries = [{
        id: '1',
        key: ['گربه'],
        content: 'اطلاعات گربه',
        constant: false,
        disable: false,
        selective: false,
        insertion_order: 100,
      }];

      const messages = [
        { content: 'من یک گربه دارم' },
        { content: 'اسمش میوئه' },
      ];

      const result = activateWorldInfo(messages, { entries, scan_depth: 50 });
      expect(result).toHaveLength(1);
    });

    it('باید key پیدا نشده رو فعال نکنه', () => {
      const entries = [{
        id: '1',
        key: ['سگ'],
        content: 'اطلاعات سگ',
        constant: false,
        disable: false,
        selective: false,
        insertion_order: 100,
      }];

      const messages = [
        { content: 'من یک گربه دارم' },
      ];

      const result = activateWorldInfo(messages, { entries, scan_depth: 50 });
      expect(result).toHaveLength(0);
    });

    it('باید scan_depth رو رعایت کنه', () => {
      const entries = [{
        id: '1',
        key: ['سلام'],
        content: 'جواب سلام',
        constant: false,
        disable: false,
        selective: false,
        insertion_order: 100,
      }];

      // فقط 2 پیام آخر رو اسکن کن - سلام در پیام اول هست
      const messages = [
        { content: 'سلام' },
        { content: 'چیز دیگه' },
        { content: 'چیز دیگه' },
      ];

      const result = activateWorldInfo(messages, { entries, scan_depth: 2 });
      expect(result).toHaveLength(0); // سلام خارج از scan_depth هست
    });

    it('باید selective entry رو بررسی کنه', () => {
      const entries = [{
        id: '1',
        key: ['گربه'],
        keysecondary: ['سیاه'],
        content: 'گربه سیاه',
        constant: false,
        disable: false,
        selective: true,
        insertion_order: 100,
      }];

      // فقط key اصلی موجوده
      const messages1 = [{ content: 'گربه دارم' }];
      expect(activateWorldInfo(messages1, { entries, scan_depth: 50 })).toHaveLength(0);

      // هر دو کلید موجوده
      const messages2 = [{ content: 'گربه سیاه دارم' }];
      expect(activateWorldInfo(messages2, { entries, scan_depth: 50 })).toHaveLength(1);
    });

    it('باید entries رو بر اساس insertion_order مرتب کنه', () => {
      const entries = [
        { id: '1', key: ['الف'], content: 'دوم', constant: false, disable: false, selective: false, insertion_order: 200 },
        { id: '2', key: ['الف'], content: 'اول', constant: false, disable: false, selective: false, insertion_order: 100 },
      ];

      const messages = [{ content: 'الف' }];
      const result = activateWorldInfo(messages, { entries, scan_depth: 50 });

      expect(result[0].content).toBe('اول');
      expect(result[1].content).toBe('دوم');
    });

    it('case-insensitive باشه', () => {
      const entries = [{
        id: '1',
        key: ['hello'],
        content: 'جواب',
        constant: false,
        disable: false,
        selective: false,
        insertion_order: 100,
      }];

      const messages = [{ content: 'HELLO world' }];
      const result = activateWorldInfo(messages, { entries, scan_depth: 50 });
      expect(result).toHaveLength(1);
    });

    describe('موتور پیشرفته', () => {
      it('case_sensitive باید به بزرگی/کوچکی حروف حساس باشه', () => {
        const entries = [{
          id: '1',
          key: ['Hello'],
          content: 'محتوا',
          constant: false,
          disable: false,
          selective: false,
          insertion_order: 100,
          case_sensitive: true,
        }];

        // حروف کوچک → پیدا نشود
        expect(activateWorldInfo(
          [{ content: 'hello world' }],
          { entries, scan_depth: 50 },
        )).toHaveLength(0);

        // دقیقاً Hello → پیدا شود
        expect(activateWorldInfo(
          [{ content: 'say Hello world' }],
          { entries, scan_depth: 50 },
        )).toHaveLength(1);
      });

      it('use_regex باید کلید را به‌عنوان regex تفسیر کنه', () => {
        const entries = [{
          id: '1',
          key: ['\\d{4}-\\d{2}-\\d{2}'],
          content: 'فرمت تاریخ',
          constant: false,
          disable: false,
          selective: false,
          insertion_order: 100,
          use_regex: true,
        }];

        expect(activateWorldInfo(
          [{ content: 'امروز 1403-05-21 است' }],
          { entries, scan_depth: 50 },
        )).toHaveLength(1);

        expect(activateWorldInfo(
          [{ content: 'بدون تاریخ' }],
          { entries, scan_depth: 50 },
        )).toHaveLength(0);
      });

      it('regex نامعتبر نباید crash کنه (fallback به substring)', () => {
        const entries = [{
          id: '1',
          key: ['[invalid('],
          content: 'محتوا',
          constant: false,
          disable: false,
          selective: false,
          insertion_order: 100,
          use_regex: true,
        }];

        expect(() => activateWorldInfo(
          [{ content: 'متن با [invalid( داخلش' }],
          { entries, scan_depth: 50 },
        )).not.toThrow();
      });

      it('probability صفر هیچ‌وقت و صد همیشه فعال بشه', () => {
        const makeEntries = (p: number) => [{
          id: '1',
          key: ['کلید'],
          content: 'محتوا',
          constant: false,
          disable: false,
          selective: false,
          insertion_order: 100,
          probability: p,
        }];
        const messages = [{ content: 'کلید هست' }];

        expect(activateWorldInfo(messages, { entries: makeEntries(0), scan_depth: 50 })).toHaveLength(0);
        expect(activateWorldInfo(messages, { entries: makeEntries(100), scan_depth: 50 })).toHaveLength(1);
      });

      it('probability با rng قطعی قابل کنترله', () => {
        const entries = [{
          id: '1',
          key: ['کلید'],
          content: 'محتوا',
          constant: false,
          disable: false,
          selective: false,
          insertion_order: 100,
          probability: 50,
        }];
        const messages = [{ content: 'کلید' }];

        // rng همیشه زیر آستانه → فعال
        expect(activateWorldInfo(messages, { entries, scan_depth: 50 }, { rng: () => 0.1 })).toHaveLength(1);
        // rng بالای آستانه → غیرفعال
        expect(activateWorldInfo(messages, { entries, scan_depth: 50 }, { rng: () => 0.9 })).toHaveLength(0);
      });

      it('token_budget باید entryهای کم‌اولویت را حذف کنه', () => {
        // هر entry حدوداً ۵۰ توکن (۲۰۰ کاراکتر)
        const longContent = 'x'.repeat(200);
        const entries = [
          { id: '1', key: ['الف'], content: longContent, constant: false, disable: false, selective: false, insertion_order: 100 },
          { id: '2', key: ['الف'], content: longContent, constant: false, disable: false, selective: false, insertion_order: 200 },
        ];

        // بودجه فقط برای یکی کافی است
        const result = activateWorldInfo([{ content: 'الف' }], { entries, scan_depth: 50, token_budget: 60 });
        expect(result).toHaveLength(1);
        // اولویت‌دار (insertion_order پایین‌تر) حفظ شده
        expect(result[0].id).toBe('1');

        // بدون بودجه هر دو فعال می‌مانند (سازگاری با رفتار قبلی)
        expect(activateWorldInfo([{ content: 'الف' }], { entries, scan_depth: 50 })).toHaveLength(2);
      });
    });
  });
});
