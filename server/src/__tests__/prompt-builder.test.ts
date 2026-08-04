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
      const examplePart = result.find(p => p.content.includes('مثال'));
      expect(examplePart).toBeDefined();
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
  });
});
