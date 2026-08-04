export interface PromptPart {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
