import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';

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

  // Use first character as primary (for backward compat)
  const primaryCharId = character_ids[0];

  // Create the chat
  const chatName = name || 'Group Chat';
  db.prepare(`
    INSERT INTO chats (id, character_id, name, is_group_chat, group_chat_name, lorebook_id, created_at, updated_at)
    VALUES (?, ?, ?, 1, ?, ?, ?, ?)
  `).run(id, primaryCharId, chatName, chatName, lorebook_id || '', now, now);

  // Add participants
  const insertParticipant = db.prepare(`
    INSERT INTO chat_participants (id, chat_id, character_id, display_name, display_avatar, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, 1, ?)
  `);

  for (const charId of character_ids) {
    const char = db.prepare('SELECT name, avatar FROM characters WHERE id = ?').get(charId) as any;
    insertParticipant.run(
      uuidv4(), id, charId,
      char?.name || '',
      char?.avatar || '',
      now
    );
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

  // Check if already a participant
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

  // Check if character exists
  const newChar = db.prepare('SELECT name, avatar FROM characters WHERE id = ?').get(character_id) as any;
  if (!newChar) {
    res.status(404).json({ error: 'Character not found' });
    return;
  }

  const now = new Date().toISOString();
  const transaction = db.transaction(() => {
    // If not a group chat, convert it
    if (!chat.is_group_chat) {
      // Set as group chat
      db.prepare('UPDATE chats SET is_group_chat = 1, group_chat_name = ? WHERE id = ?')
        .run(chat.name, chat.id);

      // Add original character as participant
      const originalChar = db.prepare('SELECT name, avatar FROM characters WHERE id = ?')
        .get(chat.character_id) as any;

      if (originalChar) {
        db.prepare(`
          INSERT INTO chat_participants (id, chat_id, character_id, display_name, display_avatar, is_active, created_at)
          VALUES (?, ?, ?, ?, ?, 1, ?)
        `).run(uuidv4(), chat.id, chat.character_id, originalChar.name, originalChar.avatar || '', now);
      }
    }

    // Check if new character is already a participant
    const existing = db.prepare(
      'SELECT id FROM chat_participants WHERE chat_id = ? AND character_id = ?'
    ).get(chat.id, character_id);

    if (!existing) {
      // Add new character as participant
      db.prepare(`
        INSERT INTO chat_participants (id, chat_id, character_id, display_name, display_avatar, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, 1, ?)
      `).run(uuidv4(), chat.id, character_id, newChar.name, newChar.avatar || '', now);
    }

    // Add system message if requested
    if (add_system_message !== false) {
      db.prepare(`
        INSERT INTO messages (id, chat_id, role, content, swipes, swipe_id, is_edited, is_system, send_date, sender_name)
        VALUES (?, ?, 'system', ?, '[]', 0, 0, 1, ?, '')
      `).run(
        uuidv4(),
        chat.id,
        `*${newChar.name} has entered the chat.*`,
        now
      );
    }
  });

  transaction();

  // Return updated chat with participants
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

  // Get character info
  const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(character_id) as any;
  if (!character) {
    res.status(400).json({ error: 'Character not found' });
    return;
  }

  // Get persona
  const persona = persona_id ? db.prepare('SELECT * FROM personas WHERE id = ?').get(persona_id) as any : null;

  // Get messages
  const messages = db.prepare(
    'SELECT * FROM messages WHERE chat_id = ? ORDER BY rowid ASC'
  ).all(req.params.id) as any[];

  // Get participants for context
  const participants = db.prepare(
    'SELECT cp.*, c.name as char_name, c.description as char_desc, c.personality as char_personality FROM chat_participants cp JOIN characters c ON cp.character_id = c.id WHERE cp.chat_id = ? AND cp.is_active = 1'
  ).all(req.params.id) as any[];

  // Build character info with all participants
  const participantInfo = participants.map(p =>
    `${p.char_name}: ${p.char_desc || ''} ${p.char_personality || ''}`
  ).join('\n');

  // Get lorebook entries
  const effectiveLorebookId = lorebook_id || chat?.lorebook_id;
  let lorebookEntries: any[] = [];
  if (effectiveLorebookId) {
    const lorebook = db.prepare('SELECT * FROM lorebooks WHERE id = ?').get(effectiveLorebookId) as any;
    if (lorebook) {
      const entries = db.prepare('SELECT * FROM lorebook_entries WHERE lorebook_id = ?').all(effectiveLorebookId).map((e: any) => ({
        ...e,
        key: JSON.parse(e.keys || '[]'),
        keysecondary: JSON.parse(e.keys_secondary || '[]'),
        constant: !!e.constant,
        selective: !!e.selective,
        disable: !!e.disable,
      }));
      // Import activateWorldInfo dynamically
      const { activateWorldInfo } = await import('../utils/prompt-builder.js');
      lorebookEntries = activateWorldInfo(messages, { ...lorebook, entries });
    }
  }

  // Get API settings
  const settings = db.prepare("SELECT * FROM api_settings ORDER BY ROWID DESC LIMIT 1").get() as any;
  if (!settings) {
    res.status(400).json({ error: 'API settings not found' });
    return;
  }

  // Build prompt parts
  const { buildPrompt } = await import('../utils/prompt-builder.js');
  const { buildEndpoint, buildHeaders, buildRequestBody, createLineBuffer, parseStreamChunk, parseNonStreamingResponse } = await import('../utils/providers.js');

  // Build system prompt with all participants context
  const systemPrompt = settings.system_prompt || '';

  // فیلتر کردن پیام‌ها برای regenerate: حذف محتوای قدیمی پیام هدف
  let filteredMessages = messages;
  if (update_message_id && !req.body.continue_mode) {
    filteredMessages = messages.map(m =>
      m.id === update_message_id ? { ...m, content: '' } : m
    );
  }

  const promptParts = buildPrompt(
    { ...character, description: `${character.description}\n\nGroup Members:\n${participantInfo}` },
    persona,
    filteredMessages,
    lorebookEntries,
    systemPrompt,
    {
      impersonate: false,
      continueMode: !!req.body.continue_mode,
    }
  );

  // Add instruction for group chat
  promptParts.push({
    role: 'system',
    content: `[Group Chat] You are responding as "${character.name}". Write only ONE message as this character. Do not write messages for other characters. Stay in character.`,
  });

  // Build request
  const { v4: uuid } = await import('uuid');
  const endpoint = buildEndpoint(settings.base_url);
  const headers = buildHeaders(settings.api_key);
  const requestBody = buildRequestBody(promptParts, {
    model: settings.model,
    temperature: settings.temperature,
    max_tokens: settings.max_tokens,
    top_p: settings.top_p,
    frequency_penalty: settings.frequency_penalty,
    presence_penalty: settings.presence_penalty,
    stream: !!settings.stream,
    stop: JSON.parse(settings.stop || '[]'),
  });

  // Handle update_message_id for regeneration
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
        // Headers already sent — write error as SSE data, not JSON response
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
                const token = parseStreamChunk(data);
                if (token) {
                  fullContent += token;
                  res.write(`data: ${JSON.stringify({ token })}\n\n`);
                }
              }
            }
          }

          // پردازش باقیمانده buffer
          const remaining = lineBuffer.flush();
          for (const line of remaining) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
              const data = trimmed.slice(6);
              if (data !== '[DONE]') {
                const token = parseStreamChunk(data);
                if (token) {
                  fullContent += token;
                  res.write(`data: ${JSON.stringify({ token })}\n\n`);
                }
              }
            }
          }
        } catch (streamError: any) {
          if (streamError?.name === 'AbortError') {
            streamAborted = true;
          } else {
            console.error('Group chat stream error:', streamError);
          }
        }
      }

      db.prepare('UPDATE messages SET content = ? WHERE id = ?').run(fullContent, msgId);
      // اگر ریجنریت بود، محتوای جدید رو به swipes اضافه کن و swipe_id رو درست کن
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
      // اگر ریجنریت بود، محتوای جدید رو به swipes اضافه کن و swipe_id رو درست کن
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

export default router;
