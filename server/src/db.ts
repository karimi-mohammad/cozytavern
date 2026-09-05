import Database from 'better-sqlite3';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
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
      trigger_message_id TEXT DEFAULT '',
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

    CREATE TABLE IF NOT EXISTS chat_lorebooks (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      lorebook_id TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      insertion_order INTEGER DEFAULT 100,
      created_at TEXT NOT NULL,
      FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
      FOREIGN KEY (lorebook_id) REFERENCES lorebooks(id) ON DELETE CASCADE
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

  // Migration: reasoning_effort for DeepSeek/o1 style models
  if (!apiCols.some(c => c.name === 'reasoning_effort')) {
    database.exec("ALTER TABLE api_settings ADD COLUMN reasoning_effort TEXT DEFAULT ''");
  }

  // Migration: pollinations_api_key for image generation
  if (!apiCols.some(c => c.name === 'pollinations_api_key')) {
    database.exec("ALTER TABLE api_settings ADD COLUMN pollinations_api_key TEXT DEFAULT ''");
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
  if (!chapterCols.some(c => c.name === 'trigger_message_id')) {
    database.exec("ALTER TABLE chapters ADD COLUMN trigger_message_id TEXT DEFAULT ''");
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
  if (!entryCols.some(c => c.name === 'always_active')) {
    database.exec("ALTER TABLE lorebook_entries ADD COLUMN always_active INTEGER DEFAULT 0");
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

  // ─── Group Chat Settings ───
  database.exec(`
    CREATE TABLE IF NOT EXISTS group_chat_settings (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL UNIQUE,
      auto_respond_character_id TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
    );
  `);

  // ─── Story Advisor tables ───
  database.exec(`
    CREATE TABLE IF NOT EXISTS story_advisor_chats (
      id TEXT PRIMARY KEY,
      main_chat_id TEXT NOT NULL,
      name TEXT DEFAULT 'Advisor Chat',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (main_chat_id) REFERENCES chats(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS story_advisor_messages (
      id TEXT PRIMARY KEY,
      advisor_chat_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (advisor_chat_id) REFERENCES story_advisor_chats(id) ON DELETE CASCADE
    );
  `);

  // ─── Chat Notes (یادداشت‌های هر چت) ───
  database.exec(`
    CREATE TABLE IF NOT EXISTS chat_notes (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      content TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
    );
  `);

  // ─── Image Generation Tables ───
  database.exec(`
    -- Image profiles (built-in + custom)
    CREATE TABLE IF NOT EXISTS image_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      instruction TEXT NOT NULL,
      negative_prompt TEXT DEFAULT 'text, watermark, logo, blurry, deformed',
      width INTEGER DEFAULT 1024,
      height INTEGER DEFAULT 1024,
      model TEXT DEFAULT 'flux',
      is_builtin INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Image presets ( ذخیره تنظیمات ترکیبی)
    CREATE TABLE IF NOT EXISTS image_presets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      preset_type TEXT DEFAULT 'scene' CHECK(preset_type IN ('scene', 'portrait')),
      profile_id TEXT DEFAULT 'scene',
      model TEXT DEFAULT 'flux',
      width INTEGER DEFAULT 1024,
      height INTEGER DEFAULT 1024,
      auto_use_last_prompt INTEGER DEFAULT 0,
      prompt_template TEXT DEFAULT '',
      negative_prompt TEXT DEFAULT 'text, watermark, logo, blurry, deformed',
      selected_character_ids TEXT DEFAULT '[]',
      is_builtin INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Scene images
    CREATE TABLE IF NOT EXISTS scene_images (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      message_id TEXT DEFAULT '',
      profile_id TEXT DEFAULT 'scene',
      llm_prompt TEXT DEFAULT '',
      image_prompt TEXT NOT NULL,
      negative_prompt TEXT DEFAULT '',
      image_url TEXT DEFAULT '',
      image_data TEXT DEFAULT '',
      model TEXT DEFAULT 'flux',
      seed INTEGER DEFAULT 0,
      width INTEGER DEFAULT 1024,
      height INTEGER DEFAULT 1024,
      chapter_id TEXT DEFAULT '',
      is_auto_generated INTEGER DEFAULT 0,
      is_pinned INTEGER DEFAULT 0,
      metadata JSON DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Character portraits
    CREATE TABLE IF NOT EXISTS character_portraits (
      id TEXT PRIMARY KEY,
      character_id TEXT NOT NULL,
      chat_id TEXT DEFAULT '',
      profile_id TEXT DEFAULT 'portrait',
      llm_prompt TEXT DEFAULT '',
      image_prompt TEXT NOT NULL,
      negative_prompt TEXT DEFAULT '',
      image_url TEXT DEFAULT '',
      image_data TEXT DEFAULT '',
      model TEXT DEFAULT 'flux',
      seed INTEGER DEFAULT 0,
      width INTEGER DEFAULT 1024,
      height INTEGER DEFAULT 1024,
      is_current INTEGER DEFAULT 0,
      is_variation INTEGER DEFAULT 0,
      parent_id TEXT DEFAULT '',
      metadata JSON DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Indexes for image tables
    CREATE INDEX IF NOT EXISTS idx_scene_images_chat_id ON scene_images(chat_id);
    CREATE INDEX IF NOT EXISTS idx_scene_images_pinned ON scene_images(is_pinned);
    CREATE INDEX IF NOT EXISTS idx_portraits_character ON character_portraits(character_id);
    CREATE INDEX IF NOT EXISTS idx_portraits_current ON character_portraits(is_current);
  `);

  // Seed built-in image profiles
  const existingProfiles = database.prepare("SELECT COUNT(*) as count FROM image_profiles").get() as any;
  if (existingProfiles.count === 0) {
    database.exec(`
      INSERT INTO image_profiles (id, name, instruction, negative_prompt, width, height, model, is_builtin) VALUES
      ('scene', 'Scene', 'Create a polished visual prompt for a full scene. Focus on environment, story moment, composition, lighting, and mood.', 'text, watermark, logo, blurry, deformed', 1024, 1024, 'flux', 1),
      ('portrait', 'Portrait', 'Create a polished visual prompt for a character portrait. Focus on face, expression, pose, lighting, clothing, and composition.', 'text, watermark, logo, blurry, deformed, extra limbs, bad anatomy', 1024, 1024, 'flux', 1),
      ('face', 'Face', 'Create a polished close-up face prompt. Focus on facial features, eyes, expression, skin detail, and lighting.', 'text, watermark, logo, blurry, deformed', 1024, 1024, 'flux', 1),
      ('background', 'Background', 'Create a polished background prompt. Focus on setting, atmosphere, depth, and visual details without centering a character.', 'text, watermark, logo, blurry, deformed', 1024, 1024, 'flux', 1),
      ('character-sheet', 'Character Sheet', 'Create a polished character sheet prompt. Focus on consistent outfit, body shape, front and side views, and detail callouts.', 'text, watermark, logo, blurry, deformed', 1024, 1024, 'flux', 1);
    `);
  }

  // Seed built-in image presets
  const existingPresets = database.prepare("SELECT COUNT(*) as count FROM image_presets").get() as any;
  if (existingPresets.count === 0) {
    database.exec(`
      INSERT INTO image_presets (id, name, description, preset_type, profile_id, model, width, height, is_builtin) VALUES
      ('default-scene', 'Default Scene', 'Standard scene generation settings', 'scene', 'scene', 'flux', 1024, 1024, 1),
      ('default-portrait', 'Default Portrait', 'Standard portrait generation settings', 'portrait', 'portrait', 'flux', 1024, 1024, 1),
      ('anime-scene', 'Anime Scene', 'Anime style scene generation', 'scene', 'scene', 'flux-anime', 1024, 1024, 1),
      ('realistic-portrait', 'Realistic Portrait', 'Photorealistic portrait generation', 'portrait', 'portrait', 'flux-realism', 1024, 1024, 1),
      ('quick-draft', 'Quick Draft', 'Fast generation for testing ideas', 'scene', 'scene', 'flux-turbo', 512, 512, 1);
    `);
  }

  // ─── Performance indexes ───
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
    CREATE INDEX IF NOT EXISTS idx_chats_character_id ON chats(character_id);
    CREATE INDEX IF NOT EXISTS idx_lorebook_entries_lorebook_id ON lorebook_entries(lorebook_id);
    CREATE INDEX IF NOT EXISTS idx_chat_lorebooks_chat_id ON chat_lorebooks(chat_id);
    CREATE INDEX IF NOT EXISTS idx_chapters_chat_id ON chapters(chat_id);
    CREATE INDEX IF NOT EXISTS idx_chat_participants_chat_id ON chat_participants(chat_id);
    CREATE INDEX IF NOT EXISTS idx_settings_chat ON group_chat_settings(chat_id);
    CREATE INDEX IF NOT EXISTS idx_advisor_chats_main_chat ON story_advisor_chats(main_chat_id);
    CREATE INDEX IF NOT EXISTS idx_advisor_msgs_chat ON story_advisor_messages(advisor_chat_id);
    CREATE INDEX IF NOT EXISTS idx_chat_notes_chat_id ON chat_notes(chat_id);
  `);

  // Migration: انتقال lorebook_id از chats به chat_lorebooks (پشتیبانی از چند لور بوک)
  const chatLorebookRows = database.prepare("SELECT id, lorebook_id FROM chats WHERE lorebook_id != '' AND lorebook_id IS NOT NULL").all() as any[];
  const existingChatLorebooks = database.prepare("SELECT chat_id FROM chat_lorebooks").all() as any[];
  const existingChatLorebookSet = new Set(existingChatLorebooks.map((r: any) => r.chat_id));

  if (chatLorebookRows.length > 0) {
    const insertCL = database.prepare(`
      INSERT OR IGNORE INTO chat_lorebooks (id, chat_id, lorebook_id, is_active, insertion_order, created_at)
      VALUES (?, ?, ?, 1, 100, ?)
    `);
    const now = new Date().toISOString();
    for (const row of chatLorebookRows) {
      // Only insert if not already migrated for this chat
      if (!existingChatLorebookSet.has(row.chat_id)) {
        const uuid = uuidv4();
        insertCL.run(uuid, row.chat_id, row.lorebook_id, now);
      }
    }
  }

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

  // Migration: group_chat_settings columns
  const gcSettingsCols = database.prepare("PRAGMA table_info(group_chat_settings)").all() as any[];
  if (!gcSettingsCols.some(c => c.name === 'auto_respond_character_id')) {
    database.exec("ALTER TABLE group_chat_settings ADD COLUMN auto_respond_character_id TEXT DEFAULT NULL");
  }

  // Migration: strip_think for API settings
  if (!apiCols.some(c => c.name === 'strip_think')) {
    database.exec("ALTER TABLE api_settings ADD COLUMN strip_think INTEGER DEFAULT 0");
  }

  // Migration: two_phase_state_update (separate text generation from tool calls)
  if (!apiCols.some(c => c.name === 'two_phase_state_update')) {
    database.exec("ALTER TABLE api_settings ADD COLUMN two_phase_state_update INTEGER DEFAULT 1");
  }

  // Migration: اضافه کردن preset_type و selected_character_ids به image_presets
  const presetCols = database.prepare("PRAGMA table_info(image_presets)").all() as any[];
  if (!presetCols.some(c => c.name === 'preset_type')) {
    database.exec("ALTER TABLE image_presets ADD COLUMN preset_type TEXT DEFAULT 'scene'");
  }
  if (!presetCols.some(c => c.name === 'selected_character_ids')) {
    database.exec("ALTER TABLE image_presets ADD COLUMN selected_character_ids TEXT DEFAULT '[]'");
  }
}
