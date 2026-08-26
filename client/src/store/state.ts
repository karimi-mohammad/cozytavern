import { create } from 'zustand';
import { Character, Chat, Message, Persona, Lorebook, ApiSettings, Chapter, ChapterSettings, LorebookPluginSettings, PromptInspection, PromptInspectionPayload, PromptPart } from '../types';
import { api } from '../api/client';
import { estimateContextUsage, ContextUsage } from '../utils/tokenEstimate';

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

  // Chapter Memory
  chapters: Chapter[];
  chapterSettings: ChapterSettings | null;
  chapterSuggestion: { trigger_message_id: string; trigger_phrase: string } | null;
  // انتخاب دستی مرزهای فصل (start/end) روی پیام‌ها
  chapterStartId: string | null;
  chapterEndId: string | null;

  // Plugins (تنظیمات پلاگین لوربوک)
  lorebookPluginSettings: LorebookPluginSettings | null;

  // Loading States
  loadingCharacters: boolean;
  loadingChats: boolean;
  loadingMessages: boolean;
  loadingPersonas: boolean;
  loadingLorebooks: boolean;

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
  activePanel: 'characters' | 'chats' | 'personas' | 'lorebooks' | 'plugins' | 'settings' | 'chapters' | null;
  panelOpen: boolean;
  rightPanelOpen: boolean;
  setActivePanel: (panel: 'characters' | 'chats' | 'personas' | 'lorebooks' | 'plugins' | 'settings' | 'chapters' | null) => void;
  togglePanel: () => void;
  toggleRightPanel: () => void;
  setRightPanelOpen: (open: boolean) => void;

  // Prompt Inspector — پیش‌نمایش پرامپت قبل از ارسال به LLM
  promptInspectEnabled: boolean;
  togglePromptInspect: () => void;
  promptInspection: PromptInspection | null;      // entry در انتظار تصمیم کاربر
  promptInspectHistory: PromptInspection[];       // آخرین ۲۰ بازرسی، جدیدترین اول
  requestInspection: (entry: Omit<PromptInspection, 'id' | 'created_at'>) => Promise<boolean | PromptInspection['messages']>;
  resolveInspection: (send: boolean, editedMessages?: PromptInspection['messages']) => void;

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

  // Context usage
  contextUsage: ContextUsage | null;
  updateContextUsage: () => void;

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
  continueGeneration: () => Promise<void>;
  impersonateMessage: () => Promise<void>;
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

  // Chapter Memory
  loadChapters: (chatId: string) => Promise<void>;
  createChapter: (data: { chat_id: string; start_message_id: string; end_message_id: string; title?: string }) => Promise<Chapter>;
  updateChapter: (id: string, data: { title?: string; summary?: string }) => Promise<void>;
  deleteChapter: (id: string) => Promise<void>;
  regenerateChapter: (id: string) => Promise<void>;
  loadChapterSettings: () => Promise<void>;
  updateChapterSettings: (data: Partial<ChapterSettings>) => Promise<void>;
  loadLorebookPluginSettings: () => Promise<void>;
  updateLorebookPluginSettings: (data: Partial<LorebookPluginSettings>) => Promise<void>;
  checkChapterTrigger: (chatId: string) => Promise<void>;
  dismissChapterSuggestion: () => void;
  markChapterBoundary: (kind: 'start' | 'end', messageId: string) => void;
  clearChapterSelection: () => void;
  createChapterFromSelection: () => Promise<void>;

  setSidebarOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setCharacterEditorOpen: (open: boolean, character?: Character | null) => void;
  setLorebookEditorOpen: (open: boolean) => void;
  setPersonaEditorOpen: (open: boolean, persona?: Persona | null) => void;
  setIsGenerating: (generating: boolean) => void;
}

let confirmResolver: ((result: boolean) => void) | null = null;
let currentAbortController: AbortController | null = null;

// ─── Prompt Inspector gate ───
// resolver بازرسی فعلی + صف FIFO برای بازرسی‌های همزمان (مثلاً عنوان بعد از پایان چت)
let inspectionResolver: ((send: boolean, editedMessages?: PromptInspection['messages']) => void) | null = null;
const inspectionQueue: { entry: PromptInspection; resolve: (v: boolean, editedMessages?: PromptInspection['messages']) => void }[] = [];

function promoteNextInspection() {
  const next = inspectionQueue.shift();
  if (!next) return;
  inspectionResolver = next.resolve;
  useStore.setState({ promptInspection: next.entry });
}

// تبدیل payload سرور به entry پنل (label بر اساس source)
export function inspectionEntryFromPayload(payload: PromptInspectionPayload): Omit<PromptInspection, 'id' | 'created_at'> {
  const labels: Record<string, string> = { chat: 'Chat', title: 'Chat Title', chapter: 'Chapter Summary' };
  return {
    source: payload.source,
    label: labels[payload.source] || payload.source,
    mode: payload.mode,
    endpoint: payload.endpoint,
    model: payload.model,
    params: payload.params,
    messages: payload.messages,
  };
}

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

  // Chapter Memory
  chapters: [],
  chapterSettings: null,
  chapterSuggestion: null,
  chapterStartId: null,
  chapterEndId: null,

  // Plugins
  lorebookPluginSettings: null,

  // Loading states (از true شروع می‌شه چون لود اولیه دیتا در mount انجام می‌شه)
  loadingCharacters: true,
  loadingChats: false,
  loadingMessages: false,
  loadingPersonas: true,
  loadingLorebooks: true,

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

  // ─── Prompt Inspector ───
  promptInspectEnabled: (() => {
    try { return localStorage.getItem('cozytavern.promptInspect') === '1'; } catch { return false; }
  })(),
  togglePromptInspect: () => set(s => {
    const v = !s.promptInspectEnabled;
    try { localStorage.setItem('cozytavern.promptInspect', v ? '1' : '0'); } catch {}
    return { promptInspectEnabled: v };
  }),

  promptInspection: null,
  promptInspectHistory: [],

  requestInspection: (entry) =>
    new Promise<boolean | PromptInspection['messages']>((resolve) => {
      const full: PromptInspection = {
        ...entry,
        id: Math.random().toString(36).slice(2),
        created_at: new Date().toISOString(),
      };
      // تاریخچه حتی برای موارد لغوشده هم پر می‌شود (قابل مرور)
      set(s => ({ promptInspectHistory: [full, ...s.promptInspectHistory].slice(0, 20) }));
      // بسته‌بندی resolve تا editedMessages هم به promise برسد
      const wrappedResolve = (send: boolean, editedMessages?: PromptPart[]) => {
        resolve(send && editedMessages && editedMessages.length > 0 ? editedMessages : send);
      };
      inspectionQueue.push({ entry: full, resolve: wrappedResolve });
      if (!get().promptInspection) {
        promoteNextInspection();
      }
    }),

  resolveInspection: (send, editedMessages) => {
    if (!inspectionResolver) return; // stale resolver — نادیده گرفته می‌شود
    const r = inspectionResolver;
    inspectionResolver = null;
    set({ promptInspection: null });
    r(send, editedMessages);
    promoteNextInspection(); // مورد بعدی صف، اگر باشد
  },

  toasts: [],
  confirmDialog: null,
  pendingEdit: null,
  contextUsage: null,

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
    set({ loadingCharacters: true });
    try {
      const characters = await api.getCharacters();
      set({ characters });
    } finally {
      set({ loadingCharacters: false });
    }
  },

  selectCharacter: async (character) => {
    set({ currentCharacter: character, currentChat: null, loadingChats: true });
    try {
      const chats = await api.getChats(character.id);
      set({ chats });
    } finally {
      set({ loadingChats: false });
    }
  },

  createCharacter: async (data) => {
    const character = await api.createCharacter(data);
    set(s => ({ characters: [character, ...s.characters] }));
    get().addToast('Character created', 'success');
    return character;
  },

  updateCharacter: async (id, data) => {
    const updated = await api.updateCharacter(id, data);
    set(s => ({
      characters: s.characters.map(c => c.id === id ? updated : c),
      currentCharacter: s.currentCharacter?.id === id ? updated : s.currentCharacter,
    }));
    get().addToast('Character saved', 'success');
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
      get().addToast('Character deleted', 'success');
    } catch (error: any) {
      set(s => ({
        characters: [deleted, ...s.characters],
        currentCharacter: s.currentCharacter ?? deleted,
      }));
      get().addToast(`Error: ${error.message}`, 'error');
    }
  },

  loadChats: async (characterId) => {
    set({ loadingChats: true });
    try {
      const chats = await api.getChats(characterId);
      set({ chats });
    } finally {
      set({ loadingChats: false });
    }
  },

  selectChat: async (chatId) => {
    set({ loadingMessages: true });
    try {
      const chat = await api.getChat(chatId);
      set({ currentChat: chat, chapterStartId: null, chapterEndId: null, chapterSuggestion: null });
      // لود فصل‌ها و تنظیمات
      get().loadChapters(chatId);
      get().loadChapterSettings();
      // محاسبه context usage بعد از لود چت
      setTimeout(() => get().updateContextUsage(), 0);
    } finally {
      set({ loadingMessages: false });
    }
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
      get().addToast('Chat deleted', 'success');
    } catch (error: any) {
      set(s => ({
        chats: [deleted, ...s.chats],
        currentChat: s.currentChat ?? get().currentChat,
      }));
      get().addToast(`Error: ${error.message}`, 'error');
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
    let editedMessages: PromptPart[] | undefined;
    try {
      // ─── Prompt Inspector gate: پیش‌نمایش payload قبل از ارسال واقعی ───
      if (get().promptInspectEnabled) {
        let approved: boolean | PromptPart[] = false;
        try {
          const payload = await api.inspectChat({
            chat_id: currentChat.id,
            character_id: currentCharacter.id,
            persona_id: activePersona?.id,
            lorebook_id: activeLorebook?.id,
          });
          approved = await get().requestInspection(inspectionEntryFromPayload(payload));
        } catch (e: any) {
          get().addToast(`Error previewing prompt: ${e.message}`, 'error');
        }
        if (!approved) {
          set({ isGenerating: false });
          return; // پیام user ذخیره‌شده می‌ماند (مطابق رفتار خطای LLM)
        }
        if (Array.isArray(approved)) editedMessages = approved;
      }

      let fullContent = '';
      await api.chatWithAI(
        {
          chat_id: currentChat.id,
          character_id: currentCharacter.id,
          persona_id: activePersona?.id,
          lorebook_id: activeLorebook?.id,
          ...(editedMessages && { edited_messages: editedMessages }),
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
          get().updateContextUsage();
          if (isFirstMessage) {
            get().autoNameChat(currentChat.id);
          }
          // Check for chapter trigger suggestion
          get().checkChapterTrigger(currentChat.id);
        },
        controller.signal
      );
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        set({ isGenerating: false });
        return;
      }
      get().addToast(`Error: ${error.message}`, 'error');
      set(s => {
        if (!s.currentChat) return s;
        const msgs = [...s.currentChat.messages];
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg && lastMsg.role === 'assistant' && !lastMsg.content) {
          msgs[msgs.length - 1] = { ...lastMsg, content: `Error: ${error.message}` };
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
    // اگر پنل بازرسی باز باشد، Stop = لغو بازرسی
    if (get().promptInspection) {
      get().resolveInspection(false);
      return;
    }
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
      get().addToast(`Error: ${error.message}`, 'error');
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
      get().addToast(`Error: ${error.message}`, 'error');
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

    // ─── Prompt Inspector gate: قبل از push swipes تا لغو کاملاً تمیز باشد ───
    let editedMessages2: PromptPart[] | undefined;
    if (get().promptInspectEnabled) {
      let approved: boolean | PromptPart[] = false;
      try {
        const payload = await api.inspectChat({
          chat_id: currentChat.id,
          character_id: currentCharacter.id,
          persona_id: activePersona?.id,
          lorebook_id: activeLorebook?.id,
          update_message_id: lastAssistantMsg.id,
        });
        approved = await get().requestInspection(inspectionEntryFromPayload(payload));
      } catch (e: any) {
        get().addToast(`Error previewing prompt: ${e.message}`, 'error');
      }
      if (!approved) {
        set({ isGenerating: false });
        return;
      }
      if (Array.isArray(approved)) editedMessages2 = approved;
    }

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
          ...(editedMessages2 && { edited_messages: editedMessages2 }),
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
          get().updateContextUsage();
        }
      );
    } catch (error: any) {
      set({ isGenerating: false });
    }
  },

  // ادامه تولید — AI از آخرین پاسخ خود ادامه می‌دهد
  continueGeneration: async () => {
    if (get().pendingEdit) {
      try { await get().pendingEdit; } catch {}
    }
    const { currentChat, currentCharacter, activePersona, activeLorebook, isGenerating } = get();
    if (!currentChat || !currentCharacter || isGenerating) return;

    // پیام آخر assistant پیدا کن
    const lastAssistantMsg = [...currentChat.messages].reverse().find(m => m.role === 'assistant');
    if (!lastAssistantMsg) return;

    set({ isGenerating: true });

    // ─── Prompt Inspector gate ───
    let editedMessages3: PromptPart[] | undefined;
    if (get().promptInspectEnabled) {
      let approved: boolean | PromptPart[] = false;
      try {
        const payload = await api.inspectChat({
          chat_id: currentChat.id,
          character_id: currentCharacter.id,
          persona_id: activePersona?.id,
          lorebook_id: activeLorebook?.id,
          continue_mode: true,
        });
        approved = await get().requestInspection(inspectionEntryFromPayload(payload));
      } catch (e: any) {
        get().addToast(`Error previewing prompt: ${e.message}`, 'error');
      }
      if (!approved) {
        set({ isGenerating: false });
        return;
      }
      if (Array.isArray(approved)) editedMessages3 = approved;
    }

    const controller = new AbortController();
    currentAbortController = controller;

    try {
      let fullContent = lastAssistantMsg.content;
      await api.chatWithAI(
        {
          chat_id: currentChat.id,
          character_id: currentCharacter.id,
          persona_id: activePersona?.id,
          lorebook_id: activeLorebook?.id,
          continue_mode: true,
          ...(editedMessages3 && { edited_messages: editedMessages3 }),
        },
        (messageId) => {
          // ایجاد پیام assistant جدید برای ادامه
          const newMsg = {
            id: messageId,
            chat_id: currentChat.id,
            role: 'assistant' as const,
            content: lastAssistantMsg.content,
            swipes: [],
            swipe_id: 0,
            is_edited: false,
            is_system: false,
            send_date: new Date().toISOString(),
          };
          set(s => ({
            currentChat: s.currentChat ? {
              ...s.currentChat,
              messages: [...s.currentChat.messages, newMsg],
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
          get().updateContextUsage();
        },
        controller.signal
      );
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        set({ isGenerating: false });
        return;
      }
      set({ isGenerating: false });
    } finally {
      if (currentAbortController === controller) currentAbortController = null;
    }
  },

  // جعل هویت — AI به جای کاربر پیام می‌نویسد
  impersonateMessage: async () => {
    if (get().pendingEdit) {
      try { await get().pendingEdit; } catch {}
    }
    const { currentChat, currentCharacter, activePersona, activeLorebook, isGenerating } = get();
    if (!currentChat || !currentCharacter || isGenerating) return;

    set({ isGenerating: true });

    // ─── Prompt Inspector gate ───
    let editedMessages4: PromptPart[] | undefined;
    if (get().promptInspectEnabled) {
      let approved: boolean | PromptPart[] = false;
      try {
        const payload = await api.inspectChat({
          chat_id: currentChat.id,
          character_id: currentCharacter.id,
          persona_id: activePersona?.id,
          lorebook_id: activeLorebook?.id,
          impersonate: true,
        });
        approved = await get().requestInspection(inspectionEntryFromPayload(payload));
      } catch (e: any) {
        get().addToast(`Error previewing prompt: ${e.message}`, 'error');
      }
      if (!approved) {
        set({ isGenerating: false });
        return;
      }
      if (Array.isArray(approved)) editedMessages4 = approved;
    }

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
          impersonate: true,
          ...(editedMessages4 && { edited_messages: editedMessages4 }),
        },
        (messageId) => {
          const userMsg = {
            id: messageId,
            chat_id: currentChat.id,
            role: 'user' as const,
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
              messages: [...s.currentChat.messages, userMsg],
            } : null,
          }));
        },
        (token) => {
          fullContent += token;
          set(s => {
            if (!s.currentChat) return s;
            const msgs = [...s.currentChat.messages];
            const lastMsg = msgs[msgs.length - 1];
            if (lastMsg && lastMsg.role === 'user') {
              msgs[msgs.length - 1] = { ...lastMsg, content: fullContent };
            }
            return { currentChat: { ...s.currentChat, messages: msgs } };
          });
        },
        () => {
          set({ isGenerating: false });
          get().updateContextUsage();
        },
        controller.signal
      );
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        set({ isGenerating: false });
        return;
      }
      get().addToast(`Error: ${error.message}`, 'error');
      set({ isGenerating: false });
    } finally {
      if (controller.signal.aborted) aborted = true;
      if (currentAbortController === controller) currentAbortController = null;
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
    set({ loadingPersonas: true });
    try {
      const personas = await api.getPersonas();
      set({ personas });
    } finally {
      set({ loadingPersonas: false });
    }
  },

  createPersona: async (data) => {
    const persona = await api.createPersona(data);
    set(s => ({ personas: [persona, ...s.personas] }));
    get().addToast('Persona created', 'success');
  },

  updatePersona: async (id, data) => {
    const updated = await api.updatePersona(id, data);
    set(s => ({
      personas: s.personas.map(p => p.id === id ? updated : p),
    }));
    get().addToast('Persona saved', 'success');
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
      get().addToast('Persona deleted', 'success');
    } catch (error: any) {
      set(s => ({
        personas: [deleted, ...s.personas],
        activePersona: s.activePersona ?? deleted,
      }));
      get().addToast(`Error: ${error.message}`, 'error');
    }
  },

  setActivePersona: (persona) => {
    set({ activePersona: persona });
    try { localStorage.setItem('cozytavern.activePersonaId', persona?.id || ''); } catch {}
  },

  loadLorebooks: async () => {
    set({ loadingLorebooks: true });
    try {
      const lorebooks = await api.getLorebooks();
      set({ lorebooks });
    } finally {
      set({ loadingLorebooks: false });
    }
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
    get().addToast('Settings saved', 'success');
  },

  autoNameChat: async (chatId) => {
    try {
      // ─── Prompt Inspector gate ───
      let editedMessages5: PromptPart[] | undefined;
      if (get().promptInspectEnabled) {
        const payload = await api.inspectAutoName(chatId);
        const approved = await get().requestInspection(inspectionEntryFromPayload(payload));
        if (!approved) return; // لغو بی‌صدا — caller fire-and-forget است
        if (Array.isArray(approved)) editedMessages5 = approved;
      }
      const updated = await api.autoNameChat(chatId, editedMessages5);
      set(s => ({
        chats: s.chats.map(c => c.id === chatId ? updated : c),
        currentChat: s.currentChat?.id === chatId ? { ...s.currentChat, name: updated.name } : s.currentChat,
      }));
    } catch {}
  },

  updateContextUsage: () => {
    const { currentChat, currentCharacter, activePersona, apiSettings, activeLorebook, chapters, chapterSettings } = get();
    if (!currentChat) {
      set({ contextUsage: null });
      return;
    }
    const settings = apiSettings['openai'];
    const lorebookEntries = activeLorebook?.entries || [];
    const usage = estimateContextUsage(
      currentChat.messages,
      settings,
      currentCharacter,
      activePersona,
      lorebookEntries,
      chapters,
      chapterSettings?.raw_window
    );
    set({ contextUsage: usage });
  },

  // ─── Chapter Memory Actions ───

  loadChapters: async (chatId) => {
    try {
      const chapters = await api.getChapters(chatId);
      set({ chapters });
    } catch {
      set({ chapters: [] });
    }
  },

  createChapter: async (data) => {
    const chapter = await api.createChapter(data);
    set(s => ({ chapters: [...s.chapters, chapter].sort((a, b) => a.created_at.localeCompare(b.created_at)) }));
    get().addToast('Chapter created', 'success');
    get().updateContextUsage();
    return chapter;
  },

  updateChapter: async (id, data) => {
    const updated = await api.updateChapter(id, data);
    set(s => ({
      chapters: s.chapters.map(c => c.id === id ? updated : c),
    }));
    get().addToast('Chapter saved', 'success');
    get().updateContextUsage();
  },

  deleteChapter: async (id) => {
    const deleted = get().chapters.find(c => c.id === id);
    if (!deleted) return;
    set(s => ({ chapters: s.chapters.filter(c => c.id !== id) }));
    try {
      await api.deleteChapter(id);
      get().addToast('Chapter deleted', 'success');
      get().updateContextUsage();
    } catch (error: any) {
      set(s => ({ chapters: [...s.chapters, deleted].sort((a, b) => a.created_at.localeCompare(b.created_at)) }));
      get().addToast(`Error: ${error.message}`, 'error');
    }
  },

  regenerateChapter: async (id) => {
    try {
      // ─── Prompt Inspector gate ───
      let editedMessages6: PromptPart[] | undefined;
      if (get().promptInspectEnabled) {
        const payload = await api.inspectRegenerateChapter(id);
        const approved = await get().requestInspection(inspectionEntryFromPayload(payload));
        if (!approved) return;
        if (Array.isArray(approved)) editedMessages6 = approved;
      }
      const updated = await api.regenerateChapter(id, editedMessages6);
      set(s => ({ chapters: s.chapters.map(c => c.id === id ? updated : c) }));
      get().addToast('Summary regenerated', 'success');
      get().updateContextUsage();
    } catch (error: any) {
      get().addToast(`Error: ${error.message}`, 'error');
    }
  },

  loadChapterSettings: async () => {
    try {
      const settings = await api.getChapterSettings();
      set({ chapterSettings: settings });
    } catch {
      set({ chapterSettings: null });
    }
  },

  updateChapterSettings: async (data) => {
    try {
      const updated = await api.updateChapterSettings(data);
      set({ chapterSettings: updated });
      get().addToast('Settings saved', 'success');
    } catch (error: any) {
      get().addToast(`Error: ${error.message}`, 'error');
    }
  },

  loadLorebookPluginSettings: async () => {
    try {
      const settings = await api.getPluginSettings('lorebook_scanner');
      set({ lorebookPluginSettings: settings });
    } catch {
      set({ lorebookPluginSettings: null });
    }
  },

  updateLorebookPluginSettings: async (data) => {
    try {
      const updated = await api.updatePluginSettings('lorebook_scanner', data);
      set({ lorebookPluginSettings: updated });
      get().addToast('Settings saved', 'success');
    } catch (error: any) {
      get().addToast(`Error: ${error.message}`, 'error');
    }
  },

  checkChapterTrigger: async (chatId) => {
    const { chapterSettings } = get();
    if (!chapterSettings?.auto_detect_enabled) return;
    try {
      const result = await api.detectTrigger(chatId);
      if (result.suggested) {
        set({ chapterSuggestion: { trigger_message_id: result.trigger_message_id, trigger_phrase: result.trigger_phrase } });
      }
    } catch {}
  },

  dismissChapterSuggestion: () => set({ chapterSuggestion: null }),

  // علامت‌گذاری مرز فصل روی یک پیام — کلیک دوباره روی همان مرز آن را برمی‌دارد
  markChapterBoundary: (kind, messageId) => {
    const key = kind === 'start' ? 'chapterStartId' : 'chapterEndId';
    const otherKey = kind === 'start' ? 'chapterEndId' : 'chapterStartId';
    const patch: any = { [key]: get()[key] === messageId ? null : messageId };
    // اگر انتخاب جدید با مرز دیگر ترتیب معکوس داشت، مرز دیگر پاک شود
    const { currentChat } = get();
    const thisId = patch[key];
    const otherId = get()[otherKey];
    if (thisId && otherId && currentChat) {
      const idx = (id: string) => currentChat.messages.findIndex(m => m.id === id);
      const i1 = idx(thisId), i2 = idx(otherId);
      if (i1 !== -1 && i2 !== -1 && i1 > i2) {
        patch[otherKey] = null;
      }
    }
    set(patch);
  },

  clearChapterSelection: () => set({ chapterStartId: null, chapterEndId: null }),

  createChapterFromSelection: async () => {
    const { currentChat, chapterSettings, chapterStartId, chapterEndId } = get();
    if (!currentChat || !chapterStartId || !chapterEndId) return;
    const rawWindow = chapterSettings?.raw_window || 10;
    const messages = currentChat.messages;
    const endIdx = messages.findIndex(m => m.id === chapterEndId);
    if (endIdx !== -1 && messages.length - endIdx - 1 < rawWindow) {
      get().addToast(`Chapter must end at least ${rawWindow} messages before the last message`, 'error');
      return;
    }
    try {
      // ─── Prompt Inspector gate: قبل از createChapter تا لغو، فصل نسازد ───
      let editedMessages7: PromptPart[] | undefined;
      if (get().promptInspectEnabled) {
        const payload = await api.inspectCreateChapter({
          chat_id: currentChat.id,
          start_message_id: chapterStartId,
          end_message_id: chapterEndId,
        });
        const approved = await get().requestInspection(inspectionEntryFromPayload(payload));
        if (!approved) {
          set({ chapterStartId: null, chapterEndId: null });
          get().addToast('Chapter creation cancelled', 'info');
          return;
        }
        if (Array.isArray(approved)) editedMessages7 = approved;
      }
      await get().createChapter({
        chat_id: currentChat.id,
        start_message_id: chapterStartId,
        end_message_id: chapterEndId,
        ...(editedMessages7 && { edited_messages: editedMessages7 }),
      });
      set({ chapterStartId: null, chapterEndId: null });
    } catch {}
  },

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setCharacterEditorOpen: (open, character = null) => set({ characterEditorOpen: open, editingCharacter: character }),
  setLorebookEditorOpen: (open) => set({ lorebookEditorOpen: open }),
  setPersonaEditorOpen: (open, persona = null) => set({ personaEditorOpen: open, editingPersona: persona }),
  setIsGenerating: (generating) => set({ isGenerating: generating }),
}));
