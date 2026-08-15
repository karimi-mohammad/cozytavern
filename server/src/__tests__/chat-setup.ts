import { vi, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const TEST_DB_PATH = path.join(__dirname, '..', 'data', 'test-chat.db');
const DATA_DIR = path.join(__dirname, '..', 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

try {
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
} catch {}

const testDb = new Database(TEST_DB_PATH);
testDb.pragma('journal_mode = WAL');
testDb.pragma('foreign_keys = ON');

testDb.exec(`
  CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT DEFAULT '', personality TEXT DEFAULT '',
    scenario TEXT DEFAULT '', first_mes TEXT DEFAULT '', mes_example TEXT DEFAULT '', creator_notes TEXT DEFAULT '',
    tags TEXT DEFAULT '[]', avatar TEXT DEFAULT '', lorebook_id TEXT DEFAULT '',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS personas (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT DEFAULT '', personality TEXT DEFAULT '',
    avatar TEXT DEFAULT '', created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY, character_id TEXT NOT NULL, name TEXT NOT NULL, branch_from TEXT,
    lorebook_id TEXT DEFAULT '', folder TEXT DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY, chat_id TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    content TEXT DEFAULT '', swipes TEXT DEFAULT '[]', swipe_id INTEGER DEFAULT 0, is_edited INTEGER DEFAULT 0,
    is_system INTEGER DEFAULT 0, send_date TEXT NOT NULL,
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS lorebooks (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, scan_depth INTEGER DEFAULT 50,
    token_budget INTEGER DEFAULT 500, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS lorebook_entries (
    id TEXT PRIMARY KEY, lorebook_id TEXT NOT NULL, keys TEXT DEFAULT '[]', keys_secondary TEXT DEFAULT '[]',
    content TEXT DEFAULT '', constant INTEGER DEFAULT 0, selective INTEGER DEFAULT 0,
    insertion_order INTEGER DEFAULT 100, position TEXT DEFAULT 'before_main', disable INTEGER DEFAULT 0,
    comment TEXT DEFAULT '', FOREIGN KEY (lorebook_id) REFERENCES lorebooks(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS api_settings (
    id TEXT PRIMARY KEY, provider TEXT NOT NULL DEFAULT 'openai', api_key TEXT DEFAULT '', model TEXT DEFAULT '',
    base_url TEXT DEFAULT '', temperature REAL DEFAULT 0.7, max_tokens INTEGER DEFAULT 2048, top_p REAL DEFAULT 1,
    frequency_penalty REAL DEFAULT 0, presence_penalty REAL DEFAULT 0, stream INTEGER DEFAULT 1, stop TEXT DEFAULT '[]',
    system_prompt TEXT DEFAULT ''
  );
`);

vi.mock('../db', () => ({
  getDb: () => testDb,
  initDb: () => {},
}));

export { testDb };

afterAll(() => {
  try { testDb.close(); } catch {}
  try { fs.unlinkSync(TEST_DB_PATH); } catch {}
});