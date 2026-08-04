import { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/state';

export default function MessageInput() {
  const [content, setContent] = useState('');
  const { sendMessage, isGenerating, currentCharacter, currentChat, swipeMessage, setSettingsOpen, panelOpen, setActivePanel } = useStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [content]);

  const handleSubmit = () => {
    if (!content.trim() || isGenerating) return;
    sendMessage(content.trim());
    setContent('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const lastAssistantMsg = currentChat?.messages ? [...currentChat.messages].reverse().find(m => m.role === 'assistant') : null;
  const hasSwipes = lastAssistantMsg && lastAssistantMsg.swipes && lastAssistantMsg.swipes.length > 0;

  return (
    <div className="border-t border-tavern-border bg-tavern-topbar/60 backdrop-blur-xl flex-shrink-0 relative z-10">
      {/* Main input row */}
      <div className="flex items-end gap-2 px-3 py-2">
        {/* Left: hamburger + settings icons */}
        <div className="flex items-center gap-1 flex-shrink-0 pb-0.5">
          <button
            onClick={() => setActivePanel('chats')}
            className="w-7 h-7 flex items-center justify-center rounded text-tavern-muted hover:text-tavern-text hover:bg-tavern-hover transition-colors"
            title="Menu"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-7 h-7 flex items-center justify-center rounded text-tavern-muted hover:text-tavern-text hover:bg-tavern-hover transition-colors"
            title="Settings"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </button>
        </div>

        {/* Center: textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={currentCharacter ? `Message ${currentCharacter.name}...` : 'Type a message, or /? for help'}
          disabled={isGenerating}
          className="flex-1 bg-transparent border-0 text-sm resize-none focus:outline-none placeholder-tavern-muted/40 text-tavern-text disabled:opacity-50 min-h-[36px] max-h-[120px] py-1.5"
          rows={1}
        />

        {/* Right: arrow + send icons */}
        <div className="flex items-center gap-1 flex-shrink-0 pb-0.5">
          <button
            onClick={handleSubmit}
            disabled={!content.trim() || isGenerating}
            className="w-7 h-7 flex items-center justify-center rounded text-tavern-muted hover:text-tavern-text hover:bg-tavern-hover transition-colors disabled:opacity-30"
            title="Send arrow"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
          <button
            onClick={handleSubmit}
            disabled={!content.trim() || isGenerating}
            className="w-7 h-7 flex items-center justify-center rounded text-tavern-accent hover:text-tavern-accent-hover hover:bg-tavern-accent/10 transition-colors disabled:opacity-30"
            title="Send"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Bottom row: swipe controls + Generate button */}
      <div className="flex items-center justify-between px-3 pb-2">
        {/* Left: swipe arrows */}
        <div className="flex items-center gap-1">
          {hasSwipes && lastAssistantMsg && (
            <>
              <button
                onClick={() => swipeMessage(lastAssistantMsg.id, 'prev')}
                disabled={lastAssistantMsg.swipe_id <= 0}
                className="text-tavern-muted hover:text-tavern-text disabled:opacity-30 p-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-xs text-tavern-muted min-w-[28px] text-center font-mono">
                {lastAssistantMsg.swipe_id + 1}/{lastAssistantMsg.swipes.length + 1}
              </span>
              <button
                onClick={() => swipeMessage(lastAssistantMsg.id, 'next')}
                disabled={lastAssistantMsg.swipe_id >= lastAssistantMsg.swipes.length}
                className="text-tavern-muted hover:text-tavern-text disabled:opacity-30 p-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}
        </div>

        {/* Right: Generate button */}
        <button
          onClick={handleSubmit}
          disabled={!content.trim() || isGenerating}
          className={`px-5 py-1.5 rounded-lg text-sm font-medium transition-all shadow-lg ${
            isGenerating
              ? 'bg-tavern-accent/20 text-tavern-accent cursor-wait shadow-none'
              : 'bg-green-600 hover:bg-green-500 text-white shadow-green-900/30 disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none'
          }`}
        >
          {isGenerating ? (
            <span className="flex items-center gap-1.5">
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating...
            </span>
          ) : (
            'Generate'
          )}
        </button>
      </div>
    </div>
  );
}
