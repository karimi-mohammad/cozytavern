import { getDb } from '../db';

interface PromptPart {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface BuildPromptOptions {
  impersonate?: boolean;
  continueMode?: boolean;
  chapters?: any[];
  rawWindow?: number;
}

export function buildPrompt(
  character: any,
  persona: any,
  chatHistory: any[],
  lorebookEntries: any[],
  systemPrompt: string,
  options?: BuildPromptOptions
): PromptPart[] {
  const parts: PromptPart[] = [];

  // 1. System Prompt
  if (systemPrompt) {
    parts.push({ role: 'system', content: systemPrompt });
  }

  // Impersonate mode: instruct AI to write as the user
  if (options?.impersonate) {
    const userName = persona?.name || '{{user}}';
    parts.push({
      role: 'system',
      content: `[Special Instruction] You must write on behalf of the user "${userName}". Write the next reply from the user's perspective and in their role. Respect the user's personality, emotions, and speaking style. Write only one message as the user.`,
    });
  }

  // 2. Character info
  const charDesc = [
    `[Character Info]`,
    `Name: ${character.name}`,
    character.description && `Description: ${character.description}`,
    character.personality && `Personality: ${character.personality}`,
    character.scenario && `Scenario: ${character.scenario}`,
  ].filter(Boolean).join('\n');

  parts.push({ role: 'system', content: charDesc });

  // 3. Example dialogues
  if (character.mes_example) {
    parts.push({
      role: 'system',
      content: `[Example Dialogues]\n${character.mes_example}`,
    });
  }

  // 4. لوربوک فعال شده
  if (lorebookEntries.length > 0) {
    const loreText = lorebookEntries
      .map(e => e.content)
      .join('\n');
    parts.push({
      role: 'system',
      content: `[World Info]\n${loreText}`,
    });
  }

  // 5. اطلاعات پرسونا
  if (persona) {
    parts.push({
      role: 'system',
      content: `[User Info]\nName: ${persona.name}\n${persona.description}`,
    });
  }

  // 6. تاریخچه چت (با در نظر گرفتن chapter summaries)
  const rawWindow = options?.rawWindow || 0;
  const chapters = options?.chapters || [];

  if (chapters.length > 0 && rawWindow > 0 && chatHistory.length > rawWindow) {
    // Find which messages belong to chapters vs raw window
    const totalMessages = chatHistory.length;
    const rawStartIndex = Math.max(0, totalMessages - rawWindow);

    // Insert chapter summaries (in chronological order)
    for (const chapter of chapters) {
      if (chapter.summary) {
        const title = chapter.title || `Chapter`;
        parts.push({
          role: 'system',
          content: `[${title}]\n${chapter.summary}`,
        });
      }
    }

    // Insert raw messages (recent window only)
    for (let i = rawStartIndex; i < totalMessages; i++) {
      const msg = chatHistory[i];
      parts.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    }
  } else {
    // No chapters or no raw window — send all messages as before
    for (const msg of chatHistory) {
      parts.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    }
  }

  // جایگزینی ماکروها
  return parts.map(p => ({
    ...p,
    content: replaceMacros(p.content, character?.name, persona?.name),
  }));
}

function replaceMacros(text: string, charName?: string, userName?: string): string {
  let result = text;
  if (charName) {
    result = result.replace(/\{\{char\}\}/g, charName);
  }
  if (userName) {
    result = result.replace(/\{\{user\}\}/g, userName);
  }
  return result;
}

export function activateWorldInfo(chatMessages: any[], lorebook: any): any[] {
  if (!lorebook?.entries) return [];

  const scanDepth = lorebook.scan_depth || 50;
  const activeEntries: any[] = [];

  for (const entry of lorebook.entries) {
    if (entry.disable) continue;

    if (entry.constant) {
      activeEntries.push(entry);
      continue;
    }

    const recentMessages = chatMessages.slice(-scanDepth);
    const allText = recentMessages.map((m: any) => m.content).join(' ');

    const mainKeyFound = entry.key.some((k: string) =>
      allText.toLowerCase().includes(k.toLowerCase())
    );

    if (!mainKeyFound) continue;

    if (entry.selective) {
      const secondaryKeyFound = entry.keysecondary.some((k: string) =>
        allText.toLowerCase().includes(k.toLowerCase())
      );
      if (!secondaryKeyFound) continue;
    }

    activeEntries.push(entry);
  }

  activeEntries.sort((a: any, b: any) => a.insertion_order - b.insertion_order);
  return activeEntries;
}
