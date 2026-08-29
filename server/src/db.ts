import Database from 'better-sqlite3';
import path from 'path';
import { migrateLegacyChapterSettings } from './utils/plugin-store';

const DB_PATH = path.join(__dirname, '..', 'data', 'cozytavern.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function initDb(): void {
  const database = getDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      personality TEXT DEFAULT '',
      scenario TEXT DEFAULT '',
      first_mes TEXT DEFAULT '',
      mes_example TEXT DEFAULT '',
      creator_notes TEXT DEFAULT '',
      tags TEXT DEFAULT '[]',
      avatar TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS personas (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      personality TEXT DEFAULT '',
      avatar TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      character_id TEXT NOT NULL,
      name TEXT NOT NULL,
      branch_from TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
      content TEXT DEFAULT '',
      swipes TEXT DEFAULT '[]',
      swipe_id INTEGER DEFAULT 0,
      is_edited INTEGER DEFAULT 0,
      is_system INTEGER DEFAULT 0,
      send_date TEXT NOT NULL,
      FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS lorebooks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      scan_depth INTEGER DEFAULT 50,
      token_budget INTEGER DEFAULT 500,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lorebook_entries (
      id TEXT PRIMARY KEY,
      lorebook_id TEXT NOT NULL,
      keys TEXT DEFAULT '[]',
      keys_secondary TEXT DEFAULT '[]',
      content TEXT DEFAULT '',
      constant INTEGER DEFAULT 0,
      selective INTEGER DEFAULT 0,
      insertion_order INTEGER DEFAULT 100,
      position TEXT DEFAULT 'before_main',
      disable INTEGER DEFAULT 0,
      comment TEXT DEFAULT '',
      FOREIGN KEY (lorebook_id) REFERENCES lorebooks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chapters (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      start_message_id TEXT NOT NULL,
      end_message_id TEXT NOT NULL,
      title TEXT DEFAULT '',
      summary TEXT DEFAULT '',
      generation_model TEXT DEFAULT '',
      generation_prompt_version TEXT DEFAULT '',
      manually_edited INTEGER DEFAULT 0,
      regeneration_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chapter_settings (
      id TEXT PRIMARY KEY DEFAULT 'default',
      raw_window INTEGER DEFAULT 10,
      auto_detect_enabled INTEGER DEFAULT 1,
      trigger_phrases TEXT DEFAULT '["next day","next morning","later that day","meanwhile"]',
      summarizer_model TEXT DEFAULT '',
      summarizer_base_url TEXT DEFAULT '',
      summarizer_api_key TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS api_settings (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL DEFAULT 'openai',
      api_key TEXT DEFAULT '',
      model TEXT DEFAULT '',
      base_url TEXT DEFAULT '',
      temperature REAL DEFAULT 0.7,
      max_tokens INTEGER DEFAULT 2048,
      top_p REAL DEFAULT 1,
      frequency_penalty REAL DEFAULT 0,
      presence_penalty REAL DEFAULT 0,
      stream INTEGER DEFAULT 1,
      stop TEXT DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS plugin_settings (
      plugin_id TEXT PRIMARY KEY,
      settings_json TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS chat_story_state (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL UNIQUE,
      state_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL,
      FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chat_state_snapshots (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      state_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
    );
  `);

  // Migration: انتقال chapter_settings قدیمی به plugin_settings ('chapters')
  migrateLegacyChapterSettings(database);

  // Migration: اضافه کردن lorebook_id به characters و chats
  const charCols = database.prepare("PRAGMA table_info(characters)").all() as any[];
  if (!charCols.some(c => c.name === 'lorebook_id')) {
    database.exec("ALTER TABLE characters ADD COLUMN lorebook_id TEXT DEFAULT ''");
  }

  const chatCols = database.prepare("PRAGMA table_info(chats)").all() as any[];
  if (!chatCols.some(c => c.name === 'lorebook_id')) {
    database.exec("ALTER TABLE chats ADD COLUMN lorebook_id TEXT DEFAULT ''");
  }

  const apiCols = database.prepare("PRAGMA table_info(api_settings)").all() as any[];
  if (!apiCols.some(c => c.name === 'system_prompt')) {
    database.exec("ALTER TABLE api_settings ADD COLUMN system_prompt TEXT DEFAULT ''");
  }

  // Migration: max_context (configurable context window size)
  if (!apiCols.some(c => c.name === 'max_context')) {
    database.exec("ALTER TABLE api_settings ADD COLUMN max_context INTEGER DEFAULT 0");
  }

  const chatFolderCols = database.prepare("PRAGMA table_info(chats)").all() as any[];
  if (!chatFolderCols.some(c => c.name === 'folder')) {
    database.exec("ALTER TABLE chats ADD COLUMN folder TEXT DEFAULT ''");
  }

  // Migration: observability fields for chapters
  const chapterCols = database.prepare("PRAGMA table_info(chapters)").all() as any[];
  if (!chapterCols.some(c => c.name === 'summary_generation_time')) {
    database.exec("ALTER TABLE chapters ADD COLUMN summary_generation_time INTEGER DEFAULT 0");
  }
  if (!chapterCols.some(c => c.name === 'summary_generation_tokens')) {
    database.exec("ALTER TABLE chapters ADD COLUMN summary_generation_tokens INTEGER DEFAULT 0");
  }
  if (!chapterCols.some(c => c.name === 'generated_at')) {
    database.exec("ALTER TABLE chapters ADD COLUMN generated_at TEXT DEFAULT ''");
  }

  // Migration: فیلدهای اضافی Character Card V3 (سازگار با SillyTavern)
  const charColsV3 = database.prepare("PRAGMA table_info(characters)").all() as any[];
  if (!charColsV3.some(c => c.name === 'system_prompt')) {
    database.exec("ALTER TABLE characters ADD COLUMN system_prompt TEXT DEFAULT ''");
  }
  if (!charColsV3.some(c => c.name === 'post_history_instructions')) {
    database.exec("ALTER TABLE characters ADD COLUMN post_history_instructions TEXT DEFAULT ''");
  }
  if (!charColsV3.some(c => c.name === 'alternate_greetings')) {
    database.exec("ALTER TABLE characters ADD COLUMN alternate_greetings TEXT DEFAULT '[]'");
  }
  if (!charColsV3.some(c => c.name === 'group_only_greetings')) {
    database.exec("ALTER TABLE characters ADD COLUMN group_only_greetings TEXT DEFAULT '[]'");
  }
  if (!charColsV3.some(c => c.name === 'nickname')) {
    database.exec("ALTER TABLE characters ADD COLUMN nickname TEXT DEFAULT ''");
  }
  if (!charColsV3.some(c => c.name === 'creator')) {
    database.exec("ALTER TABLE characters ADD COLUMN creator TEXT DEFAULT ''");
  }
  if (!charColsV3.some(c => c.name === 'character_version')) {
    database.exec("ALTER TABLE characters ADD COLUMN character_version TEXT DEFAULT ''");
  }

  // Migration: Author's Note برای هر چت (تزریق پرامپت در عمق قابل تنظیم)
  const chatColsAll = database.prepare("PRAGMA table_info(chats)").all() as any[];
  if (!chatColsAll.some(c => c.name === 'authors_note')) {
    database.exec("ALTER TABLE chats ADD COLUMN authors_note TEXT DEFAULT ''");
  }
  if (!chatColsAll.some(c => c.name === 'authors_note_depth')) {
    database.exec("ALTER TABLE chats ADD COLUMN authors_note_depth INTEGER DEFAULT 4");
  }
  if (!chatColsAll.some(c => c.name === 'authors_note_position')) {
    database.exec("ALTER TABLE chats ADD COLUMN authors_note_position TEXT DEFAULT 'in_chat'");
  }

  // Migration: موتور پیشرفته لوربوک (regex / case-sensitivity / probability)
  const entryCols = database.prepare("PRAGMA table_info(lorebook_entries)").all() as any[];
  if (!entryCols.some(c => c.name === 'case_sensitive')) {
    database.exec("ALTER TABLE lorebook_entries ADD COLUMN case_sensitive INTEGER DEFAULT 0");
  }
  if (!entryCols.some(c => c.name === 'use_regex')) {
    database.exec("ALTER TABLE lorebook_entries ADD COLUMN use_regex INTEGER DEFAULT 0");
  }
  if (!entryCols.some(c => c.name === 'probability')) {
    database.exec("ALTER TABLE lorebook_entries ADD COLUMN probability INTEGER DEFAULT 100");
  }

  // ─── Group Chat tables ───
  database.exec(`
    CREATE TABLE IF NOT EXISTS chat_participants (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      character_id TEXT NOT NULL,
      display_name TEXT DEFAULT '',
      display_avatar TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    );
  `);

  // Migration: group chat fields for chats
  const chatColsGc = database.prepare("PRAGMA table_info(chats)").all() as any[];
  if (!chatColsGc.some(c => c.name === 'is_group_chat')) {
    database.exec("ALTER TABLE chats ADD COLUMN is_group_chat INTEGER DEFAULT 0");
  }
  if (!chatColsGc.some(c => c.name === 'group_chat_name')) {
    database.exec("ALTER TABLE chats ADD COLUMN group_chat_name TEXT DEFAULT ''");
  }

  // Migration: sender info for messages
  const msgCols = database.prepare("PRAGMA table_info(messages)").all() as any[];
  if (!msgCols.some(c => c.name === 'sender_name')) {
    database.exec("ALTER TABLE messages ADD COLUMN sender_name TEXT DEFAULT ''");
  }
  if (!msgCols.some(c => c.name === 'sender_avatar')) {
    database.exec("ALTER TABLE messages ADD COLUMN sender_avatar TEXT DEFAULT ''");
  }
  if (!msgCols.some(c => c.name === 'sender_character_id')) {
    database.exec("ALTER TABLE messages ADD COLUMN sender_character_id TEXT DEFAULT ''");
  }
}
