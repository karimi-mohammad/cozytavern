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

const SUMMARIZER_WITH_CONTEXT_PROMPT = `You are a Roleplay Conversation Summarizer.

Your job is to compress roleplay conversations into concise, story-like summaries that preserve everything important for continuing the roleplay naturally.

You will receive a PREVIOUS story summary and a NEW conversation segment. Your task is to summarize ONLY the new events.

## Main Goal

Transform the new conversation segment into a coherent narrative summary that continues from where the previous summary left off.

Do NOT simply list events or write bullet points.

Do NOT repeat information from the previous summary.

## Critical Rules

1. Do NOT repeat any information already covered in the previous summary
2. Only include NEW events, NEW dialogue, NEW developments
3. The summary should flow naturally from the previous context
4. Focus on: what changed, what's new, what decisions were made, what tensions arose

## What to Preserve (from the NEW segment only)

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

## What to Remove

Do not waste space on:

* Repetitive dialogue
* Trivial small talk
* Repeated descriptions
* Unimportant actions
* Filler interactions
* Information already covered in the previous summary
* Duplicate events

## Narrative Style

Write the summary as a continuous narrative.

Use past tense.

Write it as if you are summarizing the next chapter of an ongoing novel.

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

Return ONLY the new story summary.

Do not include:

* "Summary:"
* "Here is the summary:"
* Analysis
* Bullet points
* Character lists
* Commentary about what you chose to omit
* Suggestions for continuing the roleplay
* Any reference to "previous summary" or "new segment"

The result should be concise but sufficiently detailed to preserve continuity.

If the new conversation contains little meaningful information, produce a very short summary rather than inventing details.`;

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
  previousSummaries?: string[],
): Promise<ChapterSummaryResult> {
  const info = buildChapterSummaryRequest(messages, character, db, previousSummaries);
  // اگر کاربر پیام‌ها را ویرایش کرده باشد، از آن‌ها به جای prompt ساخته‌شده استفاده می‌شود
  const requestBody = (editedMessages && Array.isArray(editedMessages) && editedMessages.length > 0)
    ? buildRequestBody(editedMessages.map(m => ({ role: m.role as any, content: m.content })), {
        model: info.model,
        temperature: 0.3,
        max_tokens: 2048,
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

  // Find the start point for scanning (after last chapter's end message)
  // +2 to skip past the end_message_id AND the trigger that created this chapter
  let scanStart = 0;
  const lastChapter = chapters.length > 0 ? chapters[chapters.length - 1] : null;
  if (lastChapter) {
    const lastChapterEndIndex = messages.findIndex((m: any) => m.id === lastChapter.end_message_id);
    if (lastChapterEndIndex !== -1) {
      // Start scanning from AFTER the last chapter's end message + trigger
      // The chapter ends at trigger-1, so we need to skip trigger+1 to avoid re-detecting
      scanStart = lastChapterEndIndex + 2;
    }
  }

  // Only scan messages after the last chapter
  const messagesAfterLastChapter = messages.slice(scanStart);

  // Not enough messages after last chapter
  if (messagesAfterLastChapter.length < rawWindow) {
    return { suggested: false };
  }

  // Scan messages outside the raw window for triggers (raw window is the most recent messages that won't be summarized)
  const scanEnd = messagesAfterLastChapter.length - rawWindow;
  const scanMessages = messagesAfterLastChapter.slice(0, scanEnd);

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
