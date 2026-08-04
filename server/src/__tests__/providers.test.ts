import { describe, it, expect } from 'vitest';
import { buildEndpoint, buildHeaders, buildRequestBody, parseStreamChunk, parseNonStreamingResponse } from '../utils/providers';

describe('Providers Utility', () => {
  describe('buildEndpoint', () => {
    it('باید endpoint پیش‌فرض OpenAI رو برگردونه', () => {
      expect(buildEndpoint()).toBe('https://api.openai.com/v1/chat/completions');
      expect(buildEndpoint('')).toBe('https://api.openai.com/v1/chat/completions');
    });

    it('باید URL کامل رو حفظ کنه', () => {
      expect(buildEndpoint('http://localhost:11434/v1/chat/completions'))
        .toBe('http://localhost:11434/v1/chat/completions');
    });

    it('باید /v1/chat/completions رو اضافه کنه اگر نباشه', () => {
      expect(buildEndpoint('http://localhost:11434'))
        .toBe('http://localhost:11434/v1/chat/completions');
    });

    it('باید /v1/ رو به /chat/completions تبدیل کنه', () => {
      expect(buildEndpoint('http://localhost:11434/v1/'))
        .toBe('http://localhost:11434/v1/chat/completions');
    });

    it('باید trailing slash رو حذف کنه', () => {
      expect(buildEndpoint('http://localhost:11434/'))
        .toBe('http://localhost:11434/v1/chat/completions');
    });
  });

  describe('buildHeaders', () => {
    it('باید Content-Type رو برگردونه', () => {
      const headers = buildHeaders();
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('باید Authorization header اضافه کنه', () => {
      const headers = buildHeaders('sk-test-key');
      expect(headers['Authorization']).toBe('Bearer sk-test-key');
    });

    it('باید بدون API key Authorization نده', () => {
      const headers = buildHeaders();
      expect(headers['Authorization']).toBeUndefined();
    });
  });

  describe('buildRequestBody', () => {
    const messages = [
      { role: 'system' as const, content: 'تو یک دستیار هستی' },
      { role: 'user' as const, content: 'سلام' },
    ];

    it('باید body ساده بسازه', () => {
      const body = JSON.parse(buildRequestBody(messages, {
        model: 'gpt-4',
        temperature: 0.7,
        max_tokens: 1000,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
        stream: false,
        stop: [],
      }));

      expect(body.model).toBe('gpt-4');
      expect(body.messages).toHaveLength(2);
      expect(body.temperature).toBe(0.7);
      expect(body.stream).toBe(false);
    });

    it('باید stop keywords رو اضافه کنه', () => {
      const body = JSON.parse(buildRequestBody(messages, {
        model: 'gpt-4',
        temperature: 0.7,
        max_tokens: 1000,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
        stream: false,
        stop: ['\n', 'END'],
      }));

      expect(body.stop).toEqual(['\n', 'END']);
    });

    it('باید top_p رو فقط وقتی < 1 بفرسته', () => {
      const body1 = JSON.parse(buildRequestBody(messages, {
        model: 'gpt-4', temperature: 0.7, max_tokens: 1000,
        top_p: 1, frequency_penalty: 0, presence_penalty: 0,
        stream: false, stop: [],
      }));
      expect(body1.top_p).toBeUndefined();

      const body2 = JSON.parse(buildRequestBody(messages, {
        model: 'gpt-4', temperature: 0.7, max_tokens: 1000,
        top_p: 0.9, frequency_penalty: 0, presence_penalty: 0,
        stream: false, stop: [],
      }));
      expect(body2.top_p).toBe(0.9);
    });
  });

  describe('parseStreamChunk', () => {
    it('باید content از OpenAI format استخراج کنه', () => {
      const data = JSON.stringify({
        choices: [{ delta: { content: 'سلام' } }],
      });
      expect(parseStreamChunk(data)).toBe('سلام');
    });

    it('باید null برگردونه برای chunk خالی', () => {
      const data = JSON.stringify({
        choices: [{ delta: {} }],
      });
      expect(parseStreamChunk(data)).toBeNull();
    });

    it('باید null برگردونه برای data نامعتبر', () => {
      expect(parseStreamChunk('invalid')).toBeNull();
    });
  });

  describe('parseNonStreamingResponse', () => {
    it('باید content از OpenAI response استخراج کنه', () => {
      const data = {
        choices: [{ message: { content: 'جواب تست' } }],
      };
      expect(parseNonStreamingResponse(data)).toBe('جواب تست');
    });

    it('باید content مستقیم رو هم بخونه', () => {
      const data = { content: 'جواب مستقیم' };
      expect(parseNonStreamingResponse(data)).toBe('جواب مستقیم');
    });

    it('باید string خالی برگردونه وقتی چیزی نباشه', () => {
      expect(parseNonStreamingResponse({})).toBe('');
    });
  });
});
