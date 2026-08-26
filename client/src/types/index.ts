export interface Character {
  id: string;
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  creator_notes: string;
  tags: string[];
  avatar: string;
  lorebook_id: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  chat_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  swipes: string[];
  swipe_id: number;
  is_edited: boolean;
  is_system: boolean;
  send_date: string;
}

export interface Chat {
  id: string;
  character_id: string;
  name: string;
  lorebook_id: string;
  folder: string;
  branch_from?: string;
  created_at: string;
  updated_at: string;
}

export interface Persona {
  id: string;
  name: string;
  description: string;
  personality: string;
  avatar: string;
  created_at: string;
}

export interface LorebookEntry {
  id: string;
  lorebook_id: string;
  key: string[];
  keysecondary: string[];
  content: string;
  constant: boolean;
  selective: boolean;
  insertion_order: number;
  position: 'before_main' | 'after_main';
  disable: boolean;
  comment: string;
}

export interface Lorebook {
  id: string;
  name: string;
  scan_depth: number;
  token_budget: number;
  entries: LorebookEntry[];
  created_at: string;
}

export interface ApiSettings {
  id: string;
  provider: 'openai' | 'claude' | 'ollama';
  api_key: string;
  model: string;
  base_url: string;
  temperature: number;
  max_tokens: number;
  top_p: number;
  frequency_penalty: number;
  presence_penalty: number;
  stream: boolean;
  stop: string[];
  system_prompt: string;
}

export interface PromptPart {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// ─── Prompt Inspector ───
export type InspectionSource = 'chat' | 'title' | 'chapter';

// payload بازگشتی از dry-run سرور (قبل از ارسال واقعی به LLM)
export interface PromptInspectionPayload {
  inspect: boolean;
  source: InspectionSource;
  mode?: string;
  endpoint: string;
  model: string;
  params: Record<string, any>;
  messages: PromptPart[];
}

// entry پنل بازرس — شامل متادیتا برای تاریخچه
export interface PromptInspection {
  id: string;
  source: InspectionSource;
  label: string; // 'Chat' | 'Chat Title' | 'Chapter Summary'
  mode?: string; // send | regenerate | continue | impersonate
  endpoint: string;
  model: string;
  params: Record<string, any>;
  messages: PromptPart[];
  created_at: string;
}

export interface Chapter {
  id: string;
  chat_id: string;
  start_message_id: string;
  end_message_id: string;
  title: string;
  summary: string;
  generation_model: string;
  generation_prompt_version: string;
  manually_edited: boolean;
  regeneration_count: number;
  created_at: string;
  updated_at: string;
}

export interface ChapterSettings {
  raw_window: number;
  auto_detect_enabled: boolean;
  trigger_phrases: string[];
  summarizer_model: string;
  summarizer_base_url: string;
  summarizer_api_key: string;
}

export interface LorebookPluginSettings {
  default_scan_depth: number;
  default_token_budget: number;
}
