import { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/state';

export default function MessageInput() {
  const [content, setContent] = useState('');
  const { sendMessage, stopGeneration, isGenerating, currentCharacter, currentChat, swipeMessage, setSettingsOpen, panelOpen, setActivePanel } = useStore();
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
    <div className="border-t border-tavern-border bg-tavern-surface flex-shrink-0 relative z-10">
      <div className="max-w-[50vw] mx-auto">
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
          placeholder={currentCharacter ? `Message ${currentCharacter.name}...` : 'Type a message, or /? for help'}
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
        {/* Left: swipe arrows */}
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
