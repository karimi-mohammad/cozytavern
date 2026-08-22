import { useState } from 'react';
import { useStore } from '../store/state';
import { formatTokenCount } from '../utils/tokenEstimate';

export default function TopBar() {
  const {
    apiSettings, setSettingsOpen, isGenerating,
    rightPanelOpen, toggleRightPanel, currentCharacter,
    chats, currentChat, selectChat, createChat,
    setCharacterEditorOpen, editingCharacter,
    activePanel, setActivePanel, panelOpen,
    regenerateMessage, contextUsage,
  } = useStore();

  const [showChatDropdown, setShowChatDropdown] = useState(false);

  const settings = apiSettings['openai'];
  const endpoint = settings?.base_url || 'api.openai.com';
  const model = settings?.model || 'No model set';

  const handleChatSelect = async (chatId: string) => {
    await selectChat(chatId);
    setShowChatDropdown(false);
  };

  const handleNewChat = async () => {
    if (currentCharacter) {
      const newChat = await createChat(currentCharacter.id);
      await selectChat(newChat.id);
      setShowChatDropdown(false);
    }
  };

  return (
    <div className="h-[40px] bg-tavern-surface border-b border-tavern-border flex items-center px-3 gap-2 flex-shrink-0 z-40">
      {/* Left: Chat Name / Selector */}
      <div className="relative flex-shrink-0">
        <button
          onClick={() => setShowChatDropdown(!showChatDropdown)}
          className="flex items-center gap-1.5 hover:bg-tavern-hover px-2 py-1 rounded-md transition-colors max-w-[320px]"
        >
          <span className="text-xs text-tavern-text truncate font-medium">
            {currentChat ? `${currentCharacter?.name || ''} - ${currentChat.name}` : 'No chat selected'}
          </span>
          <svg className={`w-3 h-3 text-tavern-dim transition-transform flex-shrink-0 ${showChatDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showChatDropdown && (
          <div className="absolute top-full left-0 mt-1 w-72 bg-tavern-surface2 border border-tavern-border rounded-lg shadow-xl z-50 py-1 max-h-[300px] overflow-y-auto">
            {currentCharacter && (
              <button
                onClick={handleNewChat}
                className="w-full px-3 py-2 text-left text-xs text-tavern-accent hover:bg-tavern-hover flex items-center gap-2"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Chat
              </button>
            )}
            {chats.map(chat => (
              <button
                key={chat.id}
                onClick={() => handleChatSelect(chat.id)}
                className={`w-full px-3 py-2 text-left text-xs hover:bg-tavern-hover flex items-center gap-2 ${
                  currentChat?.id === chat.id ? 'text-tavern-accent bg-tavern-accent/10' : 'text-tavern-text'
                }`}
              >
                <svg className="w-3.5 h-3.5 text-tavern-dim flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span className="truncate">{chat.name}</span>
                {chat.branch_from && (
                  <svg className="w-3 h-3 text-tavern-accent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 3v12M18 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM18 9a9 9 0 01-9 9" />
                  </svg>
                )}
              </button>
            ))}
            {chats.length === 0 && (
              <div className="px-3 py-2 text-xs text-tavern-dim text-center">No chats yet</div>
            )}
          </div>
        )}
      </div>

      {/* Center: Model name + Context Usage */}
      <div className="flex items-center gap-2 ml-auto mr-auto">
        <span className="text-[10px] text-tavern-dim font-mono">{model}</span>
        {contextUsage && currentChat && (
          <div className="flex items-center gap-1.5">
            <div className="w-24 h-1.5 bg-tavern-border rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  contextUsage.percentage < 50
                    ? 'bg-emerald-500'
                    : contextUsage.percentage < 80
                    ? 'bg-amber-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(100, contextUsage.percentage)}%` }}
              />
            </div>
            <span className="text-[10px] text-tavern-dim font-mono whitespace-nowrap">
              {formatTokenCount(contextUsage.used)}/{formatTokenCount(contextUsage.max)}
            </span>
          </div>
        )}
      </div>

      {/* Right: Action buttons */}
      <div className="flex items-center gap-1">
        {/* Generating indicator */}
        {isGenerating && (
          <div className="flex items-center gap-1 text-tavern-accent text-xs px-2">
            <div className="flex gap-0.5">
              <span className="w-1 h-1 bg-tavern-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-1 bg-tavern-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1 h-1 bg-tavern-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        <button
          onClick={() => currentCharacter && setCharacterEditorOpen(true, currentCharacter)}
          className="w-7 h-7 flex items-center justify-center rounded-md text-tavern-dim hover:text-tavern-text-bright hover:bg-tavern-hover transition-colors"
          title="Edit Character"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>

        <button
          onClick={() => regenerateMessage()}
          disabled={isGenerating || !currentChat}
          className="w-7 h-7 flex items-center justify-center rounded-md text-tavern-dim hover:text-tavern-text-bright hover:bg-tavern-hover transition-colors disabled:opacity-30"
          title="Regenerate"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>

        <button
          onClick={toggleRightPanel}
          className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${rightPanelOpen ? 'bg-tavern-accent/20 text-tavern-accent' : 'text-tavern-dim hover:text-tavern-text-bright hover:bg-tavern-hover'}`}
          title="Toggle Info Panel"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
