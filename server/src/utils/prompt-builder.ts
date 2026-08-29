interface PromptPart {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Author's Note — دستورات سفارشی که در عمق مشخصی از تاریخچه تزریق می‌شوند
export interface AuthorsNote {
  content: string;
  // چند پیام از آخر فاصله داشته باشد (پیش‌فرض ۴)
  depth?: number;
  // after_char = بلافاصله بعد از بلوک کاراکتر | in_chat = داخل تاریخچه در depth مشخص
  position?: 'after_char' | 'in_chat';
}

interface RawWindowSettings {
  raw_mode: 'count' | 'tokens';
  raw_window: number;
  raw_token_budget: number;
  raw_min_messages: number;
  raw_max_messages: number;
}

interface BuildPromptOptions {
  impersonate?: boolean;
  continueMode?: boolean;
  chapters?: any[];
  rawWindow?: number;
  rawWindowSettings?: RawWindowSettings;
  authorsNote?: AuthorsNote;
  storyState?: {
    characters: Record<string, { location?: string; position?: string; clothing?: string }>;
    relationships: Record<string, string>;
    current_situation: string;
    rules: string[];
  };
}

// ─── Dynamic Raw Window Calculation (server-side) ───

function estimateTokensServer(text: string): number {
  if (!text) return 0;
  const asciiChars = (text.match(/[\x00-\x7F]/g) || []).length;
  const nonAsciiChars = text.length - asciiChars;
  return Math.ceil(asciiChars / 4) + Math.ceil(nonAsciiChars / 2);
}

function calculateDynamicRawWindow(messages: any[], settings: RawWindowSettings): number {
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

    const msgTokens = estimateTokensServer(messages[i].content || '');
    if (tokensUsed + msgTokens > budget && count >= minMsg) break;

    count++;
    tokensUsed += msgTokens;
  }

  return Math.max(count, Math.min(minMsg, messages.length));
}

const AUTHORS_NOTE_TAG = "[Author's Note]";

export function buildPrompt(
  character: any,
  persona: any,
  chatHistory: any[],
  lorebookEntries: any[],
  systemPrompt: string,
  options?: BuildPromptOptions
): PromptPart[] {
  const parts: PromptPart[] = [];

  // 1. System Prompt (global + character-specific)
  if (systemPrompt) {
    parts.push({ role: 'system', content: systemPrompt });
  }
  if (character.system_prompt) {
    parts.push({ role: 'system', content: character.system_prompt });
  }

  // Impersonate mode: instruct AI to write as the user
  if (options?.impersonate) {
    const userName = persona?.name || '{{user}}';
    parts.push({
      role: 'system',
      content: `[Special Instruction] You must write on behalf of the user "${userName}". Write the next reply from the user's perspective and in their role. Respect the user's personality, emotions, and speaking style. Write only one message as the user.`,
    });
  }

  // 2. Character info
  const charDesc = [
    `[Character Info]`,
    `Name: ${character.name}`,
    character.description && `Description: ${character.description}`,
    character.personality && `Personality: ${character.personality}`,
    character.scenario && `Scenario: ${character.scenario}`,
  ].filter(Boolean).join('\n');

  parts.push({ role: 'system', content: charDesc });

  // جایگاه Author's Note حالت after_char — بلافاصله بعد از بلوک کاراکتر ثبت می‌شود
  const note = options?.authorsNote;
  const hasNote = !!(note && note.content.trim());
  let afterCharIndex = -1;
  if (hasNote) {
    afterCharIndex = parts.length;
  }

  // 3. Example dialogues
  if (character.mes_example) {
    parts.push({
      role: 'system',
      content: `[Example Dialogues]\n${character.mes_example}`,
    });
  }

  // 4. لوربوک فعال شده
  if (lorebookEntries.length > 0) {
    const loreText = lorebookEntries
      .map(e => e.content)
      .join('\n');
    parts.push({
      role: 'system',
      content: `[World Info]\n${loreText}`,
    });
  }

  // 4.5 Story State (حافظه وضعیت داستان)
  const storyState = options?.storyState;
  if (storyState) {
    const stateParts: string[] = [];

    // Characters state
    const charEntries = Object.entries(storyState.characters || {});
    if (charEntries.length > 0) {
      const charText = charEntries.map(([name, state]) => {
        const details = [];
        if (state.location) details.push(`Location: ${state.location}`);
        if (state.position) details.push(`Position: ${state.position}`);
        if (state.clothing) details.push(`Clothing: ${state.clothing}`);
        return `${name}: ${details.join(', ') || 'Unknown'}`;
      }).join('\n');
      stateParts.push(`Characters:\n${charText}`);
    }

    // Relationships
    const relEntries = Object.entries(storyState.relationships || {});
    if (relEntries.length > 0) {
      const relText = relEntries.map(([pair, status]) => `- ${pair}: ${status}`).join('\n');
      stateParts.push(`Relationships:\n${relText}`);
    }

    // Relationship Details (emotions)
    const relDetailEntries = Object.entries((storyState as any).relationship_details || {});
    if (relDetailEntries.length > 0) {
      const detailText = relDetailEntries.map(([pair, detail]: [string, any]) => {
        const emotions = [];
        if (detail.anger !== undefined) emotions.push(`Anger: ${detail.anger}%`);
        if (detail.love !== undefined) emotions.push(`Love: ${detail.love}%`);
        if (detail.trust !== undefined) emotions.push(`Trust: ${detail.trust}%`);
        if (detail.fear !== undefined) emotions.push(`Fear: ${detail.fear}%`);
        if (detail.respect !== undefined) emotions.push(`Respect: ${detail.respect}%`);
        if (detail.gratitude !== undefined) emotions.push(`Gratitude: ${detail.gratitude}%`);
        if (detail.jealousy !== undefined) emotions.push(`Jealousy: ${detail.jealousy}%`);
        if (detail.shame !== undefined) emotions.push(`Shame: ${detail.shame}%`);
        if (detail.affection !== undefined) emotions.push(`Affection: ${detail.affection}%`);
        if (detail.summary) emotions.push(`Summary: ${detail.summary}`);
        return `- ${pair}: ${emotions.join(', ') || 'Neutral'}`;
      }).join('\n');
      stateParts.push(`Relationship Details:\n${detailText}`);
    }

    // Current situation
    if (storyState.current_situation) {
      stateParts.push(`Current Situation: ${storyState.current_situation}`);
    }

    // Rules
    if (storyState.rules && storyState.rules.length > 0) {
      const rulesText = storyState.rules.map(r => `- ${r}`).join('\n');
      stateParts.push(`Story Rules:\n${rulesText}`);
    }

    // Important Memories
    const memories = (storyState as any).memories || [];
    if (memories.length > 0) {
      const memoriesText = memories.map((m: any) => `- ${m.content}`).join('\n');
      stateParts.push(`Important Memories:\n${memoriesText}`);
    }

    if (stateParts.length > 0) {
      parts.push({
        role: 'system',
        content: `[Current Story State]\n${stateParts.join('\n\n')}`,
      });
    }
  }

  // 5. اطلاعات پرسونا
  if (persona) {
    parts.push({
      role: 'system',
      content: `[User Info]\nName: ${persona.name}\n${persona.description}`,
    });
  }

  // 6. تاریخچه چت (با در نظر گرفتن chapter summaries + raw window دینامیک)
  const historyParts: PromptPart[] = [];
  const chapters = options?.chapters || [];

  // Calculate effective raw window (dynamic or static)
  let effectiveRawWindow: number;
  if (options?.rawWindowSettings) {
    effectiveRawWindow = calculateDynamicRawWindow(chatHistory, options.rawWindowSettings);
  } else {
    effectiveRawWindow = options?.rawWindow || chatHistory.length;
  }

  const useChapters = chapters.length > 0 && effectiveRawWindow > 0 && chatHistory.length > effectiveRawWindow;

  if (useChapters) {
    const totalMessages = chatHistory.length;

    // Find the end of the last chapter to avoid losing uncovered messages
    let lastChapterEndIndex = -1;
    if (chapters.length > 0) {
      const lastChapter = chapters[chapters.length - 1];
      lastChapterEndIndex = chatHistory.findIndex((m: any) => m.id === lastChapter.end_message_id);
    }

    // Raw messages: everything after the last chapter
    // Messages after the last chapter have NOT been summarized, so they MUST all be sent.
    // The raw window only limits messages that are already covered by chapter summaries.
    const rawStartFromChapter = lastChapterEndIndex + 1;
    const rawMessagesAvailable = totalMessages - rawStartFromChapter;
    let rawStartIndex: number;

    if (rawMessagesAvailable <= 0) {
      // All messages are covered by chapters — use standard raw window
      rawStartIndex = Math.max(0, totalMessages - effectiveRawWindow);
    } else if (rawMessagesAvailable <= effectiveRawWindow) {
      // Few uncovered messages — send all of them (they're within budget)
      rawStartIndex = rawStartFromChapter;
    } else {
      // Many uncovered messages — apply raw window to limit context size
      rawStartIndex = Math.max(rawStartFromChapter, totalMessages - effectiveRawWindow);
    }

    // Insert chapter summaries sequentially (narrative format, one after another)
    // Each summary is plain text, no headers
    for (const chapter of chapters) {
      if (chapter.summary) {
        historyParts.push({
          role: 'system',
          content: `[Story so far]\n${chapter.summary}`,
        });
      }
    }

    // Insert raw messages (after last chapter, up to raw window limit)
    for (let i = rawStartIndex; i < totalMessages; i++) {
      const msg = chatHistory[i];
      historyParts.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    }
  } else {
    // No chapters or no raw window — send all messages as before
    for (const msg of chatHistory) {
      historyParts.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    }
  }

  // 7. Author's Note حالت in_chat — در depth پیام از انتهای تاریخچه تزریق می‌شود
  if (hasNote && (note!.position ?? 'in_chat') === 'in_chat') {
    const depth = Math.max(0, Math.min(note!.depth ?? 4, historyParts.length));
    const insertAt = historyParts.length - depth;
    historyParts.splice(insertAt, 0, {
      role: 'system',
      content: `${AUTHORS_NOTE_TAG}\n${note!.content.trim()}`,
    });
  }

  parts.push(...historyParts);

  // 8. Post-History Instructions (SillyTavern V2 spec)
  if (character.post_history_instructions) {
    parts.push({
      role: 'system',
      content: character.post_history_instructions,
    });
  }

  // تزریق after_char — روی index ثبت‌شده (بعد از بلوک کاراکتر، قبل از مثال‌ها)
  if (hasNote && (note!.position ?? 'in_chat') === 'after_char' && afterCharIndex !== -1) {
    parts.splice(afterCharIndex, 0, {
      role: 'system',
      content: `${AUTHORS_NOTE_TAG}\n${note!.content.trim()}`,
    });
  }

  // جایگزینی ماکروها
  return parts.map(p => ({
    ...p,
    content: replaceMacros(p.content, character?.name, persona?.name),
  }));
}

// Tool definition for update_story_state
export function getStoryStateToolDefinition(characterNames: string[]) {
  return {
    type: 'function',
    function: {
      name: 'update_story_state',
      description: `Update the current state of the roleplay. ONLY provide properties that CHANGED.

TRACK THESE:
1. characters - Location, position, clothing changes
2. relationships - "A-B": "description"  
3. relationship_details - "A-B": {love: 0-100, trust: 0-100, anger: 0-100, fear: 0-100, respect: 0-100, affection: 0-100, shame: 0-100, jealousy: 0-100, gratitude: 0-100, summary: "text"}
4. current_situation - What is happening RIGHT NOW (replace, don't append)
5. rules - Persistent world rules (only truly persistent facts)
6. memories - IMPORTANT events that may matter later (format: [{content: "event description", importance: "low|medium|high"}])

EXAMPLES:
- Character moves: {"characters": {"Alice": {"location": "Kitchen"}}}
- Emotions change: {"relationship_details": {"Alice-Bob": {"trust": 30, "anger": 70, "summary": "Bob is furious"}}}
- Important event: {"memories": [{"content": "User saved Elena from assassination", "importance": "high"}]}
- Multiple changes: {"characters": {"Alice": {"clothing": "torn dress"}}, "current_situation": "Alice confronts Bob", "relationship_details": {"Alice-Bob": {"love": 20, "anger": 90}}}`,
      parameters: {
        type: 'object',
        properties: {
          characters: {
            type: 'object',
            description: 'Character state changes. Key is character name.',
          },
          relationships: {
            type: 'object',
            description: 'Relationship status. Key: "CharA-CharB", Value: description string',
          },
          relationship_details: {
            type: 'object',
            description: 'Emotional state. Key: "CharA-CharB", Value: object with emotion scores 0-100',
          },
          current_situation: {
            type: 'string',
            description: 'What is happening right now (replace entirely)',
          },
          rules: {
            type: 'array',
            items: { type: 'string' },
            description: 'Persistent world/story rules',
          },
          memories: {
            type: 'array',
            items: { type: 'object' },
            description: 'Important events. Each: {content: "text", importance: "low|medium|high"}',
          },
        },
      },
    },
  };
}

function replaceMacros(text: string, charName?: string, userName?: string): string {
  let result = text;
  if (charName) {
    result = result.replace(/\{\{char\}\}/g, charName);
  }
  if (userName) {
    result = result.replace(/\{\{user\}\}/g, userName);
  }
  return result;
}

// ─── World Info Engine ───

// تخمین سبک توکن برای اعمال بودجه لوربوک (~۴ کاراکتر به‌ازای هر توکن)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// تطبیق یک کلید با متن — substring ساده یا regex بر اساس تنظیمات entry
function keyMatches(key: string, text: string, useRegex: boolean, caseSensitive: boolean): boolean {
  if (!key) return false;
  if (useRegex) {
    try {
      const flags = caseSensitive ? '' : 'i';
      return new RegExp(key, flags).test(text);
    } catch {
      // pattern نامعتبر → fallback به substring تا entry کلاً از دست نرود
    }
  }
  return caseSensitive
    ? text.includes(key)
    : text.toLowerCase().includes(key.toLowerCase());
}

export interface WorldInfoOptions {
  // تزریق‌شدنی برای تست قطعی — پیش‌فرض Math.random
  rng?: () => number;
}

export function activateWorldInfo(chatMessages: any[], lorebook: any, worldOpts?: WorldInfoOptions): any[] {
  if (!lorebook?.entries) return [];

  const scanDepth = lorebook.scan_depth || 50;
  const rng = worldOpts?.rng ?? Math.random;

  // بودجه توکن — undefined/نامعتبر یعنی بدون محدودیت (سازگار با رفتار قدیمی)
  const budget = typeof lorebook.token_budget === 'number' && lorebook.token_budget > 0
    ? lorebook.token_budget
    : Infinity;

  const recentMessages = chatMessages.slice(-scanDepth);
  const allText = recentMessages.map((m: any) => m.content).join(' ');

  const candidates: any[] = [];

  for (const entry of lorebook.entries) {
    if (entry.disable) continue;

    // احتمال فعال‌سازی (probability درصد) — شامل constant ها هم می‌شود
    const probability = typeof entry.probability === 'number'
      ? Math.min(100, Math.max(0, entry.probability))
      : 100;
    if (probability < 100 && rng() >= probability / 100) continue;

    if (!entry.constant) {
      const useRegex = !!entry.use_regex;
      const caseSensitive = !!entry.case_sensitive;

      const mainKeyFound = (entry.key || []).some((k: string) =>
        keyMatches(k, allText, useRegex, caseSensitive)
      );
      if (!mainKeyFound) continue;

      if (entry.selective) {
        const secondaryKeyFound = (entry.keysecondary || []).some((k: string) =>
          keyMatches(k, allText, useRegex, caseSensitive)
        );
        if (!secondaryKeyFound) continue;
      }
    }

    candidates.push(entry);
  }

  // اولویت‌بندی بر اساس insertion_order و اعمال بودجه توکن (greedy)
  candidates.sort((a: any, b: any) => a.insertion_order - b.insertion_order);

  const activeEntries: any[] = [];
  let usedTokens = 0;
  for (const entry of candidates) {
    const cost = estimateTokens(entry.content || '');
    if (usedTokens + cost <= budget) {
      activeEntries.push(entry);
      usedTokens += cost;
    }
  }

  return activeEntries;
}
