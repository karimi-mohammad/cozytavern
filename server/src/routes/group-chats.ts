import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { stripToolCallsFromContent } from '../utils/strip-tool-calls';

const router = Router();

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
      isGroupChat: true,
      participants,
      respondingCharacterName: character.name,
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

  const requestBody = buildRequestBody(effectiveParts, {
    model: settings.model,
    temperature: settings.temperature,
    max_tokens: settings.max_tokens,
    top_p: settings.top_p,
    frequency_penalty: settings.frequency_penalty,
    presence_penalty: settings.presence_penalty,
    stream: !!settings.stream,
    stop: JSON.parse(settings.stop || '[]'),
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
                const parsed = parseStreamChunkFull(data);
                if (parsed) sendToken(parsed.token, parsed.isReasoning);
              }
            }
          }

          const remaining = lineBuffer.flush();
          for (const line of remaining) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
              const data = trimmed.slice(6);
              if (data !== '[DONE]') {
                const parsed = parseStreamChunkFull(data);
                if (parsed) sendToken(parsed.token, parsed.isReasoning);
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

      fullContent = stripToolCallsFromContent(fullContent);
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

      const data = await response.json();
      const content = parseNonStreamingResponse(data);

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

      res.json({ content, message_id: msgId });
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
