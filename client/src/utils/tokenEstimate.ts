import { Message, Character, Persona, ApiSettings, Chapter } from '../types';

// Heuristic token estimation (cl100k_base-like)
function heuristicTokens(text: string): number {
  if (!text) return 0;
  const asciiChars = (text.match(/[\x00-\x7F]/g) || []).length;
  const nonAsciiChars = text.length - asciiChars;
  return Math.ceil(asciiChars / 4) + Math.ceil(nonAsciiChars / 2);
}

/**
 * Estimate token count for text.
 * Uses heuristic estimation (~4 chars per token for ASCII, ~2 for non-ASCII).
 */
export async function estimateTokensAsync(text: string): Promise<number> {
  return heuristicTokens(text);
}

/**
 * Sync version - uses heuristic estimation.
 */
export function estimateTokens(text: string): number {
  return heuristicTokens(text);
}

// ─── Dynamic Raw Window ───

export interface RawWindowSettings {
  raw_mode: 'count' | 'tokens';
  raw_window: number;           // used when raw_mode = 'count'
  raw_token_budget: number;     // used when raw_mode = 'tokens'
  raw_min_messages: number;
  raw_max_messages: number;
}

/**
 * Calculate how many recent messages should be sent as raw (not summarized).
 * In 'count' mode: uses raw_window directly.
 * In 'tokens' mode: adds messages from the end until token budget is reached.
 */
export function calculateDynamicRawWindow(
  messages: Message[],
  settings: RawWindowSettings,
): number {
  if (settings.raw_mode === 'count') {
    return Math.min(settings.raw_window, messages.length);
  }

  // Token mode: walk from the end, accumulate tokens
  const budget = settings.raw_token_budget;
  const minMsg = settings.raw_min_messages;
  const maxMsg = settings.raw_max_messages;

  let count = 0;
  let tokensUsed = 0;

  for (let i = messages.length - 1; i >= 0; i--) {
    if (count >= maxMsg) break;

    const msgTokens = estimateTokens(messages[i].content);
    if (tokensUsed + msgTokens > budget && count >= minMsg) break;

    count++;
    tokensUsed += msgTokens;
  }

  return Math.max(count, Math.min(minMsg, messages.length));
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
    chapters: number;
    history: number;
    overhead: number;
  };
}

export function estimateContextUsage(
  messages: Message[],
  settings: ApiSettings | undefined,
  character: Character | null,
  persona: Persona | null,
  lorebookEntries: { content: string }[],
  chapters?: Chapter[],
  rawWindowSettings?: Partial<RawWindowSettings>,
): ContextUsage {
  // اگر max_context توسط کاربر تنظیم شده باشه، از اون استفاده کن
  // در غیر این صورت از مقدار hardcoded بر اساس نام مدل استفاده کن
  const max = (settings?.max_context && settings.max_context > 0)
    ? settings.max_context
    : getMaxContext(settings?.model || '');

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

  // Calculate effective raw window
  const effectiveRawWindow = rawWindowSettings
    ? calculateDynamicRawWindow(messages, {
        raw_mode: rawWindowSettings.raw_mode || 'count',
        raw_window: rawWindowSettings.raw_window || 10,
        raw_token_budget: rawWindowSettings.raw_token_budget || 3000,
        raw_min_messages: rawWindowSettings.raw_min_messages || 3,
        raw_max_messages: rawWindowSettings.raw_max_messages || 20,
      })
    : messages.length;

  // Chapter summaries vs raw messages
  let chapterTokens = 0;
  let historyTokens = 0;
  let rawMessageCount = 0;

  if (chapters && chapters.length > 0 && effectiveRawWindow > 0 && effectiveRawWindow < messages.length) {
    // Chapter summaries are sent instead of their covered messages
    // Narrative format: just the summary text, no headers
    chapterTokens = chapters.reduce((sum, c) => {
      return sum + estimateTokens(c.summary || '');
    }, 0);

    // Find the end of the last chapter to avoid losing uncovered messages
    let lastChapterEndIndex = -1;
    if (chapters.length > 0) {
      const lastChapter = chapters[chapters.length - 1];
      lastChapterEndIndex = messages.findIndex((m: any) => m.id === lastChapter.end_message_id);
    }

    // Raw messages: everything after the last chapter
    // Messages after the last chapter have NOT been summarized, so they MUST all be sent.
    // The raw window only limits messages that are already covered by chapter summaries.
    const rawStartFromChapter = lastChapterEndIndex + 1;
    const rawMessagesAvailable = messages.length - rawStartFromChapter;
    let rawStartIndex: number;

    if (rawMessagesAvailable <= 0) {
      // All messages are covered by chapters — use standard raw window
      rawStartIndex = Math.max(0, messages.length - effectiveRawWindow);
    } else {
      // Uncovered messages exist — send ALL of them (no chapter summary for these!)
      rawStartIndex = rawStartFromChapter;
    }

    // Only raw window messages are sent
    for (let i = rawStartIndex; i < messages.length; i++) {
      historyTokens += estimateTokens(messages[i].content);
    }

    // Overhead: role labels, formatting, API overhead (~4 tokens per message)
    rawMessageCount = messages.length - rawStartIndex;
  } else {
    // No chapters — all messages are raw
    historyTokens = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
    rawMessageCount = messages.length;
  }

  // Overhead: role labels, formatting, API overhead (~4 tokens per message)
  const overhead = rawMessageCount * 4 + 10;

  const used = systemTokens + characterTokens + lorebookTokens + personaTokens + chapterTokens + historyTokens + overhead;
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
      chapters: chapterTokens,
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
