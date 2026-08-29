import { create } from 'zustand';
import { Character, Chat, Message, Persona, Lorebook, ApiSettings, Chapter, ChapterSettings, LorebookPluginSettings, PromptInspection, PromptInspectionPayload, PromptPart, QuickReplySettings, SearchResult, ChatParticipant, ChapterPreviewData, ChapterSummaryResult, StoryState } from '../types';
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

  // Chapter Creation Flow (preview → summarize → review → save)
  chapterFlowEndId: string | null;
  chapterFlowStartId: string | null;
  chapterFlowPreviewOpen: boolean;
  chapterFlowPreviewData: ChapterPreviewData | null;
  chapterFlowIsGenerating: boolean;
  chapterFlowReviewOpen: boolean;
  chapterFlowSummary: string;
  chapterFlowSummaryMetadata: { model: string; time: number; tokens: number } | null;
  chapterFlowCreatedChapterId: string | null;
  // Actions
  startChapterCreation: (endMessageId: string) => Promise<void>;
  cancelChapterCreation: () => void;
  sendChapterForSummary: () => Promise<void>;
  updateChapterFlowSummary: (summary: string) => void;
  regenerateChapterFlowSummary: () => Promise<void>;
  saveChapterFromFlow: () => Promise<void>;

  // Plugins (تنظیمات پلاگین لوربوک)
  lorebookPluginSettings: LorebookPluginSettings | null;

  // Quick Replies
  quickReplySettings: QuickReplySettings | null;

  // Story State (حافظه وضعیت داستان)
  storyState: StoryState | null;
  loadingStoryState: boolean;
  storyStateOpen: boolean;
  loadStoryState: (chatId: string) => Promise<void>;
  updateStoryState: (chatId: string, delta: Partial<StoryState>) => Promise<void>;
  setStoryStateOpen: (open: boolean) => void;
  _initStoryStateListener: () => void;

  // Group Chat
  groupChatParticipants: ChatParticipant[];
  groupChatGenerating: boolean;
  selectedCharacterForResponse: string | null;
  setSelectedCharacterForResponse: (charId: string | null) => void;
  addParticipant: (chatId: string, characterId: string) => Promise<void>;
  removeParticipant: (chatId: string, participantId: string) => Promise<void>;
  toggleParticipant: (chatId: string, participantId: string, isActive: boolean) => Promise<void>;
  generateGroupResponse: (chatId: string, characterId: string) => Promise<void>;
  createGroupChat: (data: { name?: string; character_ids: string[]; lorebook_id?: string }) => Promise<Chat>;
  addCharacterToChat: (chatId: string, characterId: string) => Promise<void>;

  // Loading States
  loadingCharacters: boolean;
  loadingChats: boolean;
  loadingMessages: boolean;
  loadingPersonas: boolean;
  loadingLorebooks: boolean;

  // Search
  searchQuery: string;
  searchResults: SearchResult[];
  searchTotal: number;
  searchLoading: boolean;
  searchOpen: boolean;
  setSearchQuery: (query: string) => void;
  setSearchOpen: (open: boolean) => void;
  searchMessages: (query: string, opts?: { chat_id?: string; role?: string }) => Promise<void>;
  loadMoreSearchResults: () => Promise<void>;
  scrollToMessage: (messageId: string) => void;

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
  // Quick Replies
  loadQuickReplies: () => Promise<void>;
  updateQuickReplies: (data: Partial<QuickReplySettings>) => Promise<void>;
  // Import/Export
  importCharacterFromFile: (file: File) => Promise<void>;
  importChatFile: (characterId: string, file: File) => Promise<void>;
  exportCharacter: (id: string, format: 'json' | 'png') => Promise<void>;
  exportChatAction: (chatId: string, chatName: string) => Promise<void>;
  exportBackup: () => Promise<void>;
  restoreBackupFile: (file: File) => Promise<void>;
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

  // Chapter Creation Flow
  chapterFlowEndId: null,
  chapterFlowStartId: null,
  chapterFlowPreviewOpen: false,
  chapterFlowPreviewData: null,
  chapterFlowIsGenerating: false,
  chapterFlowReviewOpen: false,
  chapterFlowSummary: '',
  chapterFlowSummaryMetadata: null,
  chapterFlowCreatedChapterId: null,

  // Plugins
  lorebookPluginSettings: null,
  quickReplySettings: null,

  // Story State (حافظه وضعیت داستان)
  storyState: null,
  loadingStoryState: false,
  storyStateOpen: false,
  loadStoryState: async (chatId) => {
    set({ loadingStoryState: true });
    try {
      const state = await api.getStoryState(chatId);
      set({ storyState: state });
    } finally {
      set({ loadingStoryState: false });
    }
  },
  updateStoryState: async (chatId, delta) => {
    try {
      const updated = await api.updateStoryState(chatId, delta);
      set({ storyState: updated });
    } catch (error: any) {
      get().addToast(`Failed to update state: ${error.message}`, 'error');
    }
  },
  setStoryStateOpen: (open) => set({ storyStateOpen: open }),
  // Listen for story state updates from SSE
  _initStoryStateListener: () => {
    window.addEventListener('story-state-updated', ((e: CustomEvent) => {
      const { currentChat } = get();
      if (currentChat) {
        // Reload state from server
        get().loadStoryState(currentChat.id);
      }
    }) as EventListener);
  },

  // Group Chat state
  groupChatParticipants: [],
  groupChatGenerating: false,
  selectedCharacterForResponse: null,
  setSelectedCharacterForResponse: (charId) => set({ selectedCharacterForResponse: charId }),
  addParticipant: async (chatId, characterId) => {
    try {
      const participant = await api.addParticipant(chatId, characterId);
      set(s => ({ groupChatParticipants: [...s.groupChatParticipants, participant] }));
      get().addToast('Character added to group', 'success');
    } catch (error: any) {
      get().addToast(`Error: ${error.message}`, 'error');
    }
  },
  removeParticipant: async (chatId, participantId) => {
    try {
      await api.removeParticipant(chatId, participantId);
      set(s => ({ groupChatParticipants: s.groupChatParticipants.filter(p => p.id !== participantId) }));
      get().addToast('Character removed from group', 'success');
    } catch (error: any) {
      get().addToast(`Error: ${error.message}`, 'error');
    }
  },
  toggleParticipant: async (chatId, participantId, isActive) => {
    try {
      const updated = await api.toggleParticipant(chatId, participantId, isActive);
      set(s => ({
        groupChatParticipants: s.groupChatParticipants.map(p =>
          p.id === participantId ? { ...p, is_active: isActive } : p
        ),
      }));
    } catch (error: any) {
      get().addToast(`Error: ${error.message}`, 'error');
    }
  },
  addCharacterToChat: async (chatId, characterId) => {
    try {
      const result = await api.addCharacterToChat(chatId, characterId, true);

      // Update current chat if it's the same one
      const { currentChat } = get();
      if (currentChat && currentChat.id === chatId) {
        // Update chat to group chat
        set({
          currentChat: {
            ...currentChat,
            is_group_chat: 1,
            group_chat_name: currentChat.name,
          },
          groupChatParticipants: result.participants || [],
        });

        // Add system message to messages
        if (result.participants) {
          const newChar = result.participants.find((p: any) => p.character_id === characterId);
          if (newChar) {
            const systemMsg = {
              id: crypto.randomUUID(),
              chat_id: chatId,
              role: 'system' as const,
              content: `*${newChar.display_name} has entered the chat.*`,
              swipes: [],
              swipe_id: 0,
              is_edited: false,
              is_system: true,
              send_date: new Date().toISOString(),
              sender_name: '',
              sender_avatar: '',
              sender_character_id: '',
            };
            set(s => ({
              currentChat: {
                ...s.currentChat!,
                messages: [...s.currentChat!.messages, systemMsg],
              },
            }));
          }
        }
      }

      get().addToast('Character added to chat', 'success');
    } catch (error: any) {
      get().addToast(`Error: ${error.message}`, 'error');
    }
  },
  generateGroupResponse: async (chatId, characterId) => {
    const { activePersona, activeLorebook, isGenerating } = get();
    if (isGenerating) return;

    set({ isGenerating: true, groupChatGenerating: true });

    const controller = new AbortController();
    currentAbortController = controller;

    try {
      let fullContent = '';
      await api.generateGroupChatResponseStream(
        chatId,
        {
          character_id: characterId,
          persona_id: activePersona?.id,
          lorebook_id: activeLorebook?.id,
        },
        (messageId) => {
          // Get the character info for the sender
          const participant = get().groupChatParticipants.find(p => p.character_id === characterId);
          const char = get().characters.find(c => c.id === characterId);
          const assistantMsg = {
            id: messageId,
            chat_id: chatId,
            role: 'assistant' as const,
            content: '',
            swipes: [],
            swipe_id: 0,
            is_edited: false,
            is_system: false,
            send_date: new Date().toISOString(),
            sender_name: char?.name || participant?.display_name || '',
            sender_avatar: char?.avatar || participant?.display_avatar || '',
            sender_character_id: characterId,
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
            if (lastMsg && lastMsg.role === 'assistant' && lastMsg.sender_character_id === characterId) {
              msgs[msgs.length - 1] = { ...lastMsg, content: fullContent };
            }
            return { currentChat: { ...s.currentChat, messages: msgs } };
          });
        },
        () => {
          set({ isGenerating: false, groupChatGenerating: false });
          get().updateContextUsage();
        },
        controller.signal
      );
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        set({ isGenerating: false, groupChatGenerating: false });
        return;
      }
      get().addToast(`Error: ${error.message}`, 'error');
      set({ isGenerating: false, groupChatGenerating: false });
    } finally {
      if (currentAbortController === controller) currentAbortController = null;
    }
  },
  createGroupChat: async (data) => {
    const result = await api.createGroupChat(data);
    const chat = { ...result, messages: [] } as Chat & { messages: Message[] };
    set(s => ({
      chats: [chat, ...s.chats],
      currentChat: chat,
      groupChatParticipants: result.participants || [],
    }));
    get().addToast('Group chat created', 'success');
    return chat;
  },

  // Loading states (از true شروع می‌شه چون لود اولیه دیتا در mount انجام می‌شه)
  loadingCharacters: true,
  loadingChats: false,
  loadingMessages: false,
  loadingPersonas: true,
  loadingLorebooks: true,

  // Search state
  searchQuery: '',
  searchResults: [],
  searchTotal: 0,
  searchLoading: false,
  searchOpen: false,
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSearchOpen: (open) => set({ searchOpen: open }),
  searchMessages: async (query, opts) => {
    if (!query.trim()) {
      set({ searchResults: [], searchTotal: 0 });
      return;
    }
    set({ searchLoading: true });
    try {
      const result = await api.searchMessages({ q: query, ...opts });
      set({ searchResults: result.results, searchTotal: result.total, searchQuery: query, searchOpen: true });
    } catch (error: any) {
      useStore.getState().addToast(`Search error: ${error.message}`, 'error');
      set({ searchResults: [], searchTotal: 0 });
    } finally {
      set({ searchLoading: false });
    }
  },
  loadMoreSearchResults: async () => {
    const { searchQuery, searchResults, searchTotal } = useStore.getState();
    if (searchResults.length >= searchTotal || !searchQuery.trim()) return;
    set({ searchLoading: true });
    try {
      const result = await api.searchMessages({ q: searchQuery, offset: searchResults.length });
      set({ searchResults: [...searchResults, ...result.results] });
    } catch {} finally {
      set({ searchLoading: false });
    }
  },
  scrollToMessage: (messageId) => {
    const el = document.querySelector(`[data-message-id="${messageId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('highlight-flash');
      setTimeout(() => el.classList.remove('highlight-flash'), 2000);
    }
  },

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
      // لود وضعیت داستان
      get().loadStoryState(chatId);
      // لود participant های گروه چت
      if (chat.is_group_chat) {
        try {
          const groupChat = await api.getGroupChat(chatId);
          set({ groupChatParticipants: groupChat.participants || [] });
        } catch {
          set({ groupChatParticipants: [] });
        }
      } else {
        set({ groupChatParticipants: [] });
      }
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

    const isFirstMessage = !currentChat.messages.some(m => m.role === 'user');

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
      // سرور محتوای فعلی رو به swipes اضافه می‌کنه و پیام آپدیت شده رو برمی‌گردونه
      const regenerated = await api.regenerateMessage(currentChat.id);

      // بلافاصله swipes و swipe_id رو در store آپدیت کن
      if (regenerated) {
        set(s => {
          if (!s.currentChat) return s;
          const msgs = s.currentChat.messages.map(m =>
            m.id === lastAssistantMsg.id ? { ...m, swipes: regenerated.swipes, swipe_id: regenerated.swipe_id } : m
          );
          return { currentChat: { ...s.currentChat, messages: msgs } };
        });
      }

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
      chapterSettings ? {
        raw_mode: chapterSettings.raw_mode || 'count',
        raw_window: chapterSettings.raw_window || 10,
        raw_token_budget: chapterSettings.raw_token_budget || 3000,
        raw_min_messages: chapterSettings.raw_min_messages || 3,
        raw_max_messages: chapterSettings.raw_max_messages || 20,
      } : undefined,
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

  // ─── Quick Replies ───

  loadQuickReplies: async () => {
    try {
      const settings = await api.getQuickReplies();
      set({ quickReplySettings: settings });
    } catch {
      set({ quickReplySettings: null });
    }
  },

  updateQuickReplies: async (data) => {
    try {
      const updated = await api.updateQuickReplies(data);
      set({ quickReplySettings: updated });
      get().addToast('Quick replies saved', 'success');
    } catch (error: any) {
      get().addToast(`Error: ${error.message}`, 'error');
    }
  },

  // ─── Import/Export ───

  importCharacterFromFile: async (file) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(',')[1];
        if (!base64) throw new Error('Could not read file');
        const result = await api.importCharacterFromBase64(base64);
        await get().loadCharacters();
        get().addToast(`Imported "${result.name}"`, 'success');
      } catch (error: any) {
        get().addToast(`Import error: ${error.message}`, 'error');
      }
    };
    reader.readAsDataURL(file);
  },

  importChatFile: async (characterId, file) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (data.format !== 'cozytavern-chat') throw new Error('Not a CozyTavern chat file');
        const result = await api.importChat(characterId, data);
        get().addToast(`Imported "${result.name}" (${result.imported_messages} messages)`, 'success');
        if (get().currentCharacter?.id === characterId) {
          await get().loadChats(characterId);
        }
      } catch (error: any) {
        get().addToast(`Import error: ${error.message}`, 'error');
      }
    };
    reader.readAsText(file);
  },

  exportCharacter: async (id, format) => {
    try {
      if (format === 'png') {
        await api.exportCharacterPng(id);
      } else {
        await api.exportCharacterJson(id);
      }
      get().addToast(`Character exported as ${format.toUpperCase()}`, 'success');
    } catch (error: any) {
      get().addToast(`Export error: ${error.message}`, 'error');
    }
  },

  exportChatAction: async (chatId, chatName) => {
    try {
      await api.exportChat(chatId, chatName);
      get().addToast('Chat exported', 'success');
    } catch (error: any) {
      get().addToast(`Export error: ${error.message}`, 'error');
    }
  },

  exportBackup: async () => {
    try {
      await api.exportBackup();
      get().addToast('Backup downloaded', 'success');
    } catch (error: any) {
      get().addToast(`Backup error: ${error.message}`, 'error');
    }
  },

  restoreBackupFile: async (file) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (data.format !== 'cozytavern-backup') throw new Error('Not a CozyTavern backup file');
        const ok = await get().showConfirm('This will REPLACE ALL data (characters, chats, settings). Continue?');
        if (!ok) return;
        await api.restoreBackup(data);
        // Reload everything
        await Promise.all([
          get().loadCharacters(),
          get().loadPersonas(),
          get().loadLorebooks(),
          get().loadApiSettings(),
        ]);
        get().addToast('Backup restored successfully', 'success');
      } catch (error: any) {
        get().addToast(`Restore error: ${error.message}`, 'error');
      }
    };
    reader.readAsText(file);
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

  // ─── Chapter Creation Flow ───

  startChapterCreation: async (endMessageId) => {
    const { currentChat, chapters } = get();
    if (!currentChat) return;

    const messages = currentChat.messages;
    const endIdx = messages.findIndex(m => m.id === endMessageId);
    if (endIdx === -1) return;

    // Calculate start message: first message or after last chapter
    let startMessageId: string;
    if (chapters.length === 0) {
      startMessageId = messages[0].id;
    } else {
      // Find the last chapter that ends before this message
      let lastChapterEndIdx = -1;
      for (const chapter of chapters) {
        const chapterEndIdx = messages.findIndex(m => m.id === chapter.end_message_id);
        if (chapterEndIdx !== -1 && chapterEndIdx < endIdx) {
          lastChapterEndIdx = Math.max(lastChapterEndIdx, chapterEndIdx);
        }
      }
      if (lastChapterEndIdx === -1) {
        startMessageId = messages[0].id;
      } else {
        startMessageId = messages[lastChapterEndIdx + 1].id;
      }
    }

    // Validate raw window
    const { chapterSettings } = get();
    const rawWindow = chapterSettings?.raw_window || 10;
    if (messages.length - endIdx - 1 < rawWindow) {
      get().addToast(`Chapter must end at least ${rawWindow} messages before the last message`, 'error');
      return;
    }

    // Set flow state and open preview
    set({
      chapterFlowStartId: startMessageId,
      chapterFlowEndId: endMessageId,
      chapterFlowPreviewOpen: true,
      chapterFlowPreviewData: null,
    });

    // Fetch preview data
    try {
      const previewData = await api.previewChapter({
        chat_id: currentChat.id,
        start_message_id: startMessageId,
        end_message_id: endMessageId,
      });
      set({ chapterFlowPreviewData: previewData });
    } catch (error: any) {
      get().addToast(`Error loading preview: ${error.message}`, 'error');
      set({ chapterFlowPreviewOpen: false, chapterFlowStartId: null, chapterFlowEndId: null });
    }
  },

  cancelChapterCreation: () => {
    set({
      chapterFlowEndId: null,
      chapterFlowStartId: null,
      chapterFlowPreviewOpen: false,
      chapterFlowPreviewData: null,
      chapterFlowIsGenerating: false,
      chapterFlowReviewOpen: false,
      chapterFlowSummary: '',
      chapterFlowSummaryMetadata: null,
      chapterFlowCreatedChapterId: null,
    });
  },

  sendChapterForSummary: async () => {
    const { currentChat, chapterFlowStartId, chapterFlowEndId } = get();
    if (!currentChat || !chapterFlowStartId || !chapterFlowEndId) return;

    // Create chapter without summary first
    set({ chapterFlowIsGenerating: true, chapterFlowPreviewOpen: false });

    try {
      const chapter = await api.createChapter({
        chat_id: currentChat.id,
        start_message_id: chapterFlowStartId,
        end_message_id: chapterFlowEndId,
        auto_summarize: false,
      });

      // Generate summary
      const result = await api.summarizeChapter(chapter.id);

      // Show review modal
      set({
        chapterFlowCreatedChapterId: chapter.id,
        chapterFlowIsGenerating: false,
        chapterFlowReviewOpen: true,
        chapterFlowSummary: result.summary,
        chapterFlowSummaryMetadata: {
          model: result.model,
          time: result.generation_time,
          tokens: result.generation_tokens,
        },
      });

      // Reload chapters
      get().loadChapters(currentChat.id);
    } catch (error: any) {
      get().addToast(`Error generating summary: ${error.message}`, 'error');
      set({
        chapterFlowIsGenerating: false,
        chapterFlowReviewOpen: false,
        chapterFlowEndId: null,
        chapterFlowStartId: null,
      });
    }
  },

  updateChapterFlowSummary: (summary) => {
    set({ chapterFlowSummary: summary });
  },

  regenerateChapterFlowSummary: async () => {
    const { chapterFlowCreatedChapterId } = get();
    if (!chapterFlowCreatedChapterId) return;

    set({ chapterFlowIsGenerating: true });

    try {
      const result = await api.summarizeChapter(chapterFlowCreatedChapterId);
      set({
        chapterFlowIsGenerating: false,
        chapterFlowSummary: result.summary,
        chapterFlowSummaryMetadata: {
          model: result.model,
          time: result.generation_time,
          tokens: result.generation_tokens,
        },
      });
    } catch (error: any) {
      get().addToast(`Error regenerating summary: ${error.message}`, 'error');
      set({ chapterFlowIsGenerating: false });
    }
  },

  saveChapterFromFlow: async () => {
    const { currentChat, chapterFlowCreatedChapterId, chapterFlowSummary } = get();
    if (!currentChat || !chapterFlowCreatedChapterId) return;

    try {
      await api.updateChapter(chapterFlowCreatedChapterId, { summary: chapterFlowSummary });
      get().addToast('Chapter saved', 'success');
      get().loadChapters(currentChat.id);
    } catch (error: any) {
      get().addToast(`Error saving chapter: ${error.message}`, 'error');
    }

    // Reset flow state
    set({
      chapterFlowEndId: null,
      chapterFlowStartId: null,
      chapterFlowPreviewOpen: false,
      chapterFlowPreviewData: null,
      chapterFlowIsGenerating: false,
      chapterFlowReviewOpen: false,
      chapterFlowSummary: '',
      chapterFlowSummaryMetadata: null,
      chapterFlowCreatedChapterId: null,
    });
  },

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setCharacterEditorOpen: (open, character = null) => set({ characterEditorOpen: open, editingCharacter: character }),
  setLorebookEditorOpen: (open) => set({ lorebookEditorOpen: open }),
  setPersonaEditorOpen: (open, persona = null) => set({ personaEditorOpen: open, editingPersona: persona }),
  setIsGenerating: (generating) => set({ isGenerating: generating }),
}));
