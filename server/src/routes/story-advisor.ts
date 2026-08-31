import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { buildEndpoint, buildHeaders, buildRequestBody, createLineBuffer, parseStreamChunkFull } from '../utils/providers';
import { advisorTools, buildAdvisorToolsContext, executeAdvisorTool } from '../utils/advisor-tools';
import { generateCharacterMessage } from '../utils/generate-message';

const router = Router();

const ADVISOR_SYSTEM_PROMPT = `You are a **Story Advisor** — a creative consultant for an interactive fiction / roleplay session.

Your role:
- Analyze the current story and suggest creative directions
- Identify plot holes, character inconsistencies, or pacing issues
- Suggest modifications to character cards, system prompts, or lorebook entries
- Recommend story arcs based on current relationships and situation
- Help the user troubleshoot when the AI response doesn't match expectations
- Provide actionable, specific suggestions (exact text to change, specific prompts to add)

## Tool Use
You have access to tools that can create and modify lorebooks and characters. When the user asks you to:
- **Create a lorebook** → use the \`create_lorebook\` tool
- **Add entries to a lorebook** → use the \`add_lorebook_entries\` tool
- **Edit a lorebook entry** → use the \`update_lorebook_entry\` tool
- **Create a character** → use the \`create_character\` tool
- **Edit/update a character** → use the \`update_character\` tool

When using tools:
- Provide complete, well-thought-out content
- Include helpful comments describing each entry's purpose
- Use descriptive keywords for lorebook entries
- Always explain what you're doing in your text response alongside the tool call
- If the user asks for something complex, break it into multiple tool calls

Rules:
- Respond in the same language the user writes in (Persian or English)
- Be specific and actionable in your suggestions
- When suggesting character card changes, provide the exact text to modify
- You are NOT the character — you are an out-of-character creative consultant
- Keep responses focused and practical
- Use markdown formatting for clarity when needed`;

// ─── Build context for the advisor ───
function buildAdvisorContext(mainChatId: string, db: any): string {
  const parts: string[] = [];

  // 1. Character info
  const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(mainChatId) as any;
  if (chat) {
    // Check if it's a group chat
    if (chat.is_group_chat) {
      // For group chats, get all participants' character cards
      const participants = db.prepare(
        'SELECT c.* FROM chat_participants cp JOIN characters c ON cp.character_id = c.id WHERE cp.chat_id = ? AND cp.is_active = 1'
      ).all(mainChatId) as any[];
      
      if (participants.length > 0) {
        const characterCards = participants.map((character: any) => 
          `[Character Card]
Name: ${character.name}
Description: ${character.description || ''}
Personality: ${character.personality || ''}
Scenario: ${character.scenario || ''}
System Prompt: ${character.system_prompt || ''}
First Message: ${character.first_mes || ''}`
        ).join('\n\n');
        parts.push(characterCards);
      }
    } else {
      // For normal chats, get the single character
      const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(chat.character_id) as any;
      if (character) {
        parts.push(`[Character Card]
Name: ${character.name}
Description: ${character.description || ''}
Personality: ${character.personality || ''}
Scenario: ${character.scenario || ''}
System Prompt: ${character.system_prompt || ''}
First Message: ${character.first_mes || ''}`);
      }
    }

    // 2. Authors note
    if (chat.authors_note) {
      parts.push(`[Author's Note]
${chat.authors_note}`);
    }
  }

  // 3. Story State
  const storyStateRow = db.prepare('SELECT * FROM chat_story_state WHERE chat_id = ?').get(mainChatId) as any;
  if (storyStateRow) {
    try {
      const state = JSON.parse(storyStateRow.state_json);
      const stateParts: string[] = [];

      if (state.characters && Object.keys(state.characters).length > 0) {
        const charText = Object.entries(state.characters).map(([name, s]: [string, any]) => {
          const details = [];
          if (s.location) details.push(`Location: ${s.location}`);
          if (s.position) details.push(`Position: ${s.position}`);
          if (s.clothing) details.push(`Clothing: ${s.clothing}`);
          return `${name}: ${details.join(', ') || 'Unknown'}`;
        }).join('\n');
        stateParts.push(`Characters:\n${charText}`);
      }

      if (state.relationships && Object.keys(state.relationships).length > 0) {
        const relText = Object.entries(state.relationships).map(([pair, status]) => `- ${pair}: ${status}`).join('\n');
        stateParts.push(`Relationships:\n${relText}`);
      }

      if (state.relationship_details && Object.keys(state.relationship_details).length > 0) {
        const detailText = Object.entries(state.relationship_details).map(([pair, detail]: [string, any]) => {
          const emotions = [];
          if (detail.love !== undefined) emotions.push(`Love: ${detail.love}%`);
          if (detail.trust !== undefined) emotions.push(`Trust: ${detail.trust}%`);
          if (detail.anger !== undefined) emotions.push(`Anger: ${detail.anger}%`);
          if (detail.fear !== undefined) emotions.push(`Fear: ${detail.fear}%`);
          if (detail.summary) emotions.push(`Summary: ${detail.summary}`);
          return `- ${pair}: ${emotions.join(', ') || 'Neutral'}`;
        }).join('\n');
        stateParts.push(`Relationship Details:\n${detailText}`);
      }

      if (state.current_situation) {
        stateParts.push(`Current Situation: ${state.current_situation}`);
      }

      if (state.rules && state.rules.length > 0) {
        stateParts.push(`Story Rules:\n${state.rules.map((r: string) => `- ${r}`).join('\n')}`);
      }

      if (state.memories && state.memories.length > 0) {
        const memText = state.memories.map((m: any) => `- ${m.content}`).join('\n');
        stateParts.push(`Important Memories:\n${memText}`);
      }

      if (stateParts.length > 0) {
        parts.push(`[Current Story State]\n${stateParts.join('\n\n')}`);
      }
    } catch {}
  }

  // 4. Chapter summaries
  const chapters = db.prepare("SELECT summary, title FROM chapters WHERE chat_id = ? AND summary != '' ORDER BY created_at ASC").all(mainChatId) as any[];
  if (chapters.length > 0) {
    const summaryText = chapters.map((ch: any, i: number) => {
      const title = ch.title || `Chapter ${i + 1}`;
      return `[${title}]\n${ch.summary}`;
    }).join('\n\n');
    parts.push(`[Story So Far]\n${summaryText}`);
  }

  // 5. Recent messages (last 30)
  const messages = db.prepare(
    "SELECT role, content, sender_name FROM messages WHERE chat_id = ? ORDER BY rowid DESC LIMIT 30"
  ).all(mainChatId) as any[];
  if (messages.length > 0) {
    const msgText = messages.reverse().map((m: any) => {
      // Use sender_name for assistant messages in group chats
      const label = m.role === 'user' ? 'User' : (m.sender_name || 'Character');
      return `${label}: ${m.content}`;
    }).join('\n\n');
    parts.push(`[Recent Chat History (last ${messages.length} messages)]\n${msgText}`);
  }

  return parts.join('\n\n---\n\n');
}

// ─── GET /chats/:mainChatId — List advisor chats for a main chat ───
router.get('/chats/:mainChatId', (req: Request, res: Response) => {
  const db = getDb();
  const chats = db.prepare(
    'SELECT * FROM story_advisor_chats WHERE main_chat_id = ? ORDER BY updated_at DESC'
  ).all(req.params.mainChatId);
  res.json(chats);
});

// ─── POST /chats — Create new advisor chat ───
router.post('/chats', (req: Request, res: Response) => {
  const db = getDb();
  const { main_chat_id, name } = req.body;

  if (!main_chat_id) {
    res.status(400).json({ error: 'main_chat_id is required' });
    return;
  }

  // Verify main chat exists
  const mainChat = db.prepare('SELECT id FROM chats WHERE id = ?').get(main_chat_id);
  if (!mainChat) {
    res.status(400).json({ error: 'Main chat not found' });
    return;
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  const chatName = name || 'Advisor Chat';

  db.prepare(
    'INSERT INTO story_advisor_chats (id, main_chat_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, main_chat_id, chatName, now, now);

  const chat = db.prepare('SELECT * FROM story_advisor_chats WHERE id = ?').get(id);
  res.status(201).json(chat);
});

// ─── DELETE /chats/:id — Delete advisor chat and its messages ───
router.delete('/chats/:id', (req: Request, res: Response) => {
  const db = getDb();
  const chat = db.prepare('SELECT * FROM story_advisor_chats WHERE id = ?').get(req.params.id);
  if (!chat) {
    res.status(404).json({ error: 'Advisor chat not found' });
    return;
  }

  db.prepare('DELETE FROM story_advisor_messages WHERE advisor_chat_id = ?').run(req.params.id);
  db.prepare('DELETE FROM story_advisor_chats WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ─── PUT /chats/:id — Rename advisor chat ───
router.put('/chats/:id', (req: Request, res: Response) => {
  const db = getDb();
  const chat = db.prepare('SELECT * FROM story_advisor_chats WHERE id = ?').get(req.params.id) as any;
  if (!chat) {
    res.status(404).json({ error: 'Advisor chat not found' });
    return;
  }

  const { name } = req.body;
  if (name !== undefined) {
    db.prepare('UPDATE story_advisor_chats SET name = ?, updated_at = ? WHERE id = ?')
      .run(name, new Date().toISOString(), req.params.id);
  }

  const updated = db.prepare('SELECT * FROM story_advisor_chats WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// ─── GET /chats/:id/messages — Get messages for an advisor chat ───
router.get('/chats/:id/messages', (req: Request, res: Response) => {
  const db = getDb();
  const messages = db.prepare(
    'SELECT * FROM story_advisor_messages WHERE advisor_chat_id = ? ORDER BY created_at ASC'
  ).all(req.params.id);
  res.json(messages);
});

// ─── DELETE /chats/:id/messages — Clear messages for an advisor chat ───
router.delete('/chats/:id/messages', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM story_advisor_messages WHERE advisor_chat_id = ?').run(req.params.id);
  db.prepare('UPDATE story_advisor_chats SET updated_at = ? WHERE id = ?')
    .run(new Date().toISOString(), req.params.id);
  res.json({ success: true });
});

// ─── POST /send — Send message and stream advisor response ───
router.post('/send', async (req: Request, res: Response) => {
  const db = getDb();
  const { advisor_chat_id, message } = req.body;

  if (!advisor_chat_id || !message?.trim()) {
    res.status(400).json({ error: 'advisor_chat_id and message are required' });
    return;
  }

  const advisorChat = db.prepare('SELECT * FROM story_advisor_chats WHERE id = ?').get(advisor_chat_id) as any;
  if (!advisorChat) {
    res.status(404).json({ error: 'Advisor chat not found' });
    return;
  }

  // Get API settings
  const settings = db.prepare("SELECT * FROM api_settings ORDER BY ROWID DESC LIMIT 1").get() as any;
  if (!settings) {
    res.status(400).json({ error: 'API settings not found' });
    return;
  }

  // Save user message
  const userMsgId = uuidv4();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO story_advisor_messages (id, advisor_chat_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(userMsgId, advisorChat.id, 'user', message.trim(), now);

  // Update chat timestamp
  db.prepare('UPDATE story_advisor_chats SET updated_at = ? WHERE id = ?').run(now, advisorChat.id);

  // Build context from main chat
  const context = buildAdvisorContext(advisorChat.main_chat_id, db);

  // Build tools context (available lorebooks, characters)
  const toolsContext = buildAdvisorToolsContext(db);

  // Build conversation history
  const history = db.prepare(
    'SELECT role, content FROM story_advisor_messages WHERE advisor_chat_id = ? ORDER BY created_at ASC'
  ).all(advisorChat.id) as any[];

  // Build prompt
  const promptParts: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: ADVISOR_SYSTEM_PROMPT },
    ...(context ? [{ role: 'system' as const, content: `[Story Context]\n${context}` }] : []),
    ...(toolsContext ? [{ role: 'system' as const, content: toolsContext }] : []),
    ...history.map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ];

  const endpoint = buildEndpoint(settings.base_url);
  const headers = buildHeaders(settings.api_key);
  const requestBody = buildRequestBody(promptParts, {
    model: settings.model,
    temperature: 0.7,
    max_tokens: settings.max_tokens || 2048,
    top_p: settings.top_p,
    frequency_penalty: settings.frequency_penalty,
    presence_penalty: settings.presence_penalty,
    stream: !!settings.stream,
    tools: advisorTools,
    tool_choice: 'auto',
    reasoning_effort: settings.reasoning_effort || undefined,
  });

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: requestBody,
    });

    if (!response.ok) {
      const errorText = await response.text();
      res.write(`data: ${JSON.stringify({ error: `API error: ${response.status}: ${errorText}` })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';

    // Track tool calls from streaming
    const toolCalls: Record<number, { id: string; type: string; function: { name: string; arguments: string } }> = {};

    if (settings.stream && reader) {
      const lineBuffer = createLineBuffer();
      let done = false;
      let inThinking = false;

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
        try {
          const parsed = JSON.parse(rawData);
          const delta = parsed.choices?.[0]?.delta;

          // Check for tool calls
          if (delta?.tool_calls) {
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
      }
      if (inThinking) {
        fullContent += '</think>';
        res.write(`data: ${JSON.stringify({ token: '</think>' })}\n\n`);
      }

      // Flush remaining buffer
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
    } else {
      // Non-streaming
      const data = await response.json() as any;
      const msg = data.choices?.[0]?.message;

      // Handle tool calls in non-streaming
      if (msg?.tool_calls) {
        for (const [i, tc] of msg.tool_calls.entries()) {
          toolCalls[i] = {
            id: tc.id || '',
            type: 'function',
            function: {
              name: tc.function?.name || '',
              arguments: typeof tc.function?.arguments === 'string'
                ? tc.function.arguments
                : JSON.stringify(tc.function?.arguments || {}),
            },
          };
        }
      }

      if (msg?.content) {
        fullContent = msg.content;
      } else if (data.choices?.[0]?.text) {
        fullContent = data.choices[0].text;
      }
      if (fullContent) {
        res.write(`data: ${JSON.stringify({ token: fullContent })}\n\n`);
      }
    }

    // Send tool calls to client for approval
    const toolCallArray = Object.values(toolCalls);
    if (toolCallArray.length > 0) {
      for (const tc of toolCallArray) {
        try {
          const parsedArgs = JSON.parse(tc.function.arguments);
          res.write(`data: ${JSON.stringify({
            tool_call: {
              id: tc.id,
              name: tc.function.name,
              arguments: parsedArgs,
            }
          })}\n\n`);
        } catch {
          // If arguments can't be parsed, send raw
          res.write(`data: ${JSON.stringify({
            tool_call: {
              id: tc.id,
              name: tc.function.name,
              arguments_raw: tc.function.arguments,
            }
          })}\n\n`);
        }
      }
    }

    // Save assistant message
    if (fullContent) {
      const assistantMsgId = uuidv4();
      db.prepare(
        'INSERT INTO story_advisor_messages (id, advisor_chat_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run(assistantMsgId, advisorChat.id, 'assistant', fullContent, new Date().toISOString());
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('Story Advisor error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Error generating response' });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
});

// ─── POST /generate-message — Generate a character message preview ───
router.post('/generate-message', async (req: Request, res: Response) => {
  const db = getDb();
  const { advisor_chat_id, character_id, instruction } = req.body;

  if (!advisor_chat_id || !character_id || !instruction?.trim()) {
    res.status(400).json({ error: 'advisor_chat_id, character_id, and instruction are required' });
    return;
  }

  const advisorChat = db.prepare('SELECT * FROM story_advisor_chats WHERE id = ?').get(advisor_chat_id) as any;
  if (!advisorChat) {
    res.status(404).json({ error: 'Advisor chat not found' });
    return;
  }

  const result = await generateCharacterMessage({
    chat_id: advisorChat.main_chat_id,
    character_id,
    instruction: instruction.trim(),
    db,
  });

  res.json(result);
});

// ─── POST /insert-message — Insert a generated message into the main chat ───
router.post('/insert-message', async (req: Request, res: Response) => {
  const db = getDb();
  const { advisor_chat_id, character_id, content } = req.body;

  if (!advisor_chat_id || !character_id || !content?.trim()) {
    res.status(400).json({ error: 'advisor_chat_id, character_id, and content are required' });
    return;
  }

  const advisorChat = db.prepare('SELECT * FROM story_advisor_chats WHERE id = ?').get(advisor_chat_id) as any;
  if (!advisorChat) {
    res.status(404).json({ error: 'Advisor chat not found' });
    return;
  }

  // Get character info
  const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(character_id) as any;
  if (!character) {
    res.status(404).json({ error: 'Character not found' });
    return;
  }

  // Insert message into main chat
  const messageId = uuidv4();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO messages (id, chat_id, role, content, sender_name, sender_avatar, sender_character_id, swipes, swipe_id, is_edited, is_system, send_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    messageId,
    advisorChat.main_chat_id,
    'assistant',
    content.trim(),
    character.name,
    character.avatar || '',
    character_id,
    '[]',
    0,
    0,
    0,
    now
  );

  // Update chat timestamp
  db.prepare('UPDATE chats SET updated_at = ? WHERE id = ?').run(now, advisorChat.main_chat_id);

  res.json({ success: true, message_id: messageId });
});

// ─── POST /execute-tool — Execute an approved tool call ───
router.post('/execute-tool', async (req: Request, res: Response) => {
  const db = getDb();
  const { advisor_chat_id, tool_name, arguments: toolArgs } = req.body;

  if (!advisor_chat_id || !tool_name) {
    res.status(400).json({ error: 'advisor_chat_id and tool_name are required' });
    return;
  }

  const advisorChat = db.prepare('SELECT * FROM story_advisor_chats WHERE id = ?').get(advisor_chat_id) as any;
  if (!advisorChat) {
    res.status(404).json({ error: 'Advisor chat not found' });
    return;
  }

  const result = await executeAdvisorTool(tool_name, toolArgs || {}, db, advisorChat.main_chat_id);

  // Add a system message about the tool execution
  const now = new Date().toISOString();
  const toolMsg = `[Tool: ${tool_name}] ${result.message}`;
  db.prepare(
    'INSERT INTO story_advisor_messages (id, advisor_chat_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(uuidv4(), advisorChat.id, 'assistant', toolMsg, now);
  db.prepare('UPDATE story_advisor_chats SET updated_at = ? WHERE id = ?').run(now, advisorChat.id);

  res.json(result);
});

export default router;
