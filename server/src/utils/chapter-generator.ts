import { buildEndpoint, buildHeaders, buildRequestBody } from './providers';
import { getChapterSettingsCompat } from './plugin-store';

// ─── Summarization Prompt ───

const SUMMARIZER_SYSTEM_PROMPT = `You are a roleplay summarizer. Summarize the following conversation in a structured way.

Rules:
- Only write information that exists in the conversation. Do not invent new details.
- Keep the details that are important for continuing the roleplay.
- Use the language of the conversation itself.
- The summary must be rich enough for the model to continue the roleplay naturally.

Write the output exactly with this structure:

# Chapter Title

## Summary
Concise description of events

## Key Events
- ...

## Character Progression
- ...

## Important Details
- ...

## Unanswered Questions
- ...

## End-of-Chapter State
- ...`;

// ─── Build Chapter Summary Request ───

// ساخت درخواست خلاصه‌سازی به صورت جدا — تا حالت بازرسی (inspect) هم بدون فراخوانی LLM بتواند payload را بسازد
export interface ChapterSummaryRequestInfo {
  endpoint: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  requestBody: string; // خروجی buildRequestBody
}

export function buildChapterSummaryRequest(
  messages: any[],
  character: any,
  db: any,
): ChapterSummaryRequestInfo {
  // Get API settings (prefer summarizer-specific settings if configured)
  const chapterSettings = getChapterSettingsCompat(db) as any;
  const mainSettings = db.prepare("SELECT * FROM api_settings ORDER BY ROWID DESC LIMIT 1").get() as any;

  if (!mainSettings) {
    throw new Error('API settings not found');
  }

  // Decide which model/endpoint to use
  const useCustomSummarizer = chapterSettings?.summarizer_model && chapterSettings.summarizer_model.trim();
  const model = useCustomSummarizer ? chapterSettings.summarizer_model : mainSettings.model;
  const baseUrl = useCustomSummarizer && chapterSettings.summarizer_base_url
    ? chapterSettings.summarizer_base_url
    : mainSettings.base_url;
  const apiKey = useCustomSummarizer && chapterSettings.summarizer_api_key
    ? chapterSettings.summarizer_api_key
    : mainSettings.api_key;

  if (!apiKey) {
    throw new Error('API key is not configured');
  }

  // Build conversation for summarizer
  const charInfo = character
    ? `Character name: ${character.name}\nDescription: ${character.description || ''}\nPersonality: ${character.personality || ''}`
    : '';

  const conversationText = messages
    .map((m: any) => {
      const role = m.role === 'user' ? 'User' : character?.name || 'Character';
      return `${role}: ${m.content}`;
    })
    .join('\n\n');

  const userMessage = `${charInfo ? charInfo + '\n\n' : ''}Conversation to summarize:\n\n${conversationText}`;

  // Build request
  const endpoint = buildEndpoint(baseUrl);
  const promptParts = [
    { role: 'system' as const, content: SUMMARIZER_SYSTEM_PROMPT },
    { role: 'user' as const, content: userMessage },
  ];
  const requestBody = buildRequestBody(promptParts, {
    model,
    temperature: 0.3,
    max_tokens: 2048,
    stream: false,
  });

  return { endpoint, model, baseUrl, apiKey, requestBody };
}

// ─── Generate Chapter Summary ───

export interface ChapterSummaryResult {
  summary: string;
  model: string;
  generation_time: number;
  generation_tokens: number;
}

export async function generateChapterSummary(
  messages: any[],
  character: any,
  _persona: any,
  db: any,
  editedMessages?: { role: string; content: string }[],
): Promise<ChapterSummaryResult> {
  const info = buildChapterSummaryRequest(messages, character, db);
  // اگر کاربر پیام‌ها را ویرایش کرده باشد، از آن‌ها به جای prompt ساخته‌شده استفاده می‌شود
  const requestBody = (editedMessages && Array.isArray(editedMessages) && editedMessages.length > 0)
    ? buildRequestBody(editedMessages.map(m => ({ role: m.role as any, content: m.content })), {
        model: info.model,
        temperature: 0.3,
        max_tokens: 1000,
        stream: false,
      })
    : info.requestBody;
  const { endpoint, model, apiKey } = info;
  const headers = buildHeaders(apiKey);

  // Call LLM
  const startTime = Date.now();
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: requestBody,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM API error ${response.status}: ${errorText.slice(0, 200)}`);
  }

  const data = await response.json() as any;

  // Parse response (handle OpenAI-compatible formats)
  let summary = '';
  if (data.choices?.[0]?.message?.content) {
    summary = data.choices[0].message.content;
  } else if (data.choices?.[0]?.text) {
    summary = data.choices[0].text;
  } else {
    throw new Error('Empty response received from API');
  }

  const generationTime = Date.now() - startTime;
  const generationTokens = data.usage?.completion_tokens || 0;

  return { summary: summary.trim(), model, generation_time: generationTime, generation_tokens: generationTokens };
}

// ─── Trigger Detection ───

export interface TriggerDetectionResult {
  suggested: boolean;
  trigger_message_id?: string;
  trigger_phrase?: string;
}

export function detectChapterTrigger(
  messages: any[],
  chapters: any[],
  rawWindow: number,
  triggerPhrases: string[],
): TriggerDetectionResult {
  if (messages.length < rawWindow || triggerPhrases.length === 0) {
    return { suggested: false };
  }

  // Check distance from last chapter
  const lastChapter = chapters.length > 0 ? chapters[chapters.length - 1] : null;
  if (lastChapter) {
    const lastChapterEndIndex = messages.findIndex((m: any) => m.id === lastChapter.end_message_id);
    if (lastChapterEndIndex !== -1) {
      const distanceFromEnd = messages.length - 1 - lastChapterEndIndex;
      if (distanceFromEnd < rawWindow) {
        return { suggested: false };
      }
    }
  }

  // Scan messages outside the raw window for triggers
  const scanEnd = messages.length - rawWindow;
  const scanMessages = messages.slice(0, scanEnd);

  for (const trigger of triggerPhrases) {
    const triggerLower = trigger.toLowerCase();
    for (const msg of scanMessages) {
      if (msg.content && msg.content.toLowerCase().includes(triggerLower)) {
        return {
          suggested: true,
          trigger_message_id: msg.id,
          trigger_phrase: trigger,
        };
      }
    }
  }

  return { suggested: false };
}
