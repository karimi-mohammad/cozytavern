export interface Character {
  id: string;
  name: string;
  nickname: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  creator_notes: string;
  system_prompt: string;
  post_history_instructions: string;
  alternate_greetings: string[];
  group_only_greetings: string[];
  creator: string;
  character_version: string;
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
  // Group chat sender info
  sender_name?: string;
  sender_avatar?: string;
  sender_character_id?: string;
}

export interface Chat {
  id: string;
  character_id: string;
  name: string;
  lorebook_id: string;
  folder: string;
  branch_from?: string;
  authors_note: string;
  authors_note_depth: number;
  authors_note_position: 'after_char' | 'in_chat';
  is_group_chat: boolean;
  group_chat_name: string;
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
  case_sensitive: boolean;
  use_regex: boolean;
  probability: number;
}

export interface Lorebook {
  id: string;
  name: string;
  scan_depth: number;
  token_budget: number;
  entries: LorebookEntry[];
  entry_count?: number;
  active_entry_count?: number;
  created_at: string;
}

export interface ChatLorebook {
  id: string;
  chat_id: string;
  lorebook_id: string;
  is_active: boolean;
  insertion_order: number;
  created_at: string;
  // Joined fields
  lorebook_name: string;
  scan_depth: number;
  token_budget: number;
  active_entries: number;
  total_entries: number;
}

export interface ApiSettings {
  id: string;
  provider: 'openai' | 'claude' | 'ollama';
  api_key: string;
  model: string;
  base_url: string;
  temperature: number;
  max_tokens: number;
  max_context: number;
  top_p: number;
  frequency_penalty: number;
  presence_penalty: number;
  stream: boolean;
  stop: string[];
  system_prompt: string;
  reasoning_effort?: 'low' | 'medium' | 'high' | '';
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
  // Group chat info (optional)
  character_name?: string;
  character_avatar?: string;
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
  // Group chat info (optional)
  character_name?: string;
  character_avatar?: string;
}

export interface Chapter {
  id: string;
  chat_id: string;
  start_message_id: string;
  end_message_id: string;
  trigger_message_id: string;
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
  raw_mode: 'count' | 'tokens';
  raw_token_budget: number;
  raw_min_messages: number;
  raw_max_messages: number;
  auto_detect_enabled: boolean;
  trigger_phrases: string[];
  summarizer_model: string;
  summarizer_base_url: string;
  summarizer_api_key: string;
}

// ─── Chapter Creation Flow ───

export interface ChapterPreviewData {
  character: {
    name: string;
    description: string;
    personality: string;
  } | null;
  previous_summaries: string[];
  messages_preview: Message[];
  total_messages: number;
  settings: {
    model: string;
    temperature: number;
    max_tokens: number;
  };
  full_payload: {
    model: string;
    messages: { role: string; content: string }[];
    temperature: number;
    max_tokens: number;
    stream: boolean;
  };
}

export interface ChapterSummaryResult {
  summary: string;
  model: string;
  generation_time: number;
  generation_tokens: number;
}

export interface LorebookPluginSettings {
  default_scan_depth: number;
  default_token_budget: number;
}

export interface QuickReply {
  label: string;
  message: string;
}

export interface QuickReplySettings {
  enabled: boolean;
  replies: QuickReply[];
}

export interface SearchResult {
  id: string;
  chat_id: string;
  chat_name: string;
  character_name: string;
  character_avatar: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  snippet: string;
  send_date: string;
  is_edited: boolean;
}

export interface ChatParticipant {
  id: string;
  chat_id: string;
  character_id: string;
  display_name: string;
  display_avatar: string;
  is_active: boolean;
  created_at: string;
}

export interface GroupChat extends Chat {
  is_group_chat: boolean;
  group_chat_name: string;
  participants: ChatParticipant[];
}

export interface CharacterState {
  location?: string;
  position?: string;
  clothing?: string;
}

export interface RelationshipDetail {
  anger?: number;        // 0-100
  shame?: number;        // 0-100
  love?: number;         // 0-100
  affection?: number;    // 0-100
  trust?: number;        // 0-100
  fear?: number;         // 0-100
  respect?: number;      // 0-100
  jealousy?: number;     // 0-100
  gratitude?: number;    // 0-100
  summary?: string;      // Text description
}

export interface ImportantMemory {
  id?: string;
  content: string;
  timestamp?: string;
  importance?: 'low' | 'medium' | 'high';
}

export interface StoryState {
  chat_id?: string;
  characters: Record<string, CharacterState>;
  relationships: Record<string, string>;
  relationship_details?: Record<string, RelationshipDetail>;
  current_situation: string;
  rules: string[];
  memories?: ImportantMemory[];
  updated_at?: string;
}
