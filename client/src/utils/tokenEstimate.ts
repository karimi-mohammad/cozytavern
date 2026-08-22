import { Message, Character, Persona, ApiSettings } from '../types';

// تخمین توکن: ~4 کاراکتر برای انگلیسی، ~2 کاراکتر برای فارسی/عربی
function estimateTokens(text: string): number {
  if (!text) return 0;
  // کاراکترهای ASCII (انگلیسی)
  const asciiChars = (text.match(/[\x00-\x7F]/g) || []).length;
  // کاراکترهای غیرASCII (فارسی، عربی، چینی، ...)
  const nonAsciiChars = text.length - asciiChars;
  return Math.ceil(asciiChars / 4) + Math.ceil(nonAsciiChars / 2);
}

// حداکثر context بر اساس مدل
function getMaxContext(model: string): number {
  const modelLower = (model || '').toLowerCase();
  if (modelLower.includes('gpt-4o')) return 128000;
  if (modelLower.includes('gpt-4-turbo')) return 128000;
  if (modelLower.includes('gpt-4')) return 8192;
  if (modelLower.includes('gpt-3.5')) return 16385;
  if (modelLower.includes('claude-3')) return 200000;
  if (modelLower.includes('claude')) return 100000;
  if (modelLower.includes('gemini')) return 1000000;
  if (modelLower.includes('llama-3')) return 8192;
  if (modelLower.includes('llama')) return 4096;
  if (modelLower.includes('mistral')) return 32768;
  if (modelLower.includes('deepseek')) return 65536;
  if (modelLower.includes('qwen')) return 32768;
  // پیش‌فرض: 8k
  return 8192;
}

export interface ContextUsage {
  used: number;
  max: number;
  percentage: number;
  breakdown: {
    system: number;
    character: number;
    lorebook: number;
    persona: number;
    history: number;
    overhead: number;
  };
}

export function estimateContextUsage(
  messages: Message[],
  settings: ApiSettings | undefined,
  character: Character | null,
  persona: Persona | null,
  lorebookEntries: { content: string }[]
): ContextUsage {
  const max = getMaxContext(settings?.model || '');

  // System prompt
  const systemTokens = estimateTokens(settings?.system_prompt || '');

  // Character info
  let characterTokens = 0;
  if (character) {
    characterTokens += estimateTokens(`[اطلاعات کاراکتر]\nنام: ${character.name}`);
    characterTokens += estimateTokens(character.description);
    characterTokens += estimateTokens(character.personality);
    characterTokens += estimateTokens(character.scenario);
    characterTokens += estimateTokens(character.mes_example);
  }

  // Lorebook entries
  const lorebookTokens = lorebookEntries.reduce((sum, e) => sum + estimateTokens(e.content), 0);

  // Persona info
  const personaTokens = persona
    ? estimateTokens(`[اطلاعات کاربر]\nنام: ${persona.name}\n${persona.description}`)
    : 0;

  // Chat history
  const historyTokens = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);

  // Overhead: role labels, formatting, API overhead (~4 tokens per message)
  const overhead = messages.length * 4 + 10;

  const used = systemTokens + characterTokens + lorebookTokens + personaTokens + historyTokens + overhead;
  const percentage = Math.min(100, Math.round((used / max) * 100));

  return {
    used,
    max,
    percentage,
    breakdown: {
      system: systemTokens,
      character: characterTokens,
      lorebook: lorebookTokens,
      persona: personaTokens,
      history: historyTokens,
      overhead,
    },
  };
}

export function formatTokenCount(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
  return tokens.toString();
}
