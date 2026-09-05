import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { stripToolCallsFromContent } from '../utils/strip-tool-calls';
import { parseToolCallsFromText } from '../utils/parse-tool-calls-from-text';
import { getChapterSettingsCompat } from '../utils/plugin-store';
import { getStoryStateToolDefinition } from '../utils/prompt-builder';

const router = Router();

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

// ─── Create Group Chat ───
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  const { name, character_ids, lorebook_id } = req.body;

  if (!character_ids || !Array.isArray(character_ids) || character_ids.length < 1) {
    res.status(400).json({ error: 'At least one character_id is required' });
    return;
  }

  const primaryCharId = character_ids[0];
  const chatName = name || 'Group Chat';
  db.prepare(`
    INSERT INTO chats (id, character_id, name, is_group_chat, group_chat_name, lorebook_id, created_at, updated_at)
    VALUES (?, ?, ?, 1, ?, ?, ?, ?)
  `).run(id, primaryCharId, chatName, chatName, lorebook_id || '', now, now);

  const insertParticipant = db.prepare(`
    INSERT INTO chat_participants (id, chat_id, character_id, display_name, display_avatar, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, 1, ?)
  `);

  for (const charId of character_ids) {
    const char = db.prepare('SELECT name, avatar FROM characters WHERE id = ?').get(charId) as any;
    insertParticipant.run(uuidv4(), id, charId, char?.name || '', char?.avatar || '', now);
  }

  const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(id) as any;
  const participants = db.prepare(
    'SELECT * FROM chat_participants WHERE chat_id = ? ORDER BY created_at ASC'
  ).all(id);

  res.status(201).json({ ...chat, participants });
});

// ─── Get Group Chat with Participants ───
router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(req.params.id) as any;
  if (!chat) {
    res.status(404).json({ error: 'Chat not found' });
    return;
  }

  const participants = db.prepare(
    'SELECT * FROM chat_participants WHERE chat_id = ? ORDER BY created_at ASC'
  ).all(req.params.id);

  const messages = db.prepare(
    'SELECT * FROM messages WHERE chat_id = ? ORDER BY rowid ASC'
  ).all(req.params.id).map((m: any) => ({
    ...m,
    swipes: JSON.parse(m.swipes || '[]'),
    is_edited: !!m.is_edited,
    is_system: !!m.is_system,
  }));

  res.json({ ...chat, participants, messages });
});

// ─── Add Participant to Group Chat ───
router.post('/:id/participants', (req: Request, res: Response) => {
  const db = getDb();
  const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(req.params.id) as any;
  if (!chat || !chat.is_group_chat) {
    res.status(404).json({ error: 'Group chat not found' });
    return;
  }

  const { character_id } = req.body;
  if (!character_id) {
    res.status(400).json({ error: 'character_id is required' });
    return;
  }

  const existing = db.prepare(
    'SELECT id FROM chat_participants WHERE chat_id = ? AND character_id = ?'
  ).get(req.params.id, character_id);
  if (existing) {
    res.status(400).json({ error: 'Character is already a participant' });
    return;
  }

  const char = db.prepare('SELECT name, avatar FROM characters WHERE id = ?').get(character_id) as any;
  const participantId = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO chat_participants (id, chat_id, character_id, display_name, display_avatar, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, 1, ?)
  `).run(participantId, req.params.id, character_id, char?.name || '', char?.avatar || '', now);

  const participant = db.prepare('SELECT * FROM chat_participants WHERE id = ?').get(participantId);
  res.status(201).json(participant);
});

// ─── Convert Normal Chat to Group Chat (Add Character) ───
router.post('/:id/add-character', (req: Request, res: Response) => {
  const db = getDb();
  const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(req.params.id) as any;

  if (!chat) {
    res.status(404).json({ error: 'Chat not found' });
    return;
  }

  const { character_id, add_system_message } = req.body;
  if (!character_id) {
    res.status(400).json({ error: 'character_id is required' });
    return;
  }

  const newChar = db.prepare('SELECT name, avatar FROM characters WHERE id = ?').get(character_id) as any;
  if (!newChar) {
    res.status(404).json({ error: 'Character not found' });
    return;
  }

  const now = new Date().toISOString();
  const transaction = db.transaction(() => {
    if (!chat.is_group_chat) {
      db.prepare('UPDATE chats SET is_group_chat = 1, group_chat_name = ? WHERE id = ?')
        .run(chat.name, chat.id);

      const originalChar = db.prepare('SELECT name, avatar FROM characters WHERE id = ?')
        .get(chat.character_id) as any;

      if (originalChar) {
        db.prepare(`
          INSERT INTO chat_participants (id, chat_id, character_id, display_name, display_avatar, is_active, created_at)
          VALUES (?, ?, ?, ?, ?, 1, ?)
        `).run(uuidv4(), chat.id, chat.character_id, originalChar.name, originalChar.avatar || '', now);

        db.prepare(`
          UPDATE messages
          SET sender_name = ?, sender_avatar = ?, sender_character_id = ?
          WHERE chat_id = ? AND role = 'assistant' AND (sender_name = '' OR sender_name IS NULL)
        `).run(originalChar.name, originalChar.avatar || '', chat.character_id, chat.id);
      }
    }

    const existing = db.prepare(
      'SELECT id FROM chat_participants WHERE chat_id = ? AND character_id = ?'
    ).get(chat.id, character_id);

    if (!existing) {
      db.prepare(`
        INSERT INTO chat_participants (id, chat_id, character_id, display_name, display_avatar, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, 1, ?)
      `).run(uuidv4(), chat.id, character_id, newChar.name, newChar.avatar || '', now);
    }

    if (add_system_message !== false) {
      db.prepare(`
        INSERT INTO messages (id, chat_id, role, content, swipes, swipe_id, is_edited, is_system, send_date, sender_name)
        VALUES (?, ?, 'system', ?, '[]', 0, 0, 1, ?, '')
      `).run(uuidv4(), chat.id, `*${newChar.name} has entered the chat.*`, now);
    }
  });

  transaction();

  const updatedChat = db.prepare('SELECT * FROM chats WHERE id = ?').get(chat.id) as any;
  const participants = db.prepare(
    'SELECT * FROM chat_participants WHERE chat_id = ? ORDER BY created_at ASC'
  ).all(chat.id);

  res.json({ ...updatedChat, participants });
});

// ─── Remove Participant from Group Chat ───
router.delete('/:id/participants/:participantId', (req: Request, res: Response) => {
  const db = getDb();
  const result = db.prepare(
    'DELETE FROM chat_participants WHERE id = ? AND chat_id = ?'
  ).run(req.params.participantId, req.params.id);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Participant not found' });
    return;
  }

  res.json({ success: true });
});

// ─── Toggle Participant Active State ───
router.put('/:id/participants/:participantId', (req: Request, res: Response) => {
  const db = getDb();
  const { is_active } = req.body;

  const existing = db.prepare(
    'SELECT * FROM chat_participants WHERE id = ? AND chat_id = ?'
  ).get(req.params.participantId, req.params.id) as any;

  if (!existing) {
    res.status(404).json({ error: 'Participant not found' });
    return;
  }

  db.prepare(
    'UPDATE chat_participants SET is_active = ? WHERE id = ?'
  ).run(is_active ? 1 : 0, req.params.participantId);

  const updated = db.prepare('SELECT * FROM chat_participants WHERE id = ?').get(req.params.participantId);
  res.json(updated);
});

// ─── Generate AI Response for a Specific Character ───
router.post('/:id/generate', async (req: Request, res: Response) => {
  const db = getDb();
  const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(req.params.id) as any;
  if (!chat || !chat.is_group_chat) {
    res.status(404).json({ error: 'Group chat not found' });
    return;
  }

  const { character_id, persona_id, lorebook_id, update_message_id } = req.body;
  if (!character_id) {
    res.status(400).json({ error: 'character_id is required' });
    return;
  }

  const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(character_id) as any;
  if (!character) {
    res.status(400).json({ error: 'Character not found' });
    return;
  }

  const persona = persona_id ? db.prepare('SELECT * FROM personas WHERE id = ?').get(persona_id) as any : null;

  const messages = db.prepare(
    'SELECT * FROM messages WHERE chat_id = ? ORDER BY rowid ASC'
  ).all(req.params.id) as any[];

  const participants = db.prepare(
    'SELECT cp.*, c.name as char_name, c.description as char_desc, c.personality as char_personality FROM chat_participants cp JOIN characters c ON cp.character_id = c.id WHERE cp.chat_id = ? AND cp.is_active = 1'
  ).all(req.params.id) as any[];

  // Lorebook entries
  const lorebookIdsToLoad: string[] = [];
  if (lorebook_id) {
    lorebookIdsToLoad.push(lorebook_id);
  } else {
    const chatLorebooks = db.prepare(
      'SELECT cl.lorebook_id, cl.is_active FROM chat_lorebooks cl WHERE cl.chat_id = ? ORDER BY cl.insertion_order ASC'
    ).all(req.params.id) as any[];
    for (const cl of chatLorebooks) {
      if (cl.is_active) lorebookIdsToLoad.push(cl.lorebook_id);
    }
    if (lorebookIdsToLoad.length === 0 && chat?.lorebook_id) {
      lorebookIdsToLoad.push(chat.lorebook_id);
    }
  }

  let lorebookEntries: any[] = [];
  const { activateWorldInfo } = await import('../utils/prompt-builder.js');
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
      lorebookEntries.push(...activateWorldInfo(messages, { ...lorebook, entries }));
    }
  }
  const seenIds = new Set<string>();
  lorebookEntries = lorebookEntries.filter((e: any) => {
    if (seenIds.has(e.id)) return false;
    seenIds.add(e.id);
    return true;
  });

  const settings = db.prepare("SELECT * FROM api_settings ORDER BY ROWID DESC LIMIT 1").get() as any;
  if (!settings) {
    res.status(400).json({ error: 'API settings not found' });
    return;
  }

  const { buildPrompt } = await import('../utils/prompt-builder.js');
  const { buildEndpoint, buildHeaders, buildRequestBody, createLineBuffer, parseStreamChunkFull, parseNonStreamingResponse } = await import('../utils/providers.js');

  const systemPrompt = settings.system_prompt || '';

  // Chapters + Raw Window (همانند single chat)
  const chapters = db.prepare('SELECT * FROM chapters WHERE chat_id = ? ORDER BY created_at ASC').all(req.params.id) as any[];
  const chapterSettings = getChapterSettingsCompat(db);

  // Story State (حافظه وضعیت داستان)
  const storyStateRow = db.prepare('SELECT * FROM chat_story_state WHERE chat_id = ?').get(req.params.id) as any;
  let storyState: {
    characters: Record<string, any>;
    relationships: Record<string, string>;
    current_situation: string;
    rules: string[];
  } = {
    characters: {} as Record<string, any>,
    relationships: {} as Record<string, string>,
    current_situation: '',
    rules: [] as string[],
  };
  if (storyStateRow) {
    try {
      const parsed = JSON.parse(storyStateRow.state_json);
      storyState = {
        characters: parsed.characters || {},
        relationships: parsed.relationships || {},
        current_situation: parsed.current_situation || '',
        rules: Array.isArray(parsed.rules) ? parsed.rules : [],
      };
    } catch {}
  }

  let filteredMessages = messages;
  if (update_message_id && !req.body.continue_mode) {
    filteredMessages = messages.map(m =>
      m.id === update_message_id ? { ...m, content: '' } : m
    );
  }

  const promptParts = buildPrompt(
    character,
    persona,
    filteredMessages,
    lorebookEntries,
    systemPrompt,
    {
      impersonate: false,
      continueMode: !!req.body.continue_mode,
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
      isGroupChat: true,
      participants,
      respondingCharacterName: character.name,
      // حذف blok‌های think از تاریخچه پیام‌ها
      stripThink: !!settings.strip_think,
    }
  );

  // Identity enforcement for group chat
  const otherParticipants = participants.filter(p => p.character_id !== character_id);
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
- If you need another character to speak, STOP and let the system handle it${otherCharsInfo}`,
  });

  const { v4: uuid } = await import('uuid');
  const endpoint = buildEndpoint(settings.base_url);
  const headers = buildHeaders(settings.api_key);

  const editedMessages = (req.body as any)?.edited_messages;
  const effectiveParts = editedMessages && Array.isArray(editedMessages) && editedMessages.length > 0
    ? editedMessages.map((m: any) => ({ role: m.role, content: m.content }))
    : promptParts;

  // ابزار update_story_state
  const storyStateTool = getStoryStateToolDefinition([character.name]);
  console.log(`[GroupChat][StoryState] Tool definition for character: ${character.name}`);

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
    reasoning_effort: settings.reasoning_effort || undefined,
  });

  // Prompt Inspector dry-run
  if ((req.body as any)?.inspect) {
    const parsed = JSON.parse(requestBody);
    const { model, messages, ...params } = parsed;
    res.json({
      inspect: true,
      source: 'chat',
      mode: update_message_id ? 'regenerate' : 'send',
      endpoint,
      model,
      params,
      messages,
      character_name: character.name,
      character_avatar: character.avatar,
    });
    return;
  }

  let msgId: string;
  const now = new Date().toISOString();

  if (update_message_id) {
    msgId = update_message_id;
    db.prepare('UPDATE messages SET content = ?, sender_name = ?, sender_avatar = ?, sender_character_id = ? WHERE id = ?')
      .run('', character.name, character.avatar, character.id, msgId);
  } else {
    msgId = uuid();
    db.prepare(`
      INSERT INTO messages (id, chat_id, role, content, swipes, swipe_id, is_edited, is_system, send_date, sender_name, sender_avatar, sender_character_id)
      VALUES (?, ?, 'assistant', '', '[]', 0, 0, 0, ?, ?, ?, ?)
    `).run(msgId, req.params.id, now, character.name, character.avatar, character.id);
  }

  // Handle streaming
  if (settings.stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    res.write(`data: ${JSON.stringify({ message_id: msgId })}\n\n`);

    try {
      const response = await fetch(endpoint, { method: 'POST', headers, body: requestBody });
      if (!response.ok) {
        const errorText = await response.text();
        res.write(`data: ${JSON.stringify({ error: `API error: ${response.status}: ${errorText}` })}\n\n`);
        res.end();
        return;
      }

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
          let chunkCount = 0;

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

          const processChunk = (rawData: string) => {
            chunkCount++;
            try {
              const parsed = JSON.parse(rawData);
              const delta = parsed.choices?.[0]?.delta;

              // Check for tool calls
              if (delta?.tool_calls) {
                console.log(`[GroupChat][StoryState] Tool call detected in chunk ${chunkCount}`);
                for (const tc of delta.tool_calls) {
                  if (tc.index !== undefined) {
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
              const parsed = parseStreamChunkFull(rawData);
              if (parsed) sendToken(parsed.token, parsed.isReasoning);
            }
          };

          while (!done) {
            const { done: streamDone, value } = await reader.read();
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
            if (done) break;
          }

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
            console.error('Group chat stream error:', streamError);
          }
        }
      }

      // Strip tool calls from content before saving
      const strippedContent = stripToolCallsFromContent(fullContent);
      if (strippedContent !== fullContent) {
        fullContent = strippedContent;
      }

      db.prepare('UPDATE messages SET content = ? WHERE id = ?').run(fullContent, msgId);
      if (update_message_id && fullContent) {
        const msg = db.prepare('SELECT swipes FROM messages WHERE id = ?').get(msgId) as any;
        if (msg) {
          const swipes = JSON.parse(msg.swipes || '[]');
          swipes.push(fullContent);
          db.prepare('UPDATE messages SET swipes = ?, swipe_id = ? WHERE id = ?')
            .run(JSON.stringify(swipes), swipes.length - 1, msgId);
        }
      }
      db.prepare('UPDATE chats SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), req.params.id);

      // ─── Story State Processing (Tool Calls) ───
      let storyStateUpdated = false;
      let newStoryState = null;
      console.log(`[GroupChat][StoryState] Tool calls received: ${toolCalls.length}`);

      // Save snapshot before state update (for rollback)
      if (toolCalls.length > 0 || fullContent) {
        const existingRowForSnapshot = db.prepare('SELECT * FROM chat_story_state WHERE chat_id = ?').get(req.params.id) as any;
        if (existingRowForSnapshot) {
          const snapshotId = uuidv4();
          db.prepare(`
            INSERT INTO chat_state_snapshots (id, chat_id, message_id, state_json, created_at)
            VALUES (?, ?, ?, ?, ?)
          `).run(snapshotId, req.params.id, msgId, existingRowForSnapshot.state_json, new Date().toISOString());
          console.log(`[GroupChat][StoryState] Snapshot saved for message: ${msgId}`);
        }
      }

      for (const toolCall of toolCalls) {
        if (toolCall.function?.name === 'update_story_state') {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            const existingRow = db.prepare('SELECT * FROM chat_story_state WHERE chat_id = ?').get(req.params.id) as any;
            let currentState = { characters: {}, relationships: {}, current_situation: '', rules: [], relationship_details: {}, memories: [] };
            if (existingRow) {
              try { currentState = JSON.parse(existingRow.state_json); } catch {}
            }
            newStoryState = deepMergeState(currentState, args);
            const now2 = new Date().toISOString();
            if (existingRow) {
              db.prepare('UPDATE chat_story_state SET state_json = ?, updated_at = ? WHERE chat_id = ?')
                .run(JSON.stringify(newStoryState), now2, req.params.id);
            } else {
              db.prepare('INSERT INTO chat_story_state (id, chat_id, state_json, updated_at) VALUES (?, ?, ?, ?)')
                .run(uuidv4(), req.params.id, JSON.stringify(newStoryState), now2);
            }
            storyStateUpdated = true;
            console.log(`[GroupChat][StoryState] State updated via tool call`);
          } catch (e) {
            console.error('[GroupChat][StoryState] Failed to process update_story_state:', e);
          }
        }
      }

      // Fallback: parse tool calls from text if no tool calls were detected
      if (!storyStateUpdated && fullContent) {
        console.log(`[GroupChat][StoryState] No tool calls detected, trying text parsing...`);
        const textToolCalls = parseToolCallsFromText(fullContent);
        console.log(`[GroupChat][StoryState] Found ${textToolCalls.length} tool calls in text`);

        for (const toolCall of textToolCalls) {
          if (toolCall.function?.name === 'update_story_state') {
            try {
              const args = JSON.parse(toolCall.function.arguments);
              const existingRow = db.prepare('SELECT * FROM chat_story_state WHERE chat_id = ?').get(req.params.id) as any;
              let currentState = { characters: {}, relationships: {}, current_situation: '', rules: [], relationship_details: {}, memories: [] };
              if (existingRow) {
                try { currentState = JSON.parse(existingRow.state_json); } catch {}
              }
              newStoryState = deepMergeState(currentState, args);
              const now2 = new Date().toISOString();
              if (existingRow) {
                db.prepare('UPDATE chat_story_state SET state_json = ?, updated_at = ? WHERE chat_id = ?')
                  .run(JSON.stringify(newStoryState), now2, req.params.id);
              } else {
                db.prepare('INSERT INTO chat_story_state (id, chat_id, state_json, updated_at) VALUES (?, ?, ?, ?)')
                  .run(uuidv4(), req.params.id, JSON.stringify(newStoryState), now2);
              }
              storyStateUpdated = true;
              console.log(`[GroupChat][StoryState] State updated via text parsing`);
            } catch (e) {
              console.error('[GroupChat][StoryState] Failed to process update_story_state from text:', e);
            }
          }
        }
      }

      // Send story state update before DONE
      if (storyStateUpdated && newStoryState) {
        res.write(`data: ${JSON.stringify({ story_state_updated: true, state: newStoryState })}\n\n`);
      }

      if (!streamAborted) {
        res.write('data: [DONE]\n\n');
      }
      res.end();
    } catch (error: any) {
      console.error('Group chat generation error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message || 'Error generating response' });
      } else {
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      }
    }
  } else {
    // Non-streaming
    try {
      const response = await fetch(endpoint, { method: 'POST', headers, body: requestBody });
      if (!response.ok) {
        const errorText = await response.text();
        res.status(response.status).json({ error: `API error: ${errorText}` });
        return;
      }

      const data = await response.json() as any;
      let content = parseNonStreamingResponse(data);

      // Process tool calls from response
      let storyStateUpdated = false;
      let newStoryState = null;

      // Check for tool_calls in response
      const responseToolCalls = data.choices?.[0]?.message?.tool_calls || [];
      if (responseToolCalls.length > 0) {
        console.log(`[GroupChat][StoryState] Non-streaming: ${responseToolCalls.length} tool calls`);
        for (const toolCall of responseToolCalls) {
          if (toolCall.function?.name === 'update_story_state') {
            try {
              const args = typeof toolCall.function.arguments === 'string'
                ? JSON.parse(toolCall.function.arguments)
                : toolCall.function.arguments;
              const existingRow = db.prepare('SELECT * FROM chat_story_state WHERE chat_id = ?').get(req.params.id) as any;
              let currentState = { characters: {}, relationships: {}, current_situation: '', rules: [], relationship_details: {}, memories: [] };
              if (existingRow) {
                try { currentState = JSON.parse(existingRow.state_json); } catch {}
              }
              newStoryState = deepMergeState(currentState, args);
              const now2 = new Date().toISOString();
              if (existingRow) {
                db.prepare('UPDATE chat_story_state SET state_json = ?, updated_at = ? WHERE chat_id = ?')
                  .run(JSON.stringify(newStoryState), now2, req.params.id);
              } else {
                db.prepare('INSERT INTO chat_story_state (id, chat_id, state_json, updated_at) VALUES (?, ?, ?, ?)')
                  .run(uuidv4(), req.params.id, JSON.stringify(newStoryState), now2);
              }
              storyStateUpdated = true;
              console.log(`[GroupChat][StoryState] State updated via tool call (non-streaming)`);
            } catch (e) {
              console.error('[GroupChat][StoryState] Failed to process update_story_state:', e);
            }
          }
        }
      }

      // Fallback: parse tool calls from text
      if (!storyStateUpdated && content) {
        const textToolCalls = parseToolCallsFromText(content);
        for (const toolCall of textToolCalls) {
          if (toolCall.function?.name === 'update_story_state') {
            try {
              const args = JSON.parse(toolCall.function.arguments);
              const existingRow = db.prepare('SELECT * FROM chat_story_state WHERE chat_id = ?').get(req.params.id) as any;
              let currentState = { characters: {}, relationships: {}, current_situation: '', rules: [], relationship_details: {}, memories: [] };
              if (existingRow) {
                try { currentState = JSON.parse(existingRow.state_json); } catch {}
              }
              newStoryState = deepMergeState(currentState, args);
              const now2 = new Date().toISOString();
              if (existingRow) {
                db.prepare('UPDATE chat_story_state SET state_json = ?, updated_at = ? WHERE chat_id = ?')
                  .run(JSON.stringify(newStoryState), now2, req.params.id);
              } else {
                db.prepare('INSERT INTO chat_story_state (id, chat_id, state_json, updated_at) VALUES (?, ?, ?, ?)')
                  .run(uuidv4(), req.params.id, JSON.stringify(newStoryState), now2);
              }
              storyStateUpdated = true;
              console.log(`[GroupChat][StoryState] State updated via text parsing (non-streaming)`);
            } catch (e) {
              console.error('[GroupChat][StoryState] Failed to process update_story_state from text:', e);
            }
          }
        }
      }

      // Strip tool calls from content
      content = stripToolCallsFromContent(content);

      db.prepare('UPDATE messages SET content = ? WHERE id = ?').run(content, msgId);
      if (update_message_id && content) {
        const msg = db.prepare('SELECT swipes FROM messages WHERE id = ?').get(msgId) as any;
        if (msg) {
          const swipes = JSON.parse(msg.swipes || '[]');
          swipes.push(content);
          db.prepare('UPDATE messages SET swipes = ?, swipe_id = ? WHERE id = ?')
            .run(JSON.stringify(swipes), swipes.length - 1, msgId);
        }
      }
      db.prepare('UPDATE chats SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), req.params.id);

      res.json({ content, message_id: msgId, ...(storyStateUpdated && newStoryState ? { story_state_updated: true, state: newStoryState } : {}) });
    } catch (error: any) {
      console.error('Group chat generation error:', error);
      res.status(500).json({ error: error.message || 'Error generating response' });
    }
  }
});

// ═══════════════════════════════════════════════════════════
// Group Chat Settings (simplified)
// ═══════════════════════════════════════════════════════════

// ─── Get Group Chat Settings ───
router.get('/:id/settings', (req: Request, res: Response) => {
  const db = getDb();
  const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(req.params.id) as any;
  if (!chat || !chat.is_group_chat) {
    res.status(404).json({ error: 'Group chat not found' });
    return;
  }

  let settings = db.prepare('SELECT * FROM group_chat_settings WHERE chat_id = ?').get(req.params.id);
  if (!settings) {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO group_chat_settings (id, chat_id, auto_respond_character_id)
      VALUES (?, ?, NULL)
    `).run(id, req.params.id);
    settings = db.prepare('SELECT * FROM group_chat_settings WHERE chat_id = ?').get(req.params.id);
  }
  res.json(settings);
});

// ─── Update Group Chat Settings ───
router.put('/:id/settings', (req: Request, res: Response) => {
  const db = getDb();
  const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(req.params.id) as any;
  if (!chat || !chat.is_group_chat) {
    res.status(404).json({ error: 'Group chat not found' });
    return;
  }

  // Ensure settings exist
  let settings = db.prepare('SELECT * FROM group_chat_settings WHERE chat_id = ?').get(req.params.id) as any;
  if (!settings) {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO group_chat_settings (id, chat_id, auto_respond_character_id)
      VALUES (?, ?, NULL)
    `).run(id, req.params.id);
    settings = db.prepare('SELECT * FROM group_chat_settings WHERE chat_id = ?').get(req.params.id) as any;
  }

  if (req.body.auto_respond_character_id !== undefined) {
    db.prepare('UPDATE group_chat_settings SET auto_respond_character_id = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(req.body.auto_respond_character_id, settings.id);
  }

  const updated = db.prepare('SELECT * FROM group_chat_settings WHERE id = ?').get(settings.id);
  res.json(updated);
});

export default router;
