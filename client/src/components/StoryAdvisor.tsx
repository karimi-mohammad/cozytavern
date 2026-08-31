import { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store/state';
import { api } from '../api/client';
import ToolCallCard, { ToolCallData } from './ToolCallCard';

interface AdvisorChat {
  id: string;
  main_chat_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface AdvisorMessage {
  id: string;
  advisor_chat_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

const QUICK_ACTIONS = [
  { label: '🎭 تولید پیام کاراکتر', message: 'بر اساس وضعیت فعلی داستان، یک پیام از طرف یکی از کاراکترهای فعال گروپ چت تولید کن. ابتدا کاراکتر مورد نظر و سپس مسیر داستانی را مشخص کن.' },
  { label: '🎯 مسیر داستانی', message: 'بر اساس وضعیت فعلی داستان، چند مسیر پیشنهادی برای ادامه داستان پیشنهاد بده. مسیرها باید متنوع باشن و شامل تضاد، رشد کاراکتر و لحظات دراماتیک باشن.' },
  { label: '🔍 بررسی مشکلات', message: 'داستان فعلی رو بررسی کن و هرگونه مشکل رو شناسایی کن: plot holes، ناهماهنگی شخصیت‌ها، pacing ضعیف، یا روابطی که منطقی پیش نرفتن. برای هر مشکل یه راهکار پیشنهاد بده.' },
  { label: '✏️ تغییرات کاراکتر', message: 'کاراکتر فعلی رو تحلیل کن و پیشنهاد بده چه تغییراتی در فیلدهای system_prompt، personality یا description باعث بهبود کیفیت پاسخ‌های AI بشه. متن دقیق تغییرات رو بنویس.' },
  { label: '💡 پیشنهاد لوربوک', message: 'بر اساس داستان فعلی و روابط کاراکترها، entries پیشنهادی برای لوربوک بنویس. هر entry باید شامل کلمات کلیدی و محتوای مفید برای حفظ continuity داستان باشه.' },
  { label: '📊 خلاصه وضعیت', message: 'یه خلاصه جامع از وضعیت فعلی داستان بنویس: موقعیت کاراکترها، روابط و احساسات، تعارض‌های فعلی، و مهم‌ترین رویدادهایی که رخ داده.' },
];

export default function StoryAdvisor() {
  const storyAdvisorOpen = useStore(s => s.storyAdvisorOpen);
  const setStoryAdvisorOpen = useStore(s => s.setStoryAdvisorOpen);
  const currentChat = useStore(s => s.currentChat);
  const addToast = useStore(s => s.addToast);
  const showConfirm = useStore(s => s.showConfirm);

  const [advisorChats, setAdvisorChats] = useState<AdvisorChat[]>([]);
  const [currentAdvisorChat, setCurrentAdvisorChat] = useState<AdvisorChat | null>(null);
  const [messages, setMessages] = useState<AdvisorMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingChats, setLoadingChats] = useState(false);
  const [pendingToolCalls, setPendingToolCalls] = useState<ToolCallData[]>([]);
  const [executingTool, setExecutingTool] = useState<string | null>(null);
  const [toolResults, setToolResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [isGeneratingMessage, setIsGeneratingMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load advisor chats when panel opens or main chat changes
  useEffect(() => {
    if (!storyAdvisorOpen || !currentChat) return;
    loadAdvisorChats();
  }, [storyAdvisorOpen, currentChat?.id]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadAdvisorChats = async () => {
    if (!currentChat) return;
    setLoadingChats(true);
    try {
      const chats = await api.getAdvisorChats(currentChat.id);
      setAdvisorChats(chats);
    } catch (error: any) {
      console.error('Failed to load advisor chats:', error);
    } finally {
      setLoadingChats(false);
    }
  };

  const loadAdvisorMessages = async (chatId: string) => {
    try {
      const msgs = await api.getAdvisorMessages(chatId);
      setMessages(msgs);
    } catch (error: any) {
      console.error('Failed to load advisor messages:', error);
      setMessages([]);
    }
  };

  const handleCreateChat = async () => {
    if (!currentChat) return;
    try {
      const chat = await api.createAdvisorChat({ main_chat_id: currentChat.id });
      setAdvisorChats(prev => [chat, ...prev]);
      setCurrentAdvisorChat(chat);
      setMessages([]);
    } catch (error: any) {
      addToast(`Error: ${error.message}`, 'error');
    }
  };

  const handleSelectChat = async (chat: AdvisorChat) => {
    setCurrentAdvisorChat(chat);
    setPendingToolCalls([]);
    setToolResults({});
    await loadAdvisorMessages(chat.id);
  };

  const handleDeleteChat = async (chatId: string) => {
    const ok = await showConfirm('Delete this advisor conversation?');
    if (!ok) return;
    try {
      await api.deleteAdvisorChat(chatId);
      setAdvisorChats(prev => prev.filter(c => c.id !== chatId));
      if (currentAdvisorChat?.id === chatId) {
        setCurrentAdvisorChat(null);
        setMessages([]);
      }
    } catch (error: any) {
      addToast(`Error: ${error.message}`, 'error');
    }
  };

  const handleClearMessages = async () => {
    if (!currentAdvisorChat) return;
    const ok = await showConfirm('Clear all messages in this conversation?');
    if (!ok) return;
    try {
      await api.clearAdvisorMessages(currentAdvisorChat.id);
      setMessages([]);
      setPendingToolCalls([]);
      setToolResults({});
    } catch (error: any) {
      addToast(`Error: ${error.message}`, 'error');
    }
  };

  const handleSend = useCallback(async (messageText?: string) => {
    const text = (messageText || inputValue).trim();
    if (!text || !currentAdvisorChat || isGenerating) return;

    setInputValue('');
    setIsGenerating(true);
    setPendingToolCalls([]);
    setToolResults({});

    // Add user message optimistically
    const userMsg: AdvisorMessage = {
      id: crypto.randomUUID(),
      advisor_chat_id: currentAdvisorChat.id,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);

    // Add placeholder assistant message
    const assistantMsg: AdvisorMessage = {
      id: 'generating',
      advisor_chat_id: currentAdvisorChat.id,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, assistantMsg]);

    const controller = new AbortController();
    abortRef.current = controller;

    let fullContent = '';
    const toolCallsReceived: ToolCallData[] = [];

    try {
      await api.sendAdvisorMessage(
        { advisor_chat_id: currentAdvisorChat.id, message: text },
        (token) => {
          // Check if this is a tool_call token
          try {
            const parsed = JSON.parse(token);
            if (parsed.tool_call) {
              toolCallsReceived.push(parsed.tool_call);
              return;
            }
          } catch {
            // Not JSON, treat as regular text token
          }

          fullContent += token;
          setMessages(prev => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (lastIdx >= 0 && updated[lastIdx].id === 'generating') {
              updated[lastIdx] = { ...updated[lastIdx], content: fullContent };
            }
            return updated;
          });
        },
        () => {
          // Done - replace generating placeholder with real message
          setMessages(prev => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (lastIdx >= 0 && updated[lastIdx].id === 'generating') {
              updated[lastIdx] = {
                ...updated[lastIdx],
                id: crypto.randomUUID(),
              };
            }
            return updated;
          });
          setIsGenerating(false);
          abortRef.current = null;

          // Set pending tool calls after generation is done
          if (toolCallsReceived.length > 0) {
            setPendingToolCalls(toolCallsReceived);
          }
        },
        controller.signal
      );
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        // Remove the generating placeholder
        setMessages(prev => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0 && updated[lastIdx].id === 'generating') {
            updated[lastIdx] = { ...updated[lastIdx], id: crypto.randomUUID() };
          }
          return updated;
        });
      } else {
        addToast(`Error: ${error.message}`, 'error');
        // Remove generating placeholder and replace with error
        setMessages(prev => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0 && updated[lastIdx].id === 'generating') {
            updated[lastIdx] = {
              ...updated[lastIdx],
              id: crypto.randomUUID(),
              content: `Error: ${error.message}`,
            };
          }
          return updated;
        });
      }
      setIsGenerating(false);
      abortRef.current = null;
    }
  }, [inputValue, currentAdvisorChat, isGenerating, addToast]);

  const handleStopGeneration = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsGenerating(false);
  };

  const handleApproveTool = useCallback(async (toolName: string, toolArgs: Record<string, any>) => {
    if (!currentAdvisorChat) return;

    // Special handling for generate_character_message
    if (toolName === 'generate_character_message') {
      setIsGeneratingMessage(toolArgs.character_id);
      try {
        const result = await api.generateCharacterMessage({
          advisor_chat_id: currentAdvisorChat.id,
          character_id: toolArgs.character_id,
          instruction: toolArgs.instruction,
        });

        if (result.success && result.content) {
          // Update the tool call with generated content for preview
          setPendingToolCalls(prev => prev.map(tc => {
            if (tc.name === 'generate_character_message' && tc.arguments.character_id === toolArgs.character_id) {
              return {
                ...tc,
                arguments: { ...tc.arguments, generated_content: result.content },
              };
            }
            return tc;
          }));
          addToast('Message generated successfully', 'success');
        } else {
          addToast(`Error: ${result.error || 'Failed to generate message'}`, 'error');
        }
      } catch (error: any) {
        addToast(`Error: ${error.message}`, 'error');
      } finally {
        setIsGeneratingMessage(null);
      }
      return;
    }

    // Default handling for other tools
    setExecutingTool(toolName);
    try {
      const result = await api.executeAdvisorTool({
        advisor_chat_id: currentAdvisorChat.id,
        tool_name: toolName,
        arguments: toolArgs,
      });

      setToolResults(prev => ({
        ...prev,
        [toolName]: { success: result.success, message: result.message },
      }));

      // Remove from pending after a delay
      setTimeout(() => {
        setPendingToolCalls(prev => prev.filter(tc => tc.name !== toolName));
      }, 1500);
    } catch (error: any) {
      addToast(`Error: ${error.message}`, 'error');
      setToolResults(prev => ({
        ...prev,
        [toolName]: { success: false, message: error.message },
      }));
    } finally {
      setExecutingTool(null);
    }
  }, [currentAdvisorChat, addToast]);

  const handleRejectTool = useCallback((toolName: string) => {
    setPendingToolCalls(prev => prev.filter(tc => tc.name !== toolName));
  }, []);

  const handleInsertMessage = useCallback(async (toolArgs: Record<string, any>) => {
    if (!currentAdvisorChat) return;

    const { character_id, generated_content } = toolArgs;
    if (!generated_content) {
      addToast('No generated content to insert', 'error');
      return;
    }

    try {
      const result = await api.insertGeneratedMessage({
        advisor_chat_id: currentAdvisorChat.id,
        character_id,
        content: generated_content,
      });

      if (result.success) {
        addToast('Message inserted into chat', 'success');
        // Remove from pending
        setPendingToolCalls(prev => prev.filter(tc => 
          !(tc.name === 'generate_character_message' && tc.arguments.character_id === character_id)
        ));
      } else {
        addToast('Failed to insert message', 'error');
      }
    } catch (error: any) {
      addToast(`Error: ${error.message}`, 'error');
    }
  }, [currentAdvisorChat, addToast]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!storyAdvisorOpen) return null;

  return (
    <div className="absolute left-0 top-0 bottom-0 w-80 bg-tavern-surface border-r border-tavern-border flex flex-col flex-shrink-0 z-30 animate-slide-in shadow-xl">
      {/* Header */}
      <div className="h-[50px] border-b border-tavern-border flex items-center justify-between px-3 flex-shrink-0">
        <h2 className="text-sm font-semibold text-tavern-text-bright flex items-center gap-2">
          <span className="text-tavern-accent">🧭</span>
          {currentAdvisorChat ? currentAdvisorChat.name : 'Story Advisor'}
        </h2>
        <div className="flex items-center gap-1">
          {currentAdvisorChat && (
            <button
              onClick={() => { setCurrentAdvisorChat(null); setMessages([]); }}
              className="text-tavern-dim hover:text-tavern-text p-1.5 rounded-md hover:bg-tavern-hover transition-colors"
              title="Back to list"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <button
            onClick={() => setStoryAdvisorOpen(false)}
            className="text-tavern-dim hover:text-tavern-text p-1.5 rounded-md hover:bg-tavern-hover transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* No chat selected: show chat list */}
      {!currentAdvisorChat ? (
        <>
          {/* Create button */}
          <div className="p-3 border-b border-tavern-border/50">
            <button
              onClick={handleCreateChat}
              className="w-full py-2 bg-tavern-accent/10 border border-tavern-accent/30 rounded-lg text-xs text-tavern-accent hover:bg-tavern-accent/20 transition-colors font-medium"
            >
              + New Conversation
            </button>
          </div>

          {/* Chat list */}
          <div className="flex-1 overflow-y-auto">
            {loadingChats ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-tavern-accent/30 border-t-tavern-accent rounded-full animate-spin" />
              </div>
            ) : advisorChats.length === 0 ? (
              <div className="text-center py-12 px-4">
                <span className="text-3xl mb-3 block">🧭</span>
                <p className="text-sm text-tavern-dim">No conversations yet</p>
                <p className="text-xs text-tavern-faint mt-1">Create a new advisor chat to get started</p>
              </div>
            ) : (
              <div className="p-2">
                {advisorChats.map((chat) => (
                  <div
                    key={chat.id}
                    className="p-3 rounded-lg cursor-pointer mb-1 transition-all duration-150 hover:bg-tavern-hover group flex items-center justify-between"
                    onClick={() => handleSelectChat(chat)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-tavern-text truncate font-medium">{chat.name}</p>
                      <p className="text-[10px] text-tavern-faint mt-0.5">
                        {new Date(chat.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteChat(chat.id); }}
                      className="text-tavern-dim hover:text-red-400 text-xs p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-all hover:bg-tavern-hover"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Quick Actions */}
          <div className="px-3 py-2 border-b border-tavern-border/50 flex gap-1 overflow-x-auto">
            {QUICK_ACTIONS.map((action, i) => (
              <button
                key={i}
                onClick={() => handleSend(action.message)}
                disabled={isGenerating || !currentChat}
                className="flex-shrink-0 px-2.5 py-1 bg-tavern-input border border-tavern-border/60 rounded-full text-[10px] text-tavern-dim hover:text-tavern-accent hover:border-tavern-accent/30 transition-colors whitespace-nowrap disabled:opacity-30"
              >
                {action.label}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <span className="text-3xl mb-3 block">🧭</span>
                <p className="text-sm text-tavern-dim">Ask me anything about your story</p>
                <p className="text-xs text-tavern-faint mt-1">I can help with plot, characters, lorebook, and more</p>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[90%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-tavern-accent/15 text-tavern-text border border-tavern-accent/20'
                      : 'bg-tavern-input text-tavern-text border border-tavern-border'
                  }`}
                >
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-1 mb-1.5">
                      <span className="text-tavern-accent text-[10px] font-medium">🧭 Advisor</span>
                    </div>
                  )}
                  <div className="whitespace-pre-wrap break-words">{msg.content || (msg.id === 'generating' ? <span className="text-tavern-dim animate-pulse">Thinking...</span> : '')}</div>
                </div>
              </div>
            ))}

            {/* Pending Tool Calls */}
            {pendingToolCalls.map((tc) => (
              <div key={tc.id || tc.name || tc.arguments?.character_id} className="flex justify-start">
                <div className="w-full max-w-[95%]">
                  <ToolCallCard
                    toolCall={tc}
                    onApprove={handleApproveTool}
                    onReject={() => handleRejectTool(tc.name)}
                    onInsert={tc.name === 'generate_character_message' ? handleInsertMessage : undefined}
                    isExecuting={executingTool === tc.name || (tc.name === 'generate_character_message' && isGeneratingMessage === tc.arguments?.character_id)}
                    result={toolResults[tc.name] || null}
                  />
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-tavern-border bg-tavern-surface px-3 py-2 flex-shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={currentChat ? "Ask about your story..." : "Select a chat first"}
                disabled={isGenerating || !currentChat}
                className="flex-1 bg-tavern-input border border-tavern-border rounded-lg px-3 py-2 text-xs resize-none focus:outline-none focus:border-tavern-accent placeholder-tavern-dim text-tavern-text min-h-[36px] max-h-[100px] disabled:opacity-50"
                dir="auto"
                rows={1}
              />
              {isGenerating ? (
                <button
                  onClick={handleStopGeneration}
                  className="w-8 h-8 flex items-center justify-center rounded-md bg-red-500/90 text-white hover:bg-red-500 transition-colors flex-shrink-0"
                  title="Stop"
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="1" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={() => handleSend()}
                  disabled={!inputValue.trim() || !currentChat}
                  className="w-8 h-8 flex items-center justify-center rounded-md text-tavern-accent hover:text-tavern-accent-hover hover:bg-tavern-accent/10 transition-all active:scale-90 disabled:opacity-30 flex-shrink-0"
                  title="Send"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </button>
              )}
            </div>
            {/* Clear messages button */}
            {messages.length > 0 && (
              <button
                onClick={handleClearMessages}
                className="w-full mt-1.5 py-1 text-[10px] text-tavern-faint hover:text-tavern-dim transition-colors"
              >
                Clear conversation
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
