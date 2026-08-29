import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { getPluginSettings } from '../utils/plugin-store';
import { buildEndpoint, buildHeaders, buildRequestBody } from '../utils/providers';

const router = Router();

// ─── تابع کمکی: استخراج JSON از پاسخ AI ───
// پاسخ AI ممکنه شامل متن + کد بلاک + JSON باشه — باید همه حالت‌ها رو handle کنه
function extractJsonFromAIResponse(content: string, type: 'array' | 'object'): any {
  if (!content) return null;

  // مرحله ۱: تلاش برای پیدا کردن کد بلاک JSON
  // ````json ... ```` یا ``` ... ```
  const codeBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/g;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (type === 'array' && Array.isArray(parsed)) return parsed;
      if (type === 'object' && typeof parsed === 'object' && !Array.isArray(parsed) && parsed !== null) return parsed;
    } catch (e) {
      // اگر پارس نشد، تلاش بعدی
    }
  }

  // مرحله ۱.۵: پیدا کردن JSON با greedy matching (برای آرایه‌های تو در تو)
  // از انتهای متن شروع می‌کنیم چون معمولاً JSON اصلی آخره
  if (type === 'array') {
    // تلاش با greedy match — ``[\s\S]+`` ممکنه خیلی بزرگ باشه پس اول آخرین [ رو پیدا می‌کنیم
    const lastArrayStart = content.lastIndexOf('[');
    if (lastArrayStart !== -1) {
      const slice = content.slice(lastArrayStart);
      // پیدا کردن آخرین ] که جزو یک آرایه معتبر باشه
      for (let i = slice.length - 1; i >= 0; i--) {
        if (slice[i] === ']') {
          try {
            const candidate = slice.slice(0, i + 1);
            const parsed = JSON.parse(candidate);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
          } catch {}
        }
      }
    }
  } else {
    // برای object — مشابه آرایه ولی با curly braces
    const lastObjStart = content.lastIndexOf('{');
    if (lastObjStart !== -1) {
      const slice = content.slice(lastObjStart);
      for (let i = slice.length - 1; i >= 0; i--) {
        if (slice[i] === '}') {
          try {
            const candidate = slice.slice(0, i + 1);
            const parsed = JSON.parse(candidate);
            if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) return parsed;
          } catch {}
        }
      }
    }
  }

  // مرحله ۲: تلاش برای پیدا کردن JSON مستقیم (بدون کد بلاک)
  if (type === 'array') {
    const allArrays: any[] = [];
    const arrayRegex = /\[[\s\S]*?\]/g;
    let arrayMatch;
    while ((arrayMatch = arrayRegex.exec(content)) !== null) {
      try {
        const parsed = JSON.parse(arrayMatch[0]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          allArrays.push(parsed);
        }
      } catch {}
    }
    if (allArrays.length > 0) {
      return allArrays[allArrays.length - 1];
    }
  } else {
    const allObjects: any[] = [];
    const objectRegex = /\{[\s\S]*?\}/g;
    let objMatch;
    while ((objMatch = objectRegex.exec(content)) !== null) {
      try {
        const parsed = JSON.parse(objMatch[0]);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          allObjects.push(parsed);
        }
      } catch {}
    }
    if (allObjects.length > 0) {
      return allObjects[allObjects.length - 1];
    }
  }

  // مرحله ۳: تلاش نهایی با تصحیح متن
  try {
    let cleaned = content
      .replace(/[\n\r\t]/g, ' ')
      .replace(/,\s*([\]}])/g, '$1')
      .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":')  // اضافه کردن کوتیشن به کلیدها
      .trim();

    if (type === 'array') {
      const arrMatch = cleaned.match(/\[[\s\S]+\]/);
      if (arrMatch) return JSON.parse(arrMatch[0]);
    } else {
      const objMatch = cleaned.match(/\{[\s\S]+\}/);
      if (objMatch) return JSON.parse(objMatch[0]);
    }
  } catch {}

  return null;
}

// مپ کردن ردیف entry به فرمت کلاینت — شامل فیلدهای موتور پیشرفته
function mapEntry(e: any) {
  return {
    ...e,
    key: JSON.parse(e.keys || '[]'),
    keysecondary: JSON.parse(e.keys_secondary || '[]'),
    constant: !!e.constant,
    selective: !!e.selective,
    disable: !!e.disable,
    case_sensitive: !!(e.case_sensitive ?? 0),
    use_regex: !!(e.use_regex ?? 0),
    probability: e.probability ?? 100,
  };
}

// لیست لوربوک‌ها
router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const lorebooks = db.prepare(`
    SELECT l.*,
      (SELECT COUNT(*) FROM lorebook_entries WHERE lorebook_id = l.id) as entry_count,
      (SELECT COUNT(*) FROM lorebook_entries WHERE lorebook_id = l.id AND disable = 0) as active_entry_count
    FROM lorebooks l
    ORDER BY l.created_at DESC
  `).all();
  res.json(lorebooks);
});

// ─── Entry routes (باید قبل از /:id باشند تا تداخل نداشته باشند) ───

// اضافه کردن entry
router.post('/:id/entries', (req: Request, res: Response) => {
  const db = getDb();
  const entryId = uuidv4();
  const { key, keysecondary, content, constant, selective, insertion_order, position, disable, comment, case_sensitive, use_regex, probability } = req.body;

  db.prepare(`
    INSERT INTO lorebook_entries (id, lorebook_id, keys, keys_secondary, content, constant, selective, insertion_order, position, disable, comment, case_sensitive, use_regex, probability)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    entryId, req.params.id,
    JSON.stringify(key || []), JSON.stringify(keysecondary || []),
    content || '', constant ? 1 : 0, selective ? 1 : 0,
    insertion_order ?? 100, position || 'before_main',
    disable ? 1 : 0, comment || '',
    case_sensitive ? 1 : 0, use_regex ? 1 : 0,
    typeof probability === 'number' ? Math.min(100, Math.max(0, Math.trunc(probability))) : 100,
  );

  const entry = db.prepare('SELECT * FROM lorebook_entries WHERE id = ?').get(entryId) as any;
  res.status(201).json(mapEntry(entry));
});

// بروزرسانی entry
router.put('/entries/:entryId', (req: Request, res: Response) => {
  const db = getDb();
  const { key, keysecondary, content, constant, selective, insertion_order, position, disable, comment, case_sensitive, use_regex, probability } = req.body;
  const existing = db.prepare('SELECT * FROM lorebook_entries WHERE id = ?').get(req.params.entryId) as any;
  if (!existing) {
    res.status(404).json({ error: 'Entry not found' });
    return;
  }

  db.prepare(`
    UPDATE lorebook_entries SET keys=?, keys_secondary=?, content=?, constant=?, selective=?, insertion_order=?, position=?, disable=?, comment=?, case_sensitive=?, use_regex=?, probability=?
    WHERE id=?
  `).run(
    JSON.stringify(key || []), JSON.stringify(keysecondary || []),
    content || '', constant ? 1 : 0, selective ? 1 : 0,
    insertion_order ?? 100, position || 'before_main',
    disable ? 1 : 0, comment || '',
    case_sensitive !== undefined ? (case_sensitive ? 1 : 0) : (existing.case_sensitive ?? 0),
    use_regex !== undefined ? (use_regex ? 1 : 0) : (existing.use_regex ?? 0),
    probability !== undefined
      ? Math.min(100, Math.max(0, Math.trunc(probability)))
      : (existing.probability ?? 100),
    req.params.entryId
  );

  const entry = db.prepare('SELECT * FROM lorebook_entries WHERE id = ?').get(req.params.entryId) as any;
  res.json(mapEntry(entry));
});

// حذف entry
router.delete('/entries/:entryId', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM lorebook_entries WHERE id = ?').run(req.params.entryId);
  res.json({ success: true });
});

// ─── AI Lorebook Generator (نسخه جدید - ۳ حالت) ───

// تابع کمکی: دریافت اطلاعات چت و کاراکتر
// حداکثر طول متن هر پیام: 500 کاراکتر — جلوگیری از overflow توکن
const MAX_MESSAGE_LENGTH = 500;
// حداکثر تعداد پیام‌ها برای ارسال به AI
const MAX_MESSAGES = 60;
// حداکثر طول کل متن مکالمه (تقریبی — ~40k کاراکتر ≈ ~10k توکن)
const MAX_CONVERSATION_CHARS = 40000;

function getChatContext(db: any, chat_id: string, character_id: string) {
  const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(character_id) as any;
  const messages = db.prepare('SELECT * FROM messages WHERE chat_id = ? ORDER BY rowid ASC').all(chat_id) as any[];
  const settings = db.prepare("SELECT * FROM api_settings ORDER BY ROWID DESC LIMIT 1").get() as any;

  if (!character || !settings || messages.length === 0) {
    return null;
  }

  // گرفتن آخرین پیام‌ها و محدود کردن طول هر کدوم
  const recentMessages = messages.slice(-MAX_MESSAGES);
  const conversationText = recentMessages.map((m: any) => {
    const role = m.role === 'user' ? 'User' : 'Assistant';
    const content = m.content.length > MAX_MESSAGE_LENGTH
      ? m.content.slice(0, MAX_MESSAGE_LENGTH) + '... [truncated]'
      : m.content;
    return `${role}: ${content}`;
  }).join('\n\n');

  // محدود کردن طول کل متن
  const truncatedConversation = conversationText.length > MAX_CONVERSATION_CHARS
    ? conversationText.slice(-MAX_CONVERSATION_CHARS)
    : conversationText;

  return { character, settings, conversationText: truncatedConversation, messageCount: messages.length };
}

// تابع کمکی: دریافت entryهای موجود
function getExistingEntries(db: any, lorebook_id: string): string[] {
  if (!lorebook_id) return [];
  const existing = db.prepare('SELECT keys, content FROM lorebook_entries WHERE lorebook_id = ?')
    .all(lorebook_id) as any[];
  return existing.map((e: any) => {
    const keys = JSON.parse(e.keys || '[]');
    return keys.join(', ');
  });
}

// ─── حالت ۱: پیشنهاد موضوعات ───
// AI متن رو بررسی و موضوعات کلیدی رو پیشنهاد می‌ده
router.post('/suggest-topics', async (req: Request, res: Response) => {
  const db = getDb();
  const { chat_id, character_id, lorebook_id } = req.body;

  if (!chat_id || !character_id) {
    res.status(400).json({ error: 'chat_id and character_id are required' });
    return;
  }

  const ctx = getChatContext(db, chat_id, character_id);
  if (!ctx) {
    res.status(400).json({ error: 'Chat or character not found, or chat is empty' });
    return;
  }

  const existingKeys = getExistingEntries(db, lorebook_id);

  // ساخت توضیحات کاراکتر برای پرامپت
  const charDescription = [
    ctx.character.name,
    ctx.character.personality ? `Personality: ${ctx.character.personality}` : '',
    ctx.character.description ? ctx.character.description.slice(0, 800) : '',
  ].filter(Boolean).join('\n');

  const suggestPrompt = `You are an expert World Info / Lorebook analyst for a roleplay game. Your ONLY job is to extract locations and places from a conversation that should be stored as World Info entries.

## CRITICAL RULES
1. Respond with ONLY a valid JSON array — NO text before or after
2. NO markdown code blocks, NO explanations, NO greetings, NO commentary
3. Start your response with [ and end with ]
4. If you cannot identify any locations, return an empty array: []
5. Focus on PLACES and LOCATIONS — their physical descriptions, atmosphere, and details

## Character Information
Name: ${ctx.character.name}
${charDescription}

${existingKeys.length > 0 ? `## Already Covered Topics (do NOT duplicate)\n${existingKeys.join(', ')}\n` : ''}

## Output Format
Return a JSON array. Each element must have these exact fields:
[{"topic":"Location Name","category":"location","keywords":["keyword1","keyword2"],"note":"Brief summary of what this place looks like"}]

Category is ALWAYS "location" for places.

## What to Look For — FOCUS ON PLACES
- Rooms (bedroom, throne room, dungeon, kitchen, etc.)
- Buildings (castle, tavern, temple, house, etc.)
- Areas (forest, mountain, city, garden, etc.)
- Landmarks (fountain, statue, bridge, tower, etc.)
- Any place mentioned in the conversation

## IGNORE
- Characters/NPCs (do NOT include people)
- Items/objects (do NOT include weapons, artifacts, etc.)
- Events (do NOT include plot events)
- Abstract concepts (do NOT include magic systems, rules, etc.)

Return ONLY the JSON array.`;

  const endpoint = buildEndpoint(ctx.settings.base_url);
  const headers = buildHeaders(ctx.settings.api_key);
  const requestBody = buildRequestBody([
    { role: 'system', content: suggestPrompt },
    { role: 'user', content: `Conversation to analyze:\n\n${ctx.conversationText}` },
  ], {
    model: ctx.settings.model,
    temperature: 0.3,
    max_tokens: 2048,
    stream: false,
  });

  try {
    const response = await fetch(endpoint, { method: 'POST', headers, body: requestBody });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[AI Suggest] API error ${response.status}:`, errorText.slice(0, 300));
      res.status(response.status).json({ error: `API error: ${response.status}` });
      return;
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content || '';
    console.log('[AI Suggest] === RAW RESPONSE START ===');
    console.log(content);
    console.log('[AI Suggest] === RAW RESPONSE END ===');

    let topics: any[] = [];
    try {
      topics = extractJsonFromAIResponse(content, 'array') || [];
      console.log('[AI Suggest] Parsed topics count:', topics.length);
    } catch (e) {
      console.error('[AI Suggest] Parse error:', e);
    }

    // Fallback: اگر parse خالی برگردوند
    if (topics.length === 0 && content.length > 10) {
      console.log('[AI Suggest] Trying fallback extraction...');
      const objectMatches = content.match(/\{[^{}]*"topic"[^{}]*\}/g);
      if (objectMatches) {
        console.log('[AI Suggest] Found', objectMatches.length, 'topic-like objects');
        for (const objStr of objectMatches) {
          try {
            const parsed = JSON.parse(objStr);
            if (parsed.topic) {
              topics.push({
                topic: parsed.topic,
                category: parsed.category || 'concept',
                keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
                note: parsed.note || '',
                _selected: true,
              });
            }
          } catch {}
        }
      }
    }

    // اعتبارسنجی
    const validTopics = topics
      .filter((t: any) => t.topic && t.category && Array.isArray(t.keywords) && t.keywords.length > 0)
      .map((t: any) => ({
        topic: String(t.topic).trim(),
        category: ['location', 'character', 'item', 'concept', 'event'].includes(t.category) ? t.category : 'concept',
        keywords: t.keywords.filter((k: any) => typeof k === 'string' && k.trim()).slice(0, 5),
        note: String(t.note || '').trim(),
        _selected: true,
      }));

    console.log('[AI Suggest] Valid topics count:', validTopics.length);

    // اگه هیچ topic‌ای پیدا نشد، raw response رو برگردون
    if (validTopics.length === 0) {
      res.json({
        topics: [],
        count: 0,
        model: ctx.settings.model,
        debug_raw: content.slice(0, 3000),
      });
      return;
    }

    res.json({ topics: validTopics, count: validTopics.length, model: ctx.settings.model });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error suggesting topics' });
  }
});

// ─── حالت ۲: تولید اینتری از موضوعات انتخاب شده ───
router.post('/generate-from-topics', async (req: Request, res: Response) => {
  const db = getDb();
  const { chat_id, character_id, topics, custom_prompt } = req.body;

  if (!chat_id || !character_id || !topics || !Array.isArray(topics) || topics.length === 0) {
    res.status(400).json({ error: 'chat_id, character_id, and topics array are required' });
    return;
  }

  const ctx = getChatContext(db, chat_id, character_id);
  if (!ctx) {
    res.status(400).json({ error: 'Chat or character not found' });
    return;
  }

  const topicList = topics.map((t: any, i: number) =>
    `${i + 1}. "${t.topic}" [${t.category}] Keywords: ${t.keywords?.join(', ')} — ${t.note || 'no description'}`
  ).join('\n');

  const charDescription = [
    ctx.character.name,
    ctx.character.personality ? `Personality: ${ctx.character.personality}` : '',
    ctx.character.description ? ctx.character.description.slice(0, 600) : '',
  ].filter(Boolean).join('\n');

  const generatePrompt = `You are an expert World Info / Lorebook writer for a roleplay game. Generate detailed location entries based on the conversation context.

## CRITICAL RULES
1. Respond with ONLY a valid JSON array — NO text before or after
2. NO markdown code blocks, NO explanations, NO greetings, NO commentary
3. Start your response with [ and end with ]
4. Each topic MUST produce exactly one entry
5. Content must be factual — extract ALL descriptive details from the conversation about each location

## Character Information
Name: ${ctx.character.name}
${charDescription}

## Locations to Generate Entries For
${topicList}

${custom_prompt ? `## Additional Instructions\n${custom_prompt}\n` : ''}

## Output Format
Return a JSON array where each element has these exact fields:
[{"keys":["primary_keyword","secondary_keyword"],"keysecondary":["optional_trigger"],"content":"Detailed location description","constant":false,"selective":false,"comment":"Location name"}]

## Content Guidelines — VERY IMPORTANT
Write DETAILED location descriptions. For each place, include:
- Physical appearance (size, shape, materials, colors)
- Atmosphere (lighting, temperature, sounds, smells)
- Key features and furnishings
- Layout and sections
- Any notable objects or decorations
- How characters interact with or describe the space

Example good content:
"The throne room is a vast chamber with high vaulted ceilings supported by marble columns. The floor is made of polished black stone that reflects the flickering torchlight. At the far end sits an ornate golden throne on a raised dais, flanked by crimson tapestries depicting ancient battles. The air smells of incense and old stone. Shadows dance along the walls where torchlight fails to reach."

Example BAD content:
"This is the throne room where the king sits."

Field rules:
- "keys": 1-5 trigger keywords (lowercase, as they'd appear in text)
- "keysecondary": optional additional triggers (leave [] if not needed)
- "content": 3-6 sentences of rich descriptive detail about the location
- "constant": false (trigger-based)
- "selective": false
- "comment": the location name

Return ONLY the JSON array.`;

  const endpoint = buildEndpoint(ctx.settings.base_url);
  const headers = buildHeaders(ctx.settings.api_key);
  const requestBody = buildRequestBody([
    { role: 'system', content: generatePrompt },
    { role: 'user', content: `Conversation context:\n\n${ctx.conversationText}\n\nNow generate the lorebook entries for the topics listed above.` },
  ], {
    model: ctx.settings.model,
    temperature: 0.4,
    max_tokens: 4096,
    stream: false,
  });

  try {
    const response = await fetch(endpoint, { method: 'POST', headers, body: requestBody });
    if (!response.ok) {
      const errorText = await response.text();
      res.status(response.status).json({ error: `API error: ${response.status}` });
      return;
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content || '';

    let entries: any[] = [];
    try {
      entries = extractJsonFromAIResponse(content, 'array') || [];
    } catch {
      res.status(500).json({ error: 'Failed to parse AI response', raw_response: content });
      return;
    }

    const validEntries = entries
      .filter((e: any) => e.keys && Array.isArray(e.keys) && e.keys.length > 0 && e.content)
      .map((e: any) => ({
        keys: e.keys.filter((k: any) => typeof k === 'string' && k.trim()).slice(0, 5),
        keysecondary: Array.isArray(e.keysecondary) ? e.keysecondary.filter((k: any) => typeof k === 'string' && k.trim()).slice(0, 3) : [],
        content: String(e.content || '').trim(),
        constant: !!e.constant,
        selective: !!e.selective,
        comment: String(e.comment || '').trim(),
        insertion_order: 100,
        position: 'before_main',
        disable: false,
        case_sensitive: false,
        use_regex: false,
        probability: 100,
        _selected: true,
      }));

    res.json({ entries: validEntries, count: validEntries.length, model: ctx.settings.model });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error generating entries' });
  }
});

// ─── حالت ۳: تولید تک موضوعی ───
router.post('/generate-single', async (req: Request, res: Response) => {
  const db = getDb();
  const { chat_id, character_id, topic, keywords, custom_prompt } = req.body;

  if (!chat_id || !character_id || !topic) {
    res.status(400).json({ error: 'chat_id, character_id, and topic are required' });
    return;
  }

  const ctx = getChatContext(db, chat_id, character_id);
  if (!ctx) {
    res.status(400).json({ error: 'Chat or character not found' });
    return;
  }

  const keywordStr = Array.isArray(keywords) && keywords.length > 0
    ? `Use these trigger keywords: ${keywords.join(', ')}`
    : 'Generate 3-5 appropriate trigger keywords based on the topic';

  const charDescription = [
    ctx.character.name,
    ctx.character.personality ? `Personality: ${ctx.character.personality}` : '',
    ctx.character.description ? ctx.character.description.slice(0, 600) : '',
  ].filter(Boolean).join('\n');

  const singlePrompt = `You are an expert World Info / Lorebook writer for a roleplay game. Generate ONE detailed location entry based on the conversation context.

## CRITICAL RULES
1. Respond with ONLY a valid JSON object — NO text before or after
2. NO markdown code blocks, NO explanations, NO greetings, NO commentary
3. Start your response with { and end with }
4. Content must be factual — extract ALL descriptive details from the conversation about this location

## Character Information
Name: ${ctx.character.name}
${charDescription}

## Location to Generate Entry For
"${topic}"
${keywordStr}

${custom_prompt ? `## Additional Instructions\n${custom_prompt}\n` : ''}

## Output Format
Return a JSON object with these exact fields:
{"keys":["primary_keyword","secondary_keyword"],"keysecondary":["optional_trigger"],"content":"Detailed location description","constant":false,"selective":false,"comment":"Location name"}

## Content Guidelines — VERY IMPORTANT
Write a RICH, DETAILED location description. Include ALL of these if mentioned in the conversation:
- Physical appearance (size, shape, materials, colors)
- Atmosphere (lighting, temperature, sounds, smells)
- Key features and furnishings
- Layout and sections
- Any notable objects or decorations
- How characters interact with or describe the space

Example good content:
"The throne room is a vast chamber with high vaulted ceilings supported by marble columns. The floor is made of polished black stone that reflects the flickering torchlight. At the far end sits an ornate golden throne on a raised dais, flanked by crimson tapestries depicting ancient battles. The air smells of incense and old stone."

Example BAD content:
"This is the throne room where the king sits."

Field rules:
- "keys": 1-5 trigger keywords (lowercase, as they'd appear in text)
- "keysecondary": optional additional triggers (leave [] if not needed)
- "content": 4-6 sentences of rich descriptive detail about the location
- "constant": false (trigger-based)
- "selective": false
- "comment": the location name

Return ONLY the JSON object.`;

  const endpoint = buildEndpoint(ctx.settings.base_url);
  const headers = buildHeaders(ctx.settings.api_key);
  const requestBody = buildRequestBody([
    { role: 'system', content: singlePrompt },
    { role: 'user', content: `Conversation context:\n\n${ctx.conversationText}\n\nGenerate the lorebook entry for "${topic}".` },
  ], {
    model: ctx.settings.model,
    temperature: 0.4,
    max_tokens: 1024,
    stream: false,
  });

  try {
    const response = await fetch(endpoint, { method: 'POST', headers, body: requestBody });
    if (!response.ok) {
      const errorText = await response.text();
      res.status(response.status).json({ error: `API error: ${response.status}` });
      return;
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content || '';

    let entry: any = null;
    try {
      entry = extractJsonFromAIResponse(content, 'object');
    } catch {
      res.status(500).json({ error: 'Failed to parse AI response', raw_response: content });
      return;
    }

    if (!entry || !entry.keys || !entry.content) {
      res.status(500).json({ error: 'Invalid entry format', raw_response: content });
      return;
    }

    const validEntry = {
      keys: (entry.keys || []).filter((k: any) => typeof k === 'string' && k.trim()).slice(0, 5),
      keysecondary: Array.isArray(entry.keysecondary) ? entry.keysecondary.filter((k: any) => typeof k === 'string' && k.trim()).slice(0, 3) : [],
      content: String(entry.content || '').trim(),
      constant: !!entry.constant,
      selective: !!entry.selective,
      comment: String(entry.comment || topic).trim(),
      insertion_order: 100,
      position: 'before_main',
      disable: false,
      case_sensitive: false,
      use_regex: false,
      probability: 100,
      _selected: true,
    };

    res.json({ entry: validEntry, model: ctx.settings.model });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error generating entry' });
  }
});

// ─── اعمال entryهای تولید شده به لوربوک ───
router.post('/:id/apply-generated', (req: Request, res: Response) => {
  const db = getDb();
  const { entries } = req.body;

  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    res.status(400).json({ error: 'entries array is required' });
    return;
  }

  const lorebook = db.prepare('SELECT * FROM lorebooks WHERE id = ?').get(req.params.id) as any;
  if (!lorebook) {
    res.status(404).json({ error: 'Lorebook not found' });
    return;
  }

  const insertedEntries: any[] = [];
  const insertEntry = db.prepare(`
    INSERT INTO lorebook_entries (id, lorebook_id, keys, keys_secondary, content, constant, selective, insertion_order, position, disable, comment, case_sensitive, use_regex, probability)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // دریافت بالاترین insertion_order موجود
  const maxOrder = db.prepare('SELECT MAX(insertion_order) as max_order FROM lorebook_entries WHERE lorebook_id = ?')
    .get(req.params.id) as any;
  let nextOrder = (maxOrder?.max_order || 0) + 10;

  const transaction = db.transaction(() => {
    for (const entry of entries) {
      const entryId = uuidv4();
      insertEntry.run(
        entryId,
        req.params.id,
        JSON.stringify(entry.keys || []),
        JSON.stringify(entry.keysecondary || []),
        entry.content || '',
        entry.constant ? 1 : 0,
        entry.selective ? 1 : 0,
        nextOrder,
        entry.position || 'before_main',
        entry.disable ? 1 : 0,
        entry.comment || '',
        entry.case_sensitive ? 1 : 0,
        entry.use_regex ? 1 : 0,
        typeof entry.probability === 'number' ? entry.probability : 100,
      );
      nextOrder += 10;
      insertedEntries.push({ id: entryId, ...entry });
    }
  });

  transaction();

  res.status(201).json({
    success: true,
    added: insertedEntries.length,
    entries: insertedEntries,
  });
});

// ─── Lorebook CRUD (بعد از entry routes) ───

// دریافت لوربوک با entries
router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const lorebook = db.prepare('SELECT * FROM lorebooks WHERE id = ?').get(req.params.id) as any;
  if (!lorebook) {
    res.status(404).json({ error: 'Lorebook not found' });
    return;
  }
  const entries = db.prepare('SELECT * FROM lorebook_entries WHERE lorebook_id = ? ORDER BY insertion_order ASC')
    .all(req.params.id).map(mapEntry);
  res.json({ ...lorebook, entries });
});

// ایجاد لوربوک جدید (پیش‌فرض‌های scan_depth/token_budget از پلاگین lorebook_scanner)
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  const { name, scan_depth, token_budget } = req.body;
  const scannerDefaults = getPluginSettings(db, 'lorebook_scanner');

  db.prepare(`
    INSERT INTO lorebooks (id, name, scan_depth, token_budget, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    id,
    name || 'New Lorebook',
    scan_depth ?? scannerDefaults?.default_scan_depth ?? 50,
    token_budget ?? scannerDefaults?.default_token_budget ?? 500,
    now,
  );

  const lorebook = db.prepare('SELECT * FROM lorebooks WHERE id = ?').get(id);
  res.status(201).json(lorebook);
});

// بروزرسانی لوربوک
router.put('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const { name, scan_depth, token_budget } = req.body;
  db.prepare('UPDATE lorebooks SET name=?, scan_depth=?, token_budget=? WHERE id=?')
    .run(name, scan_depth, token_budget, req.params.id);
  const lorebook = db.prepare('SELECT * FROM lorebooks WHERE id = ?').get(req.params.id);
  res.json(lorebook);
});

// حذف لوربوک
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM lorebooks WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
