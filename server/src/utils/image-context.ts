// ─── Image Context Building ───
// ساخت کانتکست از چت و کاراکتر برای تولید تصویر

export interface ImageContextOptions {
  includeCharacterCard?: boolean;
  includeSummary?: boolean;
  includePersona?: boolean;
  includeWorldInfo?: boolean;
  includeLastUserMessage?: boolean;
  includeLastAssistantMessage?: boolean;
  includeChatHistory?: boolean;
  historyCount?: number;
  includeStoryState?: boolean;
}

const DEFAULT_OPTIONS: ImageContextOptions = {
  includeCharacterCard: true,
  includeSummary: true,
  includePersona: true,
  includeWorldInfo: true,
  includeLastUserMessage: true,
  includeLastAssistantMessage: true,
  includeChatHistory: false,
  historyCount: 10,
  includeStoryState: true,
};

/**
 * حذف بخش think از متن پیام
 * <think>...</think> را حذف می‌کند
 */
function stripThinkBlocks(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

/**
 * ساخت کانتکست از چت برای تولید تصویر صحنه
 */
export function buildImageContext(
  chat: any[],
  character: any,
  persona?: any,
  lorebookEntries?: any[],
  storyState?: any,
  options: ImageContextOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const parts: string[] = [];

  // کارت کاراکتر (بدون سناریو)
  if (opts.includeCharacterCard && character) {
    const cardParts: string[] = [];
    if (character.name) cardParts.push(`Name: ${character.name}`);
    if (character.description) cardParts.push(`Description: ${character.description}`);
    if (character.personality) cardParts.push(`Personality: ${character.personality}`);

    if (cardParts.length > 0) {
      parts.push(`Character Card\n${cardParts.join('\n')}`);
    }
  }

  // پرسونا (اگر وجود داشته باشد)
  if (opts.includePersona && persona) {
    const personaParts: string[] = [];
    if (persona.name) personaParts.push(`Name: ${persona.name}`);
    if (persona.description) personaParts.push(`Description: ${persona.description}`);
    if (persona.personality) personaParts.push(`Personality: ${persona.personality}`);
    if (persona.mes) personaParts.push(`Message Style: ${persona.mes}`);

    if (personaParts.length > 0) {
      parts.push(`Persona\n${personaParts.join('\n')}`);
    }
  }

  // لوربوک‌ها (World Info)
  if (opts.includeWorldInfo && lorebookEntries && lorebookEntries.length > 0) {
    const entries = lorebookEntries.map(entry => {
      const keys = Array.isArray(entry.keys) ? entry.keys.join(', ') : entry.keys;
      const content = entry.content;
      const comment = entry.comment ? ` (${entry.comment})` : '';
      return `[${keys}]${comment}: ${content}`;
    });

    if (entries.length > 0) {
      parts.push(`World Info / Lorebook\n${entries.join('\n')}`);
    }
  }

  // State داستان (اگر وجود داشته باشد)
  if (opts.includeStoryState && storyState) {
    const stateParts: string[] = [];

    // کاراکترها
    if (storyState.characters && Object.keys(storyState.characters).length > 0) {
      const charText = Object.entries(storyState.characters).map(([name, state]: [string, any]) => {
        const details: string[] = [];
        if (state.location) details.push(`Location: ${state.location}`);
        if (state.position) details.push(`Position: ${state.position}`);
        if (state.clothing) details.push(`Clothing: ${state.clothing}`);
        return `- ${name}: ${details.join(', ') || 'No details'}`;
      }).join('\n');
      stateParts.push(`Characters:\n${charText}`);
    }

    // روابط
    if (storyState.relationships && Object.keys(storyState.relationships).length > 0) {
      const relText = Object.entries(storyState.relationships).map(([pair, status]) => `- ${pair}: ${status}`).join('\n');
      stateParts.push(`Relationships:\n${relText}`);
    }

    // جزئیات عاطفی
    if (storyState.relationship_details && Object.keys(storyState.relationship_details).length > 0) {
      const detailText = Object.entries(storyState.relationship_details).map(([pair, detail]: [string, any]) => {
        const emotions = [];
        if (detail.love !== undefined) emotions.push(`love: ${detail.love}`);
        if (detail.trust !== undefined) emotions.push(`trust: ${detail.trust}`);
        if (detail.anger !== undefined) emotions.push(`anger: ${detail.anger}`);
        if (detail.fear !== undefined) emotions.push(`fear: ${detail.fear}`);
        if (detail.summary) emotions.push(`summary: ${detail.summary}`);
        return `- ${pair}: ${emotions.join(', ')}`;
      }).join('\n');
      stateParts.push(`Emotional State:\n${detailText}`);
    }

    // وضعیت فعلی
    if (storyState.current_situation) {
      stateParts.push(`Current Situation: ${storyState.current_situation}`);
    }

    // قوانین داستان
    if (storyState.rules && storyState.rules.length > 0) {
      stateParts.push(`Story Rules:\n${storyState.rules.map((r: string) => `- ${r}`).join('\n')}`);
    }

    // خاطرات مهم
    if (storyState.memories && storyState.memories.length > 0) {
      const memText = storyState.memories.map((m: any) => `- ${m.content}`).join('\n');
      stateParts.push(`Important Memories:\n${memText}`);
    }

    if (stateParts.length > 0) {
      parts.push(`Current Story State\n${stateParts.join('\n\n')}`);
    }
  }

  // ۱۰ پیام اخیر (بدون بخش think)
  const lastMessages = chat.slice(-opts.historyCount!);
  if (lastMessages.length > 0) {
    const history = lastMessages.map(msg => {
      const name = msg.sender_name || msg.name || (msg.role === 'user' ? 'User' : 'Assistant');
      const rawText = msg.content || msg.mes || msg.message || msg.text || '';
      const text = stripThinkBlocks(rawText);
      return text ? `${name}: ${text}` : null;
    }).filter(Boolean);

    if (history.length > 0) {
      parts.push(`Recent Messages (Last ${opts.historyCount})\n${history.join('\n')}`);
    }
  }

  return parts.join('\n\n');
}

/**
 * ساخت کانتکست از کاراکتر برای تولید پرتره
 */
export function buildPortraitContext(
  character: any,
  extras?: string
): string {
  const parts: string[] = [];

  if (character.name) parts.push(`Name: ${character.name}`);
  if (character.description) parts.push(`Description: ${character.description}`);
  if (character.personality) parts.push(`Personality: ${character.personality}`);

  // استخراج ویژگی‌های بصری از توضیحات
  const visualCues = extractVisualCues(character.description || '');
  if (visualCues.length > 0) {
    parts.push(`Visual features: ${visualCues.join(', ')}`);
  }

  if (extras) parts.push(`Additional: ${extras}`);

  return parts.join('\n');
}

/**
 * استخراج ویژگی‌های بصری از توضیحات کاراکتر
 */
function extractVisualCues(description: string): string[] {
  const cues: string[] = [];

  // مو
  const hairMatch = description.match(/(silver|blonde|brown|black|red|white|blue|green|pink|golden|dark|light) (hair|locks|braids|curls)/i);
  if (hairMatch) cues.push(hairMatch[0]);

  // چشم
  const eyeMatch = description.match(/(emerald|blue|green|brown|amber|red|violet|gold|gray|grey|hazel) (eyes|gaze)/i);
  if (eyeMatch) cues.push(eyeMatch[0]);

  // ویژگی‌های خاص
  const featurePatterns = [
    /scar (across|on|over)/i,
    /tattoo(s)?/i,
    /beard/i,
    /mustache/i,
    /pointed ears/i,
    /horns/i,
    /wings/i,
    /tail/i,
    /armor/i,
    /cloak/i,
    /robe(s)?/i,
    /sword/i,
    /staff/i,
    /bow/i,
  ];
  
  for (const pattern of featurePatterns) {
    const match = description.match(pattern);
    if (match) cues.push(match[0]);
  }

  return [...new Set(cues)]; // حذف duplicate ها
}

/**
 * ساخت کانتکست از چند کاراکتر (برای group chat)
 */
export function buildGroupPortraitContext(
  characters: any[],
  primaryCharacterId?: string
): string {
  const parts: string[] = [];

  for (const char of characters) {
    const isPrimary = char.id === primaryCharacterId;
    const prefix = isPrimary ? '[PRIMARY] ' : '';
    
    const charParts: string[] = [];
    if (char.name) charParts.push(`Name: ${char.name}`);
    if (char.description) charParts.push(`Description: ${char.description}`);
    
    if (charParts.length > 0) {
      parts.push(`${prefix}${charParts.join(', ')}`);
    }
  }

  return parts.join('\n\n');
}
