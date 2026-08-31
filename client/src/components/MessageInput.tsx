import { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/state';

interface SlashCommand {
  name: string;
  aliases: string[];
  description: string;
}

const COMMANDS: SlashCommand[] = [
  { name: '/regenerate', aliases: ['/regen'], description: 'Regenerate last AI response' },
  { name: '/inspect', aliases: ['/debug'], description: 'Preview the prompt before each LLM request' },
];

export default function MessageInput() {
  const [content, setContent] = useState('');
  const [showCommandPopup, setShowCommandPopup] = useState(false);
  const [selectedCommandIdx, setSelectedCommandIdx] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const sendMessage = useStore(s => s.sendMessage);
  const stopGeneration = useStore(s => s.stopGeneration);
  const isGenerating = useStore(s => s.isGenerating);
  const currentCharacter = useStore(s => s.currentCharacter);
  const currentChat = useStore(s => s.currentChat);
  const swipeMessage = useStore(s => s.swipeMessage);
  const continueGeneration = useStore(s => s.continueGeneration);
  const impersonateMessage = useStore(s => s.impersonateMessage);
  const regenerateMessage = useStore(s => s.regenerateMessage);
  const deleteMessage = useStore(s => s.deleteMessage);
  const addToast = useStore(s => s.addToast);
  const setActivePanel = useStore(s => s.setActivePanel);
  const togglePromptInspect = useStore(s => s.togglePromptInspect);
  const promptInspectEnabled = useStore(s => s.promptInspectEnabled);
  const quickReplySettings = useStore(s => s.quickReplySettings);
  const groupChatParticipants = useStore(s => s.groupChatParticipants);
  const characters = useStore(s => s.characters);
  const generateGroupResponse = useStore(s => s.generateGroupResponse);
  const autoRespondCharacterId = useStore(s => s.autoRespondCharacterId);
  const setAutoRespondCharacter = useStore(s => s.setAutoRespondCharacter);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [content]);

  useEffect(() => {
    if (content.startsWith('/') && !content.includes(' ')) {
      setShowCommandPopup(true);
      setSelectedCommandIdx(0);
    } else {
      setShowCommandPopup(false);
    }
  }, [content]);

  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const isGroupChat = !!currentChat?.is_group_chat;
  const activeParticipants = groupChatParticipants.filter(p => p.is_active);

  const filteredCommands = COMMANDS.filter(cmd => {
    const query = content.toLowerCase();
    return cmd.name.startsWith(query) || cmd.aliases.some(a => a.startsWith(query));
  });

  const handleSlashCommand = (input: string) => {
    const [command, ...args] = input.split(' ');
    const cmd = command.toLowerCase();

    if (cmd === '/regenerate' || cmd === '/regen') {
      const messages = currentChat?.messages || [];
      if (messages.length === 0) {
        addToast('No messages to regenerate', 'error');
        return;
      }
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === 'assistant') {
        regenerateMessage();
        return;
      }
      if (lastMsg.role === 'user') {
        deleteMessage(lastMsg.id);
        setTimeout(() => {
          sendMessage(lastMsg.content);
        }, 100);
        return;
      }
    }

    if (cmd === '/inspect' || cmd === '/debug') {
      togglePromptInspect();
      const next = useStore.getState().promptInspectEnabled;
      addToast(next ? 'Prompt preview enabled' : 'Prompt preview disabled', 'info');
      return;
    }

    addToast(`Unknown command: ${command}`, 'error');
  };

  const handleSubmit = () => {
    if (isGenerating) return;

    if (content.trim().startsWith('/')) {
      handleSlashCommand(content.trim());
      setContent('');
      setShowCommandPopup(false);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      return;
    }

    // Group chat: send message, then auto-respond if enabled
    if (isGroupChat) {
      const msg = content.trim();
      setContent('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      if (msg) {
        sendMessage(msg, true);
        // Auto-respond after user message if a character is selected
        if (autoRespondCharacterId) {
          setTimeout(() => {
            generateGroupResponse(currentChat!.id, autoRespondCharacterId);
          }, 200);
        }
      }
      return;
    }

    if (!content.trim()) return;
    sendMessage(content.trim());
    setContent('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const selectCommand = (cmd: SlashCommand) => {
    setContent(cmd.name + ' ');
    setShowCommandPopup(false);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showCommandPopup && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCommandIdx(i => (i + 1) % filteredCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCommandIdx(i => (i - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey && !e.altKey)) {
        e.preventDefault();
        selectCommand(filteredCommands[selectedCommandIdx]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowCommandPopup(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Enter' && e.altKey) {
      e.preventDefault();
      if (!isGenerating && currentChat) {
        continueGeneration();
      }
    }
  };

  const lastAssistantMsg = currentChat?.messages ? [...currentChat.messages].reverse().find(m => m.role === 'assistant') : null;
  const hasSwipes = lastAssistantMsg && lastAssistantMsg.swipes && lastAssistantMsg.swipes.length > 0;
  const canContinue = !isGenerating && currentChat && lastAssistantMsg && currentChat.messages.length > 0;

  return (
    <div className="border-t border-tavern-border bg-tavern-surface flex-shrink-0 relative z-10">
      {/* Quick Reply Bar */}
      {quickReplySettings?.enabled && quickReplySettings.replies.length > 0 && !isGenerating && currentChat && (
        <div className="border-b border-tavern-border/50 px-4 py-1.5 overflow-x-auto">
          <div className="flex gap-1.5 min-w-0">
            {quickReplySettings.replies.map((r, i) => (
              <button
                key={`${r.label}-${i}`}
                onClick={() => sendMessage(r.message)}
                className="flex-shrink-0 px-3 py-1 bg-tavern-card border border-tavern-border/60 rounded-full text-xs text-tavern-dim hover:text-tavern-accent hover:border-tavern-accent/30 transition-colors whitespace-nowrap"
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Auto-Respond Dropdown — Group Chat Only */}
      {isGroupChat && activeParticipants.length > 0 && (
        <div className="border-b border-tavern-border/50 px-4 py-1.5">
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-tavern-dim select-none">Auto-respond:</label>
            <select
              value={autoRespondCharacterId || ''}
              onChange={(e) => setAutoRespondCharacter(e.target.value || null)}
              className="bg-tavern-input border border-tavern-border rounded px-1.5 py-0.5 text-[10px] text-tavern-text focus:outline-none focus:border-tavern-accent"
            >
              <option value="">Off</option>
              {activeParticipants.map(p => {
                const char = characters.find(c => c.id === p.character_id);
                return (
                  <option key={p.character_id} value={p.character_id}>
                    {char?.name || p.display_name}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      )}

      <div className="max-w-[50vw] mx-auto">
      {/* Slash Command Popup */}
      {showCommandPopup && filteredCommands.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mx-4 mb-1">
          <div className="bg-tavern-surface2 border border-tavern-border rounded-lg shadow-xl shadow-black/30 overflow-hidden animate-pop-up origin-bottom-left">
            <div className="px-3 py-1.5 text-[10px] text-tavern-dim border-b border-tavern-border/50 flex items-center justify-between">
              <span>Commands</span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-px bg-tavern-input border border-tavern-border rounded text-[9px] font-mono">↑↓</kbd>
                <kbd className="px-1 py-px bg-tavern-input border border-tavern-border rounded text-[9px] font-mono">Tab</kbd>
              </span>
            </div>
            {filteredCommands.map((cmd, idx) => (
              <button
                key={cmd.name}
                onClick={() => selectCommand(cmd)}
                className={`w-full px-3 py-2 text-left flex items-center gap-3 transition-colors ${
                  idx === selectedCommandIdx
                    ? 'bg-tavern-accent/15 text-tavern-accent'
                    : 'hover:bg-tavern-hover text-tavern-text'
                }`}
              >
                <span className="text-sm font-mono font-medium min-w-[110px]">{cmd.name}</span>
                <span className="text-xs text-tavern-dim">{cmd.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main input row */}
      <div className="flex items-end gap-2 px-4 py-2">
        {/* Left: hamburger icon + command menu */}
        <div className="flex items-center gap-1 flex-shrink-0 pb-0.5 relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-8 h-8 flex items-center justify-center rounded-md text-tavern-dim hover:text-tavern-text-bright hover:bg-tavern-hover transition-colors"
            title="Menu"
          >
            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {showMenu && (
            <div className="absolute bottom-full left-0 mb-2 min-w-[180px]">
              <div className="bg-tavern-surface2 border border-tavern-border rounded-lg shadow-xl shadow-black/30 overflow-hidden animate-pop-up origin-bottom-left">
                <div className="px-3 py-1.5 text-[10px] text-tavern-dim border-b border-tavern-border/50">
                  Commands
                </div>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    handleSlashCommand('/regenerate');
                  }}
                  className="w-full px-3 py-2 text-left flex items-center gap-2.5 hover:bg-tavern-hover text-tavern-text transition-colors"
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span className="text-sm">Regenerate</span>
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    handleSlashCommand('/inspect');
                  }}
                  className="w-full px-3 py-2 text-left flex items-center gap-2.5 hover:bg-tavern-hover text-tavern-text transition-colors"
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l-3 3 3 3m8-6l3 3-3 3M13 6l-2 12" />
                  </svg>
                  <span className="text-sm flex-1">Prompt Preview</span>
                  {promptInspectEnabled && (
                    <span className="w-2 h-2 rounded-full bg-tavern-accent flex-shrink-0 animate-pulse" title="Active" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Center: textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={currentCharacter ? `Message ${currentCharacter.name}... or / for commands` : 'Type a message, or /? for help'}
          className="flex-1 bg-tavern-input border border-tavern-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-tavern-accent placeholder-tavern-dim text-tavern-text min-h-[36px] max-h-[120px]"
          dir="auto"
          rows={1}
        />

        {/* Right: send icon */}
        <div className="flex items-center flex-shrink-0 pb-0.5">
          <button
            onClick={handleSubmit}
            disabled={isGenerating || !content.trim()}
            className="w-8 h-8 flex items-center justify-center rounded-md text-tavern-accent hover:text-tavern-accent-hover hover:bg-tavern-accent/10 transition-all active:scale-90 disabled:opacity-30"
            title="Send"
          >
            <svg className={`w-[18px] h-[18px] ${content.trim() && !isGenerating ? 'drop-shadow-[0_0_4px_rgba(102,102,204,0.5)]' : ''}`} fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Bottom row: swipe controls + Generate button */}
      <div className="flex items-center justify-between px-4 pb-2">
        <div className="flex items-center gap-1">
          {hasSwipes && lastAssistantMsg && (
            <>
              <button
                onClick={() => swipeMessage(lastAssistantMsg.id, 'prev')}
                disabled={lastAssistantMsg.swipe_id <= 0}
                className="text-tavern-dim hover:text-tavern-text disabled:opacity-30 p-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-xs text-tavern-dim min-w-[28px] text-center font-mono">
                {lastAssistantMsg.swipe_id + 1}/{lastAssistantMsg.swipes.length + 1}
              </span>
              <button
                onClick={() => swipeMessage(lastAssistantMsg.id, 'next')}
                disabled={lastAssistantMsg.swipe_id >= lastAssistantMsg.swipes.length}
                className="text-tavern-dim hover:text-tavern-text disabled:opacity-30 p-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}
          {canContinue && !isGroupChat && (
            <button
              onClick={continueGeneration}
              className="text-tavern-dim hover:text-tavern-accent p-1 rounded-md hover:bg-tavern-hover transition-colors ml-1"
              title="Continue generation (Alt+Enter)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          )}
          {canContinue && !isGroupChat && (
            <button
              onClick={impersonateMessage}
              className="text-tavern-dim hover:text-tavern-accent p-1 rounded-md hover:bg-tavern-hover transition-colors"
              title="Impersonate (AI writes as you)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </button>
          )}
        </div>

        {isGenerating ? (
          <button
            onClick={stopGeneration}
            className="px-5 py-1.5 rounded-lg text-sm font-semibold transition-all shadow-lg bg-red-500/90 hover:bg-red-500 text-white shadow-red-500/20 active:scale-[0.97] animate-fade-in"
            title="Stop generation"
          >
            <span className="flex items-center gap-1.5">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="1" />
              </svg>
              Stop
            </span>
          </button>
        ) : !isGroupChat && (
          <button
            onClick={handleSubmit}
            disabled={!content.trim() || isGenerating}
            className={`px-5 py-1.5 rounded-lg text-sm font-semibold transition-all shadow-lg active:scale-[0.97] ${
              'bg-tavern-cta hover:bg-tavern-cta-hover text-white shadow-tavern-cta/20 hover:shadow-tavern-cta/40 disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none'
            }`}
          >
            Generate
          </button>
        )}
      </div>
      </div>
    </div>
  );
}
