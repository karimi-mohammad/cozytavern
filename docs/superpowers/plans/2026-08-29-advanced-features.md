# Advanced Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four advanced features to CozyTavern: auto character interaction, complex relationship management, versioning system, and smart notifications.

**Architecture:** Each feature is implemented as an independent subsystem with its own database tables, API routes, and UI components. Features share common patterns (SQLite migrations, Express routes, React components with Zustand state).

**Tech Stack:** Express.js + better-sqlite3 (backend), React + Zustand + Tailwind CSS (frontend), TypeScript throughout.

## Global Constraints

- Node.js >= 18
- TypeScript 5.3+
- SQLite with WAL mode and foreign keys
- Vitest for testing
- Follow existing code patterns (no new dependencies unless essential)

---

## Feature 1: Auto Character Interaction (Character Auto-Chat)

### Task 1.1: Database Schema for Auto-Chat Config

**Files:**
- Create: `server/src/__tests__/auto-chat.test.ts`
- Modify: `server/src/db.ts`

**Interfaces:**
- Consumes: existing `getDb()` function
- Produces: `auto_chat_sessions` and `auto_chat_messages` tables

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { testDb } from './global-setup';
import { v4 as uuidv4 } from 'uuid';

describe('Auto Chat Database', () => {
  beforeEach(() => {
    testDb.exec('DELETE FROM auto_chat_sessions');
    testDb.exec('DELETE FROM auto_chat_messages');
  });

  it('should create auto_chat_sessions table', () => {
    const id = uuidv4();
    testDb.prepare(`
      INSERT INTO auto_chat_sessions (id, chat_id, is_running, interval_seconds, max_turns, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, 'chat1', 1, 30, 10, new Date().toISOString());
    
    const session = testDb.prepare('SELECT * FROM auto_chat_sessions WHERE id = ?').get(id);
    expect(session).toBeDefined();
    expect((session as any).is_running).toBe(1);
  });

  it('should create auto_chat_messages table', () => {
    const id = uuidv4();
    testDb.prepare(`
      INSERT INTO auto_chat_messages (id, session_id, character_id, content, turn_number, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, 'session1', 'char1', 'Hello!', 1, new Date().toISOString());
    
    const msg = testDb.prepare('SELECT * FROM auto_chat_messages WHERE id = ?').get(id);
    expect(msg).toBeDefined();
    expect((msg as any).content).toBe('Hello!');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/__tests__/auto-chat.test.ts`
Expected: FAIL with "no such table: auto_chat_sessions"

- [ ] **Step 3: Write minimal implementation**

Add to `server/src/db.ts` after the `chat_state_snapshots` table creation:

```typescript
// Auto Chat tables
database.exec(`
  CREATE TABLE IF NOT EXISTS auto_chat_sessions (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    is_running INTEGER DEFAULT 0,
    interval_seconds INTEGER DEFAULT 30,
    max_turns INTEGER DEFAULT 10,
    current_turn INTEGER DEFAULT 0,
    character_ids TEXT DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS auto_chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    character_id TEXT NOT NULL,
    content TEXT DEFAULT '',
    turn_number INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES auto_chat_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
  );
`);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run src/__tests__/auto-chat.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/db.ts server/src/__tests__/auto-chat.test.ts
git commit -m "feat: add auto-chat database schema"
```

---

### Task 1.2: Auto-Chat API Routes

**Files:**
- Create: `server/src/routes/auto-chat.ts`
- Create: `server/src/__tests__/auto-chat-routes.test.ts`
- Modify: `server/src/app.ts`

**Interfaces:**
- Consumes: `getDb()`, existing chat/character routes
- Produces: `POST /api/auto-chat/start`, `POST /api/auto-chat/stop`, `GET /api/auto-chat/sessions/:chatId`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';
import { testDb } from './global-setup';
import { v4 as uuidv4 } from 'uuid';

describe('Auto Chat Routes', () => {
  let chatId: string;
  let characterId: string;

  beforeEach(async () => {
    testDb.exec('DELETE FROM auto_chat_sessions');
    testDb.exec('DELETE FROM auto_chat_messages');
    testDb.exec('DELETE FROM messages');
    testDb.exec('DELETE FROM chats');
    testDb.exec('DELETE FROM characters');

    characterId = uuidv4();
    testDb.prepare(`
      INSERT INTO characters (id, name, description, personality, created_at, updated_at)
      VALUES (?, 'TestChar', 'Desc', 'Personality', ?, ?)
    `).run(characterId, new Date().toISOString(), new Date().toISOString());

    chatId = uuidv4();
    testDb.prepare(`
      INSERT INTO chats (id, character_id, name, created_at, updated_at)
      VALUES (?, ?, 'TestChat', ?, ?)
    `).run(chatId, characterId, new Date().toISOString(), new Date().toISOString());
  });

  it('should start auto-chat session', async () => {
    const res = await request(app)
      .post('/api/auto-chat/start')
      .send({
        chat_id: chatId,
        character_ids: [characterId],
        interval_seconds: 30,
        max_turns: 10,
      })
      .expect(200);

    expect(res.body.session).toBeDefined();
    expect(res.body.session.is_running).toBe(1);
  });

  it('should stop auto-chat session', async () => {
    // First start a session
    const startRes = await request(app)
      .post('/api/auto-chat/start')
      .send({
        chat_id: chatId,
        character_ids: [characterId],
        interval_seconds: 30,
        max_turns: 10,
      });

    const sessionId = startRes.body.session.id;

    const res = await request(app)
      .post('/api/auto-chat/stop')
      .send({ session_id: sessionId })
      .expect(200);

    expect(res.body.success).toBe(true);
  });

  it('should get auto-chat sessions for chat', async () => {
    const res = await request(app)
      .get(`/api/auto-chat/sessions/${chatId}`)
      .expect(200);

    expect(Array.isArray(res.body.sessions)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/__tests__/auto-chat-routes.test.ts`
Expected: FAIL with "Cannot find module" or route not found

- [ ] **Step 3: Write minimal implementation**

Create `server/src/routes/auto-chat.ts`:

```typescript
import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Start auto-chat session
router.post('/start', (req: Request, res: Response) => {
  const { chat_id, character_ids, interval_seconds = 30, max_turns = 10 } = req.body;
  const db = getDb();

  if (!chat_id || !character_ids?.length) {
    res.status(400).json({ error: 'chat_id and character_ids required' });
    return;
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO auto_chat_sessions (id, chat_id, is_running, interval_seconds, max_turns, character_ids, created_at, updated_at)
    VALUES (?, ?, 1, ?, ?, ?, ?, ?)
  `).run(id, chat_id, interval_seconds, max_turns, JSON.stringify(character_ids), now, now);

  const session = db.prepare('SELECT * FROM auto_chat_sessions WHERE id = ?').get(id);
  res.json({ session });
});

// Stop auto-chat session
router.post('/stop', (req: Request, res: Response) => {
  const { session_id } = req.body;
  const db = getDb();

  if (!session_id) {
    res.status(400).json({ error: 'session_id required' });
    return;
  }

  db.prepare('UPDATE auto_chat_sessions SET is_running = 0, updated_at = ? WHERE id = ?')
    .run(new Date().toISOString(), session_id);

  res.json({ success: true });
});

// Get sessions for a chat
router.get('/sessions/:chatId', (req: Request, res: Response) => {
  const db = getDb();
  const sessions = db.prepare('SELECT * FROM auto_chat_sessions WHERE chat_id = ? ORDER BY created_at DESC')
    .all(req.params.chatId);
  res.json({ sessions });
});

export default router;
```

Add to `server/src/app.ts` after other route imports:

```typescript
import autoChatRouter from './routes/auto-chat';
// ...
app.use('/api/auto-chat', autoChatRouter);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run src/__tests__/auto-chat-routes.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/auto-chat.ts server/src/app.ts server/src/__tests__/auto-chat-routes.test.ts
git commit -m "feat: add auto-chat API routes"
```

---

### Task 1.3: Auto-Chat Engine (Character Turn Generation)

**Files:**
- Create: `server/src/utils/auto-chat-engine.ts`
- Create: `server/src/__tests__/auto-chat-engine.test.ts`

**Interfaces:**
- Consumes: `getDb()`, existing `buildPrompt()`, `buildEndpoint()`, `buildHeaders()`
- Produces: `startAutoChatTurn()`, `processAutoChatTurn()`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testDb } from './global-setup';
import { v4 as uuidv4 } from 'uuid';

// Mock fetch for LLM calls
global.fetch = vi.fn();

describe('Auto Chat Engine', () => {
  let chatId: string;
  let characterId: string;
  let sessionId: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    testDb.exec('DELETE FROM auto_chat_sessions');
    testDb.exec('DELETE FROM auto_chat_messages');
    testDb.exec('DELETE FROM messages');
    testDb.exec('DELETE FROM chats');
    testDb.exec('DELETE FROM characters');

    characterId = uuidv4();
    testDb.prepare(`
      INSERT INTO characters (id, name, description, personality, created_at, updated_at)
      VALUES (?, 'Elena', 'A mage', 'Curious', ?, ?)
    `).run(characterId, new Date().toISOString(), new Date().toISOString());

    chatId = uuidv4();
    testDb.prepare(`
      INSERT INTO chats (id, character_id, name, created_at, updated_at)
      VALUES (?, ?, 'TestChat', ?, ?)
    `).run(chatId, characterId, new Date().toISOString(), new Date().toISOString());

    // Create API settings
    testDb.prepare(`
      INSERT INTO api_settings (id, provider, api_key, model, base_url, temperature, max_tokens, stream)
      VALUES (?, 'openai', 'test-key', 'gpt-4', '', 0.7, 2048, 0)
    `).run('default');
  });

  it('should generate a character turn', async () => {
    // Mock successful LLM response
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Hello! How are you?' } }],
      }),
    });

    // Create session
    sessionId = uuidv4();
    testDb.prepare(`
      INSERT INTO auto_chat_sessions (id, chat_id, is_running, interval_seconds, max_turns, character_ids, created_at, updated_at)
      VALUES (?, ?, 1, 30, 10, ?, ?, ?)
    `).run(sessionId, chatId, JSON.stringify([characterId]), new Date().toISOString(), new Date().toISOString());

    // Import and call engine
    const { processAutoChatTurn } = await import('../utils/auto-chat-engine');
    const result = await processAutoChatTurn(sessionId, characterId);

    expect(result.success).toBe(true);
    expect(result.content).toBe('Hello! How are you?');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/__tests__/auto-chat-engine.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write minimal implementation**

Create `server/src/utils/auto-chat-engine.ts`:

```typescript
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { buildPrompt } from './prompt-builder';
import { buildEndpoint, buildHeaders, buildRequestBody } from './providers';

export interface AutoChatTurnResult {
  success: boolean;
  content?: string;
  error?: string;
}

export async function processAutoChatTurn(
  sessionId: string,
  characterId: string
): Promise<AutoChatTurnResult> {
  const db = getDb();
  
  // Get session
  const session = db.prepare('SELECT * FROM auto_chat_sessions WHERE id = ?').get(sessionId) as any;
  if (!session || !session.is_running) {
    return { success: false, error: 'Session not found or not running' };
  }

  // Get character
  const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(characterId) as any;
  if (!character) {
    return { success: false, error: 'Character not found' };
  }

  // Get chat messages
  const messages = db.prepare('SELECT * FROM messages WHERE chat_id = ? ORDER BY rowid ASC')
    .all(session.chat_id) as any[];

  // Get API settings
  const settings = db.prepare("SELECT * FROM api_settings ORDER BY ROWID DESC LIMIT 1").get() as any;
  if (!settings) {
    return { success: false, error: 'API settings not found' };
  }

  // Build prompt for character
  const promptParts = buildPrompt(character, null, messages, [], settings.system_prompt || '', {
    impersonate: false,
    continueMode: false,
  });

  // Add character instruction
  const characterInstruction = {
    role: 'system' as const,
    content: `You are ${character.name}. Respond in character. Keep responses concise and natural.`,
  };

  const endpoint = buildEndpoint(settings.base_url);
  const headers = buildHeaders(settings.api_key);
  const requestBody = buildRequestBody([...promptParts, characterInstruction], {
    model: settings.model,
    temperature: settings.temperature,
    max_tokens: Math.min(settings.max_tokens, 500), // Limit for auto-chat
    stream: false,
  });

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: requestBody,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `API error: ${errorText}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Save message
    const msgId = uuidv4();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO messages (id, chat_id, role, content, swipes, swipe_id, is_edited, is_system, send_date, sender_name, sender_avatar, sender_character_id)
      VALUES (?, ?, 'assistant', ?, '[]', 0, 0, 0, ?, ?, ?, ?)
    `).run(msgId, session.chat_id, content, now, character.name, character.avatar, characterId);

    // Save auto-chat message
    const autoMsgId = uuidv4();
    const turnNumber = (session.current_turn || 0) + 1;
    db.prepare(`
      INSERT INTO auto_chat_messages (id, session_id, character_id, content, turn_number, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(autoMsgId, sessionId, characterId, content, turnNumber, now);

    // Update session turn count
    db.prepare('UPDATE auto_chat_sessions SET current_turn = ?, updated_at = ? WHERE id = ?')
      .run(turnNumber, now, sessionId);

    return { success: true, content };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run src/__tests__/auto-chat-engine.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/utils/auto-chat-engine.ts server/src/__tests__/auto-chat-engine.test.ts
git commit -m "feat: add auto-chat engine for character turns"
```

---

### Task 1.4: Frontend Auto-Chat Panel

**Files:**
- Create: `client/src/components/AutoChatPanel.tsx`
- Modify: `client/src/store/state.ts`
- Modify: `client/src/api/client.ts`

**Interfaces:**
- Consumes: existing store patterns, API client
- Produces: `startAutoChat()`, `stopAutoChat()`, `autoChatSession` state

- [ ] **Step 1: Add API methods to client.ts**

Add to `client/src/api/client.ts`:

```typescript
// Auto Chat
async startAutoChat(data: { chat_id: string; character_ids: string[]; interval_seconds?: number; max_turns?: number }) {
  const res = await fetch(`${API_BASE}/auto-chat/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async stopAutoChat(sessionId: string) {
  const res = await fetch(`${API_BASE}/auto-chat/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async getAutoChatSessions(chatId: string) {
  const res = await fetch(`${API_BASE}/auto-chat/sessions/${chatId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

- [ ] **Step 2: Add store state and actions**

Add to `client/src/store/state.ts` in the `AppState` interface:

```typescript
// Auto Chat
autoChatSession: any | null;
autoChatRunning: boolean;
startAutoChat: (data: { character_ids: string[]; interval_seconds?: number; max_turns?: number }) => Promise<void>;
stopAutoChat: () => Promise<void>;
loadAutoChatSessions: () => Promise<void>;
```

Add to the store implementation:

```typescript
// Auto Chat
autoChatSession: null,
autoChatRunning: false,
startAutoChat: async (data) => {
  const { currentChat } = get();
  if (!currentChat) return;
  
  try {
    const result = await api.startAutoChat({ ...data, chat_id: currentChat.id });
    set({ autoChatSession: result.session, autoChatRunning: true });
    get().addToast('Auto-chat started', 'success');
  } catch (error: any) {
    get().addToast(`Error: ${error.message}`, 'error');
  }
},
stopAutoChat: async () => {
  const { autoChatSession } = get();
  if (!autoChatSession) return;
  
  try {
    await api.stopAutoChat(autoChatSession.id);
    set({ autoChatSession: null, autoChatRunning: false });
    get().addToast('Auto-chat stopped', 'success');
  } catch (error: any) {
    get().addToast(`Error: ${error.message}`, 'error');
  }
},
loadAutoChatSessions: async () => {
  const { currentChat } = get();
  if (!currentChat) return;
  
  try {
    const result = await api.getAutoChatSessions(currentChat.id);
    const runningSession = result.sessions.find((s: any) => s.is_running);
    set({ autoChatSession: runningSession || null, autoChatRunning: !!runningSession });
  } catch {}
},
```

- [ ] **Step 3: Create AutoChatPanel component**

Create `client/src/components/AutoChatPanel.tsx`:

```tsx
import { useStore } from '../store/state';

export default function AutoChatPanel() {
  const { 
    autoChatSession, 
    autoChatRunning, 
    startAutoChat, 
    stopAutoChat, 
    currentCharacter,
    groupChatParticipants 
  } = useStore();

  const handleStart = async () => {
    if (!currentCharacter) return;
    
    // Get all active participants (including main character)
    const characterIds = [currentCharacter.id];
    groupChatParticipants
      .filter(p => p.is_active)
      .forEach(p => characterIds.push(p.character_id));
    
    await startAutoChat({
      character_ids: [...new Set(characterIds)], // deduplicate
      interval_seconds: 30,
      max_turns: 10,
    });
  };

  return (
    <div className="p-4 border-t border-tavern-border">
      <h3 className="text-sm font-medium text-tavern-text mb-2">Auto Chat</h3>
      
      {autoChatRunning ? (
        <div className="space-y-2">
          <div className="text-xs text-tavern-dim">
            Turn {autoChatSession?.current_turn || 0} / {autoChatSession?.max_turns || 10}
          </div>
          <button
            onClick={stopAutoChat}
            className="w-full px-3 py-2 text-sm bg-tavern-danger/20 text-tavern-danger rounded hover:bg-tavern-danger/30"
          >
            Stop Auto-Chat
          </button>
        </div>
      ) : (
        <button
          onClick={handleStart}
          className="w-full px-3 py-2 text-sm bg-tavern-accent/20 text-tavern-accent rounded hover:bg-tavern-accent/30"
        >
          Start Auto-Chat
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add panel to ChatView or appropriate location**

Import and add `AutoChatPanel` in `client/src/components/ChatView.tsx` or `client/src/components/RightPanel.tsx`.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/AutoChatPanel.tsx client/src/store/state.ts client/src/api/client.ts
git commit -m "feat: add auto-chat frontend panel"
```

---

## Feature 2: Complex Relationship Management

### Task 2.1: Database Schema for Relationships

**Files:**
- Create: `server/src/__tests__/relationships.test.ts`
- Modify: `server/src/db.ts`

**Interfaces:**
- Consumes: existing `getDb()` function
- Produces: `character_relationships` and `relationship_events` tables

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { testDb } from './global-setup';
import { v4 as uuidv4 } from 'uuid';

describe('Relationships Database', () => {
  beforeEach(() => {
    testDb.exec('DELETE FROM relationship_events');
    testDb.exec('DELETE FROM character_relationships');
  });

  it('should create character_relationships table', () => {
    const id = uuidv4();
    testDb.prepare(`
      INSERT INTO character_relationships (id, character_a_id, character_b_id, relationship_type, strength, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, 'char1', 'char2', 'friend', 75, '{}', new Date().toISOString(), new Date().toISOString());
    
    const rel = testDb.prepare('SELECT * FROM character_relationships WHERE id = ?').get(id);
    expect(rel).toBeDefined();
    expect((rel as any).strength).toBe(75);
  });

  it('should create relationship_events table', () => {
    const id = uuidv4();
    testDb.prepare(`
      INSERT INTO relationship_events (id, relationship_id, event_type, old_value, new_value, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, 'rel1', 'strength_change', 50, 75, new Date().toISOString());
    
    const event = testDb.prepare('SELECT * FROM relationship_events WHERE id = ?').get(id);
    expect(event).toBeDefined();
    expect((event as any).event_type).toBe('strength_change');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/__tests__/relationships.test.ts`
Expected: FAIL with "no such table: character_relationships"

- [ ] **Step 3: Write minimal implementation**

Add to `server/src/db.ts` after auto-chat tables:

```typescript
// Relationship tables
database.exec(`
  CREATE TABLE IF NOT EXISTS character_relationships (
    id TEXT PRIMARY KEY,
    character_a_id TEXT NOT NULL,
    character_b_id TEXT NOT NULL,
    relationship_type TEXT DEFAULT 'acquaintance',
    strength INTEGER DEFAULT 50,
    metadata TEXT DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (character_a_id) REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY (character_b_id) REFERENCES characters(id) ON DELETE CASCADE,
    UNIQUE(character_a_id, character_b_id)
  );

  CREATE TABLE IF NOT EXISTS relationship_events (
    id TEXT PRIMARY KEY,
    relationship_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (relationship_id) REFERENCES character_relationships(id) ON DELETE CASCADE
  );
`);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run src/__tests__/relationships.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/db.ts server/src/__tests__/relationships.test.ts
git commit -m "feat: add relationship database schema"
```

---

### Task 2.2: Relationship API Routes

**Files:**
- Create: `server/src/routes/relationships.ts`
- Create: `server/src/__tests__/relationships-routes.test.ts`
- Modify: `server/src/app.ts`

**Interfaces:**
- Consumes: `getDb()`, existing character routes
- Produces: CRUD for relationships and events

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';
import { testDb } from './global-setup';
import { v4 as uuidv4 } from 'uuid';

describe('Relationship Routes', () => {
  let charA: string;
  let charB: string;

  beforeEach(async () => {
    testDb.exec('DELETE FROM relationship_events');
    testDb.exec('DELETE FROM character_relationships');
    testDb.exec('DELETE FROM characters');

    charA = uuidv4();
    charB = uuidv4();
    
    testDb.prepare(`
      INSERT INTO characters (id, name, description, personality, created_at, updated_at)
      VALUES (?, 'Alice', 'Desc', 'Personality', ?, ?)
    `).run(charA, new Date().toISOString(), new Date().toISOString());
    
    testDb.prepare(`
      INSERT INTO characters (id, name, description, personality, created_at, updated_at)
      VALUES (?, 'Bob', 'Desc', 'Personality', ?, ?)
    `).run(charB, new Date().toISOString(), new Date().toISOString());
  });

  it('should create a relationship', async () => {
    const res = await request(app)
      .post('/api/relationships')
      .send({
        character_a_id: charA,
        character_b_id: charB,
        relationship_type: 'friend',
        strength: 75,
      })
      .expect(200);

    expect(res.body.relationship).toBeDefined();
    expect(res.body.relationship.relationship_type).toBe('friend');
  });

  it('should get relationships for a character', async () => {
    // Create relationship first
    await request(app)
      .post('/api/relationships')
      .send({
        character_a_id: charA,
        character_b_id: charB,
        relationship_type: 'friend',
        strength: 75,
      });

    const res = await request(app)
      .get(`/api/relationships/${charA}`)
      .expect(200);

    expect(Array.isArray(res.body.relationships)).toBe(true);
    expect(res.body.relationships.length).toBe(1);
  });

  it('should update relationship strength', async () => {
    // Create relationship
    const createRes = await request(app)
      .post('/api/relationships')
      .send({
        character_a_id: charA,
        character_b_id: charB,
        relationship_type: 'friend',
        strength: 50,
      });

    const relId = createRes.body.relationship.id;

    const res = await request(app)
      .put(`/api/relationships/${relId}`)
      .send({ strength: 90 })
      .expect(200);

    expect(res.body.relationship.strength).toBe(90);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/__tests__/relationships-routes.test.ts`
Expected: FAIL with "Cannot find module" or route not found

- [ ] **Step 3: Write minimal implementation**

Create `server/src/routes/relationships.ts`:

```typescript
import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Create relationship
router.post('/', (req: Request, res: Response) => {
  const { character_a_id, character_b_id, relationship_type = 'acquaintance', strength = 50, metadata = {} } = req.body;
  const db = getDb();

  if (!character_a_id || !character_b_id) {
    res.status(400).json({ error: 'character_a_id and character_b_id required' });
    return;
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  // Check if relationship already exists
  const existing = db.prepare(
    'SELECT * FROM character_relationships WHERE character_a_id = ? AND character_b_id = ?'
  ).get(character_a_id, character_b_id);

  if (existing) {
    res.status(409).json({ error: 'Relationship already exists' });
    return;
  }

  db.prepare(`
    INSERT INTO character_relationships (id, character_a_id, character_b_id, relationship_type, strength, metadata, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, character_a_id, character_b_id, relationship_type, strength, JSON.stringify(metadata), now, now);

  const relationship = db.prepare('SELECT * FROM character_relationships WHERE id = ?').get(id);
  res.json({ relationship });
});

// Get relationships for a character
router.get('/:characterId', (req: Request, res: Response) => {
  const db = getDb();
  const { characterId } = req.params;

  const relationships = db.prepare(`
    SELECT r.*, 
      ca.name as character_a_name, ca.avatar as character_a_avatar,
      cb.name as character_b_name, cb.avatar as character_b_avatar
    FROM character_relationships r
    JOIN characters ca ON r.character_a_id = ca.id
    JOIN characters cb ON r.character_b_id = cb.id
    WHERE r.character_a_id = ? OR r.character_b_id = ?
    ORDER BY r.strength DESC
  `).all(characterId, characterId);

  res.json({ relationships });
});

// Update relationship
router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { relationship_type, strength, metadata } = req.body;
  const db = getDb();

  const existing = db.prepare('SELECT * FROM character_relationships WHERE id = ?').get(id) as any;
  if (!existing) {
    res.status(404).json({ error: 'Relationship not found' });
    return;
  }

  const now = new Date().toISOString();
  const updates: string[] = [];
  const values: any[] = [];

  if (relationship_type !== undefined) {
    updates.push('relationship_type = ?');
    values.push(relationship_type);
  }
  if (strength !== undefined) {
    updates.push('strength = ?');
    values.push(strength);
  }
  if (metadata !== undefined) {
    updates.push('metadata = ?');
    values.push(JSON.stringify(metadata));
  }

  if (updates.length > 0) {
    updates.push('updated_at = ?');
    values.push(now);
    values.push(id);

    db.prepare(`UPDATE character_relationships SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    // Log event
    if (strength !== undefined && strength !== existing.strength) {
      const eventId = uuidv4();
      db.prepare(`
        INSERT INTO relationship_events (id, relationship_id, event_type, old_value, new_value, created_at)
        VALUES (?, ?, 'strength_change', ?, ?, ?)
      `).run(eventId, id, existing.strength.toString(), strength.toString(), now);
    }
  }

  const relationship = db.prepare('SELECT * FROM character_relationships WHERE id = ?').get(id);
  res.json({ relationship });
});

// Delete relationship
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();

  const result = db.prepare('DELETE FROM character_relationships WHERE id = ?').run(id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Relationship not found' });
    return;
  }

  res.json({ success: true });
});

// Get relationship events
router.get('/:id/events', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();

  const events = db.prepare('SELECT * FROM relationship_events WHERE relationship_id = ? ORDER BY created_at DESC')
    .all(id);

  res.json({ events });
});

export default router;
```

Add to `server/src/app.ts`:

```typescript
import relationshipsRouter from './routes/relationships';
// ...
app.use('/api/relationships', relationshipsRouter);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run src/__tests__/relationships-routes.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/relationships.ts server/src/app.ts server/src/__tests__/relationships-routes.test.ts
git commit -m "feat: add relationship API routes"
```

---

### Task 2.3: Relationship Manager Component

**Files:**
- Create: `client/src/components/RelationshipManager.tsx`
- Modify: `client/src/store/state.ts`
- Modify: `client/src/api/client.ts`

**Interfaces:**
- Consumes: existing store patterns, API client
- Produces: `loadRelationships()`, `createRelationship()`, `updateRelationship()`, `deleteRelationship()`

- [ ] **Step 1: Add API methods to client.ts**

Add to `client/src/api/client.ts`:

```typescript
// Relationships
async getRelationships(characterId: string) {
  const res = await fetch(`${API_BASE}/relationships/${characterId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async createRelationship(data: { character_a_id: string; character_b_id: string; relationship_type?: string; strength?: number }) {
  const res = await fetch(`${API_BASE}/relationships`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async updateRelationship(id: string, data: { relationship_type?: string; strength?: number }) {
  const res = await fetch(`${API_BASE}/relationships/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async deleteRelationship(id: string) {
  const res = await fetch(`${API_BASE}/relationships/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async getRelationshipEvents(id: string) {
  const res = await fetch(`${API_BASE}/relationships/${id}/events`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

- [ ] **Step 2: Add store state and actions**

Add to `client/src/store/state.ts` in the `AppState` interface:

```typescript
// Relationships
relationships: any[];
relationshipEvents: any[];
loadRelationships: (characterId: string) => Promise<void>;
createRelationship: (data: { character_a_id: string; character_b_id: string; relationship_type?: string; strength?: number }) => Promise<void>;
updateRelationship: (id: string, data: { relationship_type?: string; strength?: number }) => Promise<void>;
deleteRelationship: (id: string) => Promise<void>;
loadRelationshipEvents: (id: string) => Promise<void>;
```

Add to the store implementation:

```typescript
// Relationships
relationships: [],
relationshipEvents: [],
loadRelationships: async (characterId) => {
  try {
    const result = await api.getRelationships(characterId);
    set({ relationships: result.relationships });
  } catch {
    set({ relationships: [] });
  }
},
createRelationship: async (data) => {
  try {
    const result = await api.createRelationship(data);
    set(s => ({ relationships: [...s.relationships, result.relationship] }));
    get().addToast('Relationship created', 'success');
  } catch (error: any) {
    get().addToast(`Error: ${error.message}`, 'error');
  }
},
updateRelationship: async (id, data) => {
  try {
    const result = await api.updateRelationship(id, data);
    set(s => ({
      relationships: s.relationships.map(r => r.id === id ? result.relationship : r),
    }));
    get().addToast('Relationship updated', 'success');
  } catch (error: any) {
    get().addToast(`Error: ${error.message}`, 'error');
  }
},
deleteRelationship: async (id) => {
  try {
    await api.deleteRelationship(id);
    set(s => ({
      relationships: s.relationships.filter(r => r.id !== id),
    }));
    get().addToast('Relationship deleted', 'success');
  } catch (error: any) {
    get().addToast(`Error: ${error.message}`, 'error');
  }
},
loadRelationshipEvents: async (id) => {
  try {
    const result = await api.getRelationshipEvents(id);
    set({ relationshipEvents: result.events });
  } catch {
    set({ relationshipEvents: [] });
  }
},
```

- [ ] **Step 3: Create RelationshipManager component**

Create `client/src/components/RelationshipManager.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { useStore } from '../store/state';

interface Relationship {
  id: string;
  character_a_id: string;
  character_b_id: string;
  character_a_name: string;
  character_b_name: string;
  relationship_type: string;
  strength: number;
}

export default function RelationshipManager() {
  const { 
    characters, 
    currentCharacter, 
    relationships, 
    loadRelationships, 
    createRelationship, 
    updateRelationship, 
    deleteRelationship 
  } = useStore();
  
  const [selectedCharacter, setSelectedCharacter] = useState<string>('');
  const [relationshipType, setRelationshipType] = useState('friend');
  const [strength, setStrength] = useState(50);

  useEffect(() => {
    if (currentCharacter) {
      loadRelationships(currentCharacter.id);
    }
  }, [currentCharacter]);

  const handleCreate = async () => {
    if (!currentCharacter || !selectedCharacter) return;
    
    await createRelationship({
      character_a_id: currentCharacter.id,
      character_b_id: selectedCharacter,
      relationship_type: relationshipType,
      strength,
    });
    
    setSelectedCharacter('');
    setRelationshipType('friend');
    setStrength(50);
  };

  const handleStrengthChange = async (id: string, newStrength: number) => {
    await updateRelationship(id, { strength: newStrength });
  };

  const handleDelete = async (id: string) => {
    await deleteRelationship(id);
  };

  // Filter out characters that already have a relationship
  const availableCharacters = characters.filter(c => 
    c.id !== currentCharacter?.id && 
    !relationships.some(r => 
      (r.character_a_id === currentCharacter?.id && r.character_b_id === c.id) ||
      (r.character_b_id === currentCharacter?.id && r.character_a_id === c.id)
    )
  );

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-medium text-tavern-text">Relationships</h3>
      
      {/* Create new relationship */}
      <div className="space-y-2 p-3 bg-tavern-surface rounded-lg">
        <select
          value={selectedCharacter}
          onChange={(e) => setSelectedCharacter(e.target.value)}
          className="w-full px-3 py-2 bg-tavern-input border border-tavern-border rounded text-tavern-text"
        >
          <option value="">Select character...</option>
          {availableCharacters.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        
        <select
          value={relationshipType}
          onChange={(e) => setRelationshipType(e.target.value)}
          className="w-full px-3 py-2 bg-tavern-input border border-tavern-border rounded text-tavern-text"
        >
          <option value="friend">Friend</option>
          <option value="enemy">Enemy</option>
          <option value="romantic">Romantic</option>
          <option value="family">Family</option>
          <option value="colleague">Colleague</option>
          <option value="acquaintance">Acquaintance</option>
        </select>
        
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0"
            max="100"
            value={strength}
            onChange={(e) => setStrength(parseInt(e.target.value))}
            className="flex-1"
          />
          <span className="text-sm text-tavern-dim w-12">{strength}%</span>
        </div>
        
        <button
          onClick={handleCreate}
          disabled={!selectedCharacter}
          className="w-full px-3 py-2 bg-tavern-accent/20 text-tavern-accent rounded hover:bg-tavern-accent/30 disabled:opacity-50"
        >
          Add Relationship
        </button>
      </div>
      
      {/* List existing relationships */}
      <div className="space-y-2">
        {relationships.map((rel: Relationship) => (
          <div key={rel.id} className="p-3 bg-tavern-surface rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-tavern-text">
                {rel.character_a_name} → {rel.character_b_name}
              </span>
              <span className="text-xs text-tavern-dim">{rel.relationship_type}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="100"
                value={rel.strength}
                onChange={(e) => handleStrengthChange(rel.id, parseInt(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm text-tavern-dim w-12">{rel.strength}%</span>
              <button
                onClick={() => handleDelete(rel.id)}
                className="px-2 py-1 text-xs bg-tavern-danger/20 text-tavern-danger rounded hover:bg-tavern-danger/30"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        
        {relationships.length === 0 && (
          <p className="text-sm text-tavern-dim text-center py-4">No relationships yet</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add panel to appropriate location**

Import and add `RelationshipManager` in `client/src/components/RightPanel.tsx` or create a new tab.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/RelationshipManager.tsx client/src/store/state.ts client/src/api/client.ts
git commit -m "feat: add relationship manager component"
```

---

## Feature 3: Versioning System

### Task 3.1: Database Schema for Versioning

**Files:**
- Create: `server/src/__tests__/versioning.test.ts`
- Modify: `server/src/db.ts`

**Interfaces:**
- Consumes: existing `getDb()` function
- Produces: `content_versions` table

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { testDb } from './global-setup';
import { v4 as uuidv4 } from 'uuid';

describe('Versioning Database', () => {
  beforeEach(() => {
    testDb.exec('DELETE FROM content_versions');
  });

  it('should create content_versions table', () => {
    const id = uuidv4();
    testDb.prepare(`
      INSERT INTO content_versions (id, entity_type, entity_id, version_number, content, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, 'character', 'char1', 1, '{}', 'user', new Date().toISOString());
    
    const version = testDb.prepare('SELECT * FROM content_versions WHERE id = ?').get(id);
    expect(version).toBeDefined();
    expect((version as any).version_number).toBe(1);
  });

  it('should track version history', () => {
    const id1 = uuidv4();
    const id2 = uuidv4();
    
    testDb.prepare(`
      INSERT INTO content_versions (id, entity_type, entity_id, version_number, content, created_by, created_at)
      VALUES (?, 'character', 'char1', 1, '{"name":"v1"}', 'user', ?)
    `).run(id1, new Date().toISOString());
    
    testDb.prepare(`
      INSERT INTO content_versions (id, entity_type, entity_id, version_number, content, created_by, created_at)
      VALUES (?, 'character', 'char1', 2, '{"name":"v2"}', 'user', ?)
    `).run(id2, new Date().toISOString());
    
    const versions = testDb.prepare(
      'SELECT * FROM content_versions WHERE entity_type = ? AND entity_id = ? ORDER BY version_number DESC'
    ).all('character', 'char1');
    
    expect(versions.length).toBe(2);
    expect((versions[0] as any).version_number).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/__tests__/versioning.test.ts`
Expected: FAIL with "no such table: content_versions"

- [ ] **Step 3: Write minimal implementation**

Add to `server/src/db.ts` after relationship tables:

```typescript
// Versioning table
database.exec(`
  CREATE TABLE IF NOT EXISTS content_versions (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_by TEXT DEFAULT 'user',
    created_at TEXT NOT NULL,
    FOREIGN KEY (entity_id) REFERENCES characters(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_content_versions_entity 
  ON content_versions(entity_type, entity_id, version_number DESC);
`);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run src/__tests__/versioning.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/db.ts server/src/__tests__/versioning.test.ts
git commit -m "feat: add versioning database schema"
```

---

### Task 3.2: Versioning API Routes

**Files:**
- Create: `server/src/routes/versioning.ts`
- Create: `server/src/__tests__/versioning-routes.test.ts`
- Modify: `server/src/app.ts`

**Interfaces:**
- Consumes: `getDb()`, existing character routes
- Produces: CRUD for versions and restore functionality

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';
import { testDb } from './global-setup';
import { v4 as uuidv4 } from 'uuid';

describe('Versioning Routes', () => {
  let characterId: string;

  beforeEach(async () => {
    testDb.exec('DELETE FROM content_versions');
    testDb.exec('DELETE FROM characters');

    characterId = uuidv4();
    testDb.prepare(`
      INSERT INTO characters (id, name, description, personality, created_at, updated_at)
      VALUES (?, 'TestChar', 'Desc', 'Personality', ?, ?)
    `).run(characterId, new Date().toISOString(), new Date().toISOString());
  });

  it('should create a version', async () => {
    const res = await request(app)
      .post('/api/versioning')
      .send({
        entity_type: 'character',
        entity_id: characterId,
        content: { name: 'TestChar', description: 'New description' },
        created_by: 'user',
      })
      .expect(200);

    expect(res.body.version).toBeDefined();
    expect(res.body.version.version_number).toBe(1);
  });

  it('should get version history', async () => {
    // Create two versions
    await request(app)
      .post('/api/versioning')
      .send({
        entity_type: 'character',
        entity_id: characterId,
        content: { name: 'v1' },
      });

    await request(app)
      .post('/api/versioning')
      .send({
        entity_type: 'character',
        entity_id: characterId,
        content: { name: 'v2' },
      });

    const res = await request(app)
      .get(`/api/versioning/character/${characterId}`)
      .expect(200);

    expect(res.body.versions.length).toBe(2);
    expect(res.body.versions[0].version_number).toBe(2);
  });

  it('should restore a version', async () => {
    // Create version
    const createRes = await request(app)
      .post('/api/versioning')
      .send({
        entity_type: 'character',
        entity_id: characterId,
        content: { name: 'OldName', description: 'Old desc' },
      });

    const versionId = createRes.body.version.id;

    // Update character
    await request(app)
      .put(`/api/characters/${characterId}`)
      .send({ name: 'NewName', description: 'New desc' });

    // Restore version
    const res = await request(app)
      .post(`/api/versioning/restore/${versionId}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.entity.name).toBe('OldName');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/__tests__/versioning-routes.test.ts`
Expected: FAIL with "Cannot find module" or route not found

- [ ] **Step 3: Write minimal implementation**

Create `server/src/routes/versioning.ts`:

```typescript
import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Create version
router.post('/', (req: Request, res: Response) => {
  const { entity_type, entity_id, content, created_by = 'user' } = req.body;
  const db = getDb();

  if (!entity_type || !entity_id || !content) {
    res.status(400).json({ error: 'entity_type, entity_id, and content required' });
    return;
  }

  // Get next version number
  const lastVersion = db.prepare(
    'SELECT MAX(version_number) as max_version FROM content_versions WHERE entity_type = ? AND entity_id = ?'
  ).get(entity_type, entity_id) as any;
  
  const versionNumber = (lastVersion?.max_version || 0) + 1;
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO content_versions (id, entity_type, entity_id, version_number, content, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, entity_type, entity_id, versionNumber, JSON.stringify(content), created_by, now);

  const version = db.prepare('SELECT * FROM content_versions WHERE id = ?').get(id);
  res.json({ version });
});

// Get version history
router.get('/:entityType/:entityId', (req: Request, res: Response) => {
  const { entityType, entityId } = req.params;
  const db = getDb();

  const versions = db.prepare(
    'SELECT * FROM content_versions WHERE entity_type = ? AND entity_id = ? ORDER BY version_number DESC'
  ).all(entityType, entityId);

  res.json({ versions });
});

// Get single version
router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();

  const version = db.prepare('SELECT * FROM content_versions WHERE id = ?').get(id);
  if (!version) {
    res.status(404).json({ error: 'Version not found' });
    return;
  }

  res.json({ version });
});

// Restore version
router.post('/restore/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();

  const version = db.prepare('SELECT * FROM content_versions WHERE id = ?').get(id) as any;
  if (!version) {
    res.status(404).json({ error: 'Version not found' });
    return;
  }

  const content = JSON.parse(version.content);
  const now = new Date().toISOString();

  // Update the entity based on type
  if (version.entity_type === 'character') {
    const updates: string[] = [];
    const values: any[] = [];

    Object.keys(content).forEach(key => {
      if (key !== 'id' && key !== 'created_at') {
        updates.push(`${key} = ?`);
        values.push(content[key]);
      }
    });

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      values.push(now);
      values.push(version.entity_id);

      db.prepare(`UPDATE characters SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const entity = db.prepare('SELECT * FROM characters WHERE id = ?').get(version.entity_id);
    res.json({ success: true, entity });
  } else {
    res.status(400).json({ error: 'Unsupported entity type' });
  }
});

// Delete version
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();

  const result = db.prepare('DELETE FROM content_versions WHERE id = ?').run(id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Version not found' });
    return;
  }

  res.json({ success: true });
});

export default router;
```

Add to `server/src/app.ts`:

```typescript
import versioningRouter from './routes/versioning';
// ...
app.use('/api/versioning', versioningRouter);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run src/__tests__/versioning-routes.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/versioning.ts server/src/app.ts server/src/__tests__/versioning-routes.test.ts
git commit -m "feat: add versioning API routes"
```

---

### Task 3.3: Version History Component

**Files:**
- Create: `client/src/components/VersionHistory.tsx`
- Modify: `client/src/store/state.ts`
- Modify: `client/src/api/client.ts`

**Interfaces:**
- Consumes: existing store patterns, API client
- Produces: `loadVersions()`, `createVersion()`, `restoreVersion()`, `deleteVersion()`

- [ ] **Step 1: Add API methods to client.ts**

Add to `client/src/api/client.ts`:

```typescript
// Versioning
async getVersions(entityType: string, entityId: string) {
  const res = await fetch(`${API_BASE}/versioning/${entityType}/${entityId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async createVersion(data: { entity_type: string; entity_id: string; content: any; created_by?: string }) {
  const res = await fetch(`${API_BASE}/versioning`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async restoreVersion(id: string) {
  const res = await fetch(`${API_BASE}/versioning/restore/${id}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async deleteVersion(id: string) {
  const res = await fetch(`${API_BASE}/versioning/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

- [ ] **Step 2: Add store state and actions**

Add to `client/src/store/state.ts` in the `AppState` interface:

```typescript
// Versioning
versions: any[];
loadVersions: (entityType: string, entityId: string) => Promise<void>;
createVersion: (data: { entity_type: string; entity_id: string; content: any }) => Promise<void>;
restoreVersion: (id: string) => Promise<void>;
deleteVersion: (id: string) => Promise<void>;
```

Add to the store implementation:

```typescript
// Versioning
versions: [],
loadVersions: async (entityType, entityId) => {
  try {
    const result = await api.getVersions(entityType, entityId);
    set({ versions: result.versions });
  } catch {
    set({ versions: [] });
  }
},
createVersion: async (data) => {
  try {
    const result = await api.createVersion(data);
    set(s => ({ versions: [result.version, ...s.versions] }));
    get().addToast('Version created', 'success');
  } catch (error: any) {
    get().addToast(`Error: ${error.message}`, 'error');
  }
},
restoreVersion: async (id) => {
  try {
    const result = await api.restoreVersion(id);
    if (result.entity) {
      // Update character in store
      set(s => ({
        characters: s.characters.map(c => c.id === result.entity.id ? result.entity : c),
        currentCharacter: s.currentCharacter?.id === result.entity.id ? result.entity : s.currentCharacter,
      }));
    }
    get().addToast('Version restored', 'success');
  } catch (error: any) {
    get().addToast(`Error: ${error.message}`, 'error');
  }
},
deleteVersion: async (id) => {
  try {
    await api.deleteVersion(id);
    set(s => ({ versions: s.versions.filter(v => v.id !== id) }));
    get().addToast('Version deleted', 'success');
  } catch (error: any) {
    get().addToast(`Error: ${error.message}`, 'error');
  }
},
```

- [ ] **Step 3: Create VersionHistory component**

Create `client/src/components/VersionHistory.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { useStore } from '../store/state';

interface Version {
  id: string;
  version_number: number;
  content: string;
  created_by: string;
  created_at: string;
}

export default function VersionHistory() {
  const { 
    currentCharacter, 
    versions, 
    loadVersions, 
    createVersion, 
    restoreVersion, 
    deleteVersion,
    showConfirm
  } = useStore();
  
  const [showDiff, setShowDiff] = useState<string | null>(null);

  useEffect(() => {
    if (currentCharacter) {
      loadVersions('character', currentCharacter.id);
    }
  }, [currentCharacter]);

  const handleCreateVersion = async () => {
    if (!currentCharacter) return;
    
    await createVersion({
      entity_type: 'character',
      entity_id: currentCharacter.id,
      content: currentCharacter,
    });
  };

  const handleRestore = async (version: Version) => {
    const ok = await showConfirm(`Restore to version ${version.version_number}? This will overwrite current data.`);
    if (ok) {
      await restoreVersion(version.id);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await showConfirm('Delete this version?');
    if (ok) {
      await deleteVersion(id);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const parseContent = (contentStr: string) => {
    try {
      return JSON.parse(contentStr);
    } catch {
      return {};
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-tavern-text">Version History</h3>
        <button
          onClick={handleCreateVersion}
          className="px-3 py-1.5 text-sm bg-tavern-accent/20 text-tavern-accent rounded hover:bg-tavern-accent/30"
        >
          Save Version
        </button>
      </div>
      
      <div className="space-y-2">
        {versions.map((version: Version) => (
          <div key={version.id} className="p-3 bg-tavern-surface rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-tavern-text">
                Version {version.version_number}
              </span>
              <span className="text-xs text-tavern-dim">
                {formatDate(version.created_at)}
              </span>
            </div>
            
            <div className="text-xs text-tavern-dim mb-2">
              By: {version.created_by}
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setShowDiff(showDiff === version.id ? null : version.id)}
                className="px-2 py-1 text-xs bg-tavern-surface2 text-tavern-text rounded hover:bg-tavern-hover"
              >
                {showDiff === version.id ? 'Hide' : 'View'}
              </button>
              <button
                onClick={() => handleRestore(version)}
                className="px-2 py-1 text-xs bg-tavern-accent/20 text-tavern-accent rounded hover:bg-tavern-accent/30"
              >
                Restore
              </button>
              <button
                onClick={() => handleDelete(version.id)}
                className="px-2 py-1 text-xs bg-tavern-danger/20 text-tavern-danger rounded hover:bg-tavern-danger/30"
              >
                Delete
              </button>
            </div>
            
            {showDiff === version.id && (
              <div className="mt-3 p-2 bg-tavern-bg rounded text-xs font-mono overflow-auto max-h-48">
                <pre className="whitespace-pre-wrap">
                  {JSON.stringify(parseContent(version.content), null, 2)}
                </pre>
              </div>
            )}
          </div>
        ))}
        
        {versions.length === 0 && (
          <p className="text-sm text-tavern-dim text-center py-4">No versions saved yet</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add panel to appropriate location**

Import and add `VersionHistory` in `client/src/components/CharacterEditor.tsx` or `client/src/components/RightPanel.tsx`.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/VersionHistory.tsx client/src/store/state.ts client/src/api/client.ts
git commit -m "feat: add version history component"
```

---

## Feature 4: Smart Notification System

### Task 4.1: Database Schema for Notifications

**Files:**
- Create: `server/src/__tests__/notifications.test.ts`
- Modify: `server/src/db.ts`

**Interfaces:**
- Consumes: existing `getDb()` function
- Produces: `notifications` and `notification_rules` tables

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { testDb } from './global-setup';
import { v4 as uuidv4 } from 'uuid';

describe('Notifications Database', () => {
  beforeEach(() => {
    testDb.exec('DELETE FROM notifications');
    testDb.exec('DELETE FROM notification_rules');
  });

  it('should create notifications table', () => {
    const id = uuidv4();
    testDb.prepare(`
      INSERT INTO notifications (id, type, title, message, entity_type, entity_id, is_read, created_at)
      VALUES (?, 'info', 'Test', 'Message', 'chat', 'chat1', 0, ?)
    `).run(id, new Date().toISOString());
    
    const notification = testDb.prepare('SELECT * FROM notifications WHERE id = ?').get(id);
    expect(notification).toBeDefined();
    expect((notification as any).is_read).toBe(0);
  });

  it('should create notification_rules table', () => {
    const id = uuidv4();
    testDb.prepare(`
      INSERT INTO notification_rules (id, rule_type, event_type, conditions, actions, is_enabled, created_at)
      VALUES (?, 'auto_chat_complete', 'session_finished', '{}', '{}', 1, ?)
    `).run(id, new Date().toISOString());
    
    const rule = testDb.prepare('SELECT * FROM notification_rules WHERE id = ?').get(id);
    expect(rule).toBeDefined();
    expect((rule as any).is_enabled).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/__tests__/notifications.test.ts`
Expected: FAIL with "no such table: notifications"

- [ ] **Step 3: Write minimal implementation**

Add to `server/src/db.ts` after versioning table:

```typescript
// Notification tables
database.exec(`
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL DEFAULT 'info',
    title TEXT NOT NULL,
    message TEXT DEFAULT '',
    entity_type TEXT,
    entity_id TEXT,
    is_read INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS notification_rules (
    id TEXT PRIMARY KEY,
    rule_type TEXT NOT NULL,
    event_type TEXT NOT NULL,
    conditions TEXT DEFAULT '{}',
    actions TEXT DEFAULT '{}',
    is_enabled INTEGER DEFAULT 1,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_notifications_read 
  ON notifications(is_read, created_at DESC);
`);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run src/__tests__/notifications.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/db.ts server/src/__tests__/notifications.test.ts
git commit -m "feat: add notification database schema"
```

---

### Task 4.2: Notification API Routes

**Files:**
- Create: `server/src/routes/notifications.ts`
- Create: `server/src/__tests__/notifications-routes.test.ts`
- Modify: `server/src/app.ts`

**Interfaces:**
- Consumes: `getDb()`, existing routes
- Produces: CRUD for notifications and rules

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';
import { testDb } from './global-setup';
import { v4 as uuidv4 } from 'uuid';

describe('Notification Routes', () => {
  beforeEach(async () => {
    testDb.exec('DELETE FROM notifications');
    testDb.exec('DELETE FROM notification_rules');
  });

  it('should create a notification', async () => {
    const res = await request(app)
      .post('/api/notifications')
      .send({
        type: 'info',
        title: 'Test Notification',
        message: 'This is a test',
        entity_type: 'chat',
        entity_id: 'chat1',
      })
      .expect(200);

    expect(res.body.notification).toBeDefined();
    expect(res.body.notification.title).toBe('Test Notification');
  });

  it('should get notifications', async () => {
    // Create notification
    await request(app)
      .post('/api/notifications')
      .send({
        type: 'info',
        title: 'Test',
        message: 'Message',
      });

    const res = await request(app)
      .get('/api/notifications')
      .expect(200);

    expect(Array.isArray(res.body.notifications)).toBe(true);
    expect(res.body.notifications.length).toBe(1);
  });

  it('should mark notification as read', async () => {
    // Create notification
    const createRes = await request(app)
      .post('/api/notifications')
      .send({
        type: 'info',
        title: 'Test',
        message: 'Message',
      });

    const id = createRes.body.notification.id;

    const res = await request(app)
      .put(`/api/notifications/${id}/read`)
      .expect(200);

    expect(res.body.success).toBe(true);
  });

  it('should create a notification rule', async () => {
    const res = await request(app)
      .post('/api/notifications/rules')
      .send({
        rule_type: 'auto_chat_complete',
        event_type: 'session_finished',
        conditions: {},
        actions: { toast: true },
      })
      .expect(200);

    expect(res.body.rule).toBeDefined();
    expect(res.body.rule.rule_type).toBe('auto_chat_complete');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/__tests__/notifications-routes.test.ts`
Expected: FAIL with "Cannot find module" or route not found

- [ ] **Step 3: Write minimal implementation**

Create `server/src/routes/notifications.ts`:

```typescript
import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Create notification
router.post('/', (req: Request, res: Response) => {
  const { type = 'info', title, message = '', entity_type, entity_id } = req.body;
  const db = getDb();

  if (!title) {
    res.status(400).json({ error: 'title required' });
    return;
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO notifications (id, type, title, message, entity_type, entity_id, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?)
  `).run(id, type, title, message, entity_type, entity_id, now);

  const notification = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id);
  res.json({ notification });
});

// Get notifications
router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { unread_only, limit = 50 } = req.query;

  let query = 'SELECT * FROM notifications';
  const params: any[] = [];

  if (unread_only === 'true') {
    query += ' WHERE is_read = 0';
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const notifications = db.prepare(query).all(...params);
  const unread_count = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE is_read = 0').get() as any;

  res.json({ 
    notifications, 
    unread_count: unread_count?.count || 0 
  });
});

// Mark as read
router.put('/:id/read', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();

  const result = db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Notification not found' });
    return;
  }

  res.json({ success: true });
});

// Mark all as read
router.put('/read-all', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('UPDATE notifications SET is_read = 1 WHERE is_read = 0').run();
  res.json({ success: true });
});

// Delete notification
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();

  const result = db.prepare('DELETE FROM notifications WHERE id = ?').run(id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Notification not found' });
    return;
  }

  res.json({ success: true });
});

// Notification Rules
router.post('/rules', (req: Request, res: Response) => {
  const { rule_type, event_type, conditions = {}, actions = {} } = req.body;
  const db = getDb();

  if (!rule_type || !event_type) {
    res.status(400).json({ error: 'rule_type and event_type required' });
    return;
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO notification_rules (id, rule_type, event_type, conditions, actions, is_enabled, created_at)
    VALUES (?, ?, ?, ?, ?, 1, ?)
  `).run(id, rule_type, event_type, JSON.stringify(conditions), JSON.stringify(actions), now);

  const rule = db.prepare('SELECT * FROM notification_rules WHERE id = ?').get(id);
  res.json({ rule });
});

// Get rules
router.get('/rules', (req: Request, res: Response) => {
  const db = getDb();
  const rules = db.prepare('SELECT * FROM notification_rules ORDER BY created_at DESC').all();
  res.json({ rules });
});

// Update rule
router.put('/rules/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { is_enabled, conditions, actions } = req.body;
  const db = getDb();

  const existing = db.prepare('SELECT * FROM notification_rules WHERE id = ?').get(id) as any;
  if (!existing) {
    res.status(404).json({ error: 'Rule not found' });
    return;
  }

  const updates: string[] = [];
  const values: any[] = [];

  if (is_enabled !== undefined) {
    updates.push('is_enabled = ?');
    values.push(is_enabled ? 1 : 0);
  }
  if (conditions !== undefined) {
    updates.push('conditions = ?');
    values.push(JSON.stringify(conditions));
  }
  if (actions !== undefined) {
    updates.push('actions = ?');
    values.push(JSON.stringify(actions));
  }

  if (updates.length > 0) {
    values.push(id);
    db.prepare(`UPDATE notification_rules SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }

  const rule = db.prepare('SELECT * FROM notification_rules WHERE id = ?').get(id);
  res.json({ rule });
});

// Delete rule
router.delete('/rules/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();

  const result = db.prepare('DELETE FROM notification_rules WHERE id = ?').run(id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Rule not found' });
    return;
  }

  res.json({ success: true });
});

export default router;
```

Add to `server/src/app.ts`:

```typescript
import notificationsRouter from './routes/notifications';
// ...
app.use('/api/notifications', notificationsRouter);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run src/__tests__/notifications-routes.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/notifications.ts server/src/app.ts server/src/__tests__/notifications-routes.test.ts
git commit -m "feat: add notification API routes"
```

---

### Task 4.3: Notification Manager Component

**Files:**
- Create: `client/src/components/NotificationManager.tsx`
- Create: `client/src/components/NotificationBell.tsx`
- Modify: `client/src/store/state.ts`
- Modify: `client/src/api/client.ts`

**Interfaces:**
- Consumes: existing store patterns, API client
- Produces: `loadNotifications()`, `createNotification()`, `markAsRead()`, `markAllAsRead()`, `deleteNotification()`, `notificationCount`

- [ ] **Step 1: Add API methods to client.ts**

Add to `client/src/api/client.ts`:

```typescript
// Notifications
async getNotifications(options?: { unread_only?: boolean; limit?: number }) {
  const params = new URLSearchParams();
  if (options?.unread_only) params.set('unread_only', 'true');
  if (options?.limit) params.set('limit', options.limit.toString());
  
  const res = await fetch(`${API_BASE}/notifications?${params.toString()}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async createNotification(data: { type?: string; title: string; message?: string; entity_type?: string; entity_id?: string }) {
  const res = await fetch(`${API_BASE}/notifications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async markNotificationRead(id: string) {
  const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
    method: 'PUT',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async markAllNotificationsRead() {
  const res = await fetch(`${API_BASE}/notifications/read-all`, {
    method: 'PUT',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async deleteNotification(id: string) {
  const res = await fetch(`${API_BASE}/notifications/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Notification Rules
async getNotificationRules() {
  const res = await fetch(`${API_BASE}/notifications/rules`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async createNotificationRule(data: { rule_type: string; event_type: string; conditions?: any; actions?: any }) {
  const res = await fetch(`${API_BASE}/notifications/rules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async updateNotificationRule(id: string, data: { is_enabled?: boolean; conditions?: any; actions?: any }) {
  const res = await fetch(`${API_BASE}/notifications/rules/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async deleteNotificationRule(id: string) {
  const res = await fetch(`${API_BASE}/notifications/rules/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

- [ ] **Step 2: Add store state and actions**

Add to `client/src/store/state.ts` in the `AppState` interface:

```typescript
// Notifications
notifications: any[];
notificationCount: number;
loadNotifications: () => Promise<void>;
createNotification: (data: { type?: string; title: string; message?: string; entity_type?: string; entity_id?: string }) => Promise<void>;
markNotificationRead: (id: string) => Promise<void>;
markAllNotificationsRead: () => Promise<void>;
deleteNotification: (id: string) => Promise<void>;
notificationRules: any[];
loadNotificationRules: () => Promise<void>;
createNotificationRule: (data: { rule_type: string; event_type: string; conditions?: any; actions?: any }) => Promise<void>;
updateNotificationRule: (id: string, data: { is_enabled?: boolean; conditions?: any; actions?: any }) => Promise<void>;
deleteNotificationRule: (id: string) => Promise<void>;
```

Add to the store implementation:

```typescript
// Notifications
notifications: [],
notificationCount: 0,
loadNotifications: async () => {
  try {
    const result = await api.getNotifications({ unread_only: false });
    set({ 
      notifications: result.notifications, 
      notificationCount: result.unread_count 
    });
  } catch {
    set({ notifications: [], notificationCount: 0 });
  }
},
createNotification: async (data) => {
  try {
    const result = await api.createNotification(data);
    set(s => ({ 
      notifications: [result.notification, ...s.notifications],
      notificationCount: s.notificationCount + 1
    }));
  } catch (error: any) {
    console.error('Failed to create notification:', error);
  }
},
markNotificationRead: async (id) => {
  try {
    await api.markNotificationRead(id);
    set(s => ({
      notifications: s.notifications.map(n => n.id === id ? { ...n, is_read: 1 } : n),
      notificationCount: Math.max(0, s.notificationCount - 1)
    }));
  } catch (error: any) {
    console.error('Failed to mark notification as read:', error);
  }
},
markAllNotificationsRead: async () => {
  try {
    await api.markAllNotificationsRead();
    set(s => ({
      notifications: s.notifications.map(n => ({ ...n, is_read: 1 })),
      notificationCount: 0
    }));
  } catch (error: any) {
    console.error('Failed to mark all as read:', error);
  }
},
deleteNotification: async (id) => {
  try {
    await api.deleteNotification(id);
    set(s => ({
      notifications: s.notifications.filter(n => n.id !== id),
      notificationCount: s.notifications.find(n => n.id === id && !n.is_read) 
        ? Math.max(0, s.notificationCount - 1) 
        : s.notificationCount
    }));
  } catch (error: any) {
    console.error('Failed to delete notification:', error);
  }
},
notificationRules: [],
loadNotificationRules: async () => {
  try {
    const result = await api.getNotificationRules();
    set({ notificationRules: result.rules });
  } catch {
    set({ notificationRules: [] });
  }
},
createNotificationRule: async (data) => {
  try {
    const result = await api.createNotificationRule(data);
    set(s => ({ notificationRules: [...s.notificationRules, result.rule] }));
    get().addToast('Rule created', 'success');
  } catch (error: any) {
    get().addToast(`Error: ${error.message}`, 'error');
  }
},
updateNotificationRule: async (id, data) => {
  try {
    const result = await api.updateNotificationRule(id, data);
    set(s => ({
      notificationRules: s.notificationRules.map(r => r.id === id ? result.rule : r)
    }));
    get().addToast('Rule updated', 'success');
  } catch (error: any) {
    get().addToast(`Error: ${error.message}`, 'error');
  }
},
deleteNotificationRule: async (id) => {
  try {
    await api.deleteNotificationRule(id);
    set(s => ({
      notificationRules: s.notificationRules.filter(r => r.id !== id)
    }));
    get().addToast('Rule deleted', 'success');
  } catch (error: any) {
    get().addToast(`Error: ${error.message}`, 'error');
  }
},
```

- [ ] **Step 3: Create NotificationBell component**

Create `client/src/components/NotificationBell.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { useStore } from '../store/state';

export default function NotificationBell() {
  const { 
    notificationCount, 
    loadNotifications, 
    markAllNotificationsRead 
  } = useStore();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleClick = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      loadNotifications();
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        className="relative p-2 text-tavern-dim hover:text-tavern-text transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {notificationCount > 0 && (
          <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-xs bg-tavern-danger text-white rounded-full">
            {notificationCount > 99 ? '99+' : notificationCount}
          </span>
        )}
      </button>
      
      {isOpen && (
        <NotificationDropdown onClose={() => setIsOpen(false)} />
      )}
    </div>
  );
}

function NotificationDropdown({ onClose }: { onClose: () => void }) {
  const { 
    notifications, 
    markNotificationRead, 
    markAllNotificationsRead, 
    deleteNotification 
  } = useStore();

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success': return '✓';
      case 'error': return '✕';
      case 'warning': return '⚠';
      default: return 'ℹ';
    }
  };

  return (
    <div className="absolute right-0 top-full mt-2 w-80 bg-tavern-surface border border-tavern-border rounded-lg shadow-lg z-50">
      <div className="p-3 border-b border-tavern-border flex items-center justify-between">
        <h3 className="font-medium text-tavern-text">Notifications</h3>
        <button
          onClick={markAllNotificationsRead}
          className="text-xs text-tavern-accent hover:underline"
        >
          Mark all read
        </button>
      </div>
      
      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <p className="p-4 text-center text-tavern-dim text-sm">No notifications</p>
        ) : (
          notifications.map((notification: any) => (
            <div
              key={notification.id}
              className={`p-3 border-b border-tavern-border/50 hover:bg-tavern-hover ${
                !notification.is_read ? 'bg-tavern-accent/5' : ''
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="text-lg">{getTypeIcon(notification.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-tavern-text text-sm truncate">
                      {notification.title}
                    </span>
                    {!notification.is_read && (
                      <span className="w-2 h-2 bg-tavern-accent rounded-full flex-shrink-0" />
                    )}
                  </div>
                  {notification.message && (
                    <p className="text-xs text-tavern-dim mt-1 line-clamp-2">
                      {notification.message}
                    </p>
                  )}
                  <span className="text-xs text-tavern-dim mt-1 block">
                    {formatDate(notification.created_at)}
                  </span>
                </div>
                <div className="flex gap-1">
                  {!notification.is_read && (
                    <button
                      onClick={() => markNotificationRead(notification.id)}
                      className="p-1 text-tavern-dim hover:text-tavern-text"
                      title="Mark as read"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={() => deleteNotification(notification.id)}
                    className="p-1 text-tavern-dim hover:text-tavern-danger"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      <div className="p-2 border-t border-tavern-border">
        <button
          onClick={onClose}
          className="w-full px-3 py-1.5 text-sm text-tavern-dim hover:text-tavern-text"
        >
          Close
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add NotificationBell to TopBar**

Import and add `NotificationBell` in `client/src/components/TopBar.tsx`:

```tsx
import NotificationBell from './NotificationBell';

// Add in the header/nav area:
<NotificationBell />
```

- [ ] **Step 5: Commit**

```bash
git add client/src/components/NotificationBell.tsx client/src/store/state.ts client/src/api/client.ts client/src/components/TopBar.tsx
git commit -m "feat: add notification bell and manager"
```

---

### Task 4.4: Auto-Trigger Notifications

**Files:**
- Modify: `server/src/utils/auto-chat-engine.ts`
- Modify: `server/src/routes/auto-chat.ts`

**Interfaces:**
- Consumes: existing auto-chat engine, notification routes
- Produces: Notifications for auto-chat completion, errors, etc.

- [ ] **Step 1: Add notification helper to auto-chat engine**

Add to `server/src/utils/auto-chat-engine.ts`:

```typescript
function createNotification(
  type: string,
  title: string,
  message: string,
  entityType?: string,
  entityId?: string
): void {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO notifications (id, type, title, message, entity_type, entity_id, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?)
  `).run(id, type, title, message, entityType, entityId, now);
}
```

- [ ] **Step 2: Add notifications to auto-chat completion**

Modify `processAutoChatTurn` to create notifications:

```typescript
// After successful turn generation
createNotification(
  'info',
  'Auto-Chat Turn Complete',
  `${character.name} responded in auto-chat`,
  'chat',
  session.chat_id
);

// After session completes (max turns reached)
if (turnNumber >= session.max_turns) {
  createNotification(
    'success',
    'Auto-Chat Session Complete',
    `Auto-chat session finished after ${turnNumber} turns`,
    'chat',
    session.chat_id
  );
}

// On error
if (!result.success) {
  createNotification(
    'error',
    'Auto-Chat Error',
    result.error || 'Unknown error occurred',
    'chat',
    session.chat_id
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add server/src/utils/auto-chat-engine.ts
git commit -m "feat: add auto-chat notifications"
```

---

## Summary

This plan covers 4 major features:

1. **Auto Character Interaction** - Characters can chat automatically without user input
2. **Complex Relationship Management** - Track and manage relationships between characters
3. **Versioning System** - Save and restore versions of characters
4. **Smart Notifications** - System-wide notification with rules and UI

Each feature includes:
- Database schema (SQLite)
- API routes (Express)
- Frontend components (React + Zustand)
- Tests (Vitest)

**Total Tasks:** 16 tasks across 4 features

**Estimated Time:** 4-6 hours for full implementation

---

**Plan complete and saved to `docs/superpowers/plans/2026-08-29-advanced-features.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
