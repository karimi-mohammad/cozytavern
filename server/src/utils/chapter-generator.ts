import { buildEndpoint, buildHeaders, buildRequestBody } from './providers';
import { getChapterSettingsCompat } from './plugin-store';

// ─── Summarization Prompt (Improved) ───

const SUMMARIZER_SYSTEM_PROMPT = `You are a Roleplay Conversation Summarizer.

Your job is to compress long roleplay conversations into a concise, story-like summary that preserves everything important for continuing the roleplay naturally.

## Main Goal

Transform the provided roleplay conversation into a coherent narrative summary, written like a short story or chapter recap.

Do NOT simply list events or write bullet points.

The summary must allow another AI to understand what happened and continue the roleplay without needing the original conversation.

## What to Preserve

Always preserve important:

* Plot events and major developments
* Character identities, personalities, relationships, and roles
* Important dialogue and things characters explicitly said
* Decisions and actions that affect future events
* Emotional changes and character motivations
* Conflicts, arguments, promises, secrets, threats, and agreements
* Important locations and changes of location
* Important objects, items, abilities, injuries, or resources
* Romantic or interpersonal developments
* Information discovered by the characters
* Unresolved situations and ongoing conflicts
* Important consequences of previous actions
* Events that are likely to matter later in the story

## What to Remove

Do not waste space on:

* Repetitive dialogue
* Trivial small talk
* Repeated descriptions
* Unimportant actions
* Filler interactions
* Information that has no relevance to the story
* Duplicate events

However, do not remove something merely because it seems minor if it could affect future roleplay.

## Narrative Style

Write the summary as a continuous narrative.

Use past tense.

Write it as if you are summarizing a chapter of an ongoing novel.

Keep the chronology clear.

Mention important dialogue indirectly when possible, but preserve exact wording when a specific statement, promise, threat, confession, revelation, or phrase is important.

Focus on cause and effect:
what happened → why it happened → how the characters reacted → what changed afterward.

Preserve the characters' emotional states and relationship dynamics.

Do not invent events, thoughts, dialogue, motivations, or information that were not present in the conversation.

## Roleplay Continuity

The summary must prioritize information necessary for continuing the story.

Pay special attention to:

* Current character relationships
* Current location
* Current situation
* Recent events
* Character goals
* Unresolved conflicts
* Secrets
* Promises
* Important consequences
* What each character currently knows or does not know

Do not reveal information to a character if that information was only known by another character.

Maintain the distinction between what is objectively established in the story and what characters merely believe or suspect.

## Important Rule

Do not summarize the conversation as an AI analyzing a conversation.

The output should feel like a natural story recap.

Bad:
"Character A became angry after Character B said X. They then argued."

Better:
"After B revealed the truth, A's expression hardened. The revelation quickly turned their conversation into an argument, with A accusing B of hiding the truth from her. Although neither backed down, the confrontation ended when..."

## Output

Return ONLY the story summary.

Do not include:

* "Summary:"
* "Here is the summary:"
* Analysis
* Bullet points
* Character lists
* Commentary about what you chose to omit
* Suggestions for continuing the roleplay

The result should be concise but sufficiently detailed to preserve continuity.

If the conversation contains little meaningful information, produce a very short summary rather than inventing details.

If the conversation is extremely long, prioritize information based on its importance to future story continuity rather than trying to preserve every event.`;

const SUMMARIZER_WITH_CONTEXT_PROMPT = `You are an Expert Roleplay Narrator. Your objective is to synthesize the NEW conversation segment into a detailed, flowing narrative that seamlessly continues the story from the PREVIOUS summary. Do NOT over-compress. Preserve the richness of the story, including important dialogue, emotional shifts, and character dynamics.
Narrative Continuity & Focus

1. Smooth Transition: Connect the new events naturally to the existing context. While focusing on new developments, weave them seamlessly so the story doesn't feel disjointed.
2. Preserve Depth: Capture the nuances of important dialogue, promises, threats, and unspoken tensions. Maintain character identities and relationship statuses.
3. Cause and Effect: Write like a novelist in the past tense. Focus on what happened → why it happened → how characters reacted → what changed.
4. Key Elements to Keep: Plot progression, discovered secrets, location changes, combat/injuries, items acquired, and unresolved conflicts.

Exclusions

* Omit trivial small talk, repetitive greetings, or purely filler actions.
* Do not invent events, motivations, or thoughts not present in the text.
* Maintain the strict boundary of what each character objectively knows vs. what they only suspect.

Output Strict Rules

* Output ONLY the narrative continuation text.
* NO titles (Do not write "Summary:").
* NO bullet points or character lists.
* NO meta-commentary, AI analysis, or suggestions. Write it as the next natural paragraph(s) of an ongoing book.`;

// ─── Build Chapter Summary Request ───

export interface ChapterSummaryRequestInfo {
  endpoint: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  requestBody: string;
}

/**
 * Build a chapter summary request.
 * @param previousSummaries - Array of previous chapter summaries (for accumulating context)
 */
export function buildChapterSummaryRequest(
  messages: any[],
  character: any,
  db: any,
  previousSummaries?: string[],
): ChapterSummaryRequestInfo {
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
    ? `Character: ${character.name}\nDescription: ${character.description || ''}\nPersonality: ${character.personality || ''}`
    : '';

  const conversationText = messages
    .map((m: any) => {
      const role = m.role === 'user' ? 'User' : character?.name || 'Character';
      return `${role}: ${m.content}`;
    })
    .join('\n\n');

  // Build user message with optional previous context
  let userMessage = '';
  const hasPrevious = previousSummaries && previousSummaries.length > 0;

  if (hasPrevious) {
    const contextBlock = previousSummaries!
      .map((s, i) => `Previous summary ${i + 1}:\n${s}`)
      .join('\n\n');
    userMessage = `${charInfo ? charInfo + '\n\n' : ''}${contextBlock}\n\n---\n\n[TASK: Summarize the following roleplay conversation based on your system instructions.]

<conversation_to_summarize>
\`\`\`text
${conversationText}
\`\`\`
</conversation_to_summarize>

Remember: Do NOT continue the story. Output ONLY the narrative summary.`;
  } else {
    userMessage = `${charInfo ? charInfo + '\n\n' : ''}[TASK: Summarize the following roleplay conversation based on your system instructions.]

<conversation_to_summarize>
\`\`\`text
${conversationText}
\`\`\`
</conversation_to_summarize>

Remember: Do NOT continue the story. Output ONLY the narrative summary.`;
  }

  // Build request
  const endpoint = buildEndpoint(baseUrl);
  const systemPrompt = hasPrevious ? SUMMARIZER_WITH_CONTEXT_PROMPT : SUMMARIZER_SYSTEM_PROMPT;
  const promptParts = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: userMessage },
  ];
  const requestBody = buildRequestBody(promptParts, {
    model,
    temperature: 0.7,
    max_tokens: 8192,
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
  previousSummaries?: string[],
): Promise<ChapterSummaryResult> {
  const info = buildChapterSummaryRequest(messages, character, db, previousSummaries);
  // اگر کاربر پیام‌ها را ویرایش کرده باشد، از آن‌ها به جای prompt ساخته‌شده استفاده می‌شود
  const requestBody = (editedMessages && Array.isArray(editedMessages) && editedMessages.length > 0)
    ? buildRequestBody(editedMessages.map(m => ({ role: m.role as any, content: m.content })), {
        model: info.model,
        temperature: 0.7,
        max_tokens: 8192,
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
  if (triggerPhrases.length === 0) {
    return { suggested: false };
  }

  // پیدا کردن شروع اسکن: بعد از آخرین چپتر
  let scanStart = 0;
  const lastChapter = chapters.length > 0 ? chapters[chapters.length - 1] : null;
  if (lastChapter) {
    if (lastChapter.trigger_message_id) {
      const triggerIndex = messages.findIndex((m: any) => m.id === lastChapter.trigger_message_id);
      if (triggerIndex !== -1) {
        scanStart = triggerIndex + 1;
      }
    } else {
      const lastChapterEndIndex = messages.findIndex((m: any) => m.id === lastChapter.end_message_id);
      if (lastChapterEndIndex !== -1) {
        scanStart = lastChapterEndIndex + 2;
      }
    }
  }

  const messagesAfterLastChapter = messages.slice(scanStart);

  // پیدا کردن آخرین تریگر (نه اولین) بعد از آخرین چپتر
  const chapterMessageIds = new Set<string>();
  for (const ch of chapters) {
    const startIdx = messages.findIndex((m: any) => m.id === ch.start_message_id);
    const endIdx = messages.findIndex((m: any) => m.id === ch.end_message_id);
    if (startIdx !== -1 && endIdx !== -1) {
      for (let i = startIdx; i <= endIdx; i++) {
        chapterMessageIds.add(messages[i].id);
      }
    }
  }

  let lastTriggerIndex = -1;
  let lastTriggerPhrase = '';

  for (const msg of messagesAfterLastChapter) {
    if (chapterMessageIds.has(msg.id)) {
      continue;
    }
    for (const trigger of triggerPhrases) {
      if (msg.content && msg.content.toLowerCase().includes(trigger.toLowerCase())) {
        const msgIndex = messages.indexOf(msg);
        if (msgIndex > lastTriggerIndex) {
          lastTriggerIndex = msgIndex;
          lastTriggerPhrase = trigger;
        }
      }
    }
  }

  if (lastTriggerIndex === -1) {
    return { suggested: false };
  }

  // فاصله از تریگر تا آخر پیام‌ها
  const distanceFromTrigger = messages.length - 1 - lastTriggerIndex;

  if (distanceFromTrigger >= rawWindow) {
    return {
      suggested: true,
      trigger_message_id: messages[lastTriggerIndex].id,
      trigger_phrase: lastTriggerPhrase,
    };
  }

  // تریگر پیدا شده ولی فاصله کافی نیست — trigger info رو برگردون (برای UI)
  return {
    suggested: false,
    trigger_message_id: messages[lastTriggerIndex].id,
    trigger_phrase: lastTriggerPhrase,
  };
}
