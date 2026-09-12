import express, { Request, Response } from 'express';
import cors from 'cors';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import { initDb } from './db';
import charactersRouter from './routes/characters';
import chatsRouter from './routes/chats';
import messagesRouter from './routes/messages';
import apiSettingsRouter from './routes/api-settings';
import personasRouter from './routes/personas';
import lorebooksRouter from './routes/lorebooks';
import chaptersRouter from './routes/chapters';
import groupChatsRouter from './routes/group-chats';
import pluginsRouter from './routes/plugins';
import backupRouter from './routes/backup';
import storyStateRouter from './routes/story-state';
import storyAdvisorRouter from './routes/story-advisor';
import characterWizardRouter from './routes/character-wizard';
import chatNotesRouter from './routes/chat-notes';
import scenesRouter from './routes/scenes';
import portraitsRouter from './routes/portraits';
import imageProfilesRouter from './routes/image-profiles';
import imagePresetsRouter from './routes/image-presets';
import { getChapterSettingsCompat } from './utils/plugin-store';
import { buildEndpoint, buildHeaders, buildRequestBody, createLineBuffer, parseStreamChunkFull, parseNonStreamingResponse } from './utils/providers';
import { buildPrompt, activateWorldInfo, getStoryStateToolDefinition, getStateExtractionPrompt } from './utils/prompt-builder';
import { stripToolCallsFromContent } from './utils/strip-tool-calls';
import { parseToolCallsFromText } from './utils/parse-tool-calls-from-text';
import { getDb } from './db';
import { v4 as uuidv4 } from 'uuid';
import { createChatDebugger, ChatDebugContext } from './utils/chat-debug-logger';

// Debug log helper — only logs when DEBUG_CHAT=true
const _DEBUG = process.env.DEBUG_CHAT === 'true' || process.env.DEBUG_CHAT === '1';
function _log(...args: any[]) { if (_DEBUG) console.log(...args); }
function _err(...args: any[]) { if (_DEBUG) console.error(...args); }

// Extract state from text response (fallback when tool calling is not available)
function extractStateFromText(text: string, characterName: string): any {
  const state: any = {
    characters: {},
    relationships: {},
    current_situation: '',
    rules: [],
  };

  // Extract location patterns
  const locationPatterns = [
    new RegExp(`${characterName}\\s+(?:goes?|moves?|walks?|enters?|leaves?|arrives?|is\\s+(?:in|at|on))\\s+(?:the\\s+)?([\\w\\s]+?)(?:\\.|,|!|\\?|$)`, 'i'),
    new RegExp(`${characterName}(?:'s)?\\s+location\\s+(?:is|was|becomes?)\\s+(?:the\\s+)?([\\w\\s]+?)(?:\\.|,|!|\\?|$)`, 'i'),
    /(?:location|place|room):\s*([^\n.]+)/i,
  ];

  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match) {
      state.characters[characterName] = {
        ...(state.characters[characterName] || {}),
        location: match[1].trim(),
      };
      break;
    }
  }

  // Extract clothing patterns
  const clothingPatterns = [
    new RegExp(`${characterName}\\s+(?:wears?|puts?\\s+on|is\\s+wearing|dressed\\s+(?:in|as))\\s+(?:a\\s+)?([\\w\\s]+?)(?:\\.|,|!|\\?|$)`, 'i'),
    new RegExp(`${characterName}(?:'s)?\\s+clothing\\s+(?:is|was|becomes?)\\s+([\\w\\s]+?)(?:\\.|,|!|\\?|$)`, 'i'),
    /(?:clothing|outfit|wear|dressed):\s*([^\n.]+)/i,
  ];

  for (const pattern of clothingPatterns) {
    const match = text.match(pattern);
    if (match) {
      state.characters[characterName] = {
        ...(state.characters[characterName] || {}),
        clothing: match[1].trim(),
      };
      break;
    }
  }

  // Extract position patterns
  const positionPatterns = [
    new RegExp(`${characterName}\\s+(?:sits?|stands?|lies?|kneels?|falls?|sleeps?)\\s+(?:on|in|at|near|beside|next to|behind|in front of)\\s+(?:the\\s+)?([\\w\\s]+?)(?:\\.|,|!|\\?|$)`, 'i'),
    new RegExp(`${characterName}(?:'s)?\\s+position\\s+(?:is|was|becomes?)\\s+([\\w\\s]+?)(?:\\.|,|!|\\?|$)`, 'i'),
    /(?:position|posture|stance):\s*([^\n.]+)/i,
  ];

  for (const pattern of positionPatterns) {
    const match = text.match(pattern);
    if (match) {
      state.characters[characterName] = {
        ...(state.characters[characterName] || {}),
        position: match[1].trim(),
      };
      break;
    }
  }

  // Only return state if we found something
  if (Object.keys(state.characters[characterName] || {}).length > 0) {
    return state;
  }

  return null;
}


// Deep merge for story state
function deepMergeState(target: any, source: any): any {
  if (!source || typeof source !== 'object') return target;
  if (!target || typeof target !== 'object') return source;

  const result = { ...target };

  for (const key of Object.keys(source)) {
    if (source[key] === null || source[key] === undefined) {
      continue;
    }

    if (typeof source[key] === 'object' && !Array.isArray(source[key]) && source[key] !== null) {
      result[key] = deepMergeState(result[key] || {}, source[key]);
    } else if (key === 'rules' && !Array.isArray(source[key])) {
      // rules must always be an array — skip non-array values from AI
      continue;
    } else if (key === 'memories' && !Array.isArray(source[key])) {
      // memories must always be an array — skip non-array values from AI
      continue;
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

const app = express();

// رجیستری پاسخ‌های streaming فعال — کلید: message_id
const activeStreams = new Map<string, AbortController>();

// مطمئن شدن از وجود پوشه data
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// مقداردهی دیتابیس
initDb();

// Middleware
app.use(cors());
// فشرده‌سازی gzip — اما SSE (text/event-stream) را مستثنا کن تا استریم توکن‌به‌توکن کار کند
app.use(compression({
  filter: (req: Request, res: Response) => {
    const contentType = res.getHeader('Content-Type');
    if (contentType && typeof contentType === 'string' && contentType.includes('text/event-stream')) {
      return false; // SSE responses should NOT be compressed — compression buffers the stream
    }
    return compression.filter(req, res);
  },
}));
app.use(express.json({ limit: '10mb' }));

// API Routes
app.use('/api/characters', charactersRouter);
app.use('/api/chats', chatsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/api-settings', apiSettingsRouter);
app.use('/api/personas', personasRouter);
app.use('/api/lorebooks', lorebooksRouter);
app.use('/api/chapters', chaptersRouter);
app.use('/api/group-chats', groupChatsRouter);
app.use('/api/plugins', pluginsRouter);
app.use('/api/backup', backupRouter);
app.use('/api/story-state', storyStateRouter);
app.use('/api/story-advisor', storyAdvisorRouter);
app.use('/api/character-wizard', characterWizardRouter);
app.use('/api/chat-notes', chatNotesRouter);
app.use('/api/scenes', scenesRouter);
app.use('/api/portraits', portraitsRouter);
app.use('/api/image-profiles', imageProfilesRouter);
app.use('/api/image-presets', imagePresetsRouter);

// Serve static files in production (client build)
const clientDistPath = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  // SPA fallback - serve index.html for non-API routes
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(clientDistPath, 'index.html'));
    }
  });
}

// Chat API endpoint (ارسال پیام به AI با streaming)
app.post('/api/chat', async (req, res) => {
  const { chat_id, character_id, persona_id, lorebook_id, update_message_id, continue_mode, impersonate, edited_messages, skip_generate } = req.body;

  // ─── Debug Logger ───
  const _reqId = uuidv4().slice(0, 8);
  const _debugCtx: ChatDebugContext = {
    requestId: _reqId,
    chatId: chat_id,
    characterId: character_id,
    twoPhaseEnabled: false, // will be set later
    streamEnabled: false,   // will be set later
  };
  const dbg = createChatDebugger(_debugCtx);

  const db = getDb();
  let character = db.prepare('SELECT * FROM characters WHERE id = ?').get(character_id) as any;
  const persona = persona_id ? db.prepare('SELECT * FROM personas WHERE id = ?').get(persona_id) as any : null;
  const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(chat_id) as any;
  const messages = db.prepare('SELECT * FROM messages WHERE chat_id = ? ORDER BY rowid ASC').all(chat_id) as any[];

  if (!character) {
    res.status(400).json({ error: 'Character not found' });
    return;
  }
  if (!chat) {
    res.status(400).json({ error: 'Chat not found' });
    return;
  }
  if (persona_id && !persona) {
    res.status(400).json({ error: 'Persona not found' });
    return;
  }

  // دریافت تنظیمات API
  const settings = db.prepare("SELECT * FROM api_settings ORDER BY ROWID DESC LIMIT 1").get() as any;
  if (!settings) {
    res.status(400).json({ error: 'API settings not found. Please configure the API first.' });
    return;
  }

  // دریافت Story State (حافظه وضعیت داستان)
  const storyStateRow = db.prepare('SELECT * FROM chat_story_state WHERE chat_id = ?').get(chat_id) as any;
  let storyState = {
    characters: {},
    relationships: {},
    current_situation: '',
    rules: [],
  };
  if (storyStateRow) {
    try {
      storyState = JSON.parse(storyStateRow.state_json);
    } catch {}
  }

  // لوربوک‌ها (پشتیبانی از چند لور بوک به ازای هر چت)
  // اولویت: lorebook_id مستقیم > chat_lorebooks > lorebook_id چت قدیمی > لینک کاراکتر
  let lorebookEntries: any[] = [];

  // جمع‌آوری تمام lorebook_id های فعال
  const lorebookIdsToLoad: string[] = [];

  if (lorebook_id) {
    // lorebook_id مستقیم از request (مثلاً group chat)
    lorebookIdsToLoad.push(lorebook_id);
  } else {
    // دریافت از chat_lorebooks (جدول جدید)
    const chatLorebooks = db.prepare(
      'SELECT cl.lorebook_id, cl.is_active FROM chat_lorebooks cl WHERE cl.chat_id = ? ORDER BY cl.insertion_order ASC'
    ).all(chat_id) as any[];

    for (const cl of chatLorebooks) {
      if (cl.is_active) {
        lorebookIdsToLoad.push(cl.lorebook_id);
      }
    }

    // fallback: اگر chat_lorebooks خالی باشد، از lorebook_id قدیمی چت استفاده کن
    if (lorebookIdsToLoad.length === 0 && chat?.lorebook_id) {
      lorebookIdsToLoad.push(chat.lorebook_id);
    }

    // fallback: لوربوک کاراکتر
    if (lorebookIdsToLoad.length === 0 && character?.lorebook_id) {
      lorebookIdsToLoad.push(character.lorebook_id);
    }
  }

  // بارگذاری و ادغام entries از تمام لوربوک‌های فعال
  const allLoadedLorebooks: any[] = [];
  for (const lbId of lorebookIdsToLoad) {
    const lorebook = db.prepare('SELECT * FROM lorebooks WHERE id = ?').get(lbId) as any;
    if (lorebook) {
      const entries = db.prepare('SELECT * FROM lorebook_entries WHERE lorebook_id = ?').all(lbId).map((e: any) => ({
        ...e,
        key: JSON.parse(e.keys || '[]'),
        keysecondary: JSON.parse(e.keys_secondary || '[]'),
        constant: !!e.constant,
        selective: !!e.selective,
        disable: !!e.disable,
      }));
      const activated = activateWorldInfo(messages, { ...lorebook, entries });
      lorebookEntries.push(...activated);
      allLoadedLorebooks.push({ id: lbId, name: lorebook.name, token_budget: lorebook.token_budget });
    }
  }

  // حذف duplicate entries بر اساس id (اگر چند لوربوک entry یکسانی داشته باشند)
  const seenIds = new Set<string>();
  lorebookEntries = lorebookEntries.filter((e: any) => {
    if (seenIds.has(e.id)) return false;
    seenIds.add(e.id);
    return true;
  });

  // ساخت prompt (با در نظر گرفتن chapter summaries + raw window دینامیک)
  const chapters = db.prepare('SELECT * FROM chapters WHERE chat_id = ? ORDER BY created_at ASC').all(chat_id) as any[];
  const chapterSettings = getChapterSettingsCompat(db);

  // فیلتر کردن پیام‌ها برای regenerate: حذف محتوای قدیمی پیام آخر assistant
  let filteredMessages = messages;
  if (update_message_id && !continue_mode) {
    // در حالت regenerate، محتوای پیام هدف رو خالی کن تا AI محتوای قدیمی رو نبینه
    filteredMessages = messages.map(m =>
      m.id === update_message_id ? { ...m, content: '' } : m
    );

    // Rollback state به snapshot قبل از پیامی که داریم regenerate می‌کنیم
    _log(`[StoryState] Regenerating message ${update_message_id}, rolling back state...`);
    const snapshotToRestore = db.prepare(
      'SELECT * FROM chat_state_snapshots WHERE chat_id = ? AND message_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(chat_id, update_message_id) as any;

    if (snapshotToRestore) {
      _log(`[StoryState] Found snapshot, restoring state...`);
      db.prepare('UPDATE chat_story_state SET state_json = ?, updated_at = ? WHERE chat_id = ?')
        .run(snapshotToRestore.state_json, new Date().toISOString(), chat_id);
    } else {
      _log(`[StoryState] No snapshot found for this message`);
    }
  }

  // Check if this is a group chat and get participants if so
  const isGroupChat = !!chat?.is_group_chat;
  let participants: Array<{ char_name?: string; display_name?: string }> = [];
  if (isGroupChat) {
    participants = db.prepare(
      'SELECT cp.*, c.name as char_name, c.description as char_desc, c.personality as char_personality FROM chat_participants cp JOIN characters c ON cp.character_id = c.id WHERE cp.chat_id = ? AND cp.is_active = 1'
    ).all(chat_id) as any[];
  }

  const promptParts = buildPrompt(character, persona, filteredMessages, lorebookEntries, settings.system_prompt || '', {
    impersonate: !!impersonate,
    continueMode: !!continue_mode,
    chapters,
    storyState,
    rawWindowSettings: {
      raw_mode: chapterSettings?.raw_mode || 'count',
      raw_window: chapterSettings?.raw_window || 10,
      raw_token_budget: chapterSettings?.raw_token_budget || 3000,
      raw_min_messages: chapterSettings?.raw_min_messages || 3,
      raw_max_messages: chapterSettings?.raw_max_messages || 20,
    },
    // Author's Note چت — در صورت وجود محتوا تزریق می‌شود
    ...(chat?.authors_note && {
      authorsNote: {
        content: chat.authors_note,
        depth: typeof chat.authors_note_depth === 'number' ? chat.authors_note_depth : 4,
        position: chat.authors_note_position === 'after_char' ? 'after_char' as const : 'in_chat' as const,
      },
    }),
    // Group chat support
    isGroupChat,
    participants,
    respondingCharacterName: character.name,
    // حذف blok‌های think از تاریخچه پیام‌ها
    stripThink: !!settings.strip_think,
  });

  // Add enhanced identity enforcement for group chat
  if (isGroupChat) {
    const otherParticipants = (participants as any[]).filter(p => p.char_name !== character.name);
    const otherCharsInfo = otherParticipants.length > 0
      ? `\n\n[Other Characters Present]\n${otherParticipants.map(p =>
          `- ${p.char_name}`
        ).join('\n')}\n\nNote: You do NOT know other characters' inner thoughts or feelings unless they tell you.`
      : '';

    promptParts.push({
      role: 'system',
      content: `[Group Chat — Character Identity Rules]

You are responding as "${character.name}" ONLY.
- Write ONLY one message as ${character.name}
- NEVER write messages for other characters
- NEVER describe other characters' actions or thoughts
- Use ${character.name}'s established personality, speech patterns, and knowledge
- If you need another character to speak, STOP and let the system handle it
- IMPORTANT: When using update_story_state tool, character names MUST be EXACTLY as provided: [${participants.map(p => `"${p.char_name}"`).join(', ')}]${otherCharsInfo}`,
    });
  }

  try {
    const endpoint = buildEndpoint(settings.base_url);
    const headers = buildHeaders(settings.api_key);

    // اگر کاربر پیام‌ها را ویرایش کرده باشد، به جای promptParts ساخته‌شده از DB از آن‌ها استفاده می‌شود
    const effectiveParts = edited_messages && Array.isArray(edited_messages) && edited_messages.length > 0
      ? edited_messages.map((m: any) => ({ role: m.role, content: m.content }))
      : promptParts;

    // ابزار update_story_state - get ALL character names (current + participants in group chat)
    const characterNames = isGroupChat
      ? [character.name, ...participants.filter(p => p.char_name && p.char_name !== character.name).map(p => p.char_name!)]
      : [character.name];
    const storyStateTool = getStoryStateToolDefinition(characterNames);
    _log(`[StoryState] Tool definition for characters:`, JSON.stringify(characterNames));
    _log(`[StoryState] Story state in prompt:`, storyState ? 'YES' : 'NO');
    if (storyState) {
      _log(`[StoryState] Current state:`, JSON.stringify(storyState).slice(0, 500));
    }

    // Two-phase mode: separate text generation from tool calls
    // Use == for robust comparison (handles 1, true, "1" from SQLite/frontend)
    const twoPhaseEnabled = !!settings.two_phase_state_update;
    _debugCtx.twoPhaseEnabled = twoPhaseEnabled;
    _debugCtx.streamEnabled = !!settings.stream;
    dbg.start();
    dbg.params({
      chat_id, character_id, persona_id: persona_id || 'none',
      update_message_id: update_message_id || 'none',
      continue_mode: !!continue_mode, impersonate: !!impersonate,
      model: settings.model, stream: !!settings.stream,
      two_phase_state_update: twoPhaseEnabled,
      messages_count: messages.length,
    });
    _log(`[StoryState] Two-phase mode: ${twoPhaseEnabled ? 'ENABLED' : 'DISABLED'} (raw value: ${settings.two_phase_state_update})`);

    // اضافه کردن دستور استفاده از tool به انتهای پرامپت (فقط در حالت غیر two-phase)
    const toolInstruction = {
      role: 'system' as const,
      content: `[MANDATORY TOOL USE]\nYou MUST call update_story_state in EVERY response. Track ALL of these:\n\n1. CHARACTERS: location, position, clothing changes\n2. RELATIONSHIPS: "A-B": "description"\n3. RELATIONSHIP_DETAILS: Emotions 0-100 scale\n   - love, trust, anger, fear, respect, affection, shame, jealousy, gratitude\n   - summary: brief emotional state description\n4. CURRENT_SITUATION: What is happening NOW\n5. RULES: Persistent world rules\n6. MEMORIES: Important events that matter later\n   Format: [{content: "event", importance: "high|medium|low"}]\n\nMEMORY EXAMPLES:\n- "User saved Elena from assassination" (high)\n- "Elena learned User is a mage" (high)\n- "User promised to return before sunrise" (medium)\n\nALWAYS call the tool, even if only one thing changes. This is REQUIRED.`,
    };

    // Phase 1: Build request body (text only in two-phase mode, with tools otherwise)
    const requestBody = buildRequestBody(
      twoPhaseEnabled ? effectiveParts : [...effectiveParts, toolInstruction],
      {
        model: settings.model,
        temperature: settings.temperature,
        max_tokens: settings.max_tokens,
        top_p: settings.top_p,
        frequency_penalty: settings.frequency_penalty,
        presence_penalty: settings.presence_penalty,
        stream: !!settings.stream,
        stop: JSON.parse(settings.stop || '[]'),
        tools: twoPhaseEnabled ? undefined : [storyStateTool],
        tool_choice: twoPhaseEnabled ? undefined : 'auto',
        reasoning_effort: settings.reasoning_effort || undefined,
      }
    );

    dbg.phase1Request(endpoint, requestBody.slice(0, 400));

    // حالت بازرسی (Prompt Inspector): فقط ساخت payload، بدون فراخوانی LLM و بدون تغییر دیتابیس
    if (req.body?.inspect) {
      const parsed = JSON.parse(requestBody);
      const { model, messages, ...params } = parsed;
      return res.json({
        inspect: true,
        source: 'chat',
        mode: update_message_id
          ? (continue_mode ? 'continue' : 'regenerate')
          : impersonate ? 'impersonate' : 'send',
        endpoint,
        model,
        params,
        messages,
        two_phase_enabled: twoPhaseEnabled,
      });
    }

    // حالت skip_generate: فقط ذخیره پیام user بدون تولید پاسخ (برای group chat)
    if (skip_generate) {
      return res.json({ skip_generate: true });
    }

    const controller = new AbortController();

    // ─── Streaming: set SSE headers BEFORE fetch so errors can be sent as SSE events ───
    if (settings.stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: requestBody,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      _err(`LLM API error ${response.status}:`, errorText.slice(0, 200));
      dbg.error('phase1-response', new Error(`API ${response.status}: ${errorText.slice(0, 200)}`));
      if (settings.stream && res.headersSent) {
        // Headers already sent as SSE — send error as SSE event
        res.write(`data: ${JSON.stringify({ error: `API error: ${response.status}: ${errorText}` })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        res.status(response.status).json({ error: `API error: ${errorText}` });
      }
      return;
    }

    if (settings.stream) {
      // ─── Streaming response ───
      dbg.phase1Response(response.status, response.ok);
      // ایجاد یا بروزرسانی پیام — AFTER successful fetch
      let msgId: string;
      const now = new Date().toISOString();
      const msgRole = impersonate ? 'user' : 'assistant';
      if (update_message_id) {
        msgId = update_message_id;
        db.prepare('UPDATE messages SET content = ? WHERE id = ?').run('', msgId);
      } else {
        msgId = uuidv4();
        db.prepare(`
          INSERT INTO messages (id, chat_id, role, content, swipes, swipe_id, is_edited, is_system, send_date)
          VALUES (?, ?, ?, '', '[]', 0, 0, 0, ?)
        `).run(msgId, chat_id, msgRole, now);
      }
      res.write(`data: ${JSON.stringify({ message_id: msgId })}\n\n`);
      dbg.messageSaved(msgId, msgRole, 0); // content is empty at this point

      // لغو فعال: کاربر از طریق /api/chat/abort
      const streamController = new AbortController();
      activeStreams.set(msgId, streamController);
      res.on('close', () => {
        dbg.resLifecycle('close', `activeStreams.size=${activeStreams.size}`);
        streamController.abort();
        activeStreams.delete(msgId);
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let streamAborted = false;
      let toolCalls: any[] = [];
      // API usage data — استخراج از آخرین chunk streaming
      let streamUsage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null = null;

      dbg.streamStart();

      if (reader) {
        try {
          const lineBuffer = createLineBuffer();
          let done = false;
          let inThinking = false;

          // ارسال token به client با مدیریت تگ‌های thinking
          const sendToken = (token: string, isReasoning: boolean) => {
            if (isReasoning) {
              if (!inThinking) {
                inThinking = true;
                fullContent += '<think>';
                res.write(`data: ${JSON.stringify({ token: '<think>' })}\n\n`);
              }
            } else {
              if (inThinking) {
                inThinking = false;
                fullContent += '</think>';
                res.write(`data: ${JSON.stringify({ token: '</think>' })}\n\n`);
              }
            }
            fullContent += token;
            res.write(`data: ${JSON.stringify({ token })}\n\n`);
          };

          // Tool calls collection
          let currentToolCall: any = null;
          let chunkCount = 0;

          const processChunk = (rawData: string) => {
            chunkCount++;
            try {
              const parsed = JSON.parse(rawData);
              // استخراج usage data از آخرین chunk (بعضی API ها اینجا برمیگردونن)
              if (parsed.usage) {
                streamUsage = {
                  prompt_tokens: parsed.usage.prompt_tokens,
                  completion_tokens: parsed.usage.completion_tokens,
                  total_tokens: parsed.usage.total_tokens,
                };
              }
              const delta = parsed.choices?.[0]?.delta;

              // Debug logging for first few chunks
              if (chunkCount <= 3) {
                _log(`[StoryState] Chunk ${chunkCount}:`, JSON.stringify(delta).slice(0, 300));
              }

              // Check for tool calls
              if (delta?.tool_calls) {
                _log(`[StoryState] Tool call detected in chunk ${chunkCount}`);
                for (const tc of delta.tool_calls) {
                  if (tc.index !== undefined) {
                    // New tool call or continuation
                    if (!toolCalls[tc.index]) {
                      toolCalls[tc.index] = {
                        id: tc.id || '',
                        type: 'function',
                        function: {
                          name: tc.function?.name || '',
                          arguments: tc.function?.arguments || '',
                        },
                      };
                    } else {
                      // Append to existing tool call
                      if (tc.id) toolCalls[tc.index].id = tc.id;
                      if (tc.function?.name) toolCalls[tc.index].function.name += tc.function.name;
                      if (tc.function?.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments;
                    }
                  }
                }
                return; // Don't send tool call tokens to client
              }

              // Regular content tokens
              const parsed2 = parseStreamChunkFull(rawData);
              if (parsed2) sendToken(parsed2.token, parsed2.isReasoning);
            } catch {
              // Fallback to simple parsing
              const parsed = parseStreamChunkFull(rawData);
              if (parsed) sendToken(parsed.token, parsed.isReasoning);
            }
          };

          while (!done) {
            const { done: streamDone, value } = await (reader as any).read();
            if (streamDone) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = lineBuffer.push(chunk);
            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith('data: ')) {
                const data = trimmed.slice(6);
                if (data === '[DONE]') {
                  done = true;
                  break;
                }
                processChunk(data);
              }
            }
            // Break outer loop if done
            if (done) break;
          }
          if (inThinking) {
            fullContent += '</think>';
            res.write(`data: ${JSON.stringify({ token: '</think>' })}\n\n`);
          }
          // پردازش باقیمانده buffer
          const remaining = lineBuffer.flush();
          for (const line of remaining) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
              const data = trimmed.slice(6);
              if (data !== '[DONE]') {
                processChunk(data);
              }
            }
          }
          if (inThinking) {
            fullContent += '</think>';
            res.write(`data: ${JSON.stringify({ token: '</think>' })}\n\n`);
          }
        } catch (streamError: any) {
          if (streamError?.name === 'AbortError') {
            streamAborted = true;
          } else {
            _err('Stream error:', streamError);
          }
        }
      }

      dbg.streamEnd(fullContent.length, toolCalls.length, streamAborted);

      // بروزرسانی محتوای پیام
      if (fullContent) {
        // محتوا داریم — ذخیره کن
        // نکته: fullContent بعد از پردازش tool call‌های متنی strip میشه (در انتهای این بلوک)
        db.prepare('UPDATE messages SET content = ? WHERE id = ?').run(fullContent, msgId);
        // اگر ریجنریت بود، محتوای جدید رو به swipes اضافه کن و swipe_id رو درست کن
        if (update_message_id) {
          const msg = db.prepare('SELECT swipes FROM messages WHERE id = ?').get(msgId) as any;
          if (msg) {
            const swipes = JSON.parse(msg.swipes || '[]');
            swipes.push(fullContent);
            db.prepare('UPDATE messages SET swipes = ?, swipe_id = ? WHERE id = ?')
              .run(JSON.stringify(swipes), swipes.length - 1, msgId);
          }
        }
      } else if (!update_message_id && !streamAborted) {
        // پیام جدید بود ولی محتوا خالی موند (LLLLM خالی برگردوند)
        // پیام خالی رو حذف کن تا ghost نمونه
        db.prepare('DELETE FROM messages WHERE id = ?').run(msgId);
        _log(`[Chat] Empty response — deleted empty message ${msgId}`);
      }
      db.prepare('UPDATE chats SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), chat_id);

      // پردازش tool calls (update_story_state)
      let storyStateUpdated = false;
      let newStoryState = null;
      _log(`[StoryState] Tool calls received: ${toolCalls.length}`);

      // Two-phase mode: if enabled and no tool calls in phase 1, make phase 2 request
      if (twoPhaseEnabled && toolCalls.length === 0 && fullContent) {
        _log(`[StoryState] Phase 2: Triggering state extraction (twoPhase=${twoPhaseEnabled} toolCalls=${toolCalls.length} contentLen=${fullContent.length})`);
        dbg.phase2Decision(true, `twoPhase=${twoPhaseEnabled} toolCalls=${toolCalls.length} hasContent=${!!fullContent}`);

        // Strip think tags before Phase 2 — client never sees them, so don't pollute extraction
        const cleanContentForPhase2 = fullContent.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

        try {
          const extractionPrompt = getStateExtractionPrompt(character.name, storyState, characterNames);
          // Extraction instruction FIRST (system), then conversation, then assistant response
          const phase2RequestBody = buildRequestBody([
            ...extractionPrompt,
            ...effectiveParts,
            { role: 'assistant' as const, content: cleanContentForPhase2 },
          ], {
            model: settings.model,
            temperature: 0.3, // Lower temperature for more precise extraction
            max_tokens: 2000, // Enough for full state JSON
            top_p: settings.top_p,
            frequency_penalty: settings.frequency_penalty,
            presence_penalty: settings.presence_penalty,
            stream: !!settings.stream, // Match Phase 1 stream mode (some providers abort non-streaming)
            stop: JSON.parse(settings.stop || '[]'),
            // No tools/tool_choice — extraction prompt asks for JSON response, not tool calls
          });

          // 30s timeout so a slow/stuck Phase 2 never blocks [DONE]
          const phase2Abort = new AbortController();
          const phase2Timeout = setTimeout(() => {
            _log(`[StoryState] Phase 2: timeout after 30s, aborting`);
            phase2Abort.abort();
          }, 30_000);

          _log(`[StoryState] Phase 2: sending request to ${endpoint} (stream=${!!settings.stream})`);

          let phase2Response: globalThis.Response;
          try {
            phase2Response = await fetch(endpoint, {
              method: 'POST',
              headers,
              body: phase2RequestBody,
              signal: phase2Abort.signal,
            });
          } finally {
            clearTimeout(phase2Timeout);
          }

          if (phase2Response.ok) {
            let phase2Content = '';

            if (settings.stream) {
              // Read streaming response
              const reader = phase2Response.body?.getReader();
              const decoder = new TextDecoder();
              if (reader) {
                const lineBuffer = createLineBuffer();
                let done = false;
                while (!done) {
                  const { done: streamDone, value } = await reader.read();
                  if (streamDone) break;
                  const chunk = decoder.decode(value, { stream: true });
                  const lines = lineBuffer.push(chunk);
                  for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('data: ')) {
                      const data = trimmed.slice(6);
                      if (data === '[DONE]') { done = true; break; }
                      try {
                        const parsed = JSON.parse(data);
                        const delta = parsed.choices?.[0]?.delta;
                        // Only collect content tokens — NOT reasoning_content (pollutes JSON parsing)
                        if (delta?.content) phase2Content += delta.content;
                      } catch {}
                    }
                  }
                }
                // Flush remaining buffer
                const remaining = lineBuffer.flush();
                for (const line of remaining) {
                  const trimmed = line.trim();
                  if (trimmed.startsWith('data: ') && trimmed.slice(6) !== '[DONE]') {
                    try {
                      const parsed = JSON.parse(trimmed.slice(6));
                      const delta = parsed.choices?.[0]?.delta;
                      if (delta?.content) phase2Content += delta.content;
                    } catch {}
                  }
                }
              }
            } else {
              // Non-streaming: read full JSON
              const phase2Data = await phase2Response.json() as any;
              phase2Content = phase2Data.choices?.[0]?.message?.content || '';
            }

            _log(`[StoryState] Phase 2: response received (${phase2Content.length} chars)`);
            _log(`[StoryState] Phase 2: RAW first 300: ${phase2Content.slice(0, 300)}`);
            _log(`[StoryState] Phase 2: RAW last 200: ${phase2Content.slice(-200)}`);

            // Parse JSON response from extraction prompt
            // Try multiple formats: tool_calls wrapper, direct state, or text fallback
            let cleanedPhase2 = phase2Content.trim();

            // Strip markdown code blocks (```json ... ```) that LLMs often wrap around JSON
            const codeBlockMatch = cleanedPhase2.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
            if (codeBlockMatch) {
              cleanedPhase2 = codeBlockMatch[1].trim();
              _log(`[StoryState] Phase 2: stripped markdown code block → ${cleanedPhase2.length} chars`);
            } else {
              _log(`[StoryState] Phase 2: no code block found, trying raw content`);
            }

            // Also try: extract JSON between first { and last }
            if (cleanedPhase2[0] !== '{') {
              const firstBrace = cleanedPhase2.indexOf('{');
              const lastBrace = cleanedPhase2.lastIndexOf('}');
              if (firstBrace !== -1 && lastBrace > firstBrace) {
                const extracted = cleanedPhase2.slice(firstBrace, lastBrace + 1);
                _log(`[StoryState] Phase 2: extracted JSON from braces: ${extracted.length} chars`);
                cleanedPhase2 = extracted;
              }
            }

            _log(`[StoryState] Phase 2: cleanedPhase2 first 300: ${cleanedPhase2.slice(0, 300)}`);

            try {
              const parsed = JSON.parse(cleanedPhase2);

              // Format 1: {"tool_calls": [{ "function": { "name": "update_story_state", "arguments": "..." } }]}
              if (parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
                toolCalls = parsed.tool_calls;
                _log(`[StoryState] Phase 2: ✅ extracted ${toolCalls.length} tool calls via tool_calls format`);
              }
              // Format 2: Direct state object
              else if (parsed.characters || parsed.current_situation || parsed.relationships || parsed.memories) {
                _log(`[StoryState] Phase 2: wrapping direct state object`);
                toolCalls = [{
                  id: 'phase2-extracted',
                  type: 'function',
                  function: {
                    name: 'update_story_state',
                    arguments: JSON.stringify(parsed),
                  }
                }];
              }
              // Format 3: Has arguments directly at root
              else if (parsed.arguments && typeof parsed.arguments === 'string') {
                _log(`[StoryState] Phase 2: direct arguments format`);
                toolCalls = [{
                  id: 'phase2-extracted',
                  type: 'function',
                  function: {
                    name: 'update_story_state',
                    arguments: parsed.arguments,
                  }
                }];
              } else {
                _log(`[StoryState] Phase 2: JSON parsed but unrecognized format. Keys: ${Object.keys(parsed).join(', ')}`);
              }
            } catch (parseErr: any) {
              _log(`[StoryState] Phase 2: JSON parse FAILED: ${parseErr.message}`);
              _log(`[StoryState] Phase 2: cleanedPhase2 for debugging: ${cleanedPhase2.slice(0, 500)}`);
              // Fallback: try to extract tool calls from text
              const textToolCalls = parseToolCallsFromText(phase2Content);
              if (textToolCalls.length > 0) {
                toolCalls = textToolCalls;
                _log(`[StoryState] Phase 2: extracted ${toolCalls.length} tool calls via text fallback`);
              } else {
                _log(`[StoryState] Phase 2: ALL extraction methods failed`);
              }
            }
          } else {
            _log(`[StoryState] Phase 2: HTTP error ${phase2Response.status}`);
            dbg.phase2Response(phase2Response.status, false);
          }
        } catch (phase2Error: any) {
          _err(`[StoryState] Phase 2: request failed:`, phase2Error?.message || phase2Error);
          dbg.phase2Error(phase2Error);
          // Continue with fallback methods
        }
      } else {
        const reason = !twoPhaseEnabled ? 'two-phase DISABLED in settings'
          : toolCalls.length > 0 ? `already have ${toolCalls.length} tool calls from phase1`
          : !fullContent ? 'no content from phase1'
          : 'unknown';
        _log(`[StoryState] Phase 2: SKIPPED — ${reason}`);
        dbg.phase2Decision(false, reason);
      }

      // ذخیره snapshot قبل از آپدیت state (برای امکان rollback)
      if (toolCalls.length > 0 || fullContent) {
        const existingRowForSnapshot = db.prepare('SELECT * FROM chat_story_state WHERE chat_id = ?').get(chat_id) as any;
        if (existingRowForSnapshot) {
          const snapshotId = uuidv4();
          db.prepare(`
            INSERT INTO chat_state_snapshots (id, chat_id, message_id, state_json, created_at)
            VALUES (?, ?, ?, ?, ?)
          `).run(snapshotId, chat_id, msgId, existingRowForSnapshot.state_json, new Date().toISOString());
          _log(`[StoryState] Snapshot saved for message: ${msgId}`);
        }
      }

      for (const toolCall of toolCalls) {
        _log(`[StoryState] Tool: ${toolCall.function?.name}, Args: ${toolCall.function?.arguments?.slice(0, 200)}`);
        if (toolCall.function?.name === 'update_story_state') {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            // دریافت state موجود
            const existingRow = db.prepare('SELECT * FROM chat_story_state WHERE chat_id = ?').get(chat_id) as any;
            let currentState = { characters: {}, relationships: {}, current_situation: '', rules: [], relationship_details: {}, memories: [] };
            if (existingRow) {
              try { currentState = JSON.parse(existingRow.state_json); } catch {}
            }
            // Deep merge
            newStoryState = deepMergeState(currentState, args);
            // ذخیره
            const now = new Date().toISOString();
            if (existingRow) {
              db.prepare('UPDATE chat_story_state SET state_json = ?, updated_at = ? WHERE chat_id = ?')
                .run(JSON.stringify(newStoryState), now, chat_id);
            } else {
              db.prepare('INSERT INTO chat_story_state (id, chat_id, state_json, updated_at) VALUES (?, ?, ?, ?)')
                .run(uuidv4(), chat_id, JSON.stringify(newStoryState), now);
            }
            storyStateUpdated = true;
            _log(`[StoryState] State updated via tool call`);
          } catch (e) {
            _err('Failed to process update_story_state:', e);
          }
        }
      }

      // Fallback: parse tool calls from text if no tool calls were detected
      if (!storyStateUpdated && fullContent) {
        _log(`[StoryState] No tool calls detected in stream, trying text parsing...`);
        const textToolCalls = parseToolCallsFromText(fullContent);
        _log(`[StoryState] Found ${textToolCalls.length} tool calls in text`);
        
        for (const toolCall of textToolCalls) {
          _log(`[StoryState] Text Tool: ${toolCall.function?.name}, Args: ${toolCall.function?.arguments?.slice(0, 200)}`);
          if (toolCall.function?.name === 'update_story_state') {
            try {
              const args = JSON.parse(toolCall.function.arguments);
              const existingRow = db.prepare('SELECT * FROM chat_story_state WHERE chat_id = ?').get(chat_id) as any;
              let currentState = { characters: {}, relationships: {}, current_situation: '', rules: [], relationship_details: {}, memories: [] };
              if (existingRow) {
                try { currentState = JSON.parse(existingRow.state_json); } catch {}
              }
              newStoryState = deepMergeState(currentState, args);
              const now = new Date().toISOString();
              if (existingRow) {
                db.prepare('UPDATE chat_story_state SET state_json = ?, updated_at = ? WHERE chat_id = ?')
                  .run(JSON.stringify(newStoryState), now, chat_id);
              } else {
                db.prepare('INSERT INTO chat_story_state (id, chat_id, state_json, updated_at) VALUES (?, ?, ?, ?)')
                  .run(uuidv4(), chat_id, JSON.stringify(newStoryState), now);
              }
              storyStateUpdated = true;
              _log(`[StoryState] State updated via text parsing`);
            } catch (e) {
              _err('Failed to process update_story_state from text:', e);
            }
          }
        }
      }

      // Fallback: if still no tool calls, try regex extraction from text
      if (!storyStateUpdated && fullContent) {
        _log(`[StoryState] No tool calls in text, trying regex extraction...`);
        const extractedState = extractStateFromText(fullContent, character.name);
        if (extractedState) {
          _log(`[StoryState] Extracted from text:`, JSON.stringify(extractedState));
          const existingRow = db.prepare('SELECT * FROM chat_story_state WHERE chat_id = ?').get(chat_id) as any;
          let currentState = { characters: {}, relationships: {}, current_situation: '', rules: [], relationship_details: {}, memories: [] };
          if (existingRow) {
            try { currentState = JSON.parse(existingRow.state_json); } catch {}
          }
          newStoryState = deepMergeState(currentState, extractedState);
          const now = new Date().toISOString();
          if (existingRow) {
            db.prepare('UPDATE chat_story_state SET state_json = ?, updated_at = ? WHERE chat_id = ?')
              .run(JSON.stringify(newStoryState), now, chat_id);
          } else {
            db.prepare('INSERT INTO chat_story_state (id, chat_id, state_json, updated_at) VALUES (?, ?, ?, ?)')
              .run(uuidv4(), chat_id, JSON.stringify(newStoryState), now);
          }
          storyStateUpdated = true;
          _log(`[StoryState] State updated via text extraction`);
        } else {
          _log(`[StoryState] No state changes detected in text`);
        }
      }

      // حالا که tool call‌ها پارس و اعمال شدن، محتوا رو برای ذخیره نهایی strip کن
      if (fullContent) {
        const strippedContent = stripToolCallsFromContent(fullContent);
        if (strippedContent !== fullContent) {
          fullContent = strippedContent;
          db.prepare('UPDATE messages SET content = ? WHERE id = ?').run(fullContent, msgId);
          // آپدیت swipes هم اگر ریجنریت بود
          if (update_message_id) {
            const msg = db.prepare('SELECT swipes FROM messages WHERE id = ?').get(msgId) as any;
            if (msg) {
              const swipes = JSON.parse(msg.swipes || '[]');
              if (swipes.length > 0) {
                swipes[swipes.length - 1] = fullContent;
                db.prepare('UPDATE messages SET swipes = ? WHERE id = ?')
                  .run(JSON.stringify(swipes), msgId);
              }
            }
          }
          _log(`[Chat] Stripped tool call artifacts from message ${msgId}`);
        }
      }

      // ارسال story state update قبل از DONE
      if (storyStateUpdated && newStoryState) {
        dbg.sseEvent('story_state_updated', JSON.stringify(newStoryState).slice(0, 200));
        res.write(`data: ${JSON.stringify({ story_state_updated: true, state: newStoryState })}\n\n`);
      } else {
        dbg.sseEvent('story_state_updated', `SKIPPED (updated=${storyStateUpdated} hasState=${!!newStoryState})`);
      }

      // ارسال usage data (prompt_tokens, completion_tokens) قبل از DONE
      if (streamUsage) {
        dbg.sseEvent('usage', JSON.stringify(streamUsage));
        res.write(`data: ${JSON.stringify({ usage: streamUsage })}\n\n`);
      } else {
        dbg.sseEvent('usage', 'SKIPPED (no usage data from stream)');
      }

      // ارسال DONE و بستن اتصال
      dbg.done(streamAborted);
      dbg.summary({
        msgId,
        fullContentLength: fullContent.length,
        toolCallsFromPhase1: 0, // in two-phase, phase1 has no tools
        toolCallsFromPhase2: toolCalls.length,
        storyStateUpdated,
        streamAborted,
        streamUsagePresent: !!streamUsage,
      });
      if (!streamAborted) {
        res.write('data: [DONE]\n\n');
      }
      activeStreams.delete(msgId);
      res.end();
    } else {
      // Non-streaming response
      dbg.phase1Response(response.status, response.ok);
      const data = await response.json() as any;
      let content = parseNonStreamingResponse(data);
      // حذف tool call‌هایی که مدل به صورت متن در content برگردانده
      content = stripToolCallsFromContent(content);

      // ذخیره یا بروزرسانی پیام
      let msgId: string;
      const now = new Date().toISOString();
      const msgRole = impersonate ? 'user' : 'assistant';
      if (update_message_id) {
        msgId = update_message_id;
        db.prepare('UPDATE messages SET content = ? WHERE id = ?').run(content, msgId);
        // اگر ریجنریت بود، محتوای جدید رو به swipes اضافه کن و swipe_id رو درست کن
        if (content) {
          const msg = db.prepare('SELECT swipes FROM messages WHERE id = ?').get(msgId) as any;
          if (msg) {
            const swipes = JSON.parse(msg.swipes || '[]');
            swipes.push(content);
            db.prepare('UPDATE messages SET swipes = ?, swipe_id = ? WHERE id = ?')
              .run(JSON.stringify(swipes), swipes.length - 1, msgId);
          }
        }
      } else {
        msgId = uuidv4();
        db.prepare(`
          INSERT INTO messages (id, chat_id, role, content, swipes, swipe_id, is_edited, is_system, send_date)
          VALUES (?, ?, ?, ?, '[]', 0, 0, 0, ?)
        `).run(msgId, chat_id, msgRole, content, now);
      }

      db.prepare('UPDATE chats SET updated_at = ? WHERE id = ?').run(now, chat_id);

      // ─── Non-streaming: Tool calls from response ───
      let toolCalls: any[] = data.choices?.[0]?.message?.tool_calls || [];
      _log(`[StoryState] Non-streaming tool calls: ${toolCalls.length}`);

      // Two-phase mode: if enabled and no tool calls, make phase 2 request
      if (twoPhaseEnabled && toolCalls.length === 0 && content) {
        dbg.phase2Decision(true, `non-streaming: twoPhase=${twoPhaseEnabled} toolCalls=${toolCalls.length} hasContent=${!!content}`);

        // Strip think tags before Phase 2
        const cleanContentForPhase2 = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

        try {
          const extractionPrompt = getStateExtractionPrompt(character.name, storyState, characterNames);
          const phase2RequestBody = buildRequestBody([
            ...extractionPrompt,
            ...effectiveParts,
            { role: 'assistant' as const, content: cleanContentForPhase2 },
          ], {
            model: settings.model,
            temperature: 0.3,
            max_tokens: 2000,
            top_p: settings.top_p,
            frequency_penalty: settings.frequency_penalty,
            presence_penalty: settings.presence_penalty,
            stream: !!settings.stream,
            stop: JSON.parse(settings.stop || '[]'),
          });

          const phase2Abort = new AbortController();
          const phase2Timeout = setTimeout(() => {
            _log(`[StoryState] Non-streaming Phase 2: timeout after 30s`);
            phase2Abort.abort();
          }, 30_000);

          _log(`[StoryState] Non-streaming Phase 2: sending request to ${endpoint}`);

          let phase2Response: globalThis.Response;
          try {
            phase2Response = await fetch(endpoint, {
              method: 'POST',
              headers,
              body: phase2RequestBody,
              signal: phase2Abort.signal,
            });
          } finally {
            clearTimeout(phase2Timeout);
          }

          if (phase2Response.ok) {
            let phase2Content = '';

            if (settings.stream) {
              const reader = phase2Response.body?.getReader();
              const decoder = new TextDecoder();
              if (reader) {
                const lineBuffer = createLineBuffer();
                let done = false;
                while (!done) {
                  const { done: streamDone, value } = await reader.read();
                  if (streamDone) break;
                  const chunk = decoder.decode(value, { stream: true });
                  const lines = lineBuffer.push(chunk);
                  for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('data: ')) {
                      const data = trimmed.slice(6);
                      if (data === '[DONE]') { done = true; break; }
                      try {
                        const parsed = JSON.parse(data);
                        const delta = parsed.choices?.[0]?.delta;
                        if (delta?.content) phase2Content += delta.content;
                      } catch {}
                    }
                  }
                }
              }
            } else {
              const phase2Data = await phase2Response.json() as any;
              phase2Content = phase2Data.choices?.[0]?.message?.content || '';
            }

            _log(`[StoryState] Non-streaming Phase 2: response received (${phase2Content.length} chars)`);

            let cleanedPhase2 = phase2Content.trim();
            const codeBlockMatch = cleanedPhase2.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
            if (codeBlockMatch) {
              cleanedPhase2 = codeBlockMatch[1].trim();
            }

            try {
              const parsed = JSON.parse(cleanedPhase2);
              if (parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
                toolCalls = parsed.tool_calls;
                _log(`[StoryState] Non-streaming Phase 2: extracted ${toolCalls.length} tool calls`);
              }
            } catch (parseErr) {
              const textToolCalls = parseToolCallsFromText(phase2Content);
              if (textToolCalls.length > 0) {
                toolCalls = textToolCalls;
                _log(`[StoryState] Non-streaming Phase 2: text fallback ${toolCalls.length} tool calls`);
              }
            }
          }
        } catch (phase2Error: any) {
          _err(`[StoryState] Non-streaming Phase 2: failed:`, phase2Error?.message || phase2Error);
        }
      }

      // Process tool calls (same logic as streaming path)
      let storyStateUpdated = false;
      let newStoryState = null;

      for (const toolCall of toolCalls) {
        if (toolCall.function?.name === 'update_story_state') {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            const existingRow = db.prepare('SELECT * FROM chat_story_state WHERE chat_id = ?').get(chat_id) as any;
            let currentState = { characters: {}, relationships: {}, current_situation: '', rules: [], relationship_details: {}, memories: [] };
            if (existingRow) {
              try { currentState = JSON.parse(existingRow.state_json); } catch {}
            }
            newStoryState = deepMergeState(currentState, args);
            const saveNow = new Date().toISOString();
            if (existingRow) {
              db.prepare('UPDATE chat_story_state SET state_json = ?, updated_at = ? WHERE chat_id = ?')
                .run(JSON.stringify(newStoryState), saveNow, chat_id);
            } else {
              db.prepare('INSERT INTO chat_story_state (id, chat_id, state_json, updated_at) VALUES (?, ?, ?, ?)')
                .run(uuidv4(), chat_id, JSON.stringify(newStoryState), saveNow);
            }
            storyStateUpdated = true;
            _log(`[StoryState] Non-streaming state updated via tool call`);
          } catch (e) {
            _err('Failed to process non-streaming update_story_state:', e);
          }
        }
      }

      // Fallback: text parsing (same as streaming)
      if (!storyStateUpdated && content) {
        const textToolCalls = parseToolCallsFromText(content);
        for (const toolCall of textToolCalls) {
          if (toolCall.function?.name === 'update_story_state') {
            try {
              const args = JSON.parse(toolCall.function.arguments);
              const existingRow = db.prepare('SELECT * FROM chat_story_state WHERE chat_id = ?').get(chat_id) as any;
              let currentState = { characters: {}, relationships: {}, current_situation: '', rules: [], relationship_details: {}, memories: [] };
              if (existingRow) {
                try { currentState = JSON.parse(existingRow.state_json); } catch {}
              }
              newStoryState = deepMergeState(currentState, args);
              const saveNow = new Date().toISOString();
              if (existingRow) {
                db.prepare('UPDATE chat_story_state SET state_json = ?, updated_at = ? WHERE chat_id = ?')
                  .run(JSON.stringify(newStoryState), saveNow, chat_id);
              } else {
                db.prepare('INSERT INTO chat_story_state (id, chat_id, state_json, updated_at) VALUES (?, ?, ?, ?)')
                  .run(uuidv4(), chat_id, JSON.stringify(newStoryState), saveNow);
              }
              storyStateUpdated = true;
              _log(`[StoryState] Non-streaming state updated via text parsing`);
            } catch (e) {
              _err('Failed to process non-streaming text tool call:', e);
            }
          }
        }
      }

      // Strip tool calls from content
      const strippedContent = stripToolCallsFromContent(content);
      if (strippedContent !== content) {
        content = strippedContent;
        db.prepare('UPDATE messages SET content = ? WHERE id = ?').run(content, msgId);
      }

      dbg.messageSaved(msgId, msgRole, content.length);
      dbg.summary({
        path: 'non-streaming',
        msgId,
        contentLength: content.length,
        toolCallsFromPhase2: toolCalls.length,
        storyStateUpdated,
        hasUsage: !!data.usage,
      });

      res.json({
        content,
        message_id: msgId,
        ...(storyStateUpdated && { story_state_updated: true, state: newStoryState }),
        // Usage data از API response
        ...(data.usage && {
          usage: {
            prompt_tokens: data.usage.prompt_tokens,
            completion_tokens: data.usage.completion_tokens,
            total_tokens: data.usage.total_tokens,
          }
        }),
      });
    }
  } catch (error: any) {
    // اگر کلاینت اتصال را قطع کرده، نیازی به پاسخ نیست
    if (error?.name === 'AbortError') {
      dbg.error('outer-catch', new Error('Request aborted (client disconnected)'));
      return;
    }
    dbg.error('outer-catch', error);
    _err('API Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Error connecting to API' });
    }
  }
});

// لغو پاسخ streaming فعال (Stop در UI)
app.post('/api/chat/abort', (req, res) => {
  const { message_id } = req.body;
  if (!message_id) {
    res.status(400).json({ error: 'message_id is required' });
    return;
  }
  const controller = activeStreams.get(message_id);
  if (controller) {
    controller.abort();
    res.json({ success: true, aborted: true });
  } else {
    res.json({ success: true, aborted: false });
  }
});

export default app;
