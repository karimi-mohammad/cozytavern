import { Message, Character, Persona, ApiSettings, Chapter, StoryState, Chat, ChatParticipant } from '../types';
import { countTokens } from './tokenCounter';

// ─── Re-export token counter functions ───
export { countTokens as estimateTokens, countTokens as estimateTokensAsync } from './tokenCounter';
export { initTokenizer } from './tokenCounter';
export { improvedHeuristic, isTiktokenReady } from './tokenCounter';

// ─── Types ───

export interface RawWindowSettings {
  raw_mode: 'count' | 'tokens';
  raw_window: number;
  raw_token_budget: number;
  raw_min_messages: number;
  raw_max_messages: number;
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
    storyState: number;
    authorsNote: number;
    postHistory: number;
    toolInstruction: number;
    toolDefinition: number;
    groupChatRules: number;
  };
}

// ─── Dynamic Raw Window ───

/**
 * Calculate how many recent messages should be sent as raw (not summarized).
 * In 'count' mode: uses raw_window directly.
 * In 'tokens' mode: adds messages from the end until token budget is reached.
 */
export function calculateDynamicRawWindow(
  messages: Message[],
  settings: RawWindowSettings,
  model?: string,
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

    const msgTokens = countTokens(messages[i].content || '', model);
    if (tokensUsed + msgTokens > budget && count >= minMsg) break;

    count++;
    tokensUsed += msgTokens;
  }

  return Math.max(count, Math.min(minMsg, messages.length));
}

// ─── Context Window Detection ───

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

// ─── Prompt Component Estimation (replicates server prompt-builder.ts) ───

/**
 * Macro replacement — مطابق server/src/utils/prompt-builder.ts:403-406
 */
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

/**
 * تخمین توکن‌های Character Info block — مطابق سرور.
 * server prompt-builder.ts:122-130
 *
 * [Character Info]
 * Name: {name}
 * Description: {desc}
 * Personality: {personality}
 * Scenario: {scenario}
 *
 * ⚠️ IMPORTANT: When using update_story_state tool...
 */
function estimateCharacterBlockTokens(character: Character, model?: string): number {
  const charDesc = [
    `[Character Info]`,
    `Name: ${character.name}`,
    character.description && `Description: ${character.description}`,
    character.personality && `Personality: ${character.personality}`,
    character.scenario && `Scenario: ${character.scenario}`,
    `\n⚠️ IMPORTANT: When using update_story_state tool, character names MUST be EXACTLY "${character.name}". NO variations, NO translations, NO duplicates.`,
  ].filter(Boolean).join('\n');

  return countTokens(charDesc, model);
}

/**
 * تخمین توکن‌های Story State block — مطابق سرور.
 * server prompt-builder.ts:161-264
 */
function estimateStoryStateTokens(
  storyState: StoryState | null | undefined,
  model?: string,
): number {
  if (!storyState) return 0;

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

  // Relationship Details
  const relDetailEntries = Object.entries(storyState.relationship_details || {});
  if (relDetailEntries.length > 0) {
    const detailText = relDetailEntries.map(([pair, detail]) => {
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
  if (storyState.memories && storyState.memories.length > 0) {
    const memoriesText = storyState.memories.map(m => `- ${m.content}`).join('\n');
    stateParts.push(`Important Memories:\n${memoriesText}`);
  }

  if (stateParts.length === 0) return 0;

  const fullText = `[Current Story State]\n${stateParts.join('\n\n')}`;
  return countTokens(fullText, model);
}

/**
 * تخمین توکن‌های Group Chat Identity Rules — مطابق سرور.
 * server app.ts:370-382
 */
function estimateGroupChatRulesTokens(
  characterName: string,
  participants: Array<{ char_name?: string; display_name?: string }>,
  model?: string,
): number {
  const otherChars = participants
    .filter(p => p.char_name && p.char_name !== characterName)
    .map(p => `- ${p.display_name || p.char_name}`);

  const text = `[Group Chat — Character Identity Rules]

You are responding as "${characterName}" ONLY.
- Write ONLY one message as ${characterName}
- NEVER write messages for other characters
- NEVER describe other characters' actions or thoughts
- Use ${characterName}'s established personality, speech patterns, and knowledge
- If you need another character to speak, STOP and let the system handle it
- IMPORTANT: When using update_story_state tool, character names MUST be EXACTLY as provided: [${participants.map(p => p.char_name).filter(Boolean).join(', ')}]

[Other Characters Present]
${otherChars.join('\n')}

Note: You do NOT know other characters' inner thoughts or feelings unless they tell you.`;

  return countTokens(text, model);
}

/**
 * تخمین توکن‌های MANDATORY TOOL USE instruction — مطابق سرور.
 * server app.ts:409-412
 */
function estimateMandatoryToolUseTokens(model?: string): number {
  const text = `[MANDATORY TOOL USE]
You MUST call update_story_state in EVERY response. Track ALL of these:

1. CHARACTERS: location, position, clothing changes
2. RELATIONSHIPS: "A-B": "description"
3. RELATIONSHIP_DETAILS: Emotions 0-100 scale
   - love, trust, anger, fear, respect, affection, shame, jealousy, gratitude
   - summary: brief emotional state description
4. CURRENT_SITUATION: What is happening NOW
5. RULES: Persistent world rules
6. MEMORIES: Important events that matter later
   Format: [{content: "event", importance: "high|medium|low"}]

MEMORY EXAMPLES:
- "User saved Elena from assassination" (high)
- "Elena learned User is a mage" (high)
- "User promised to return before sunrise" (medium)

ALWAYS call the tool, even if only one thing changes. This is REQUIRED.`;

  return countTokens(text, model);
}

/**
 * تخمین توکن‌های Tool Definition JSON — مطابق سرور.
 * server prompt-builder.ts:410-468
 *
 * این JSON schema در body درخواست API فرستاده میشه و توکن‌هاش حساب میشه.
 */
function estimateToolDefinitionTokens(characterNames: string[], model?: string): number {
  const description = `Update the current state of the roleplay. ONLY provide properties that CHANGED.

⚠️ CRITICAL RULE: Character names MUST be EXACTLY as listed below. NO variations, NO translations, NO duplicates.
ALLOWED NAMES: [${characterNames.map(n => `"${n}"`).join(', ')}]

TRACK THESE:
1. characters - Location, position, clothing changes (USE EXACT NAMES FROM LIST ABOVE)
2. relationships - "A-B": "description" (USE EXACT NAMES FROM LIST ABOVE)
3. relationship_details - "A-B": {love: 0-100, trust: 0-100, anger: 0-100, fear: 0-100, respect: 0-100, affection: 0-100, shame: 0-100, jealousy: 0-100, gratitude: 0-100, summary: "text"}
4. current_situation - What is happening RIGHT NOW (replace, don't append)
5. rules - Persistent world rules (only truly persistent facts)
6. memories - IMPORTANT events that may matter later (format: [{content: "event description", importance: "low|medium|high"}])`;

  // Tool name + description + parameter schema
  const toolJson = JSON.stringify({
    type: 'function',
    function: {
      name: 'update_story_state',
      description,
      parameters: {
        type: 'object',
        properties: {
          characters: { type: 'object' },
          relationships: { type: 'object' },
          relationship_details: { type: 'object' },
          current_situation: { type: 'string' },
          rules: { type: 'array', items: { type: 'string' } },
          memories: { type: 'array', items: { type: 'object' } },
        },
      },
    },
  });

  return countTokens(toolJson, model);
}

/**
 * تخمین توکن‌های Author's Note — مطابق سرور.
 * server prompt-builder.ts:375-382, 395-399
 */
function estimateAuthorsNoteTokens(note: string, model?: string): number {
  if (!note || !note.trim()) return 0;
  const text = `[Author's Note]\n${note.trim()}`;
  return countTokens(text, model);
}

/**
 * تخمین توکن‌های Post-History Instructions — مطابق سرور.
 * server prompt-builder.ts:387-390
 */
function estimatePostHistoryTokens(instructions: string, model?: string): number {
  if (!instructions) return 0;
  return countTokens(instructions, model);
}

/**
 * Macro replacement for character name and user name
 */
function applyMacros(text: string, charName?: string, userName?: string): string {
  let result = text;
  if (charName) result = result.replace(/\{\{char\}\}/g, charName);
  if (userName) result = result.replace(/\{\{user\}\}/g, userName);
  return result;
}

// ─── Main Context Estimation ───

export function estimateContextUsage(
  messages: Message[],
  settings: ApiSettings | undefined,
  character: Character | null,
  persona: Persona | null,
  lorebookEntries: { content: string }[],
  chapters?: Chapter[],
  rawWindowSettings?: Partial<RawWindowSettings>,
  // پارامترهای جدید برای تخمین دقیق‌تر
  storyState?: StoryState | null,
  chat?: Chat | null,
  isGroupChat?: boolean,
  participants?: ChatParticipant[],
  twoPhaseEnabled?: boolean,
): ContextUsage {
  const model = settings?.model || '';
  const charName = character?.name;
  const userName = persona?.name;

  // اگر max_context توسط کاربر تنظیم شده باشه، از اون استفاده کن
  const max = (settings?.max_context && settings.max_context > 0)
    ? settings.max_context
    : getMaxContext(model);

  // ─── 1. System Prompt ───
  const systemTokens = countTokens(settings?.system_prompt || '', model);

  // ─── 2. Character System Prompt (additional system prompt from character) ───
  const charSystemPromptTokens = countTokens(character?.system_prompt || '', model);

  // ─── 3. Character Info Block (replicates server format exactly) ───
  const characterTokens = estimateCharacterBlockTokens(character!, model);

  // ─── 4. Example Dialogues ───
  const exampleDialogueTokens = character?.mes_example
    ? countTokens(`[Example Dialogues]\n${character.mes_example}`, model)
    : 0;

  // ─── 5. Lorebook / World Info ───
  const lorebookTokens = lorebookEntries.reduce(
    (sum, e) => sum + countTokens(e.content || '', model), 0
  );
  // World Info header overhead
  const lorebookHeaderTokens = lorebookEntries.length > 0
    ? countTokens('[World Info]\n', model)
    : 0;

  // ─── 6. Story State ───
  const storyStateTokens = estimateStoryStateTokens(storyState, model);

  // ─── 7. Persona / User Info ───
  const personaTokens = persona
    ? countTokens(`[User Info]\nName: ${persona.name}\n${persona.description}`, model)
    : 0;

  // ─── 8. Author's Note ───
  const authorsNoteTokens = estimateAuthorsNoteTokens(chat?.authors_note || '', model);

  // ─── 9. Post-History Instructions ───
  const postHistoryTokens = estimatePostHistoryTokens(
    character?.post_history_instructions || '', model
  );

  // ─── 10. Tool Definition + Instruction (non-two-phase only) ───
  const isToolMode = !twoPhaseEnabled;
  const characterNames = isGroupChat && participants
    ? [character!.name, ...participants
        .filter(p => p.char_name && p.char_name !== character!.name)
        .map(p => p.char_name!)]
    : [character!.name];

  const toolDefinitionTokens = isToolMode
    ? estimateToolDefinitionTokens(characterNames, model)
    : 0;
  const toolInstructionTokens = isToolMode
    ? estimateMandatoryToolUseTokens(model)
    : 0;

  // ─── 11. Group Chat Rules ───
  const groupChatRulesTokens = isGroupChat && participants
    ? estimateGroupChatRulesTokens(character!.name, participants, model)
    : 0;

  // ─── 12. Chat History (with chapters + raw window) ───
  const effectiveRawWindow = rawWindowSettings
    ? calculateDynamicRawWindow(messages, {
        raw_mode: rawWindowSettings.raw_mode || 'count',
        raw_window: rawWindowSettings.raw_window || 10,
        raw_token_budget: rawWindowSettings.raw_token_budget || 3000,
        raw_min_messages: rawWindowSettings.raw_min_messages || 3,
        raw_max_messages: rawWindowSettings.raw_max_messages || 20,
      }, model)
    : messages.length;

  const useChapters = chapters && chapters.length > 0
    && effectiveRawWindow > 0
    && effectiveRawWindow < messages.length;

  let chapterTokens = 0;
  let historyTokens = 0;
  let rawMessageCount = 0;

  if (useChapters) {
    // Chapter summaries — هر کدوم با header [Story so far]
    chapterTokens = chapters.reduce((sum, c) => {
      const summaryText = c.summary || '';
      const headerTokens = countTokens('[Story so far]\n', model);
      return sum + headerTokens + countTokens(summaryText, model);
    }, 0);

    // پیدا کردن انتهای آخرین chapter
    let lastChapterEndIndex = -1;
    if (chapters.length > 0) {
      const lastChapter = chapters[chapters.length - 1];
      lastChapterEndIndex = messages.findIndex(m => m.id === lastChapter.end_message_id);
    }

    const rawStartFromChapter = lastChapterEndIndex + 1;
    const rawMessagesAvailable = messages.length - rawStartFromChapter;
    let rawStartIndex: number;

    if (rawMessagesAvailable <= 0) {
      rawStartIndex = Math.max(0, messages.length - effectiveRawWindow);
    } else {
      rawStartIndex = rawStartFromChapter;
    }

    for (let i = rawStartIndex; i < messages.length; i++) {
      const msg = messages[i];
      let content = msg.content || '';
      // Group chat: add sender name prefix (replicates server formatGroupMessage)
      if (isGroupChat && msg.sender_name) {
        content = `${msg.sender_name}:\n${content}`;
      }
      historyTokens += countTokens(content, model);
    }
    rawMessageCount = messages.length - rawStartIndex;
  } else {
    // بدون chapter — همه پیام‌ها raw
    for (const msg of messages) {
      let content = msg.content || '';
      if (isGroupChat && msg.sender_name) {
        content = `${msg.sender_name}:\n${content}`;
      }
      historyTokens += countTokens(content, model);
    }
    rawMessageCount = messages.length;
  }

  // ─── 13. Overhead (بهبودیافته) ───
  // هر پیام (system/user/assistant) ~9 توکن overhead: role + JSON structure
  // + framing overhead برای کل request body
  const totalParts = 1 // system_prompt
    + (character?.system_prompt ? 1 : 0)
    + 1 // character info
    + (character?.mes_example ? 1 : 0)
    + (lorebookEntries.length > 0 ? 1 : 0)
    + (storyStateTokens > 0 ? 1 : 0)
    + (persona ? 1 : 0)
    + (authorsNoteTokens > 0 ? 1 : 0)
    + rawMessageCount
    + (chapters?.length || 0)
    + (postHistoryTokens > 0 ? 1 : 0)
    + (isGroupChat ? 1 : 0)
    + (isToolMode ? 1 : 0);

  const overhead = totalParts * 9 + 20; // framing overhead

  // ─── Total ───
  const used = systemTokens
    + charSystemPromptTokens
    + characterTokens
    + exampleDialogueTokens
    + lorebookTokens + lorebookHeaderTokens
    + storyStateTokens
    + personaTokens
    + authorsNoteTokens
    + postHistoryTokens
    + toolDefinitionTokens
    + toolInstructionTokens
    + groupChatRulesTokens
    + chapterTokens
    + historyTokens
    + overhead;

  const percentage = Math.min(100, Math.round((used / max) * 100));

  return {
    used,
    max,
    percentage,
    breakdown: {
      system: systemTokens + charSystemPromptTokens,
      character: characterTokens + exampleDialogueTokens,
      lorebook: lorebookTokens + lorebookHeaderTokens,
      persona: personaTokens,
      chapters: chapterTokens,
      history: historyTokens,
      overhead,
      storyState: storyStateTokens,
      authorsNote: authorsNoteTokens,
      postHistory: postHistoryTokens,
      toolInstruction: toolInstructionTokens,
      toolDefinition: toolDefinitionTokens,
      groupChatRules: groupChatRulesTokens,
    },
  };
}

export function formatTokenCount(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
  return tokens.toString();
}
