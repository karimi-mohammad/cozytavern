import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { buildEndpoint, buildHeaders, buildRequestBody } from '../utils/providers';

const router = Router();

// دریافت rules یک چت
router.get('/chat/:chatId', (req: Request, res: Response) => {
  const db = getDb();
  const rules = db.prepare('SELECT * FROM chat_rules WHERE chat_id = ? ORDER BY created_at ASC').all(req.params.chatId);
  res.json(rules);
});

// اضافه کردن rule به چت
router.post('/chat/:chatId', (req: Request, res: Response) => {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  const { content, source_message_id } = req.body;

  db.prepare(`
    INSERT INTO chat_rules (id, chat_id, content, source_message_id, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, req.params.chatId, content || '', source_message_id || '', now);

  const rule = db.prepare('SELECT * FROM chat_rules WHERE id = ?').get(id);
  res.status(201).json(rule);
});

// حذف rule از چت
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM chat_rules WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// استخراج خودکار قوانین از مکالمه با AI
router.post('/extract/:chatId', async (req: Request, res: Response) => {
  const db = getDb();
  const { chatId } = req.params;

  // دریافت تنظیمات API
  const settings = db.prepare("SELECT * FROM api_settings ORDER BY ROWID DESC LIMIT 1").get() as any;
  if (!settings) {
    res.status(400).json({ error: 'API settings not found' });
    return;
  }

  // دریافت پیام‌های اخیر چت
  const messages = db.prepare('SELECT * FROM messages WHERE chat_id = ? ORDER BY rowid ASC').all(chatId) as any[];
  if (messages.length < 2) {
    res.json({ rules: [], message: 'Not enough messages to extract rules' });
    return;
  }

  // دریافت rules موجود
  const existingRules = db.prepare('SELECT * FROM chat_rules WHERE chat_id = ?').all(chatId) as any[];
  const existingRulesText = existingRules.map(r => r.content).join('\n');

  // ساخت پرامپت برای استخراج قوانین
  const recentMessages = messages.slice(-10).map(m => `${m.role}: ${m.content}`).join('\n');

  const extractionPrompt = `You are a rule extractor. Analyze the conversation and extract IMPORTANT RULES, WORLD-BUILDING FACTS, CHARACTER TRAITS, OR PLOT POINTS that should be remembered for future context.

EXISTING RULES (do not duplicate):
${existingRulesText || '(none yet)'}

RECENT CONVERSATION:
${recentMessages}

TASK: Extract NEW rules/facts/traits that:
1. Are important for the story/roleplay
2. Should be remembered in future messages
3. Are NOT already in existing rules

Return ONLY a JSON array of strings, each being a rule. If no new rules, return [].
Example: ["The character always speaks in a formal tone", "The story takes place in a medieval castle"]

Respond with ONLY the JSON array, no explanation.`;

  try {
    const endpoint = buildEndpoint(settings.base_url);
    const headers = buildHeaders(settings.api_key);

    const requestBody = buildRequestBody([
      { role: 'system', content: 'You are a rule extraction assistant. Return only JSON arrays.' },
      { role: 'user', content: extractionPrompt },
    ], {
      model: settings.model,
      temperature: 0.3,
      max_tokens: 500,
      stream: false,
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: requestBody,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Rule extraction API error:', errorText.slice(0, 200));
      res.status(response.status).json({ error: 'AI extraction failed' });
      return;
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content || '[]';

    // پارس کردن JSON
    let newRules: string[] = [];
    try {
      // تلاش برای پارس مستقیم
      newRules = JSON.parse(content);
      if (!Array.isArray(newRules)) newRules = [];
    } catch {
      // تلاش برای پارس از متن
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        newRules = JSON.parse(jsonMatch[0]);
      }
    }

    // ذخیره قوانین جدید
    const savedRules = [];
    for (const ruleContent of newRules) {
      if (typeof ruleContent === 'string' && ruleContent.trim()) {
        const id = uuidv4();
        const now = new Date().toISOString();
        db.prepare(`
          INSERT INTO chat_rules (id, chat_id, content, source_message_id, created_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(id, chatId, ruleContent.trim(), messages[messages.length - 1]?.id || '', now);
        savedRules.push({ id, content: ruleContent.trim() });
      }
    }

    res.json({ rules: savedRules, count: savedRules.length });
  } catch (error: any) {
    console.error('Rule extraction error:', error);
    res.status(500).json({ error: error.message || 'Extraction failed' });
  }
});

export default router;
