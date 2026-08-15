import { create } from 'zustand';
import { Character, Chat, Message, Persona, Lorebook, ApiSettings } from '../types';
import { api } from '../api/client';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ConfirmDialog {
  message: string;
}

interface AppState {
  // Data
  characters: Character[];
  currentCharacter: Character | null;
  chats: Chat[];
  currentChat: (Chat & { messages: Message[] }) | null;
  personas: Persona[];
  activePersona: Persona | null;
  lorebooks: Lorebook[];
  activeLorebook: Lorebook | null;
  apiSettings: Record<string, ApiSettings>;

  // UI State
  theme: 'dark' | 'darker' | 'light';
  setTheme: (theme: 'dark' | 'darker' | 'light') => void;
  sidebarOpen: boolean;
  settingsOpen: boolean;
  characterEditorOpen: boolean;
  editingCharacter: Character | null;
  lorebookEditorOpen: boolean;
  personaEditorOpen: boolean;
  editingPersona: Persona | null;
  isGenerating: boolean;
  galleryView: boolean;
  toggleGallery: () => void;
  setGalleryView: (open: boolean) => void;
  activePanel: 'characters' | 'chats' | 'personas' | 'lorebooks' | 'extensions' | 'settings' | null;
  panelOpen: boolean;
  rightPanelOpen: boolean;
  setActivePanel: (panel: 'characters' | 'chats' | 'personas' | 'lorebooks' | 'extensions' | 'settings' | null) => void;
  togglePanel: () => void;
  toggleRightPanel: () => void;
  setRightPanelOpen: (open: boolean) => void;

  // Toast
  toasts: Toast[];
  addToast: (message: string, type?: Toast['type']) => void;
  removeToast: (id: string) => void;

  // Confirm
  confirmDialog: ConfirmDialog | null;
  showConfirm: (message: string) => Promise<boolean>;
  resolveConfirm: (result: boolean) => void;

  // Optimistic state (نیازی به رندر ندارد)
  pendingEdit: Promise<Message> | null;

  // Actions
  loadCharacters: () => Promise<void>;
  selectCharacter: (character: Character) => Promise<void>;
  createCharacter: (data: any) => Promise<Character>;
  updateCharacter: (id: string, data: any) => Promise<void>;
  deleteCharacter: (id: string) => Promise<void>;

  loadChats: (characterId: string) => Promise<void>;
  selectChat: (chatId: string) => Promise<void>;
  createChat: (characterId: string) => Promise<Chat>;
  branchChat: (characterId: string, sourceChatId: string, branchPoint: string) => Promise<Chat>;
  deleteChat: (id: string) => Promise<void>;
  renameChat: (id: string, name: string) => Promise<void>;
  moveChatToFolder: (id: string, folder: string) => Promise<void>;

  sendMessage: (content: string) => Promise<void>;
  stopGeneration: () => Promise<void>;
  editMessage: (messageId: string, content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  regenerateMessage: () => Promise<void>;
  swipeMessage: (messageId: string, direction: string) => Promise<void>;

  loadPersonas: () => Promise<void>;
  createPersona: (data: any) => Promise<void>;
  updatePersona: (id: string, data: any) => Promise<void>;
  deletePersona: (id: string) => Promise<void>;
  setActivePersona: (persona: Persona | null) => void;

  loadLorebooks: () => Promise<void>;
  setActiveLorebook: (lorebook: Lorebook | null) => void;

  loadApiSettings: () => Promise<void>;
  saveApiSettings: (data: any) => Promise<void>;
  autoNameChat: (chatId: string) => Promise<void>;

  setSidebarOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setCharacterEditorOpen: (open: boolean, character?: Character | null) => void;
  setLorebookEditorOpen: (open: boolean) => void;
  setPersonaEditorOpen: (open: boolean, persona?: Persona | null) => void;
  setIsGenerating: (generating: boolean) => void;
}

let confirmResolver: ((result: boolean) => void) | null = null;
let currentAbortController: AbortController | null = null;

export const useStore = create<AppState>((set, get) => ({
  characters: [],
  currentCharacter: null,
  chats: [],
  currentChat: null,
  personas: [],
  activePersona: null,
  lorebooks: [],
  activeLorebook: null,
  apiSettings: {},

  theme: (localStorage.getItem('cozytavern.theme') as 'dark' | 'darker' | 'light') || 'dark',
  setTheme: (theme) => {
    document.documentElement.classList.remove('theme-dark', 'theme-darker', 'theme-light');
    document.documentElement.classList.add(`theme-${theme}`);
    document.body.classList.toggle('theme-light', theme === 'light');
    try { localStorage.setItem('cozytavern.theme', theme); } catch {}
    set({ theme });
  },
  sidebarOpen: true,
  settingsOpen: false,
  characterEditorOpen: false,
  editingCharacter: null,
  lorebookEditorOpen: false,
  personaEditorOpen: false,
  editingPersona: null,
  isGenerating: false,
  galleryView: false,
  toggleGallery: () => set(s => ({ galleryView: !s.galleryView, sidebarOpen: true })),
  setGalleryView: (open) => set({ galleryView: open, sidebarOpen: true }),
  activePanel: 'characters',
  panelOpen: true,
  rightPanelOpen: false,
  setActivePanel: (panel) => set(s => {
    if (s.activePanel === panel && s.panelOpen) {
      return { panelOpen: false };
    }
    return { activePanel: panel, panelOpen: true };
  }),
  togglePanel: () => set(s => ({ panelOpen: !s.panelOpen })),
  toggleRightPanel: () => set(s => ({ rightPanelOpen: !s.rightPanelOpen })),
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),

  toasts: [],
  confirmDialog: null,
  pendingEdit: null,

  addToast: (message, type = 'info') => {
    const id = Math.random().toString(36).slice(2);
    set(s => ({ toasts: [...s.toasts, { id, message, type }] }));
  },
  removeToast: (id) => {
    set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }));
  },

  showConfirm: (message) => {
    // اگر مودالی هنوز باز است، پرامیس قبلی را بسته (false) کنیم تا hanging نشود
    if (confirmResolver) {
      confirmResolver(false);
      confirmResolver = null;
    }
    return new Promise<boolean>((resolve) => {
      confirmResolver = resolve;
      set({ confirmDialog: { message } });
    });
  },
  resolveConfirm: (result) => {
    set({ confirmDialog: null });
    confirmResolver?.(result);
    confirmResolver = null;
  },

  loadCharacters: async () => {
    const characters = await api.getCharacters();
    set({ characters });
  },

  selectCharacter: async (character) => {
    set({ currentCharacter: character, currentChat: null });
    const chats = await api.getChats(character.id);
    set({ chats });
  },

  createCharacter: async (data) => {
    const character = await api.createCharacter(data);
    set(s => ({ characters: [character, ...s.characters] }));
    get().addToast('کاراکتر ایجاد شد', 'success');
    return character;
  },

  updateCharacter: async (id, data) => {
    const updated = await api.updateCharacter(id, data);
    set(s => ({
      characters: s.characters.map(c => c.id === id ? updated : c),
      currentCharacter: s.currentCharacter?.id === id ? updated : s.currentCharacter,
    }));
    get().addToast('کاراکتر ذخیره شد', 'success');
  },

  deleteCharacter: async (id) => {
    const deleted = get().characters.find(c => c.id === id);
    if (!deleted) return;
    set(s => ({
      characters: s.characters.filter(c => c.id !== id),
      currentCharacter: s.currentCharacter?.id === id ? null : s.currentCharacter,
    }));
    try {
      await api.deleteCharacter(id);
      get().addToast('کاراکتر حذف شد', 'success');
    } catch (error: any) {
      set(s => ({
        characters: [deleted, ...s.characters],
        currentCharacter: s.currentCharacter ?? deleted,
      }));
      get().addToast(`خطا: ${error.message}`, 'error');
    }
  },

  loadChats: async (characterId) => {
    const chats = await api.getChats(characterId);
    set({ chats });
  },

  selectChat: async (chatId) => {
    const chat = await api.getChat(chatId);
    set({ currentChat: chat });
  },

  createChat: async (characterId) => {
    const chat = await api.createChat({ character_id: characterId });
    const fullChat = await api.getChat(chat.id);
    set(s => ({ chats: [chat, ...s.chats], currentChat: fullChat }));
    return chat;
  },

  branchChat: async (characterId, sourceChatId, branchPoint) => {
    const chat = await api.createChat({
      character_id: characterId,
      branch_from: sourceChatId,
      branch_point: branchPoint,
    });
    set(s => ({ chats: [chat, ...s.chats] }));
    return chat;
  },

  deleteChat: async (id) => {
    const deleted = get().chats.find(c => c.id === id);
    if (!deleted) return;
    const deletedCurrent = get().currentChat?.id === id;
    set(s => ({
      chats: s.chats.filter(c => c.id !== id),
      currentChat: deletedCurrent ? null : s.currentChat,
    }));
    try {
      await api.deleteChat(id);
      get().addToast('چت حذف شد', 'success');
    } catch (error: any) {
      set(s => ({
        chats: [deleted, ...s.chats],
        currentChat: s.currentChat ?? get().currentChat,
      }));
      get().addToast(`خطا: ${error.message}`, 'error');
    }
  },

  renameChat: async (id, name) => {
    const updated = await api.updateChat(id, { name });
    set(s => ({
      chats: s.chats.map(c => c.id === id ? updated : c),
      currentChat: s.currentChat?.id === id ? { ...s.currentChat, ...updated } : s.currentChat,
    }));
  },

  moveChatToFolder: async (id, folder) => {
    const updated = await api.updateChat(id, { folder });
    set(s => ({
      chats: s.chats.map(c => c.id === id ? updated : c),
      currentChat: s.currentChat?.id === id ? { ...s.currentChat, ...updated } : s.currentChat,
    }));
  },

  sendMessage: async (content) => {
    // صبر برای پایان ادیت در حال انجام (تا نسخه‌های قدیمی روی پیام‌ها ننویسد)
    if (get().pendingEdit) {
      try { await get().pendingEdit; } catch {}
    }
    const { currentChat, currentCharacter, activePersona, activeLorebook, isGenerating } = get();
    if (!currentChat || !currentCharacter || isGenerating) return;

    const isFirstMessage = currentChat.messages.length === 0;

    const userMsg = await api.sendMessage({
      chat_id: currentChat.id,
      role: 'user',
      content,
    });

    set(s => ({
      currentChat: s.currentChat ? {
        ...s.currentChat,
        messages: [...s.currentChat.messages, userMsg],
      } : null,
      isGenerating: true,
    }));

    const controller = new AbortController();
    currentAbortController = controller;

    let aborted = false;
    try {
      let fullContent = '';
      await api.chatWithAI(
        {
          chat_id: currentChat.id,
          character_id: currentCharacter.id,
          persona_id: activePersona?.id,
          lorebook_id: activeLorebook?.id,
        },
        (messageId) => {
          const assistantMsg = {
            id: messageId,
            chat_id: currentChat.id,
            role: 'assistant' as const,
            content: '',
            swipes: [],
            swipe_id: 0,
            is_edited: false,
            is_system: false,
            send_date: new Date().toISOString(),
          };
          set(s => ({
            currentChat: s.currentChat ? {
              ...s.currentChat,
              messages: [...s.currentChat.messages, assistantMsg],
            } : null,
          }));
        },
        (token) => {
          fullContent += token;
          set(s => {
            if (!s.currentChat) return s;
            const msgs = [...s.currentChat.messages];
            const lastMsg = msgs[msgs.length - 1];
            if (lastMsg && lastMsg.role === 'assistant') {
              msgs[msgs.length - 1] = { ...lastMsg, content: fullContent };
            }
            return { currentChat: { ...s.currentChat, messages: msgs } };
          });
        },
        () => {
          set({ isGenerating: false });
          if (isFirstMessage) {
            get().autoNameChat(currentChat.id);
          }
        },
        controller.signal
      );
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        set({ isGenerating: false });
        return;
      }
      get().addToast(`خطا: ${error.message}`, 'error');
      set(s => {
        if (!s.currentChat) return s;
        const msgs = [...s.currentChat.messages];
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg && lastMsg.role === 'assistant' && !lastMsg.content) {
          msgs[msgs.length - 1] = { ...lastMsg, content: `خطا: ${error.message}` };
        }
        return { currentChat: { ...s.currentChat, messages: msgs }, isGenerating: false };
      });
    } finally {
      if (controller.signal.aborted) aborted = true;
      if (currentAbortController === controller) currentAbortController = null;
    }
  },

  // لغو پاسخ در حال تولید — هم fetch کلاینت و هم استریم سرور متوقف می‌شود
  stopGeneration: async () => {
    const { currentChat, isGenerating } = get();
    if (!isGenerating || !currentChat) return;
    set({ isGenerating: false });
    // abort کردن fetch باعث بسته شدن اتصال می‌شود؛ سرور از طریق res.on('close') استریم را متوقف و partial را ذخیره می‌کند
    if (currentAbortController) {
      currentAbortController.abort();
    }
    const lastAssistantMsg = [...currentChat.messages].reverse().find(m => m.role === 'assistant');
    if (lastAssistantMsg && lastAssistantMsg.content) {
      try { await api.abortChat(lastAssistantMsg.id); } catch {}
    }
  },

  editMessage: async (messageId, content) => {
    const { currentChat, pendingEdit } = get();
    if (pendingEdit) {
      try { await pendingEdit; } catch {}
    }
    if (!currentChat) return;

    const index = currentChat.messages.findIndex(m => m.id === messageId);
    if (index === -1) return;
    const original = currentChat.messages[index];
    const optimistic: Message = { ...original, content, is_edited: true };

    set(s => {
      if (!s.currentChat) return s;
      const msgs = [...s.currentChat.messages];
      msgs[index] = optimistic;
      return { currentChat: { ...s.currentChat, messages: msgs } };
    });

    const request = api.editMessage(messageId, content);
    set({ pendingEdit: request });

    try {
      const updated = await request;
      set(s => {
        if (!s.currentChat) return s;
        const msgs = s.currentChat.messages.map(m => m.id === messageId ? updated : m);
        return { currentChat: { ...s.currentChat, messages: msgs } };
      });
    } catch (error: any) {
      set(s => {
        if (!s.currentChat) return s;
        const msgs = [...s.currentChat.messages];
        const idx = msgs.findIndex(m => m.id === messageId);
        if (idx !== -1) msgs[idx] = original;
        return { currentChat: { ...s.currentChat, messages: msgs } };
      });
      get().addToast(`خطا: ${error.message}`, 'error');
    } finally {
      set({ pendingEdit: null });
    }
  },

  deleteMessage: async (messageId) => {
    const { currentChat } = get();
    if (!currentChat) return;

    const index = currentChat.messages.findIndex(m => m.id === messageId);
    if (index === -1) return;
    const removed = currentChat.messages[index];

    set(s => {
      if (!s.currentChat) return s;
      return {
        currentChat: {
          ...s.currentChat,
          messages: s.currentChat.messages.filter(m => m.id !== messageId),
        },
      };
    });

    try {
      await api.deleteMessage(messageId);
    } catch (error: any) {
      set(s => {
        if (!s.currentChat) return s;
        const msgs = [...s.currentChat.messages];
        const idx = msgs.findIndex(m => m.id === messageId);
        if (idx === -1) {
          msgs.splice(Math.min(index, msgs.length), 0, removed);
        }
        return { currentChat: { ...s.currentChat, messages: msgs } };
      });
      get().addToast(`خطا: ${error.message}`, 'error');
    }
  },

  regenerateMessage: async () => {
    // صبر برای پایان ادیت در حال انجام
    if (get().pendingEdit) {
      try { await get().pendingEdit; } catch {}
    }
    const { currentChat, currentCharacter, activePersona, activeLorebook } = get();
    if (!currentChat || !currentCharacter) return;

    const lastAssistantMsg = [...currentChat.messages].reverse().find(m => m.role === 'assistant');
    if (!lastAssistantMsg) return;

    set({ isGenerating: true });

    try {
      await api.regenerateMessage(currentChat.id);

      let fullContent = '';
      await api.chatWithAI(
        {
          chat_id: currentChat.id,
          character_id: currentCharacter.id,
          persona_id: activePersona?.id,
          lorebook_id: activeLorebook?.id,
          update_message_id: lastAssistantMsg.id,
        },
        () => {},
        (token) => {
          fullContent += token;
          set(s => {
            if (!s.currentChat) return s;
            const msgs = s.currentChat.messages.map(m =>
              m.id === lastAssistantMsg.id ? { ...m, content: fullContent } : m
            );
            return { currentChat: { ...s.currentChat, messages: msgs } };
          });
        },
        () => {
          set({ isGenerating: false });
        }
      );
    } catch (error: any) {
      set({ isGenerating: false });
    }
  },

  swipeMessage: async (messageId, direction) => {
    const updated = await api.swipeMessage(messageId, direction);
    set(s => {
      if (!s.currentChat) return s;
      const msgs = s.currentChat.messages.map(m => m.id === messageId ? updated : m);
      return { currentChat: { ...s.currentChat, messages: msgs } };
    });
  },

  loadPersonas: async () => {
    const personas = await api.getPersonas();
    set({ personas });
  },

  createPersona: async (data) => {
    const persona = await api.createPersona(data);
    set(s => ({ personas: [persona, ...s.personas] }));
    get().addToast('پرسونا ایجاد شد', 'success');
  },

  updatePersona: async (id, data) => {
    const updated = await api.updatePersona(id, data);
    set(s => ({
      personas: s.personas.map(p => p.id === id ? updated : p),
    }));
    get().addToast('پرسونا ذخیره شد', 'success');
  },

  deletePersona: async (id) => {
    const deleted = get().personas.find(p => p.id === id);
    if (!deleted) return;
    set(s => ({
      personas: s.personas.filter(p => p.id !== id),
      activePersona: s.activePersona?.id === id ? null : s.activePersona,
    }));
    try {
      await api.deletePersona(id);
      get().addToast('پرسونا حذف شد', 'success');
    } catch (error: any) {
      set(s => ({
        personas: [deleted, ...s.personas],
        activePersona: s.activePersona ?? deleted,
      }));
      get().addToast(`خطا: ${error.message}`, 'error');
    }
  },

  setActivePersona: (persona) => {
    set({ activePersona: persona });
    try { localStorage.setItem('cozytavern.activePersonaId', persona?.id || ''); } catch {}
  },

  loadLorebooks: async () => {
    const lorebooks = await api.getLorebooks();
    set({ lorebooks });
  },

  setActiveLorebook: (lorebook) => {
    set({ activeLorebook: lorebook });
    try { localStorage.setItem('cozytavern.activeLorebookId', lorebook?.id || ''); } catch {}
  },

  loadApiSettings: async () => {
    const settings = await api.getApiSettings();
    set({ apiSettings: { openai: settings } });
  },

  saveApiSettings: async (data) => {
    await api.saveApiSettings(data);
    set(s => ({ apiSettings: { ...s.apiSettings, openai: data } }));
    get().addToast('تنظیمات ذخیره شد', 'success');
  },

  autoNameChat: async (chatId) => {
    try {
      const updated = await api.autoNameChat(chatId);
      set(s => ({
        chats: s.chats.map(c => c.id === chatId ? updated : c),
        currentChat: s.currentChat?.id === chatId ? { ...s.currentChat, name: updated.name } : s.currentChat,
      }));
    } catch {}
  },

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setCharacterEditorOpen: (open, character = null) => set({ characterEditorOpen: open, editingCharacter: character }),
  setLorebookEditorOpen: (open) => set({ lorebookEditorOpen: open }),
  setPersonaEditorOpen: (open, persona = null) => set({ personaEditorOpen: open, editingPersona: persona }),
  setIsGenerating: (generating) => set({ isGenerating: generating }),
}));
