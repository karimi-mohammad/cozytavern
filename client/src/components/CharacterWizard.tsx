import { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '../store/state';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { isRTL } from '../utils/textDirection';

interface WizardMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface WizardConversation {
  id: string;
  title: string;
  has_character: boolean;
  created_at: string;
  updated_at: string;
}

interface GeneratedCharacter {
  name: string;
  nickname: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  system_prompt: string;
  post_history_instructions: string;
  alternate_greetings: string[];
  group_only_greetings: string[];
  creator_notes: string;
  tags: string[];
  creator: string;
  character_version: string;
}

interface ChatHistoryContext {
  chat: {
    id: string;
    name: string;
    is_group_chat: boolean;
  };
  participants: Array<{
    char_name: string;
    char_desc?: string;
    char_personality?: string;
    display_name?: string;
  }>;
  messages: string[];
  total_messages: number;
}

// Parse the WIZARD_READY marker + JSON from assistant response
function extractCharacterFromResponse(text: string): GeneratedCharacter | null {
  const marker = 'WIZARD_READY';
  const markerIdx = text.indexOf(marker);
  if (markerIdx === -1) return null;

  const afterMarker = text.slice(markerIdx + marker.length);

  // Try to find JSON code block
  const codeBlockMatch = afterMarker.match(/```json\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    try { return JSON.parse(codeBlockMatch[1]); } catch {}
  }

  // Try to find raw JSON with balanced braces
  const jsonStart = afterMarker.indexOf('{');
  if (jsonStart !== -1) {
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = jsonStart; i < afterMarker.length; i++) {
      const ch = afterMarker[i];
      if (escape) { escape = false; continue; }
      if (ch === '\\' && inString) { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          try { return JSON.parse(afterMarker.slice(jsonStart, i + 1)); } catch {}
        }
      }
    }
  }
  return null;
}

// Clean the display text (remove WIZARD_READY and JSON block)
function cleanDisplayText(text: string): string {
  const marker = 'WIZARD_READY';
  const markerIdx = text.indexOf(marker);
  if (markerIdx === -1) return text;

  let result = text.slice(0, markerIdx).trimEnd();
  const afterMarker = text.slice(markerIdx + marker.length);
  const codeBlockMatch = afterMarker.match(/```json\s*[\s\S]*?\s*```/);
  if (codeBlockMatch) {
    result = result.trimEnd();
  }
  return result;
}

// API helpers for wizard conversations
const wizardApi = {
  listConversations: async (): Promise<WizardConversation[]> => {
    const res = await fetch('/api/character-wizard/conversations');
    if (!res.ok) throw new Error('Failed to load conversations');
    return res.json();
  },
  getConversation: async (id: string) => {
    const res = await fetch(`/api/character-wizard/conversations/${id}`);
    if (!res.ok) throw new Error('Failed to load conversation');
    return res.json();
  },
  createConversation: async () => {
    const res = await fetch('/api/character-wizard/conversations', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to create conversation');
    return res.json();
  },
  deleteConversation: async (id: string) => {
    const res = await fetch(`/api/character-wizard/conversations/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete conversation');
    return res.json();
  },
};

// Stream a fetch request and update messages state
async function streamChat(
  messages: WizardMessage[],
  conversationId: string | null,
  editCharacterId: string | null,
  onToken: (token: string) => void,
  onDone: (fullContent: string) => void,
  chatHistoryContext?: ChatHistoryContext | null,
): Promise<void> {
  const res = await fetch('/api/character-wizard/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      conversation_id: conversationId,
      edit_character_id: editCharacterId,
      chat_history_context: chatHistoryContext || null,
    }),
  });

  if (!res.ok) throw new Error('Failed to get response');

  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';

  if (reader) {
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
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.token) {
              fullContent += parsed.token;
              onToken(fullContent);
            }
          } catch {}
        }
      }
    }
  }

  onDone(fullContent);
}

export default function CharacterWizard() {
  const {
    characterWizardOpen, setCharacterWizardOpen, addToast,
    createCharacter, setCharacterEditorOpen, characters, chats,
  } = useStore();

  const [conversations, setConversations] = useState<WizardConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WizardMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingPhase, setGeneratingPhase] = useState<'idle' | 'thinking' | 'writing'>('idle');
  const [generatedCharacter, setGeneratedCharacter] = useState<GeneratedCharacter | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [editCharId, setEditCharId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Chat history context for "From Chat" mode
  const [chatHistoryContext, setChatHistoryContext] = useState<ChatHistoryContext | null>(null);
  const [showChatSelector, setShowChatSelector] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [isLoadingChatHistory, setIsLoadingChatHistory] = useState(false);

  // Update messages in last assistant slot
  const updateLastAssistant = useCallback((fullContent: string) => {
    setMessages(prev => {
      const updated = [...prev];
      updated[updated.length - 1] = { role: 'assistant', content: fullContent };
      return updated;
    });
  }, []);

  // Load conversation
  const loadConversation = useCallback(async (id: string) => {
    try {
      const conv = await wizardApi.getConversation(id);
      setMessages(conv.messages || []);
      setGeneratedCharacter(conv.generated_character || null);
      setActiveConvId(id);
      setShowHistory(false);
      setEditCharId(null);
    } catch {
      addToast('Failed to load conversation', 'error');
    }
  }, [addToast]);

  // Load chat history for "From Chat" mode
  const loadChatHistory = async (chatId: string) => {
    setIsLoadingChatHistory(true);
    try {
      const res = await fetch(`/api/character-wizard/chat-history/${chatId}`);
      if (!res.ok) throw new Error('Failed to load chat history');
      const data = await res.json();
      setChatHistoryContext(data);
      setShowChatSelector(false);
      setChatSearchQuery('');

      // Start conversation with context
      await startNewConversationWithContext(data);
    } catch (error) {
      addToast('Failed to load chat history', 'error');
    } finally {
      setIsLoadingChatHistory(false);
    }
  };

  // Start new conversation with chat history context
  const startNewConversationWithContext = async (context: ChatHistoryContext) => {
    try {
      const conv = await wizardApi.createConversation();
      setMessages([]);
      setGeneratedCharacter(null);
      setActiveConvId(conv.id);
      setEditCharId(null);
      setShowHistory(false);

      const participantNames = context.participants.map(p => p.char_name).join(', ');
      const userMsg: WizardMessage = {
        role: 'user',
        content: `I want to create a new character for this chat/story. The existing characters are: ${participantNames}. Based on the chat history, I'd like to add a new character that fits naturally into this story.`
      };
      setMessages([userMsg, { role: 'assistant', content: '' }]);
      setIsGenerating(true);
      setGeneratingPhase('thinking');

      try {
        await streamChat([userMsg], conv.id, null, (token) => {
          setGeneratingPhase('writing');
          updateLastAssistant(token);
        }, (fullContent) => {
          const char = extractCharacterFromResponse(fullContent);
          if (char) {
            setGeneratedCharacter(char);
          } else if (fullContent.includes('WIZARD_READY')) {
            addToast('Character generated but JSON is incomplete. Try again or describe more details.', 'error');
          }
        }, context);
      } catch {}

      setIsGenerating(false);
      setGeneratingPhase('idle');
      wizardApi.listConversations().then(setConversations).catch(() => {});
    } catch {
      addToast('Failed to start conversation', 'error');
      setIsGenerating(false);
    }
  };

  // Start new conversation
  const startNewConversation = async () => {
    try {
      const conv = await wizardApi.createConversation();
      setMessages([]);
      setGeneratedCharacter(null);
      setActiveConvId(conv.id);
      setEditCharId(null);
      setShowHistory(false);
      setChatHistoryContext(null);

      const userMsg: WizardMessage = { role: 'user', content: 'Hi! I want to create a new character.' };
      setMessages([userMsg, { role: 'assistant', content: '' }]);
      setIsGenerating(true);
      setGeneratingPhase('thinking');

      try {
        await streamChat([userMsg], conv.id, null, (token) => {
          setGeneratingPhase('writing');
          updateLastAssistant(token);
        }, (fullContent) => {
          const char = extractCharacterFromResponse(fullContent);
          if (char) {
            setGeneratedCharacter(char);
          } else if (fullContent.includes('WIZARD_READY')) {
            addToast('Character generated but JSON is incomplete. Try again or describe more details.', 'error');
          }
        });
      } catch {}

      setIsGenerating(false);
      setGeneratingPhase('idle');
      wizardApi.listConversations().then(setConversations).catch(() => {});
    } catch {
      addToast('Failed to start conversation', 'error');
      setIsGenerating(false);
    }
  };

  // Start editing an existing character
  const startEditCharacter = async (charId: string) => {
    const char = characters.find(c => c.id === charId);
    if (!char) return;

    try {
      const conv = await wizardApi.createConversation();
      setMessages([]);
      setGeneratedCharacter(null);
      setActiveConvId(conv.id);
      setEditCharId(charId);
      setShowHistory(false);

      const userMsg: WizardMessage = { role: 'user', content: `I want to edit my character "${char.name}". What can I change?` };
      setMessages([userMsg, { role: 'assistant', content: '' }]);
      setIsGenerating(true);
      setGeneratingPhase('thinking');

      try {
        await streamChat([userMsg], conv.id, charId, (token) => {
          setGeneratingPhase('writing');
          updateLastAssistant(token);
        }, (fullContent) => {
          const charData = extractCharacterFromResponse(fullContent);
          if (charData) {
            setGeneratedCharacter(charData);
          } else if (fullContent.includes('WIZARD_READY')) {
            addToast('Character generated but JSON is incomplete. Try again or describe more details.', 'error');
          }
        });
      } catch {}

      setIsGenerating(false);
      setGeneratingPhase('idle');
      wizardApi.listConversations().then(setConversations).catch(() => {});
    } catch {
      addToast('Failed to start editing', 'error');
      setIsGenerating(false);
    }
  };

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, generatedCharacter]);

  // Focus input when opened
  useEffect(() => {
    if (characterWizardOpen && inputRef.current) inputRef.current.focus();
  }, [characterWizardOpen]);

  // Load conversations list when opened
  useEffect(() => {
    if (characterWizardOpen) {
      wizardApi.listConversations().then(setConversations).catch(() => {});

      // Check if there's a chat context from GroupChatManager
      const pendingChatId = localStorage.getItem('cozytavern.wizardChatContext');
      if (pendingChatId) {
        localStorage.removeItem('cozytavern.wizardChatContext');
        // Auto-load this chat's history
        loadChatHistory(pendingChatId);
      }
    }
  }, [characterWizardOpen]);

  // Send message
  const sendMessage = async () => {
    if (!inputValue.trim() || isGenerating) return;

    const userMsg: WizardMessage = { role: 'user', content: inputValue.trim() };
    const newMessages = [...messages, userMsg];
    setMessages([...newMessages, { role: 'assistant', content: '' }]);
    setInputValue('');
    setIsGenerating(true);
    setGeneratingPhase('thinking');

    try {
      await streamChat(newMessages, activeConvId, editCharId, (token) => {
        setGeneratingPhase('writing');
        updateLastAssistant(token);
      }, (fullContent) => {
        const char = extractCharacterFromResponse(fullContent);
        if (char) {
          setGeneratedCharacter(char);
        } else if (fullContent.includes('WIZARD_READY')) {
          addToast('Character generated but JSON is incomplete. Try again or describe more details.', 'error');
        }
      }, chatHistoryContext);
    } catch {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: 'Error: Failed to get response. Please try again.' };
        return updated;
      });
    } finally {
      setIsGenerating(false);
      setGeneratingPhase('idle');
      wizardApi.listConversations().then(setConversations).catch(() => {});
    }
  };

  // Accept character
  const acceptCharacter = async () => {
    if (!generatedCharacter) return;
    try {
      if (editCharId) {
        await useStore.getState().updateCharacter(editCharId, generatedCharacter);
        addToast('Character updated!', 'success');
      } else {
        await createCharacter(generatedCharacter);
      }
      setCharacterWizardOpen(false);
      resetWizard();
    } catch (error: any) {
      addToast(`Error: ${error.message}`, 'error');
    }
  };

  const editCharacter = () => {
    if (!generatedCharacter) return;
    setCharacterWizardOpen(false);
    resetWizard();
    setCharacterEditorOpen(true, {
      id: editCharId || '',
      ...generatedCharacter,
      avatar: '',
      lorebook_id: '',
      created_at: '',
      updated_at: '',
    } as any);
  };

  const resetWizard = () => {
    setMessages([]);
    setGeneratedCharacter(null);
    setInputValue('');
    setIsGenerating(false);
    setGeneratingPhase('idle');
    setActiveConvId(null);
    setEditCharId(null);
    setChatHistoryContext(null);
    setShowChatSelector(false);
    setChatSearchQuery('');
  };

  const handleClose = () => {
    setCharacterWizardOpen(false);
    resetWizard();
    setShowHistory(false);
  };

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await wizardApi.deleteConversation(id);
      setConversations(prev => prev.filter(c => c.id !== id));
      if (activeConvId === id) resetWizard();
      addToast('Conversation deleted', 'success');
    } catch {
      addToast('Failed to delete', 'error');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!characterWizardOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex flex-col w-full max-w-2xl h-[85vh] rounded-xl shadow-2xl overflow-hidden"
        style={{ backgroundColor: '#1e2030', border: '1px solid #2a2d3e' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#2a2d3e', backgroundColor: '#1e2030' }}>
          <div className="flex items-center gap-2">
            <span className="text-xl">✨</span>
            <h2 className="text-lg font-semibold" style={{ color: '#e2e8f0' }}>Character Wizard</h2>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: '#94a3b8', backgroundColor: '#15171f' }}>AI-Powered</span>
            {chatHistoryContext && (
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: '#22c55e', backgroundColor: 'rgba(34,197,94,0.15)' }}>
                📖 From: {chatHistoryContext.chat.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowChatSelector(!showChatSelector)} className="p-1.5 rounded-lg transition-colors" style={{ color: showChatSelector ? '#22c55e' : '#94a3b8' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#252836'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'} title="Create from Chat History">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            </button>
            <button onClick={() => setShowHistory(!showHistory)} className="p-1.5 rounded-lg transition-colors" style={{ color: '#94a3b8' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#252836'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'} title="Chat History">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </button>
            <button onClick={startNewConversation} className="p-1.5 rounded-lg transition-colors" style={{ color: '#94a3b8' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#252836'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'} title="New Chat">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            </button>
            <button onClick={handleClose} className="p-1.5 rounded-lg transition-colors" style={{ color: '#94a3b8' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#252836'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* History Panel */}
        {showHistory && (
          <div className="border-b overflow-y-auto" style={{ borderColor: '#2a2d3e', maxHeight: '240px' }}>
            <div className="p-2">
              {conversations.length === 0 ? (
                <p className="text-center py-4 text-sm" style={{ color: '#64748b' }}>No conversations yet</p>
              ) : (
                conversations.map(conv => (
                  <div key={conv.id} onClick={() => loadConversation(conv.id)}
                    className="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer mb-1 transition-colors"
                    style={{ backgroundColor: activeConvId === conv.id ? 'rgba(99,102,241,0.15)' : 'transparent', color: activeConvId === conv.id ? '#a5b4fc' : '#cbd5e1' }}
                    onMouseEnter={(e) => { if (activeConvId !== conv.id) e.currentTarget.style.backgroundColor = '#252836'; }}
                    onMouseLeave={(e) => { if (activeConvId !== conv.id) e.currentTarget.style.backgroundColor = 'transparent'; }}>
                    <div className="flex items-center gap-2 min-w-0">
                      {conv.has_character && <span>✨</span>}
                      <div className="min-w-0">
                        <p className="text-sm truncate">{conv.title}</p>
                        <p className="text-xs" style={{ color: '#64748b' }}>{new Date(conv.updated_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <button onClick={(e) => deleteConversation(conv.id, e)} className="p-1 rounded hover:opacity-100 opacity-50 transition-opacity" style={{ color: '#ef4444' }} title="Delete">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                ))
              )}

              {/* Edit existing character */}
              {characters.length > 0 && (
                <div className="mt-2 pt-2" style={{ borderTop: '1px solid #2a2d3e' }}>
                  <p className="text-xs font-medium px-1 mb-1" style={{ color: '#64748b' }}>Edit with AI:</p>
                  <div className="flex flex-wrap gap-1">
                    {characters.slice(0, 10).map(char => (
                      <button key={char.id} onClick={() => { startEditCharacter(char.id); setShowHistory(false); }}
                        className="text-xs px-2 py-1 rounded transition-colors"
                        style={{ backgroundColor: '#1a1d2e', color: '#cbd5e1', border: '1px solid #2a2d3e' }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = '#6366f1'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = '#2a2d3e'}>
                        {char.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Chat Selector Panel for "From Chat" mode */}
        {showChatSelector && (
          <div className="border-b overflow-y-auto" style={{ borderColor: '#2a2d3e', maxHeight: '300px', backgroundColor: '#15171f' }}>
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium" style={{ color: '#e2e8f0' }}>📖 Select Chat for Context</p>
                <button onClick={() => { setShowChatSelector(false); setChatSearchQuery(''); }}
                  className="text-xs px-2 py-1 rounded transition-colors"
                  style={{ color: '#94a3b8', backgroundColor: '#252836' }}>
                  Cancel
                </button>
              </div>
              <p className="text-xs mb-3" style={{ color: '#64748b' }}>
                Choose a chat to use its history as context for creating a new character that fits naturally into the story.
              </p>

              {/* Search */}
              <input
                value={chatSearchQuery}
                onChange={(e) => setChatSearchQuery(e.target.value)}
                placeholder="Search chats..."
                className="w-full rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none"
                style={{ backgroundColor: '#1a1d2e', border: '1px solid #2a2d3e', color: '#e2e8f0' }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#6366f1'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#2a2d3e'}
                autoFocus
              />

              {/* Chat List */}
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {chats.filter(chat =>
                  chat.name.toLowerCase().includes(chatSearchQuery.toLowerCase())
                ).length === 0 ? (
                  <p className="text-center py-4 text-sm" style={{ color: '#64748b' }}>
                    {chats.length === 0 ? 'No chats available' : 'No chats match search'}
                  </p>
                ) : (
                  chats
                    .filter(chat => chat.name.toLowerCase().includes(chatSearchQuery.toLowerCase()))
                    .map(chat => (
                      <button
                        key={chat.id}
                        onClick={() => loadChatHistory(chat.id)}
                        disabled={isLoadingChatHistory}
                        className="w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors disabled:opacity-50"
                        style={{ backgroundColor: '#1a1d2e', border: '1px solid #2a2d3e' }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = '#6366f1'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = '#2a2d3e'}
                      >
                        <span className="text-lg">{chat.is_group_chat ? '👥' : '💬'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate" style={{ color: '#e2e8f0' }}>{chat.name}</p>
                          <p className="text-xs" style={{ color: '#64748b' }}>
                            {chat.is_group_chat ? 'Group Chat' : 'Chat'}
                          </p>
                        </div>
                        {isLoadingChatHistory && (
                          <div className="w-4 h-4 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
                        )}
                      </button>
                    ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && !showHistory && !showChatSelector && (
            <div className="flex flex-col items-center justify-center h-full text-center" style={{ color: '#64748b' }}>
              <span className="text-4xl mb-3">✨</span>
              <p className="text-lg font-medium mb-1" style={{ color: '#94a3b8' }}>Character Creation Wizard</p>
              <p className="text-sm mb-4" style={{ color: '#64748b' }}>I'll help you create an amazing character for roleplay, storytelling, or D&D.</p>
              <div className="flex flex-col gap-2">
                <button onClick={startNewConversation} className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity"
                  style={{ backgroundColor: '#6366f1' }} onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'} onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}>
                  ✨ Start Creating
                </button>
                <button onClick={() => setShowChatSelector(true)} className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{ backgroundColor: '#252836', color: '#cbd5e1', border: '1px solid #2a2d3e' }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = '#22c55e'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = '#2a2d3e'}>
                  📖 Create from Chat History
                </button>
              </div>
            </div>
          )}

          {messages.map((msg, i) => {
            const rtl = msg.role === 'user' && isRTL(msg.content);
            return (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[85%] rounded-2xl px-4 py-2.5"
                  style={msg.role === 'user' ? { backgroundColor: '#6366f1', color: '#ffffff', borderBottomRightRadius: '4px' }
                    : { backgroundColor: '#1a1d2e', color: '#d1d5db', border: '1px solid #2a2d3e', borderBottomLeftRadius: '4px' }}>
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm max-w-none" style={{ color: '#d1d5db' }}>
                      <div className="[&_p]:my-1 [&_h1]:my-2 [&_h2]:my-2 [&_h3]:my-2 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_strong]:text-gray-200 [&_em]:text-gray-300 [&_code]:bg-[#252836] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-gray-300 [&_pre]:bg-[#252836] [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{cleanDisplayText(msg.content)}</ReactMarkdown>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap" dir={rtl ? 'rtl' : 'ltr'} style={{ textAlign: rtl ? 'right' : 'left' }}>{msg.content}</p>
                  )}
                </div>
              </div>
            );
          })}

          {isGenerating && generatingPhase === 'thinking' && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-md px-4 py-3" style={{ backgroundColor: '#1a1d2e', border: '1px solid #2a2d3e' }}>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <div className="w-5 h-5 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
                  </div>
                  <span className="text-sm" style={{ color: '#94a3b8' }}>Thinking...</span>
                </div>
              </div>
            </div>
          )}

          {isGenerating && generatingPhase === 'writing' && messages[messages.length - 1]?.content === '' && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-md px-4 py-3" style={{ backgroundColor: '#1a1d2e', border: '1px solid #2a2d3e' }}>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: '#6366f1', animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: '#6366f1', animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: '#6366f1', animationDelay: '300ms' }} />
                  </div>
                  <span className="text-sm" style={{ color: '#94a3b8' }}>Writing...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Character Preview Card */}
        {generatedCharacter && (
          <div className="mx-4 mb-3 rounded-xl p-4" style={{ border: '1px solid rgba(99,102,241,0.3)', backgroundColor: 'rgba(99,102,241,0.08)' }}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-base font-bold flex items-center gap-1.5" style={{ color: '#e2e8f0' }}>
                  🎭 {generatedCharacter.name}
                  {generatedCharacter.nickname && <span className="text-sm font-normal" style={{ color: '#94a3b8' }}>"{generatedCharacter.nickname}"</span>}
                </h3>
                <div className="flex flex-wrap gap-1 mt-1">
                  {generatedCharacter.tags?.map((tag, i) => (
                    <span key={i} className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#252836', color: '#94a3b8', border: '1px solid #2a2d3e' }}>{tag}</span>
                  ))}
                </div>
              </div>
              <span className="text-lg">✨</span>
            </div>
            <p className="text-xs line-clamp-3 mb-3" style={{ color: '#94a3b8' }}>{generatedCharacter.description}</p>
            <div className="flex gap-2">
              <button onClick={acceptCharacter} className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-white transition-opacity"
                style={{ backgroundColor: '#6366f1' }} onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'} onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}>
                {editCharId ? '✅ Save Changes' : '✅ Create Character'}
              </button>
              <button onClick={editCharacter} className="px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ backgroundColor: '#252836', color: '#cbd5e1', border: '1px solid #2a2d3e' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2d3045'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#252836'}>
                ✏️ Edit
              </button>
              <button onClick={() => setGeneratedCharacter(null)} className="px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ backgroundColor: '#252836', color: '#94a3b8', border: '1px solid #2a2d3e' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2d3045'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#252836'}>
                🔄
              </button>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="px-4 pb-4 pt-2 border-t" style={{ borderColor: '#2a2d3e' }}>
          <div className="flex items-end gap-2">
            <textarea ref={inputRef} value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="Describe your character idea..." rows={1}
              className="flex-1 resize-none rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-colors"
              style={{ backgroundColor: '#1a1d2e', border: '1px solid #2a2d3e', color: '#e2e8f0', minHeight: '42px', maxHeight: '120px' }}
              onFocus={(e) => e.currentTarget.style.borderColor = '#6366f1'} onBlur={(e) => e.currentTarget.style.borderColor = '#2a2d3e'}
              onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 120) + 'px'; }} />
            <button onClick={sendMessage} disabled={!inputValue.trim() || isGenerating}
              className="p-2.5 rounded-xl text-white transition-opacity disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              style={{ backgroundColor: '#6366f1' }} onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.opacity = '0.9'; }} onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
