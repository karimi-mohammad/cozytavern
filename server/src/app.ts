import express from 'express';
import cors from 'cors';
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
import { getChapterSettingsCompat } from './utils/plugin-store';
import { buildEndpoint, buildHeaders, buildRequestBody, createLineBuffer, parseStreamChunkFull, parseNonStreamingResponse } from './utils/providers';
import { buildPrompt, activateWorldInfo, getStoryStateToolDefinition } from './utils/prompt-builder';
import { getDb } from './db';
import { v4 as uuidv4 } from 'uuid';

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

// Parse tool calls from text response (fallback when model outputs tool calls as text)
function parseToolCallsFromText(text: string): any[] {
  const toolCalls: any[] = [];
  
  // Pattern to match JSON-like tool call blocks in text
  const toolCallPattern = /(?:<\|tool_call_begin\|>|<\|tool_call_begin\|>|\[TOOL_CALL\]|```json\s*\{\s*"name"\s*:\s*"update_story_state")/i;
  
  // Try to find update_story_state tool calls in text
  const patterns = [
    // Pattern 1: Standard function calling format in text
    /update_story_state\s*\(\s*(\{[\s\S]*?\})\s*\)/gi,
    // Pattern 2: JSON code block with function call
    /```json\s*\{\s*"name"\s*:\s*"update_story_state"\s*,\s*"arguments"\s*:\s*(\{[\s\S]*?\})\s*\}/gi,
    // Pattern 3: Direct JSON object with update_story_state
    /\{\s*"name"\s*:\s*"update_story_state"\s*,\s*"arguments"\s*:\s*(\{[\s\S]*?\})\s*\}/gi,
    // Pattern 4: <tool_call> tags (some models)
    /<tool_call>\s*(\{[\s\S]*?\})\s*<\/tool_call>/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      try {
        const argsStr = match[1];
        const args = JSON.parse(argsStr);
        toolCalls.push({
          id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'function',
          function: {
            name: 'update_story_state',
            arguments: JSON.stringify(args),
          },
        });
      } catch (e) {
        console.log('[StoryState] Failed to parse tool call from text:', e);
      }
    }
  }

  return toolCalls;
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

// Chat API endpoint (ارسال پیام به AI با streaming)
app.post('/api/chat', async (req, res) => {
  const { chat_id, character_id, persona_id, lorebook_id, update_message_id, continue_mode, impersonate, edited_messages } = req.body;

  const db = getDb();
  const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(character_id) as any;
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
    console.log(`[StoryState] Regenerating message ${update_message_id}, rolling back state...`);
    const snapshotToRestore = db.prepare(
      'SELECT * FROM chat_state_snapshots WHERE chat_id = ? AND message_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(chat_id, update_message_id) as any;

    if (snapshotToRestore) {
      console.log(`[StoryState] Found snapshot, restoring state...`);
      db.prepare('UPDATE chat_story_state SET state_json = ?, updated_at = ? WHERE chat_id = ?')
        .run(snapshotToRestore.state_json, new Date().toISOString(), chat_id);
    } else {
      console.log(`[StoryState] No snapshot found for this message`);
    }
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
  });

  try {
    const endpoint = buildEndpoint(settings.base_url);
    const headers = buildHeaders(settings.api_key);

    // اگر کاربر پیام‌ها را ویرایش کرده باشد، به جای promptParts ساخته‌شده از DB از آن‌ها استفاده می‌شود
    const effectiveParts = edited_messages && Array.isArray(edited_messages) && edited_messages.length > 0
      ? edited_messages.map((m: any) => ({ role: m.role, content: m.content }))
      : promptParts;

    // ابزار update_story_state
    const characterNames = [character.name];
    const storyStateTool = getStoryStateToolDefinition(characterNames);
    console.log(`[StoryState] Tool definition for characters:`, JSON.stringify(characterNames));
    console.log(`[StoryState] Story state in prompt:`, storyState ? 'YES' : 'NO');
    if (storyState) {
      console.log(`[StoryState] Current state:`, JSON.stringify(storyState).slice(0, 500));
    }

    // اضافه کردن دستور استفاده از tool به انتهای پرامپت
    const toolInstruction = {
      role: 'system' as const,
      content: `[MANDATORY TOOL USE]\nYou MUST call update_story_state in EVERY response. Track ALL of these:\n\n1. CHARACTERS: location, position, clothing changes\n2. RELATIONSHIPS: "A-B": "description"\n3. RELATIONSHIP_DETAILS: Emotions 0-100 scale\n   - love, trust, anger, fear, respect, affection, shame, jealousy, gratitude\n   - summary: brief emotional state description\n4. CURRENT_SITUATION: What is happening NOW\n5. RULES: Persistent world rules\n6. MEMORIES: Important events that matter later\n   Format: [{content: "event", importance: "high|medium|low"}]\n\nMEMORY EXAMPLES:\n- "User saved Elena from assassination" (high)\n- "Elena learned User is a mage" (high)\n- "User promised to return before sunrise" (medium)\n\nALWAYS call the tool, even if only one thing changes. This is REQUIRED.`,
    };

    const requestBody = buildRequestBody([...effectiveParts, toolInstruction], {
      model: settings.model,
      temperature: settings.temperature,
      max_tokens: settings.max_tokens,
      top_p: settings.top_p,
      frequency_penalty: settings.frequency_penalty,
      presence_penalty: settings.presence_penalty,
      stream: !!settings.stream,
      stop: JSON.parse(settings.stop || '[]'),
      tools: [storyStateTool],
      tool_choice: 'auto',
    });

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
      });
    }

    const controller = new AbortController();

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: requestBody,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`LLM API error ${response.status}:`, errorText.slice(0, 200));
      res.status(response.status).json({ error: `API error: ${errorText}` });
      return;
    }

    if (settings.stream) {
      // Streaming response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // ایجاد یا بروزرسانی پیام
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

      // لغو فعال: کاربر از طریق /api/chat/abort
      const streamController = new AbortController();
      activeStreams.set(msgId, streamController);
      res.on('close', () => {
        streamController.abort();
        activeStreams.delete(msgId);
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let streamAborted = false;
      let toolCalls: any[] = [];

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
              const delta = parsed.choices?.[0]?.delta;

              // Debug logging for first few chunks
              if (chunkCount <= 3) {
                console.log(`[StoryState] Chunk ${chunkCount}:`, JSON.stringify(delta).slice(0, 300));
              }

              // Check for tool calls
              if (delta?.tool_calls) {
                console.log(`[StoryState] Tool call detected in chunk ${chunkCount}`);
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
            console.error('Stream error:', streamError);
          }
        }
      }

      // بروزرسانی محتوای پیام
      if (fullContent) {
        // محتوا داریم — ذخیره کن
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
        console.log(`[Chat] Empty response — deleted empty message ${msgId}`);
      }
      db.prepare('UPDATE chats SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), chat_id);

      // پردازش tool calls (update_story_state)
      let storyStateUpdated = false;
      let newStoryState = null;
      console.log(`[StoryState] Tool calls received: ${toolCalls.length}`);

      // ذخیره snapshot قبل از آپدیت state (برای امکان rollback)
      if (toolCalls.length > 0 || fullContent) {
        const existingRowForSnapshot = db.prepare('SELECT * FROM chat_story_state WHERE chat_id = ?').get(chat_id) as any;
        if (existingRowForSnapshot) {
          const snapshotId = uuidv4();
          db.prepare(`
            INSERT INTO chat_state_snapshots (id, chat_id, message_id, state_json, created_at)
            VALUES (?, ?, ?, ?, ?)
          `).run(snapshotId, chat_id, msgId, existingRowForSnapshot.state_json, new Date().toISOString());
          console.log(`[StoryState] Snapshot saved for message: ${msgId}`);
        }
      }

      for (const toolCall of toolCalls) {
        console.log(`[StoryState] Tool: ${toolCall.function?.name}, Args: ${toolCall.function?.arguments?.slice(0, 200)}`);
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
            console.log(`[StoryState] State updated via tool call`);
          } catch (e) {
            console.error('Failed to process update_story_state:', e);
          }
        }
      }

      // Fallback: parse tool calls from text if no tool calls were detected
      if (!storyStateUpdated && fullContent) {
        console.log(`[StoryState] No tool calls detected in stream, trying text parsing...`);
        const textToolCalls = parseToolCallsFromText(fullContent);
        console.log(`[StoryState] Found ${textToolCalls.length} tool calls in text`);
        
        for (const toolCall of textToolCalls) {
          console.log(`[StoryState] Text Tool: ${toolCall.function?.name}, Args: ${toolCall.function?.arguments?.slice(0, 200)}`);
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
              console.log(`[StoryState] State updated via text parsing`);
            } catch (e) {
              console.error('Failed to process update_story_state from text:', e);
            }
          }
        }
      }

      // Fallback: if still no tool calls, try regex extraction from text
      if (!storyStateUpdated && fullContent) {
        console.log(`[StoryState] No tool calls in text, trying regex extraction...`);
        const extractedState = extractStateFromText(fullContent, character.name);
        if (extractedState) {
          console.log(`[StoryState] Extracted from text:`, JSON.stringify(extractedState));
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
          console.log(`[StoryState] State updated via text extraction`);
        } else {
          console.log(`[StoryState] No state changes detected in text`);
        }
      }

      // ارسال story state update قبل از DONE
      if (storyStateUpdated && newStoryState) {
        res.write(`data: ${JSON.stringify({ story_state_updated: true, state: newStoryState })}\n\n`);
      }

      // ارسال DONE و بستن اتصال
      if (!streamAborted) {
        res.write('data: [DONE]\n\n');
      }
      activeStreams.delete(msgId);
      res.end();
    } else {
      // Non-streaming response
      const data = await response.json();
      const content = parseNonStreamingResponse(data);

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

      res.json({ content, message_id: msgId });
    }
  } catch (error: any) {
    // اگر کلاینت اتصال را قطع کرده، نیازی به پاسخ نیست
    if (error?.name === 'AbortError') {
      console.log('Request aborted (client disconnected)');
      return;
    }
    console.error('API Error:', error);
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
