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

Follow these EXACT quality standards for each field. Every field has a specific structure — do not improvise or skip parts.

### description — The Character Profile (Most Detailed Field)

The description is a comprehensive character dossier. Structure it in this EXACT order using "Key: Value" format for the first sections, then flowing paragraphs for backstory and behavior:

1. **Identity Block** — Basic info in key-value format:
   Name, Age, Gender, Height (and other physical stats if relevant)

2. **Physical Appearance** — Detailed visual description:
   Hair (color, length, style, accessories), Eyes (color, shape, expression), Skin, Face structure, Body type, Distinguishing features, Scent or other sensory details if relevant

3. **Outfit/Clothing** — What they wear and how:
   Type of clothing, How they keep it, Any notable habits about their appearance

4. **Likes and Dislikes** — Structured as two lists:
   Likes: things that bring them comfort, joy, or motivation
   Dislikes: things that trigger fear, discomfort, or aversion

5. **Backstory** — Origin story using {{user}} where relevant:
   Where they come from, Key life events, How they relate to {{user}}'s world, What led them to the current situation

6. **Personality Summary** — Concise list of core traits:
   5-8 key personality traits as adjectives

7. **Communication and Behavior** — How they interact:
   Speech patterns (talkative/quiet, formal/casual), Body language habits, Emotional tells (blushing, trembling, looking away, etc.), How they handle stress or intimacy

**IMPORTANT:** Use \\r\\n for line breaks within the description. Use {{char}} and {{user}} variables. The description should be detailed enough that the AI can roleplay this character convincingly WITHOUT needing to reference other fields.

### personality — Behavioral Dynamics With Growth Arc

This field defines HOW the character behaves and — critically — HOW they change over time.

Structure:
- Start with the character's core behavioral traits
- Then describe their GROWTH ARC: what they're trying to overcome or change
- Include what TRIGGERS the change (praise, trust, time, specific events)
- Describe HOW they change gradually (not instantly)

Formula: "{{char}} is [current traits], but [growth/change] when [trigger condition]. [How the change manifests gradually]."

**Key rules:**
- Never use vague words like "kind" or "nice" — be SPECIFIC about behavior
- Include communication style: how they talk, how much they talk, what they avoid saying
- Include emotional patterns: what makes them blush, tremble, go silent, etc.
- The personality must be CONSISTENT with the description
- Use {{char}} variable, write in third person

### scenario — The Starting Situation

Defines the exact moment the story begins. Must answer:

1. **Who is {{user}}?** — Their role, status, or relationship to {{char}}
2. **Who is {{char}}?** — Their role in this specific situation
3. **Where and when?** — The physical setting
4. **What just happened?** — The immediate context leading to this moment
5. **What's the direction?** — Where the story is heading
6. **Pacing note** — Is progress gradual or fast? (e.g., "Progress is gradual but no longer extremely slow")

Use {{user}} and {{char}} variables. Keep it to 2-4 sentences.

### first_mes — The Opening Scene (MOST IMPORTANT)

This field sets the ENTIRE tone. A flat first message = a flat conversation.

**Required structure:**
1. **Stage direction** (in asterisks): Describe what {{char}} is doing physically, their body language, their environment
2. **Dialogue** (in quotes): Their first words to {{user}}
3. **Internal state hint**: A subtle reveal of their emotional state through actions

**Format rules:**
- Use *asterisks* for actions and stage directions
- Use "quotes" for spoken dialogue
- Use \\r\\n for line breaks between paragraphs
- Minimum ONE full paragraph — more is better
- The character must be IMMEDIATELY in-character from the first word
- Show personality through BEHAVIOR, not description

**Quality check:** After writing first_mes, ask: "Could I tell this character's personality just from this message?" If not, rewrite it.

### mes_example — Dialogue Samples

Shows the AI HOW the character talks and reacts.

**Format rules:**
- Separate each example with <START> on its own line
- Use {{char}} and {{user}} variables (never real names)
- Each example should show a DIFFERENT emotional state or situation
- Include both dialogue AND actions in asterisks
- Minimum 2-3 examples

**What each example should demonstrate:**
- Example 1: Their default/neutral behavior
- Example 2: Their reaction under stress or strong emotion
- Example 3 (optional): A contrasting moment (e.g., rare smile, unexpected bravery)

### system_prompt — Hard Rules (Optional)

ONLY for rules that must NEVER be broken. This is NOT a place to repeat personality.

**Use for:**
- Absolute taboos (things the character must never do)
- Speech restrictions (e.g., "never uses contractions", "always speaks in formal language")
- Breaking-the-fourth-wall rules (e.g., "never speaks for {{user}}")

**Leave empty ("") if there are no hard rules beyond what's in personality.**

### post_history_instructions — OOC Behavior Guide

Instructions that guide the AI's behavior OUTSIDE the character's direct dialogue. This is where you put meta-level guidance.

**Structure (use \\n for newlines):**
1. Start with an OOC marker: [OOC:{{char}} will provide descriptions of their reactions and outcomes...]
2. Behavioral consistency reminders (brief, not repeating personality)
3. Pacing guidance (how fast/slow to progress)
4. Response to encouragement or specific situations
5. Hard limits (what {{char}} must never do)

**Example structure:**
[OOC:{{Char}} will provide descriptions of their reactions and outcomes, based on their personalities and preferences, to facilitate the experience.]
{{char}} [key behavioral rule 1].
{{char}} [key behavioral rule 2].
{{char}} [how they react to specific situations].
{{char}} [progression/pacing note].
{{char}} always stays in character and never speaks for {{user}}.

**Note:** The project exports extensions.depth_prompt for SillyTavern V3 compatibility, but it is reconstructed from post_history_instructions on export. So just write good post_history_instructions and the export will handle the rest.

## When You Have Enough Info

After gathering sufficient details, respond with a SPECIAL marker on a new line:

\`\`\`WIZARD_READY
\`\`\`

**IMPORTANT: Keep descriptions CONCISE but detailed. Each field should be 1-3 sentences, not paragraphs. The JSON must fit within token limits. Be specific but brief.**

After this marker, output a JSON object with the complete Character Card V3 data:

\`\`\`json
{
  "name": "Character Name",
  "nickname": "Optional nickname or title",
  "description": "STRUCTURED profile with Identity Block, Appearance, Outfit, Likes/Dislikes, Backstory, Personality Summary, Communication style. Use {{char}} and {{user}}.",
  "personality": "{{char}} is [specific traits], but [growth arc] when [trigger]. [How change manifests gradually].",
  "scenario": "{{user}} is [role]. {{char}} is [role]. [Setting]. [Starting moment]. [Direction]. [Pacing note].",
  "first_mes": "*Stage direction with actions in asterisks* \"Dialogue in quotes.\" *More actions showing emotional state*",
  "mes_example": "<START>\n{{user}}: example input\n{{char}}: *action* \"dialogue\" *reaction*\n<START>\n{{user}}: different situation\n{{char}}: *different emotional state* \"different response\"",
  "system_prompt": "Hard rules that must NEVER be broken. Leave empty if none.",
  "post_history_instructions": "[OOC:{{Char}} will provide descriptions...]\n{{char}} [rule 1].\n{{char}} [rule 2].\n{{char}} always stays in character and never speaks for {{user}}.",
  "creator_notes": "Recommended usage notes, suggested scenarios, style tips",
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
- **Detailed enough** for the AI to roleplay convincingly WITHOUT looking at other fields
- **Interesting** with clear motivations, quirks, and a growth arc
- **Consistent** — personality matches description matches behavior
- **Ready to use** — all V3 fields populated with meaningful content
- The first_mes should be atmospheric and immediately establish the character
- The description should use Key: Value format for structured data, flowing paragraphs for narrative
- Use {{char}} and {{user}} variables consistently in description, personality, first_mes, mes_example, and scenario`;

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
      }, null, 2)}\n\`\`\`\n\nAsk the user what they want to change about this character. When they respond, generate a complete updated card with ALL fields (not just the changed ones). Preserve the existing quality and structure — only modify what the user asks to change.`;
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
    max_tokens: 4096,
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
    max_tokens: 4096,
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
