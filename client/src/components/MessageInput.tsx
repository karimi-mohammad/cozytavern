import { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/state';

interface SlashCommand {
  name: string;
  aliases: string[];
  description: string;
}

const COMMANDS: SlashCommand[] = [
  { name: '/regenerate', aliases: ['/regen'], description: 'Regenerate last AI response' },
];

export default function MessageInput() {
  const [content, setContent] = useState('');
  const [showCommandPopup, setShowCommandPopup] = useState(false);
  const [selectedCommandIdx, setSelectedCommandIdx] = useState(0);
  const {
    sendMessage, stopGeneration, isGenerating, currentCharacter, currentChat,
    swipeMessage, continueGeneration, impersonateMessage,
    regenerateMessage, deleteMessage, addToast,
    setActivePanel,
  } = useStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [content]);

  // Show command popup when user types /
  useEffect(() => {
    if (content.startsWith('/') && !content.includes(' ')) {
      setShowCommandPopup(true);
      setSelectedCommandIdx(0);
    } else {
      setShowCommandPopup(false);
    }
  }, [content]);

  // Filter commands based on input
  const filteredCommands = COMMANDS.filter(cmd => {
    const query = content.toLowerCase();
    return cmd.name.startsWith(query) || cmd.aliases.some(a => a.startsWith(query));
  });

  const handleSlashCommand = (input: string) => {
    const [command, ...args] = input.split(' ');
    const cmd = command.toLowerCase();

    // Check /regenerate or /regen
    if (cmd === '/regenerate' || cmd === '/regen') {
      const messages = currentChat?.messages || [];
      if (messages.length === 0) {
        addToast('No messages to regenerate', 'error');
        return;
      }

      const lastMsg = messages[messages.length - 1];

      // Case 1: Last message is assistant → regenerate it
      if (lastMsg.role === 'assistant') {
        regenerateMessage();
        return;
      }

      // Case 2: Last message is user (no response received) → delete and resend
      if (lastMsg.role === 'user') {
        deleteMessage(lastMsg.id);
        setTimeout(() => {
          sendMessage(lastMsg.content);
        }, 100);
        return;
      }
    }

    addToast(`Unknown command: ${command}`, 'error');
  };

  const handleSubmit = () => {
    if (!content.trim() || isGenerating) return;

    // Slash command detection
    if (content.trim().startsWith('/')) {
      handleSlashCommand(content.trim());
      setContent('');
      setShowCommandPopup(false);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      return;
    }

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
    // Command popup keyboard navigation
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
    // Alt+Enter: ادامه تولید
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
      <div className="max-w-[50vw] mx-auto">
      {/* Slash Command Popup */}
      {showCommandPopup && filteredCommands.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mx-4 mb-1">
          <div className="bg-tavern-surface2 border border-tavern-border rounded-lg shadow-xl overflow-hidden">
            <div className="px-3 py-1.5 text-[10px] text-tavern-dim border-b border-tavern-border/50">
              Commands
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
        {/* Left: hamburger icon */}
        <div className="flex items-center gap-1 flex-shrink-0 pb-0.5">
          <button
            onClick={() => setActivePanel('chats')}
            className="w-8 h-8 flex items-center justify-center rounded-md text-tavern-dim hover:text-tavern-text-bright hover:bg-tavern-hover transition-colors"
            title="Menu"
          >
            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {/* Center: textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={currentCharacter ? `Message ${currentCharacter.name}... or / for commands` : 'Type a message, or /? for help'}
          disabled={isGenerating}
          className="flex-1 bg-tavern-input border border-tavern-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-tavern-accent placeholder-tavern-dim text-tavern-text disabled:opacity-50 min-h-[36px] max-h-[120px]"
          rows={1}
        />

        {/* Right: send icon */}
        <div className="flex items-center flex-shrink-0 pb-0.5">
          <button
            onClick={handleSubmit}
            disabled={!content.trim() || isGenerating}
            className="w-8 h-8 flex items-center justify-center rounded-md text-tavern-accent hover:text-tavern-accent-hover hover:bg-tavern-accent/10 transition-colors disabled:opacity-30"
            title="Send"
          >
            <svg className="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Bottom row: swipe controls + Generate button */}
      <div className="flex items-center justify-between px-4 pb-2">
        {/* Left: swipe arrows + continue + impersonate */}
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
          {/* Continue button */}
          {canContinue && (
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
          {/* Impersonate button */}
          {canContinue && (
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

        {/* Right: Generate / Stop button */}
        {isGenerating ? (
          <button
            onClick={stopGeneration}
            className="px-5 py-1.5 rounded-lg text-sm font-semibold transition-all shadow-lg bg-red-500/90 hover:bg-red-500 text-white shadow-red-500/20"
            title="Stop generation"
          >
            <span className="flex items-center gap-1.5">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="1" />
              </svg>
              Stop
            </span>
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!content.trim() || isGenerating}
            className={`px-5 py-1.5 rounded-lg text-sm font-semibold transition-all shadow-lg ${
              'bg-tavern-cta hover:bg-tavern-cta-hover text-white shadow-tavern-cta/20 disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none'
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
