import { buildEndpoint, buildHeaders, buildRequestBody } from './providers';

interface GenerateMessageOptions {
  chat_id: string;
  character_id: string;
  instruction: string;
  db: any;
}

interface GenerateMessageResult {
  success: boolean;
  message?: string;
  content?: string;
  error?: string;
}

export async function generateCharacterMessage(
  options: GenerateMessageOptions
): Promise<GenerateMessageResult> {
  const { chat_id, character_id, instruction, db } = options;

  try {
    // Get character info
    const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(character_id) as any;
    if (!character) {
      return { success: false, error: 'Character not found' };
    }

    // Get chat info
    const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(chat_id) as any;
    if (!chat) {
      return { success: false, error: 'Chat not found' };
    }

    // Get recent messages for context
    const messages = db.prepare(
      'SELECT role, content, sender_name FROM messages WHERE chat_id = ? ORDER BY rowid DESC LIMIT 20'
    ).all(chat_id) as any[];

    // Get API settings
    const settings = db.prepare('SELECT * FROM api_settings ORDER BY ROWID DESC LIMIT 1').get() as any;
    if (!settings) {
      return { success: false, error: 'API settings not found' };
    }

    // Build the generation prompt
    const systemPrompt = `You are generating a message for the character "${character.name}" in a roleplay/chat context.

Character Profile:
- Name: ${character.name}
- Description: ${character.description || ''}
- Personality: ${character.personality || ''}
- Scenario: ${character.scenario || ''}
- System Prompt: ${character.system_prompt || ''}

Your task:
Write a message that ${character.name} would say/do based on the following instruction:
"${instruction}"

Rules:
1. Stay in character as ${character.name}
2. Write in the same language as the instruction (Persian/English)
3. Include dialogue and actions formatted with markdown:
   - *asterisks for actions* (e.g., *walks to the door*)
   - "quotes for dialogue" (e.g., "Hello there!")
4. Keep the message natural and appropriate for the context
5. Do NOT include the character's name as a prefix
6. Return ONLY the message content, no explanations

Recent Chat Context:
${messages.reverse().map((m: any) => {
  const label = m.role === 'user' ? 'User' : (m.sender_name || 'Character');
  return `${label}: ${m.content}`;
}).join('\n\n')}`;

    const promptParts = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: `Generate a message for ${character.name} based on this instruction: ${instruction}` },
    ];

    const endpoint = buildEndpoint(settings.base_url);
    const headers = buildHeaders(settings.api_key);
    const requestBody = buildRequestBody(promptParts, {
      model: settings.model,
      temperature: 0.8,
      max_tokens: settings.max_tokens || 1024,
      top_p: settings.top_p,
      frequency_penalty: settings.frequency_penalty,
      presence_penalty: settings.presence_penalty,
      stream: false, // Non-streaming for preview generation
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: requestBody,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `API error: ${response.status}: ${errorText}` };
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content || '';

    if (!content) {
      return { success: false, error: 'No content generated' };
    }

    return { success: true, content };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to generate message' };
  }
}