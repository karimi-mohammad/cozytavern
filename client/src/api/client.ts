const BASE = '/api';

async function request(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'خطا' }));
    throw new Error(err.error || `خطا: ${res.status}`);
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
  updateChat: (id: string, data: any) => request(`/chats/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Messages
  sendMessage: (data: any) => request('/messages', { method: 'POST', body: JSON.stringify(data) }),
  editMessage: (id: string, content: string) => request(`/messages/${id}`, { method: 'PUT', body: JSON.stringify({ content }) }),
  regenerateMessage: (chatId: string) => request(`/messages/regenerate/${chatId}`, { method: 'POST' }),
  swipeMessage: (id: string, direction: string) => request(`/messages/swipe/${id}`, { method: 'POST', body: JSON.stringify({ direction }) }),

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

  // Chat with AI
  chatWithAI: async (
    data: { chat_id: string; character_id: string; persona_id?: string; lorebook_id?: string; update_message_id?: string },
    onMessageId: (id: string) => void,
    onToken: (token: string) => void,
    onDone: () => void
  ) => {
    const res = await fetch(`${BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'خطا' }));
      throw new Error(err.error || 'خطا در اتصال');
    }

    const contentType = res.headers.get('content-type') || '';

    if (contentType.includes('text/event-stream')) {
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
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
