const BASE = '/api';

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

  // Plugins (تنظیمات پلاگین‌ها)
  getPluginSettings: (pluginId: string) => request(`/plugins/${pluginId}/settings`),
  updatePluginSettings: (pluginId: string, data: any) =>
    request(`/plugins/${pluginId}/settings`, { method: 'PUT', body: JSON.stringify(data) }),

  // Chapters
  getChapters: (chatId: string) => request(`/chapters/chat/${chatId}`),
  createChapter: (data: { chat_id: string; start_message_id: string; end_message_id: string; title?: string; edited_messages?: { role: string; content: string }[] }) =>
    request('/chapters', { method: 'POST', body: JSON.stringify(data) }),
  updateChapter: (id: string, data: { title?: string; summary?: string }) =>
    request(`/chapters/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteChapter: (id: string) => request(`/chapters/${id}`, { method: 'DELETE' }),
  regenerateChapter: (id: string, editedMessages?: { role: string; content: string }[]) =>
    request(`/chapters/${id}/regenerate`, { method: 'POST', body: JSON.stringify({ edited_messages: editedMessages }) }),
  getChapterSettings: () => request('/plugins/chapters/settings'),
  updateChapterSettings: (data: any) =>
    request('/plugins/chapters/settings', { method: 'PUT', body: JSON.stringify(data) }),
  detectTrigger: (chatId: string) =>
    request(`/chapters/chat/${chatId}/detect`, { method: 'POST' }),

  // Prompt Inspector (dry-run — payload بدون ارسال به LLM)
  inspectChat: (data: any) =>
    request('/chat', { method: 'POST', body: JSON.stringify({ ...data, inspect: true }) }),
  inspectAutoName: (chatId: string) =>
    request(`/chats/${chatId}/auto-name`, { method: 'POST', body: JSON.stringify({ inspect: true }) }),
  inspectCreateChapter: (data: any) =>
    request('/chapters', { method: 'POST', body: JSON.stringify({ ...data, inspect: true }) }),
  inspectRegenerateChapter: (id: string) =>
    request(`/chapters/${id}/regenerate`, { method: 'POST', body: JSON.stringify({ inspect: true }) }),

  // Chat with AI
  chatWithAI: async (
    data: { chat_id: string; character_id: string; persona_id?: string; lorebook_id?: string; update_message_id?: string; continue_mode?: boolean; impersonate?: boolean; edited_messages?: { role: string; content: string }[] },
    onMessageId: (id: string) => void,
    onToken: (token: string) => void,
    onDone: () => void,
    signal?: AbortSignal
  ) => {
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
              if (parsed.message_id) onMessageId(parsed.message_id);
              else if (parsed.token) onToken(parsed.token);
            } catch {}
          }
        }
      }
      onDone();
    } else {
      const data = await res.json();
      if (data.message_id) onMessageId(data.message_id);
      if (data.content) onToken(data.content);
      onDone();
    }
  },
};
