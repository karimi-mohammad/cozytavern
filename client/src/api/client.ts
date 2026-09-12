const BASE = '/api';

// ─── Client-side Debug Logger for Two-Phase Chat ───
// Enable: localStorage.setItem('DEBUG_CHAT', '1')
// Disable: localStorage.removeItem('DEBUG_CHAT')
const _chatDbgEnabled = () => localStorage.getItem('DEBUG_CHAT') === '1';
function _chatDbg(phase: string, msg: string, data?: any) {
  if (!_chatDbgEnabled()) return;
  const ts = new Date().toISOString();
  const d = data !== undefined ? (typeof data === 'string' ? data : JSON.stringify(data).slice(0, 300)) : '';
  console.log(`[CHAT-CLIENT] [${ts}] [${phase}] ${msg}${d ? ' ' + d : ''}`);
}

async function request(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error' }));
    throw new Error(err.error || `Error: ${res.status}`);
  }
  return res.json();
}

// دانلود فایل از سرور — پاسخ blob را به فایل local تبدیل می‌کند
async function downloadBlob(path: string, filename: string) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Download failed' }));
    throw new Error(err.error || `Error: ${res.status}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Characters
export const api = {
  getCharacters: () => request('/characters'),
  getCharacter: (id: string) => request(`/characters/${id}`),
  createCharacter: (data: any) => request('/characters', { method: 'POST', body: JSON.stringify(data) }),
  updateCharacter: (id: string, data: any) => request(`/characters/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCharacter: (id: string) => request(`/characters/${id}`, { method: 'DELETE' }),

  // Chats
  getChats: (characterId: string) => request(`/chats/character/${characterId}`),
  getChat: (id: string) => request(`/chats/${id}`),
  createChat: (data: any) => request('/chats', { method: 'POST', body: JSON.stringify(data) }),
  deleteChat: (id: string) => request(`/chats/${id}`, { method: 'DELETE' }),
  renameChat: (id: string, name: string) => request(`/chats/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }),
  autoNameChat: (chatId: string, editedMessages?: { role: string; content: string }[]) =>
    request(`/chats/${chatId}/auto-name`, { method: 'POST', body: JSON.stringify({ edited_messages: editedMessages }) }),
  updateChat: (id: string, data: any) => request(`/chats/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Messages
  searchMessages: (params: { q: string; chat_id?: string; role?: string; limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams();
    searchParams.set('q', params.q);
    if (params.chat_id) searchParams.set('chat_id', params.chat_id);
    if (params.role) searchParams.set('role', params.role);
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.offset) searchParams.set('offset', String(params.offset));
    return request(`/messages/search?${searchParams.toString()}`);
  },
  sendMessage: (data: any) => request('/messages', { method: 'POST', body: JSON.stringify(data) }),
  editMessage: (id: string, content: string) => request(`/messages/${id}`, { method: 'PUT', body: JSON.stringify({ content }) }),
  deleteMessage: (id: string) => request(`/messages/${id}`, { method: 'DELETE' }),
  regenerateMessage: (chatId: string) => request(`/messages/regenerate/${chatId}`, { method: 'POST' }),
  swipeMessage: (id: string, direction: string) => request(`/messages/swipe/${id}`, { method: 'POST', body: JSON.stringify({ direction }) }),
  abortChat: (messageId: string) => request('/chat/abort', { method: 'POST', body: JSON.stringify({ message_id: messageId }) }),

  // API Settings
  getApiSettings: () => request('/api-settings'),
  saveApiSettings: (data: any) => request('/api-settings', { method: 'POST', body: JSON.stringify(data) }),

  // Personas
  getPersonas: () => request('/personas'),
  createPersona: (data: any) => request('/personas', { method: 'POST', body: JSON.stringify(data) }),
  updatePersona: (id: string, data: any) => request(`/personas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePersona: (id: string) => request(`/personas/${id}`, { method: 'DELETE' }),

  // Lorebooks
  getLorebooks: () => request('/lorebooks'),
  getLorebook: (id: string) => request(`/lorebooks/${id}`),
  createLorebook: (data: any) => request('/lorebooks', { method: 'POST', body: JSON.stringify(data) }),
  updateLorebook: (id: string, data: any) => request(`/lorebooks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLorebook: (id: string) => request(`/lorebooks/${id}`, { method: 'DELETE' }),
  addLorebookEntry: (lorebookId: string, data: any) => request(`/lorebooks/${lorebookId}/entries`, { method: 'POST', body: JSON.stringify(data) }),
  updateLorebookEntry: (entryId: string, data: any) => request(`/lorebooks/entries/${entryId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLorebookEntry: (entryId: string) => request(`/lorebooks/entries/${entryId}`, { method: 'DELETE' }),

  // Chat Lorebooks (چند لور بوک به ازای هر چت)
  getChatLorebooks: (chatId: string) => request(`/chats/${chatId}/lorebooks`),
  addChatLorebook: (chatId: string, data: { lorebook_id: string; insertion_order?: number }) =>
    request(`/chats/${chatId}/lorebooks`, { method: 'POST', body: JSON.stringify(data) }),
  updateChatLorebook: (chatId: string, id: string, data: { is_active?: boolean; insertion_order?: number }) =>
    request(`/chats/${chatId}/lorebooks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  removeChatLorebook: (chatId: string, id: string) =>
    request(`/chats/${chatId}/lorebooks/${id}`, { method: 'DELETE' }),

  // AI Lorebook Generator (۳ حالت)
  suggestLorebookTopics: (data: { chat_id: string; character_id: string; lorebook_id?: string }) =>
    request('/lorebooks/suggest-topics', { method: 'POST', body: JSON.stringify(data) }),
  generateFromTopics: (data: { chat_id: string; character_id: string; topics: any[]; custom_prompt?: string }) =>
    request('/lorebooks/generate-from-topics', { method: 'POST', body: JSON.stringify(data) }),
  generateSingleTopic: (data: { chat_id: string; character_id: string; topic: string; keywords?: string[]; custom_prompt?: string }) =>
    request('/lorebooks/generate-single', { method: 'POST', body: JSON.stringify(data) }),
  applyGeneratedEntries: (lorebookId: string, entries: any[]) =>
    request(`/lorebooks/${lorebookId}/apply-generated`, { method: 'POST', body: JSON.stringify({ entries }) }),

  // Plugins (تنظیمات پلاگین‌ها)
  getPluginSettings: (pluginId: string) => request(`/plugins/${pluginId}/settings`),
  updatePluginSettings: (pluginId: string, data: any) =>
    request(`/plugins/${pluginId}/settings`, { method: 'PUT', body: JSON.stringify(data) }),

  // Story State (حافظه وضعیت داستان)
  getStoryState: (chatId: string) => request(`/story-state/chat/${chatId}`),
  updateStoryState: (chatId: string, delta: any) => request(`/story-state/chat/${chatId}`, { method: 'PUT', body: JSON.stringify(delta) }),
  replaceStoryState: (chatId: string, state: any) => request(`/story-state/chat/${chatId}`, { method: 'POST', body: JSON.stringify(state) }),
  deleteStoryState: (chatId: string) => request(`/story-state/chat/${chatId}`, { method: 'DELETE' }),
  // Snapshots
  getSnapshot: (chatId: string, messageId?: string) => {
    const url = messageId
      ? `/story-state/chat/${chatId}/snapshot/${messageId}`
      : `/story-state/chat/${chatId}/snapshot`;
    return request(url);
  },
  rollbackToSnapshot: (chatId: string, messageId?: string) =>
    request(`/story-state/chat/${chatId}/rollback`, { method: 'POST', body: JSON.stringify({ message_id: messageId }) }),

  // Chapters
  getChapters: (chatId: string) => request(`/chapters/chat/${chatId}`),
  createChapter: (data: { chat_id: string; start_message_id: string; end_message_id: string; trigger_message_id?: string; title?: string; auto_summarize?: boolean; edited_messages?: { role: string; content: string }[] }) =>
    request('/chapters', { method: 'POST', body: JSON.stringify(data) }),
  updateChapter: (id: string, data: { title?: string; summary?: string; start_message_id?: string; end_message_id?: string }) =>
    request(`/chapters/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteChapter: (id: string) => request(`/chapters/${id}`, { method: 'DELETE' }),
  regenerateChapter: (id: string, editedMessages?: { role: string; content: string }[]) =>
    request(`/chapters/${id}/regenerate`, { method: 'POST', body: JSON.stringify({ edited_messages: editedMessages }) }),
  getChapterSettings: () => request('/plugins/chapters/settings'),
  updateChapterSettings: (data: any) =>
    request('/plugins/chapters/settings', { method: 'PUT', body: JSON.stringify(data) }),
  detectTrigger: (chatId: string) =>
    request(`/chapters/chat/${chatId}/detect`, { method: 'POST' }),

  // Chapter Preview & Summarize (new flow)
  previewChapter: (data: { chat_id: string; start_message_id: string; end_message_id: string }) =>
    request('/chapters/preview', { method: 'POST', body: JSON.stringify(data) }),
  summarizeChapter: (chapterId: string) =>
    request(`/chapters/${chapterId}/summarize`, { method: 'POST' }),

  // Prompt Inspector (dry-run — payload بدون ارسال به LLM)
  inspectChat: (data: any) =>
    request('/chat', { method: 'POST', body: JSON.stringify({ ...data, inspect: true }) }),
  inspectAutoName: (chatId: string) =>
    request(`/chats/${chatId}/auto-name`, { method: 'POST', body: JSON.stringify({ inspect: true }) }),
  inspectCreateChapter: (data: any) =>
    request('/chapters', { method: 'POST', body: JSON.stringify({ ...data, inspect: true }) }),
  inspectRegenerateChapter: (id: string) =>
    request(`/chapters/${id}/regenerate`, { method: 'POST', body: JSON.stringify({ inspect: true }) }),
  inspectGroupChat: (chatId: string, data: any) =>
    request(`/group-chats/${chatId}/generate`, { method: 'POST', body: JSON.stringify({ ...data, inspect: true }) }),

  // ─── Group Chats ───
  createGroupChat: (data: { name?: string; character_ids: string[]; lorebook_id?: string }) =>
    request('/group-chats', { method: 'POST', body: JSON.stringify(data) }),
  getGroupChat: (id: string) => request(`/group-chats/${id}`),
  addParticipant: (chatId: string, characterId: string) =>
    request(`/group-chats/${chatId}/participants`, { method: 'POST', body: JSON.stringify({ character_id: characterId }) }),
  addCharacterToChat: (chatId: string, characterId: string, addSystemMessage?: boolean) =>
    request(`/group-chats/${chatId}/add-character`, { method: 'POST', body: JSON.stringify({ character_id: characterId, add_system_message: addSystemMessage }) }),
  removeParticipant: (chatId: string, participantId: string) =>
    request(`/group-chats/${chatId}/participants/${participantId}`, { method: 'DELETE' }),
  toggleParticipant: (chatId: string, participantId: string, isActive: boolean) =>
    request(`/group-chats/${chatId}/participants/${participantId}`, { method: 'PUT', body: JSON.stringify({ is_active: isActive }) }),
  generateGroupChatResponse: (chatId: string, data: { character_id: string; persona_id?: string; lorebook_id?: string; continue_mode?: boolean; update_message_id?: string }) =>
    request(`/group-chats/${chatId}/generate`, { method: 'POST', body: JSON.stringify(data) }),
  generateGroupChatResponseStream: async (
    chatId: string,
    data: { character_id: string; persona_id?: string; lorebook_id?: string; continue_mode?: boolean; update_message_id?: string; edited_messages?: any[] },
    onMessageId: (id: string) => void,
    onToken: (token: string) => void,
    onDone: () => void,
    signal?: AbortSignal
  ) => {
    const res = await fetch(`${BASE}/group-chats/${chatId}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error' }));
      throw new Error(err.error || 'Connection error');
    }

    const contentType = res.headers.get('content-type') || '';

    if (contentType.includes('text/event-stream')) {
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const result = await reader.read();
        if (result.done) break;

        buffer += decoder.decode(result.value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const data = trimmed.slice(6);
            if (data === '[DONE]') {
              onDone();
              return;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.message_id) onMessageId(parsed.message_id);
              else if (parsed.token) onToken(parsed.token);
              else if (parsed.error) throw new Error(parsed.error);
              else if (parsed.story_state_updated) {
                // Story state was updated by AI - trigger reload in store
                try {
                  window.dispatchEvent(new CustomEvent('story-state-updated', { detail: parsed.state }));
                } catch {}
              }
              else if (parsed.usage) {
                // Usage data from API (ground truth for context estimation)
                try {
                  window.dispatchEvent(new CustomEvent('api-usage', { detail: parsed.usage }));
                } catch {}
              }
            } catch {}
          }
        }
      }
      onDone();
    } else {
      const data = await res.json();
      if (data.message_id) onMessageId(data.message_id);
      if (data.content) onToken(data.content);
      // Handle story state update in non-streaming response
      if (data.story_state_updated) {
        try {
          window.dispatchEvent(new CustomEvent('story-state-updated', { detail: data.state }));
        } catch {}
      }
      // Use setTimeout to ensure Zustand state updates are flushed before onDone
      setTimeout(() => onDone(), 0);
    }
  },

  // ─── Chat Notes (یادداشت‌های هر چت) ───
  getChatNotes: (chatId: string) => request(`/chat-notes/${chatId}`),
  createChatNote: (chatId: string, content: string) =>
    request(`/chat-notes/${chatId}`, { method: 'POST', body: JSON.stringify({ content }) }),
  updateChatNote: (id: string, content: string) =>
    request(`/chat-notes/${id}`, { method: 'PUT', body: JSON.stringify({ content }) }),
  deleteChatNote: (id: string) => request(`/chat-notes/${id}`, { method: 'DELETE' }),

  // ─── Group Chat Settings ───
  getGroupChatSettings: (chatId: string) => request(`/group-chats/${chatId}/settings`),
  updateGroupChatSettings: (chatId: string, data: any) =>
    request(`/group-chats/${chatId}/settings`, { method: 'PUT', body: JSON.stringify(data) }),

  // ─── Character Import/Export ───
  exportCharacterJson: (id: string) => downloadBlob(`/characters/${id}/export/json`, 'character.json'),
  exportCharacterPng: (id: string) => downloadBlob(`/characters/${id}/export/png`, 'character.png'),
  importCharacterFromJson: (jsonData: any) =>
    request('/characters/import', { method: 'POST', body: JSON.stringify({ json: jsonData }) }),
  importCharacterFromBase64: (fileB64: string) =>
    request('/characters/import', { method: 'POST', body: JSON.stringify({ file_b64: fileB64 }) }),

  // ─── Chat Export/Import/Duplicate ───
  exportChat: (chatId: string, chatName: string) =>
    downloadBlob(`/chats/${chatId}/export`, `chat-${chatName || chatId}.json`),
  importChat: (characterId: string, data: any) =>
    request('/chats/import', { method: 'POST', body: JSON.stringify({ character_id: characterId, data }) }),
  duplicateChat: (chatId: string, name?: string) =>
    request(`/chats/${chatId}/duplicate`, { method: 'POST', body: JSON.stringify({ name }) }),

  // ─── Full Database Backup ───
  exportBackup: () => downloadBlob('/backup/export', 'cozytavern-backup.json'),
  restoreBackup: (data: any) =>
    request('/backup/restore', { method: 'POST', body: JSON.stringify(data) }),

  // ─── Quick Replies ───
  getQuickReplies: () => request('/plugins/quick_replies/settings'),
  updateQuickReplies: (data: any) =>
    request('/plugins/quick_replies/settings', { method: 'PUT', body: JSON.stringify(data) }),

  // Chat with AI
  chatWithAI: async (
    data: { chat_id: string; character_id: string; persona_id?: string; lorebook_id?: string; update_message_id?: string; continue_mode?: boolean; impersonate?: boolean; edited_messages?: { role: string; content: string }[] },
    onMessageId: (id: string) => void,
    onToken: (token: string) => void,
    onDone: () => void,
    signal?: AbortSignal
  ) => {
    _chatDbg('REQ', `POST /api/chat`, { chat_id: data.chat_id, character_id: data.character_id, update_message_id: data.update_message_id || 'none' });
    const res = await fetch(`${BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error' }));
      throw new Error(err.error || 'Connection error');
    }

    const contentType = res.headers.get('content-type') || '';
    _chatDbg('RES', `status=${res.status} content-type=${contentType}`);

    if (contentType.includes('text/event-stream')) {
      _chatDbg('SSE', 'Stream mode — reading SSE events');
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let _eventCount = 0;
      let _tokenCount = 0;

      while (true) {
        let result: { done: boolean; value?: Uint8Array };
        try {
          result = await reader.read();
        } catch (e: any) {
          _chatDbg('SSE', `reader.read() ERROR: ${e?.message}`);
          if (signal?.aborted) throw e;
          throw e;
        }
        if (result.done) {
          _chatDbg('SSE', `reader done — stream ended naturally (no [DONE] received!) tokens=${_tokenCount} events=${_eventCount}`);
          break;
        }

        buffer += decoder.decode(result.value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const data = trimmed.slice(6);
            _eventCount++;
            if (data === '[DONE]') {
              _chatDbg('SSE', `✅ [DONE] received — tokens=${_tokenCount} events=${_eventCount}`);
              onDone();
              return;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.message_id) {
                _chatDbg('SSE', `📨 message_id: ${parsed.message_id}`);
                onMessageId(parsed.message_id);
              }
              else if (parsed.token) {
                _tokenCount++;
                if (_tokenCount <= 3 || _tokenCount % 50 === 0) {
                  _chatDbg('SSE', `🔤 token #${_tokenCount}: "${parsed.token.slice(0, 50)}"`);
                }
                onToken(parsed.token);
              }
              else if (parsed.error) {
                _chatDbg('SSE', `❌ error: ${parsed.error}`);
                throw new Error(parsed.error);
              }
              else if (parsed.story_state_updated) {
                _chatDbg('SSE', `📊 story_state_updated — state keys: ${Object.keys(parsed.state || {}).join(', ')}`);
                try {
                  window.dispatchEvent(new CustomEvent('story-state-updated', { detail: parsed.state }));
                } catch {}
              }
              else if (parsed.usage) {
                _chatDbg('SSE', `📈 usage: prompt=${parsed.usage.prompt_tokens} completion=${parsed.usage.completion_tokens} total=${parsed.usage.total_tokens}`);
                try {
                  window.dispatchEvent(new CustomEvent('api-usage', { detail: parsed.usage }));
                } catch {}
              }
              else {
                _chatDbg('SSE', `❓ unknown event: ${data.slice(0, 200)}`);
              }
            } catch (e: any) {
              if (e?.message && !e.message.includes('JSON')) throw e;
            }
          }
        }
      }
      _chatDbg('SSE', `Fallback: stream ended, calling onDone (tokens=${_tokenCount})`);
      onDone();
    } else {
      _chatDbg('NON-SSE', 'Non-streaming mode — waiting for full response');
      const data = await res.json();
      _chatDbg('NON-SSE', `Response: message_id=${data.message_id} contentLen=${(data.content || '').length} hasStoryState=${!!data.story_state_updated} hasUsage=${!!data.usage}`);
      if (data.message_id) onMessageId(data.message_id);
      if (data.content) onToken(data.content);
      // Handle story state update in non-streaming response
      if (data.story_state_updated) {
        _chatDbg('NON-SSE', `📊 story_state_updated`);
        try {
          window.dispatchEvent(new CustomEvent('story-state-updated', { detail: data.state }));
        } catch {}
      }
      // Handle usage data from non-streaming response
      if (data.usage) {
        _chatDbg('NON-SSE', `📈 usage: prompt=${data.usage.prompt_tokens} completion=${data.usage.completion_tokens}`);
        try {
          window.dispatchEvent(new CustomEvent('api-usage', { detail: data.usage }));
        } catch {}
      }
      // Use setTimeout to ensure Zustand state updates are flushed before onDone
      _chatDbg('NON-SSE', `Calling onDone via setTimeout`);
      setTimeout(() => {
        _chatDbg('NON-SSE', `✅ onDone() called`);
        onDone();
      }, 0);
    }
  },

  // ─── Story Advisor ───
  getAdvisorChats: (mainChatId: string) => request(`/story-advisor/chats/${mainChatId}`),
  createAdvisorChat: (data: { main_chat_id: string; name?: string }) =>
    request('/story-advisor/chats', { method: 'POST', body: JSON.stringify(data) }),
  deleteAdvisorChat: (id: string) => request(`/story-advisor/chats/${id}`, { method: 'DELETE' }),
  renameAdvisorChat: (id: string, name: string) =>
    request(`/story-advisor/chats/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }),
  getAdvisorMessages: (chatId: string) => request(`/story-advisor/chats/${chatId}/messages`),
  clearAdvisorMessages: (chatId: string) => request(`/story-advisor/chats/${chatId}/messages`, { method: 'DELETE' }),
  executeAdvisorTool: (data: { advisor_chat_id: string; tool_name: string; arguments: Record<string, any> }) =>
    request('/story-advisor/execute-tool', { method: 'POST', body: JSON.stringify(data) }),
  // ─── Character Message Generation ───
  generateCharacterMessage: (data: { advisor_chat_id: string; character_id: string; instruction: string }) =>
    request('/story-advisor/generate-message', { method: 'POST', body: JSON.stringify(data) }),
  insertGeneratedMessage: (data: { advisor_chat_id: string; character_id: string; content: string }) =>
    request('/story-advisor/insert-message', { method: 'POST', body: JSON.stringify(data) }),
  sendAdvisorMessage: async (
    data: { advisor_chat_id: string; message: string },
    onToken: (token: string) => void,
    onDone: () => void,
    signal?: AbortSignal
  ) => {
    const res = await fetch(`${BASE}/story-advisor/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error' }));
      throw new Error(err.error || 'Connection error');
    }

    const contentType = res.headers.get('content-type') || '';

    if (contentType.includes('text/event-stream')) {
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        let result: { done: boolean; value?: Uint8Array };
        try {
          result = await reader.read();
        } catch (e: any) {
          if (signal?.aborted) throw e;
          throw e;
        }
        if (result.done) break;

        buffer += decoder.decode(result.value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const data = trimmed.slice(6);
            if (data === '[DONE]') {
              onDone();
              return;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.token) onToken(parsed.token);
              else if (parsed.tool_call) onToken(JSON.stringify({ tool_call: parsed.tool_call }));
              else if (parsed.error) throw new Error(parsed.error);
            } catch (e: any) {
              if (e?.message && !e.message.includes('JSON')) throw e;
            }
          }
        }
      }
      onDone();
    } else {
      const data = await res.json();
      if (data.content) onToken(data.content);
      setTimeout(() => onDone(), 0);
    }
  },

  // ─── Character Wizard ───
  wizardChat: async (
    messages: { role: string; content: string }[],
    onToken: (token: string) => void,
    onDone: () => void,
    signal?: AbortSignal
  ) => {
    const res = await fetch(`${BASE}/character-wizard/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error' }));
      throw new Error(err.error || 'Connection error');
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const result = await reader.read();
      if (result.done) break;

      buffer += decoder.decode(result.value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6);
          if (data === '[DONE]') {
            onDone();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            if (parsed.token) onToken(parsed.token);
          } catch {}
        }
      }
    }
    onDone();
  },
};
