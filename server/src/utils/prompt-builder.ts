import { getDb } from '../db';

interface PromptPart {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export function buildPrompt(
  character: any,
  persona: any,
  chatHistory: any[],
  lorebookEntries: any[],
  systemPrompt: string
): PromptPart[] {
  const parts: PromptPart[] = [];

  // 1. System Prompt
  if (systemPrompt) {
    parts.push({ role: 'system', content: systemPrompt });
  }

  // 2. توضیحات کاراکتر
  const charDesc = [
    `[اطلاعات کاراکتر]`,
    `نام: ${character.name}`,
    character.description && `توضیحات: ${character.description}`,
    character.personality && `شخصیت: ${character.personality}`,
    character.scenario && `سناریو: ${character.scenario}`,
  ].filter(Boolean).join('\n');

  parts.push({ role: 'system', content: charDesc });

  // 3. مثال‌های دیالوگ
  if (character.mes_example) {
    parts.push({
      role: 'system',
      content: `[مثال‌های دیالوگ]\n${character.mes_example}`,
    });
  }

  // 4. لوربوک فعال شده
  if (lorebookEntries.length > 0) {
    const loreText = lorebookEntries
      .map(e => e.content)
      .join('\n');
    parts.push({
      role: 'system',
      content: `[اطلاعات دنیا]\n${loreText}`,
    });
  }

  // 5. اطلاعات پرسونا
  if (persona) {
    parts.push({
      role: 'system',
      content: `[اطلاعات کاربر]\nنام: ${persona.name}\n${persona.description}`,
    });
  }

  // 6. تاریخچه چت
  for (const msg of chatHistory) {
    parts.push({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    });
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
