import { useState } from 'react';
import { useStore } from '../store/state';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import CharacterAvatar from './CharacterAvatar';

export default function ChatView() {
  const [menuChatId, setMenuChatId] = useState<string | null>(null);

  const {
    currentCharacter, currentChat, characters, chats,
    selectCharacter, selectChat, createChat, deleteChat, renameChat, autoNameChat,
    setSettingsOpen,
    setCharacterEditorOpen, loadChats,
    editMessage, deleteMessage, branchChat,
    activePersona, isGenerating, showConfirm,
  } = useStore();

  const handleBranch = async (messageId: string, sendDate: string) => {
    if (!currentChat || !currentCharacter) return;
    const newChat = await branchChat(currentCharacter.id, currentChat.id, sendDate);
    await selectChat(newChat.id);
  };

  const handleDeleteMessage = async (messageId: string) => {
    const ok = await showConfirm('Are you sure you want to delete this message and everything after it?');
    if (ok) deleteMessage(messageId);
  };

  // Empty state: no character selected - show welcome screen
  if (!currentCharacter) {
    return (
      <div className="flex-1 flex flex-col bg-tavern-bg min-w-0 relative overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[50vw] mx-auto px-6 py-8">
            {/* Version header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-tavern-danger/80 flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-sm">ST</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-tavern-text-bright">CozyTavern v0.0.1</h1>
              </div>
              <button
                onClick={() => setSettingsOpen(true)}
                className="ml-auto text-tavern-dim hover:text-tavern-text p-2 rounded-md hover:bg-tavern-hover transition-colors"
                title="Settings"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>

            {/* Quick action buttons */}
            <div className="flex items-center gap-3 mb-6 text-sm">
              <button
                onClick={() => setSettingsOpen(true)}
                className="flex items-center gap-1.5 text-tavern-dim hover:text-tavern-accent transition-colors px-3 py-1.5 rounded-lg bg-tavern-input border border-tavern-border hover:border-tavern-accent/50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                API Connections
              </button>
              <button
                onClick={() => setCharacterEditorOpen(true)}
                className="flex items-center gap-1.5 text-tavern-dim hover:text-tavern-accent transition-colors px-3 py-1.5 rounded-lg bg-tavern-input border border-tavern-border hover:border-tavern-accent/50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Character Management
              </button>
            </div>

            {/* Recent Chats */}
            <h2 className="text-base font-semibold text-tavern-text-bright mb-3">Recent Chats</h2>
            <div className="space-y-2">
              {characters.map((char) => {
                const charChats = chats.filter(c => c.character_id === char.id);
                if (charChats.length === 0) return null;
                const latestChat = charChats[0];
                return (
                  <div
                    key={char.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-tavern-surface2/60 hover:bg-tavern-hover cursor-pointer transition-colors group border border-tavern-border/50"
                    onClick={() => {
                      selectCharacter(char).then(() => loadChats(char.id));
                    }}
                  >
                    <CharacterAvatar name={char.name} avatar={char.avatar} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-tavern-text-bright truncate">{char.name}</span>
                        <span className="text-[11px] text-tavern-dim flex-shrink-0">
                          {new Date(latestChat.updated_at || latestChat.created_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-tavern-dim truncate mt-0.5">
                        {latestChat.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button className="text-tavern-dim hover:text-tavern-text p-1.5 rounded-md hover:bg-tavern-hover" title="Pin">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                        </svg>
                      </button>
                      <button className="text-tavern-dim hover:text-tavern-text p-1.5 rounded-md hover:bg-tavern-hover" title="Edit">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
              {characters.length === 0 && (
                <div className="text-center py-8 text-tavern-dim text-sm">
                  No characters yet. Create one to get started.
                </div>
              )}
            </div>

            {/* Assistant welcome */}
            <div className="mt-8 p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-tavern-danger/80 flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-xs">ST</span>
                </div>
                <span className="text-sm font-semibold text-tavern-text-bright">Assistant</span>
                <span className="text-xs text-tavern-dim">
                  {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="pl-[52px]">
                <p className="text-sm text-tavern-text leading-relaxed">
                  If you're connected to an API, try asking me something!
                </p>
                <p className="text-sm text-tavern-dim mt-2 leading-relaxed">
                  Hint: Set any character as your welcome page assistant from their "More..." menu.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Character selected but no chat open — show chat list in center
  return (
    <div className="flex-1 flex flex-col bg-tavern-bg min-w-0 relative overflow-hidden">
      {currentChat ? (
        <>
          <MessageList
            messages={currentChat.messages}
            currentCharacter={currentCharacter}
            currentChat={currentChat}
            activePersona={activePersona}
            isGenerating={isGenerating}
            onEditMessage={editMessage}
            onDeleteMessage={handleDeleteMessage}
            onBranch={handleBranch}
          />
          <MessageInput />
        </>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[50vw] mx-auto px-6 py-8">
            {/* Character header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-tavern-accent/20 border border-tavern-accent/40 flex items-center justify-center text-tavern-accent font-bold text-lg">
                {currentCharacter.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold text-tavern-text-bright truncate">{currentCharacter.name}</h1>
                <p className="text-xs text-tavern-dim">Select a chat or start a new one</p>
              </div>
              <button
                onClick={() => createChat(currentCharacter.id)}
                className="flex items-center gap-1.5 px-4 py-2 bg-tavern-accent hover:bg-tavern-accent-hover text-white rounded-lg text-sm font-medium transition-colors shadow-md shadow-tavern-accent/20"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                New Chat
              </button>
            </div>

            {/* Chat list */}
            {chats.length > 0 ? (
              <div className="space-y-2">
                {chats.map((chat) => (
                  <div
                    key={chat.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-tavern-surface2/60 hover:bg-tavern-hover cursor-pointer transition-colors group border border-tavern-border/50"
                    onClick={() => { setMenuChatId(null); selectChat(chat.id); }}
                  >
                    <div className="w-9 h-9 rounded-full bg-tavern-input border border-tavern-border flex items-center justify-center text-tavern-dim flex-shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {chat.branch_from && (
                          <svg className="w-3 h-3 text-tavern-accent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 3v12M18 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM18 9a9 9 0 01-9 9" />
                          </svg>
                        )}
                        <span className="text-sm font-medium text-tavern-text-bright truncate">{chat.name}</span>
                      </div>
                      <p className="text-[11px] text-tavern-dim mt-0.5">
                        {new Date(chat.updated_at || chat.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuChatId(menuChatId === chat.id ? null : chat.id);
                        }}
                        className="text-tavern-dim hover:text-tavern-text p-1.5 rounded-md hover:bg-tavern-hover transition-colors"
                        title="More"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      {menuChatId === chat.id && (
                        <div className="absolute right-0 top-full mt-1 bg-tavern-surface2 border border-tavern-border rounded-lg shadow-xl z-50 py-1 min-w-[150px]">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuChatId(null);
                              const newName = prompt('Rename chat:', chat.name);
                              if (newName && newName.trim()) renameChat(chat.id, newName.trim());
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-tavern-hover transition-colors text-tavern-text flex items-center gap-2"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Rename
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuChatId(null);
                              autoNameChat(chat.id);
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-tavern-hover transition-colors text-tavern-text flex items-center gap-2"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            Auto Name
                          </button>
                        </div>
                      )}
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          const ok = await showConfirm('Delete this chat?');
                          if (ok) deleteChat(chat.id);
                        }}
                        className="text-tavern-dim hover:text-tavern-danger p-1.5 rounded-md hover:bg-tavern-hover transition-colors"
                        title="Delete"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-tavern-surface2/60 border border-tavern-border/50 flex items-center justify-center">
                  <svg className="w-8 h-8 text-tavern-dim" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-sm text-tavern-dim mb-3">No chats yet</p>
                <button
                  onClick={() => createChat(currentCharacter.id)}
                  className="px-4 py-2 bg-tavern-accent hover:bg-tavern-accent-hover text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Start a Chat
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
