import { useState } from 'react';
import { useStore } from '../store/state';

export default function TopBar() {
  const {
    apiSettings, setSettingsOpen, isGenerating,
    rightPanelOpen, toggleRightPanel, currentCharacter,
    chats, currentChat, selectChat, createChat,
    setCharacterEditorOpen, editingCharacter,
    activePanel, setActivePanel, panelOpen, panelOpen: sidebarOpen,
    regenerateMessage,
  } = useStore();

  const [showChatDropdown, setShowChatDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

  const toolbarIcons = [
    {
      id: 'settings' as const,
      label: 'API Settings',
      icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      action: () => setSettingsOpen(true),
    },
    {
      id: 'characters' as const,
      label: 'Characters',
      icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      action: () => setActivePanel('characters'),
    },
    {
      id: 'chats' as const,
      label: 'Chats',
      icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
      action: () => setActivePanel('chats'),
    },
    {
      id: 'personas' as const,
      label: 'Personas',
      icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      action: () => setActivePanel('personas'),
    },
    {
      id: 'lorebooks' as const,
      label: 'Lorebooks',
      icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
      action: () => setActivePanel('lorebooks'),
    },
  ];

  return (
    <div className="h-[50px] bg-tavern-surface border-b border-tavern-border flex items-center px-2 gap-1 flex-shrink-0 z-40">
      {/* Left: Toolbar Icons */}
      <div className="flex items-center gap-0.5">
        {toolbarIcons.map((icon) => (
          <button
            key={icon.id}
            onClick={icon.action}
            className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${
              activePanel === icon.id && panelOpen
                ? 'bg-tavern-accent/20 text-tavern-accent'
                : 'text-tavern-muted hover:text-tavern-text-bright hover:bg-tavern-hover'
            }`}
            title={icon.label}
          >
            {icon.icon}
          </button>
        ))}
        {/* Connection status */}
        <div className="flex items-center gap-1.5 ml-2 px-2">
          <div className={`w-1.5 h-1.5 rounded-full ${isGenerating ? 'bg-tavern-success animate-pulse' : 'bg-tavern-muted/50'}`} />
          <span className="text-[10px] text-tavern-dim hidden lg:inline font-mono">{model}</span>
        </div>
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-tavern-border mx-1" />

      {/* Center: Chat Selector */}
      <div className="relative flex-shrink-0">
        <button
          onClick={() => setShowChatDropdown(!showChatDropdown)}
          className="flex items-center gap-1.5 hover:bg-tavern-hover px-2 py-1 rounded-md transition-colors max-w-[320px]"
        >
          <svg className="w-4 h-4 text-tavern-muted flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="text-xs text-tavern-text truncate">
            {currentChat ? `${currentCharacter?.name || ''} - ${currentChat.name}` : 'No chat selected'}
          </span>
          <svg className={`w-3 h-3 text-tavern-muted transition-transform flex-shrink-0 ${showChatDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                <svg className="w-3.5 h-3.5 text-tavern-muted flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

      {/* Separator */}
      <div className="w-px h-5 bg-tavern-border mx-1 hidden md:block" />

      {/* Right: Search + Action buttons */}
      <div className="flex items-center gap-1 ml-auto">
        {/* Search */}
        <div className="relative hidden md:flex items-center">
          <svg className="w-3.5 h-3.5 text-tavern-dim absolute left-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="w-36 lg:w-48 bg-tavern-input border border-tavern-border rounded-md pl-7 pr-2 py-1.5 text-xs text-tavern-text placeholder-tavern-dim focus:outline-none focus:border-tavern-accent transition-colors"
          />
        </div>

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

        {/* Action buttons */}
        <button
          onClick={() => currentCharacter && setCharacterEditorOpen(true, currentCharacter)}
          className="w-8 h-8 flex items-center justify-center rounded-md text-tavern-muted hover:text-tavern-text-bright hover:bg-tavern-hover transition-colors"
          title="Edit Character"
        >
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>

        <button
          onClick={() => regenerateMessage()}
          disabled={isGenerating || !currentChat}
          className="w-8 h-8 flex items-center justify-center rounded-md text-tavern-muted hover:text-tavern-text-bright hover:bg-tavern-hover transition-colors disabled:opacity-30"
          title="Regenerate"
        >
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>

        <button
          onClick={toggleRightPanel}
          className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${rightPanelOpen ? 'bg-tavern-accent/20 text-tavern-accent' : 'text-tavern-muted hover:text-tavern-text-bright hover:bg-tavern-hover'}`}
          title="Toggle Info Panel"
        >
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
