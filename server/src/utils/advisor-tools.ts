// Tool definitions for Story Advisor

export const advisorTools = [
  {
    type: 'function',
    function: {
      name: 'create_lorebook',
      description: 'Create a new lorebook with entries. A lorebook stores world-building information, character backstories, location details, and other context that should be remembered during the story.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name of the lorebook',
          },
          entries: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                keys: { type: 'array', items: { type: 'string' }, description: 'Keywords that trigger this entry' },
                content: { type: 'string', description: 'The lore/content to inject when triggered' },
                comment: { type: 'string', description: 'Internal comment about this entry' },
                constant: { type: 'boolean', description: 'If true, always included in context' },
                insertion_order: { type: 'number', description: 'Insertion order (lower = higher priority)' },
              },
              required: ['keys', 'content'],
            },
            description: 'Array of lorebook entries to include',
          },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_lorebook_entries',
      description: 'Add entries to an existing lorebook. Use this to expand a lorebook with new information.',
      parameters: {
        type: 'object',
        properties: {
          lorebook_id: {
            type: 'string',
            description: 'ID of the lorebook to add entries to',
          },
          entries: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                keys: { type: 'array', items: { type: 'string' }, description: 'Keywords that trigger this entry' },
                content: { type: 'string', description: 'The lore/content to inject when triggered' },
                comment: { type: 'string', description: 'Internal comment about this entry' },
                constant: { type: 'boolean', description: 'If true, always included in context' },
                insertion_order: { type: 'number', description: 'Insertion order (lower = higher priority)' },
              },
              required: ['keys', 'content'],
            },
            description: 'Array of entries to add',
          },
        },
        required: ['lorebook_id', 'entries'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_lorebook_entry',
      description: 'Update an existing lorebook entry. Use this to modify the content, keywords, or settings of an entry.',
      parameters: {
        type: 'object',
        properties: {
          entry_id: {
            type: 'string',
            description: 'ID of the entry to update',
          },
          keys: { type: 'array', items: { type: 'string' }, description: 'Updated keywords' },
          content: { type: 'string', description: 'Updated lore/content' },
          comment: { type: 'string', description: 'Updated comment' },
          constant: { type: 'boolean' },
          insertion_order: { type: 'number' },
          disable: { type: 'boolean' },
        },
        required: ['entry_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_character',
      description: 'Create a new character card for use in roleplay. A character card defines the personality, appearance, and behavior of a character.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Character name' },
          description: { type: 'string', description: 'Physical appearance and key traits' },
          personality: { type: 'string', description: 'Personality traits and behavioral patterns' },
          scenario: { type: 'string', description: 'The situation/scenario this character exists in' },
          first_mes: { type: 'string', description: 'The character opening message' },
          mes_example: { type: 'string', description: 'Example dialogue/messages showing how character speaks' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_character',
      description: 'Update an existing character card. Only provide the fields you want to change.',
      parameters: {
        type: 'object',
        properties: {
          character_id: { type: 'string', description: 'ID of the character to update' },
          name: { type: 'string' },
          description: { type: 'string' },
          personality: { type: 'string' },
          scenario: { type: 'string' },
          first_mes: { type: 'string' },
          mes_example: { type: 'string' },
        },
        required: ['character_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_character_message',
      description: 'Generate a message from a specific character in the chat. Use this when the user wants to write what a character should say or do. The message will be previewed as HTML and requires user approval before being added to the chat.',
      parameters: {
        type: 'object',
        properties: {
          character_id: {
            type: 'string',
            description: 'ID of the character to generate the message for',
          },
          instruction: {
            type: 'string',
            description: 'The direction/instruction for what the character should do or say (e.g., "Walk to the door and say goodbye")',
          },
        },
        required: ['character_id', 'instruction'],
      },
    },
  },
];

// Build context about available lorebooks and characters for the advisor
export function buildAdvisorToolsContext(db: any): string {
  const parts: string[] = [];

  // List available lorebooks
  const lorebooks = db.prepare('SELECT id, name FROM lorebooks').all() as any[];
  if (lorebooks.length > 0) {
    const lbList = lorebooks.map((lb: any) => `- ${lb.name} (ID: ${lb.id})`).join('\n');
    parts.push(`[Available Lorebooks]\n${lbList}`);
  } else {
    parts.push(`[Available Lorebooks]\nNone yet. Use create_lorebook to create one.`);
  }

  // List available characters
  const characters = db.prepare('SELECT id, name, description FROM characters').all() as any[];
  if (characters.length > 0) {
    const charList = characters.map((c: any) => `- ${c.name} (ID: ${c.id})${c.description ? `: ${c.description.slice(0, 100)}` : ''}`).join('\n');
    parts.push(`[Available Characters]\n${charList}`);
  } else {
    parts.push(`[Available Characters]\nNone yet. Use create_character to create one.`);
  }

  // Also list active group chat participants
  const chatParticipants = db.prepare(
    'SELECT c.id, c.name, c.description, c.personality FROM chat_participants cp JOIN characters c ON cp.character_id = c.id WHERE cp.is_active = 1'
  ).all() as any[];
  if (chatParticipants.length > 0) {
    const participantList = chatParticipants.map((p: any) =>
      `- ${p.name} (ID: ${p.id})${p.description ? `: ${p.description.slice(0, 100)}` : ''}`
    ).join('\n');
    parts.push(`[Active Group Chat Participants]\n${participantList}`);
  }

  return parts.join('\n\n');
}

// Tool result interface
export interface ToolResult {
  success: boolean;
  message: string;
  data?: any;
}

// Execute a tool call
export async function executeAdvisorTool(
  name: string,
  args: Record<string, any>,
  db: any,
  mainChatId: string
): Promise<ToolResult> {
  try {
    switch (name) {
      case 'create_lorebook':
        return executeCreateLorebook(args, db);
      case 'add_lorebook_entries':
        return executeAddLorebookEntries(args, db);
      case 'update_lorebook_entry':
        return executeUpdateLorebookEntry(args, db);
      case 'create_character':
        return executeCreateCharacter(args, db);
      case 'update_character':
        return executeUpdateCharacter(args, db);
      case 'generate_character_message':
        // This tool is handled client-side, return success for now
        return { success: true, message: 'Message generation initiated', data: args };
      default:
        return { success: false, message: `Unknown tool: ${name}` };
    }
  } catch (error: any) {
    return { success: false, message: `Error executing ${name}: ${error.message}` };
  }
}

function executeCreateLorebook(args: Record<string, any>, db: any): ToolResult {
  const { v4: uuidv4 } = require('uuid');
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(
    'INSERT INTO lorebooks (id, name, created_at) VALUES (?, ?, ?)'
  ).run(id, args.name, now);

  // Add entries if provided
  if (args.entries && Array.isArray(args.entries)) {
    const insertEntry = db.prepare(
      'INSERT INTO lorebook_entries (id, lorebook_id, keys, content, comment, constant, insertion_order, disable) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    for (const entry of args.entries) {
      insertEntry.run(
        uuidv4(),
        id,
        JSON.stringify(entry.keys || []),
        entry.content || '',
        entry.comment || '',
        entry.constant ? 1 : 0,
        entry.insertion_order ?? 100,
        0
      );
    }
  }

  return {
    success: true,
    message: `Lorebook "${args.name}" created successfully${args.entries ? ` with ${args.entries.length} entries` : ''}.`,
    data: { id, name: args.name },
  };
}

function executeAddLorebookEntries(args: Record<string, any>, db: any): ToolResult {
  const { v4: uuidv4 } = require('uuid');
  const lorebook = db.prepare('SELECT id FROM lorebooks WHERE id = ?').get(args.lorebook_id);
  if (!lorebook) {
    return { success: false, message: `Lorebook with ID ${args.lorebook_id} not found.` };
  }

  const insertEntry = db.prepare(
    'INSERT INTO lorebook_entries (id, lorebook_id, keys, content, comment, constant, insertion_order, disable) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );

  let count = 0;
  for (const entry of args.entries) {
    insertEntry.run(
      uuidv4(),
      args.lorebook_id,
      JSON.stringify(entry.keys || []),
      entry.content || '',
      entry.comment || '',
      entry.constant ? 1 : 0,
      entry.insertion_order ?? 100,
      0
    );
    count++;
  }

  return {
    success: true,
    message: `Added ${count} entries to lorebook.`,
    data: { lorebook_id: args.lorebook_id, entries_added: count },
  };
}

function executeUpdateLorebookEntry(args: Record<string, any>, db: any): ToolResult {
  const entry = db.prepare('SELECT * FROM lorebook_entries WHERE id = ?').get(args.entry_id) as any;
  if (!entry) {
    return { success: false, message: `Entry with ID ${args.entry_id} not found.` };
  }

  const updates: string[] = [];
  const values: any[] = [];

  if (args.keys !== undefined) { updates.push('keys = ?'); values.push(JSON.stringify(args.keys)); }
  if (args.content !== undefined) { updates.push('content = ?'); values.push(args.content); }
  if (args.comment !== undefined) { updates.push('comment = ?'); values.push(args.comment); }
  if (args.constant !== undefined) { updates.push('constant = ?'); values.push(args.constant ? 1 : 0); }
  if (args.insertion_order !== undefined) { updates.push('insertion_order = ?'); values.push(args.insertion_order); }
  if (args.disable !== undefined) { updates.push('disable = ?'); values.push(args.disable ? 1 : 0); }

  if (updates.length === 0) {
    return { success: false, message: 'No fields to update.' };
  }

  values.push(args.entry_id);

  db.prepare(`UPDATE lorebook_entries SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  return {
    success: true,
    message: `Entry updated successfully.`,
    data: { entry_id: args.entry_id },
  };
}

function executeCreateCharacter(args: Record<string, any>, db: any): ToolResult {
  const { v4: uuidv4 } = require('uuid');
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(
    'INSERT INTO characters (id, name, description, personality, scenario, first_mes, mes_example, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    id,
    args.name,
    args.description || '',
    args.personality || '',
    args.scenario || '',
    args.first_mes || '',
    args.mes_example || '',
    '[]',
    now,
    now
  );

  return {
    success: true,
    message: `Character "${args.name}" created successfully.`,
    data: { id, name: args.name },
  };
}

function executeUpdateCharacter(args: Record<string, any>, db: any): ToolResult {
  const char = db.prepare('SELECT * FROM characters WHERE id = ?').get(args.character_id) as any;
  if (!char) {
    return { success: false, message: `Character with ID ${args.character_id} not found.` };
  }

  const now = new Date().toISOString();
  const updates: string[] = [];
  const values: any[] = [];

  if (args.name !== undefined) { updates.push('name = ?'); values.push(args.name); }
  if (args.description !== undefined) { updates.push('description = ?'); values.push(args.description); }
  if (args.personality !== undefined) { updates.push('personality = ?'); values.push(args.personality); }
  if (args.scenario !== undefined) { updates.push('scenario = ?'); values.push(args.scenario); }
  if (args.first_mes !== undefined) { updates.push('first_mes = ?'); values.push(args.first_mes); }
  if (args.mes_example !== undefined) { updates.push('mes_example = ?'); values.push(args.mes_example); }

  if (updates.length === 0) {
    return { success: false, message: 'No fields to update.' };
  }

  updates.push('updated_at = ?');
  values.push(now);
  values.push(args.character_id);

  db.prepare(`UPDATE characters SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  return {
    success: true,
    message: `Character "${char.name}" updated successfully.`,
    data: { character_id: args.character_id, name: args.name || char.name },
  };
}
