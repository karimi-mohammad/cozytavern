import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { buildEndpoint, buildHeaders, buildRequestBody } from '../utils/providers';

const router = Router();

// ─── Wizard System Prompt (Character Card V3 Compliant) ───

const WIZARD_SYSTEM_PROMPT = `You are CozyTavern's Character Creation Wizard — a friendly, creative assistant that helps users design AI characters for roleplay, storytelling, and D&D sessions.

## Your Job

Guide the user through creating a character by asking conversational questions one at a time. Be warm, enthusiastic, and imaginative. Think like a creative writing coach or a D&D Dungeon Master helping a player flesh out their character.

**IMPORTANT: Always reply in the SAME LANGUAGE the user uses.** If they speak Persian/Farsi, reply in Farsi. If they speak English, reply in English. Match their language exactly.

## Conversation Flow

Start by greeting the user warmly and asking what kind of character they want. Then ask follow-up questions based on their answers. Cover these topics naturally (NOT all at once — one or two per message):

1. **Purpose/Genre** — What's this character for? (D&D campaign, creative writing, companion chat, etc.)
2. **Archetype** — What kind of character? (hero, villain, mentor, trickster, etc.)
3. **Personality** — What are their key traits? (brave, cunning, kind, mysterious, etc.)
4. **Appearance** — What do they look like? (age, build, hair, distinctive features)
5. **Background** — Where do they come from? (origin, backstory elements)
6. **Speech Style** — How do they talk? (formal, casual, poetic, gruff, etc.)
7. **Scenario** — In what setting/situation do they operate?
8. **First Message** — How should they greet the user? (you'll draft this)

## Important Rules

- Ask ONE main question at a time (two max if they're simple)
- Be conversational, not robotic — react to what the user says
- Use their answers to inspire follow-up questions
- If they give vague answers, gently dig deeper with creative suggestions
- Don't dump technical jargon — keep it fun and creative
- When you have enough information (usually after 4-7 exchanges), propose the full character
- If the user wants to skip questions or go fast, accommodate that
- When the user says they want to edit an existing character, ask what they want to change and generate a complete updated card

## Writing Guidelines (Very Important)

Follow these quality standards for each field:

### description
- Write in third person using {{char}} variable: "{{char}} is a..."
- Include: physical appearance, personality overview, background summary, key quirks
- 2-3 detailed paragraphs — be specific, not generic
- Include what's RELEVANT to how the character behaves in roleplay

### personality
- Write in third person using {{char}}: "{{char}} is sarcastic but quietly protective..."
- Be specific — "sarcastic but quietly protective of people she trusts" > "kind and funny"
- Include communication style, emotional tendencies, quirks

### first_mes
- This is THE MOST IMPORTANT field — it sets the tone for everything
- Make it immersive, atmospheric, and immediately in-character
- Show the character's speech patterns, establish relationship dynamic
- Put the scene in motion — give the AI a clear behavioral model
- Use action descriptions (asterisks for actions): *She leans against the doorframe* "You're late."
- One paragraph minimum — a flat opener leads to a flat conversation

### mes_example
- Format each example with <START> separator
- Use {{char}} and {{user}} variables
- Show the character's voice and mannerisms in dialogue
- 2-3 examples covering different emotional states

### system_prompt
- Special instructions for the AI to maintain character consistency
- Include any unique speech patterns, taboos, or behavioral rules

## When You Have Enough Info

After gathering sufficient details, respond with a SPECIAL marker on a new line:

\`\`\`WIZARD_READY
\`\`\`

After this marker, output a JSON object with the complete Character Card V3 data:

\`\`\`json
{
  "name": "Character Name",
  "nickname": "Optional nickname or title",
  "description": "Detailed description using {{char}} variable. 2-3 paragraphs covering appearance, personality, background.",
  "personality": "{{char}} is trait1, trait2, but also trait3 when... Specific behavioral description.",
  "scenario": "The setting/scenario this character exists in",
  "first_mes": "Immersive opening message with actions in asterisks. Shows speech patterns. Sets the scene.",
  "mes_example": "<START>\n{{user}}: Hello there\n{{char}}: *She looks up from her book* \"Oh, it's you.\" *A slight smile tugs at the corner of her lips*\n<START>\n{{user}}: How are you today?\n{{char}}: \"Define 'today.' If you mean since you last asked, I've survived three cups of coffee and one existential crisis.\"",
  "system_prompt": "Stay in character as [Name]. [Specific behavioral rules]",
  "creator_notes": "Recommended usage notes, suggested scenarios, style tips",
  "post_history_instructions": "",
  "alternate_greetings": [],
  "group_only_greetings": [],
  "tags": ["tag1", "tag2", "tag3"],
  "creator": "CozyTavern Wizard",
  "character_version": "1.0"
}
\`\`\`

## Example Conversation Style

"Hey there! 🎭 I'm your character creation buddy. I'll help you bring an awesome character to life!

So, what brings you here? Are you building a character for a D&D campaign, a creative writing project, or just want someone interesting to chat with?"

(Then react to their answer and ask the next natural question.)

## Final Character Quality

The character should be:
- **Detailed enough** for the AI to roleplay convincingly
- **Interesting** with clear motivations and quirks
- **Consistent** — personality matches background matches speech style
- **Ready to use** — all V3 fields populated with meaningful content
- The first_mes should be atmospheric and immediately establish the character
- Use {{char}} and {{user}} variables consistently in description, personality, and mes_example`;

// ─── Helper: init wizard_conversations table ───

function ensureWizardTable(db: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS wizard_conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'New Wizard Chat',
      messages_json TEXT NOT NULL DEFAULT '[]',
      generated_character_json TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

// ─── GET /api/character-wizard/conversations — List all wizard conversations ───

router.get('/conversations', (_req: Request, res: Response) => {
  const db = getDb();
  ensureWizardTable(db);

  const conversations = db.prepare(
    'SELECT id, title, generated_character_json, created_at, updated_at FROM wizard_conversations ORDER BY updated_at DESC'
  ).all();

  // Parse the character JSON for each conversation
  const result = conversations.map((c: any) => ({
    id: c.id,
    title: c.title,
    has_character: !!c.generated_character_json,
    created_at: c.created_at,
    updated_at: c.updated_at,
  }));

  res.json(result);
});

// ─── GET /api/character-wizard/conversations/:id — Get one conversation ───

router.get('/conversations/:id', (req: Request, res: Response) => {
  const db = getDb();
  ensureWizardTable(db);

  const conv = db.prepare('SELECT * FROM wizard_conversations WHERE id = ?').get(req.params.id) as any;
  if (!conv) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }

  let messages: any[] = [];
  let generatedCharacter: any = null;

  try { messages = JSON.parse(conv.messages_json || '[]'); } catch {}
  try {
    if (conv.generated_character_json) generatedCharacter = JSON.parse(conv.generated_character_json);
  } catch {}

  res.json({
    id: conv.id,
    title: conv.title,
    messages,
    generated_character: generatedCharacter,
    created_at: conv.created_at,
    updated_at: conv.updated_at,
  });
});

// ─── POST /api/character-wizard/conversations — Create new conversation ───

router.post('/conversations', (req: Request, res: Response) => {
  const db = getDb();
  ensureWizardTable(db);

  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO wizard_conversations (id, title, messages_json, generated_character_json, created_at, updated_at)
    VALUES (?, ?, '[]', '', ?, ?)
  `).run(id, 'New Wizard Chat', now, now);

  res.status(201).json({ id, title: 'New Wizard Chat', messages: [], created_at: now, updated_at: now });
});

// ─── PUT /api/character-wizard/conversations/:id — Update conversation ───

router.put('/conversations/:id', (req: Request, res: Response) => {
  const db = getDb();
  ensureWizardTable(db);

  const conv = db.prepare('SELECT * FROM wizard_conversations WHERE id = ?').get(req.params.id) as any;
  if (!conv) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }

  const { title, messages, generated_character } = req.body;
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE wizard_conversations
    SET title = ?, messages_json = ?, generated_character_json = ?, updated_at = ?
    WHERE id = ?
  `).run(
    title !== undefined ? title : conv.title,
    messages !== undefined ? JSON.stringify(messages) : conv.messages_json,
    generated_character !== undefined
      ? (generated_character ? JSON.stringify(generated_character) : '')
      : conv.generated_character_json,
    now,
    req.params.id,
  );

  res.json({ success: true, updated_at: now });
});

// ─── DELETE /api/character-wizard/conversations/:id — Delete conversation ───

router.delete('/conversations/:id', (req: Request, res: Response) => {
  const db = getDb();
  ensureWizardTable(db);

  const result = db.prepare('DELETE FROM wizard_conversations WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }
  res.json({ success: true });
});

// ─── POST /api/character-wizard/chat — Send message (streaming) ───

router.post('/chat', async (req: Request, res: Response) => {
  const db = getDb();

  const settings = db.prepare("SELECT * FROM api_settings ORDER BY ROWID DESC LIMIT 1").get() as any;
  if (!settings) {
    res.status(400).json({ error: 'API settings not found. Please configure the API first.' });
    return;
  }

  const { messages, conversation_id, edit_character_id } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages array is required' });
    return;
  }

  // Build system prompt — if editing, add context
  let systemPrompt = WIZARD_SYSTEM_PROMPT;
  if (edit_character_id) {
    const char = db.prepare('SELECT * FROM characters WHERE id = ?').get(edit_character_id) as any;
    if (char) {
      systemPrompt += `\n\n## EDITING EXISTING CHARACTER\n\nThe user wants to edit an existing character. Here is the current character data:\n\n\`\`\`json\n${JSON.stringify({
        name: char.name,
        nickname: char.nickname || '',
        description: char.description || '',
        personality: char.personality || '',
        scenario: char.scenario || '',
        first_mes: char.first_mes || '',
        mes_example: char.mes_example || '',
        system_prompt: char.system_prompt || '',
        post_history_instructions: char.post_history_instructions || '',
        alternate_greetings: JSON.parse(char.alternate_greetings || '[]'),
        group_only_greetings: JSON.parse(char.group_only_greetings || '[]'),
        creator_notes: char.creator_notes || '',
        tags: JSON.parse(char.tags || '[]'),
        creator: char.creator || '',
        character_version: char.character_version || '',
      }, null, 2)}\n\`\`\`\n\nAsk the user what they want to change about this character. When they respond, generate a complete updated card with ALL fields (not just the changed ones).`;
    }
  }

  // Build the prompt
  const promptParts = [
    { role: 'system' as const, content: systemPrompt },
    ...messages.map((m: any) => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    })),
  ];

  const endpoint = buildEndpoint(settings.base_url);
  const headers = buildHeaders(settings.api_key);
  const requestBody = buildRequestBody(promptParts, {
    model: settings.model,
    temperature: 0.8,
    max_tokens: 2048,
    stream: true,
  });

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: requestBody,
    });

    if (!response.ok) {
      const errorText = await response.text();
      res.status(response.status).json({ error: `API error: ${response.status}: ${errorText.slice(0, 200)}` });
      return;
    }

    // Stream the response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';

    if (reader) {
      let buffer = '';
      let done = false;

      while (!done) {
        const result = await reader.read();
        if (result.done) break;

        const chunk = decoder.decode(result.value, { stream: true });
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const data = trimmed.slice(6);
            if (data === '[DONE]') {
              done = true;
              break;
            }
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullContent += content;
                res.write(`data: ${JSON.stringify({ token: content })}\n\n`);
              }
            } catch {}
          }
        }
      }
    }

    // Auto-save to conversation if conversation_id provided
    if (conversation_id && fullContent) {
      try {
        ensureWizardTable(db);
        const conv = db.prepare('SELECT * FROM wizard_conversations WHERE id = ?').get(conversation_id) as any;
        if (conv) {
          const existingMessages = JSON.parse(conv.messages_json || '[]');
          // The messages from request are what the user sent + previous conversation
          // The last assistant message in the stream is the new one
          // We save the full updated messages array (frontend sends it)
          const updatedMessages = [...messages, { role: 'assistant', content: fullContent }];

          // Auto-generate title from first user message if still default
          let newTitle = conv.title;
          if (newTitle === 'New Wizard Chat') {
            const firstUserMsg = updatedMessages.find((m: any) => m.role === 'user');
            if (firstUserMsg) {
              newTitle = firstUserMsg.content.slice(0, 50) + (firstUserMsg.content.length > 50 ? '...' : '');
            }
          }

          // Check if response contains WIZARD_READY (character generated)
          let generatedChar = conv.generated_character_json;
          if (fullContent.includes('WIZARD_READY')) {
            // Try to extract the JSON
            const marker = 'WIZARD_READY';
            const markerIdx = fullContent.indexOf(marker);
            if (markerIdx !== -1) {
              const afterMarker = fullContent.slice(markerIdx + marker.length);
              const jsonStart = afterMarker.indexOf('{');
              if (jsonStart !== -1) {
                let depth = 0;
                let inString = false;
                let escape = false;
                for (let i = jsonStart; i < afterMarker.length; i++) {
                  const ch = afterMarker[i];
                  if (escape) { escape = false; continue; }
                  if (ch === '\\' && inString) { escape = true; continue; }
                  if (ch === '"') { inString = !inString; continue; }
                  if (inString) continue;
                  if (ch === '{') depth++;
                  else if (ch === '}') {
                    depth--;
                    if (depth === 0) {
                      try {
                        generatedChar = JSON.stringify(JSON.parse(afterMarker.slice(jsonStart, i + 1)));
                      } catch {}
                      break;
                    }
                  }
                }
              }
            }
          }

          db.prepare(`
            UPDATE wizard_conversations
            SET title = ?, messages_json = ?, generated_character_json = ?, updated_at = ?
            WHERE id = ?
          `).run(newTitle, JSON.stringify(updatedMessages), generatedChar || conv.generated_character_json, new Date().toISOString(), conversation_id);
        }
      } catch (err) {
        console.error('Failed to auto-save wizard conversation:', err);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('Character wizard error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Error connecting to API' });
    }
  }
});

// ─── POST /api/character-wizard/preview — Preview payload ───

router.post('/preview', (req: Request, res: Response) => {
  const db = getDb();
  const settings = db.prepare("SELECT * FROM api_settings ORDER BY ROWID DESC LIMIT 1").get() as any;
  if (!settings) {
    res.status(400).json({ error: 'API settings not found' });
    return;
  }

  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: 'messages array is required' });
    return;
  }

  const promptParts = [
    { role: 'system' as const, content: WIZARD_SYSTEM_PROMPT },
    ...messages.map((m: any) => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    })),
  ];

  const endpoint = buildEndpoint(settings.base_url);
  const requestBody = buildRequestBody(promptParts, {
    model: settings.model,
    temperature: 0.8,
    max_tokens: 2048,
    stream: true,
  });

  const parsed = JSON.parse(requestBody);
  const { model, messages: msgs, ...params } = parsed;

  res.json({
    inspect: true,
    source: 'character_wizard',
    endpoint,
    model,
    params,
    messages: msgs,
  });
});

export default router;
