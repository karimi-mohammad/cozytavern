import { useState } from 'react';
import { useStore } from '../store/state';
import CharacterAvatar from './CharacterAvatar';
import { CharacterSkeleton, ChatSkeleton, PersonaSkeleton, LorebookSkeleton } from './LoadingSkeleton';
import { useDebounce } from '../hooks/useDebounce';

export default function Sidebar() {
  const {
    characters, currentCharacter, chats, currentChat,
    selectCharacter, selectChat, createChat, deleteCharacter, deleteChat, renameChat, moveChatToFolder,
    setCharacterEditorOpen, setSettingsOpen,
    personas, activePersona, setActivePersona,
    lorebooks, activeLorebook, setActiveLorebook,
    loadLorebooks, setLorebookEditorOpen, setPersonaEditorOpen,
    showConfirm, addToast,
    activePanel, panelOpen,
    theme, setTheme,
    loadingCharacters, loadingChats, loadingPersonas, loadingLorebooks,
  } = useStore();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 150);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [folderMenuChatId, setFolderMenuChatId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [folderDropdownChatId, setFolderDropdownChatId] = useState<string | null>(null);

  const isMobile = () => window.innerWidth < 768;
  const closeSidebarIfMobile = () => { if (isMobile()) useStore.setState({ panelOpen: false }); };

  const filteredCharacters = characters.filter(c =>
    c.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    c.tags?.some(t => t.toLowerCase().includes(debouncedSearch.toLowerCase()))
  );

  const chatFolders = [...new Set(chats.map(c => c.folder || '').filter(Boolean))].sort();
  const groupedChats = chatFolders.reduce((acc, folder) => {
    acc[folder] = chats.filter(c => (c.folder || '') === folder);
    return acc;
  }, {} as Record<string, typeof chats>);
  const unfolderedChats = chats.filter(c => !c.folder);

  const handleDeleteCharacter = async (id: string) => {
    const ok = await showConfirm('Are you sure you want to delete this character?');
    if (ok) deleteCharacter(id);
  };

  const handleDeleteChat = async (id: string) => {
    const ok = await showConfirm('Are you sure you want to delete this chat?');
    if (ok) deleteChat(id);
  };

  if (!panelOpen) return null;

  const renderCharactersPanel = () => (
    <div className="flex-1 overflow-y-auto">
      {/* Search */}
      <div className="p-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-tavern-input border border-tavern-border rounded-md px-3 py-2 text-xs focus:outline-none focus:border-tavern-accent transition-colors text-tavern-text placeholder-tavern-dim"
          placeholder="Search characters..."
        />
      </div>

      {/* Character list */}
      <div className="px-3 pb-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-tavern-dim font-medium">Characters</span>
          <button
            onClick={() => setCharacterEditorOpen(true)}
            className="text-tavern-accent hover:text-tavern-accent-hover text-xs font-medium"
          >
            + New
          </button>
        </div>
        {loadingCharacters ? (
          <CharacterSkeleton />
        ) : (
          filteredCharacters.map(char => (
            <div
              key={char.id}
              className={`p-2.5 rounded-lg cursor-pointer mb-1 transition-colors ${
                currentCharacter?.id === char.id
                  ? 'bg-tavern-accent/20 text-tavern-accent'
                  : 'hover:bg-tavern-hover text-tavern-text'
              }`}
              onClick={() => { selectCharacter(char); closeSidebarIfMobile(); }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CharacterAvatar name={char.name} avatar={char.avatar} size="sm" />
                  <span className="text-sm truncate font-medium">{char.name}</span>
                </div>
                <div className="flex gap-0.5 flex-shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); setCharacterEditorOpen(true, char); }}
                    className="text-tavern-dim hover:text-tavern-text text-xs p-1.5 rounded-md hover:bg-tavern-hover transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteCharacter(char.id); }}
                    className="text-tavern-dim hover:text-tavern-danger text-xs p-1.5 rounded-md hover:bg-tavern-hover transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderChatsPanel = () => {
    if (!currentCharacter) {
      return (
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm text-tavern-dim text-center">Select a character first</p>
        </div>
      );
    }

    return (
      <div className="flex-1 overflow-y-auto p-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-tavern-dim font-medium">Chats</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNewFolderInput(!showNewFolderInput)}
              className="text-tavern-dim hover:text-tavern-text text-xs p-1 rounded-md hover:bg-tavern-hover transition-colors"
              title="New folder"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
            </button>
            <button
              onClick={() => createChat(currentCharacter.id)}
              className="text-tavern-accent hover:text-tavern-accent-hover text-xs font-medium"
            >
              + New
            </button>
          </div>
        </div>

        {/* New folder input */}
        {showNewFolderInput && (
          <div className="mb-2 flex gap-1">
            <input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name..."
              className="flex-1 bg-tavern-input border border-tavern-border rounded-md px-2 py-1 text-xs focus:outline-none focus:border-tavern-accent text-tavern-text placeholder-tavern-dim"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newFolderName.trim()) {
                  setCollapsedFolders(prev => ({ ...prev, [newFolderName.trim()]: false }));
                  setNewFolderName('');
                  setShowNewFolderInput(false);
                } else if (e.key === 'Escape') {
                  setShowNewFolderInput(false);
                  setNewFolderName('');
                }
              }}
            />
            <button
              onClick={() => {
                if (newFolderName.trim()) {
                  setCollapsedFolders(prev => ({ ...prev, [newFolderName.trim()]: false }));
                  setNewFolderName('');
                  setShowNewFolderInput(false);
                }
              }}
              className="text-tavern-accent text-xs px-2"
            >
              ✓
            </button>
          </div>
        )}

        {/* Loading state */}
        {loadingChats ? (
          <ChatSkeleton />
        ) : (
          <>
          {/* Render grouped chats */}
          {(() => {
            const renderChatItem = (chat: typeof chats[0]) => (
            <div
              key={chat.id}
              className={`p-2.5 rounded-lg cursor-pointer mb-1 transition-colors flex items-center justify-between group ${
                currentChat?.id === chat.id
                  ? 'bg-tavern-accent/20 text-tavern-accent'
                  : 'hover:bg-tavern-hover text-tavern-text'
              }`}
              onClick={() => { if (renamingChatId !== chat.id && folderDropdownChatId !== chat.id) { selectChat(chat.id); closeSidebarIfMobile(); } }}
            >
              {renamingChatId === chat.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => {
                    if (renameValue.trim()) renameChat(chat.id, renameValue.trim());
                    setRenamingChatId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (renameValue.trim()) renameChat(chat.id, renameValue.trim());
                      setRenamingChatId(null);
                    } else if (e.key === 'Escape') {
                      setRenamingChatId(null);
                    }
                  }}
                  className="flex-1 bg-tavern-input border border-tavern-accent rounded-md px-2 py-1 text-sm focus:outline-none text-tavern-text"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  className="text-sm truncate flex items-center gap-1.5 flex-1 min-w-0"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setRenamingChatId(chat.id);
                    setRenameValue(chat.name);
                  }}
                >
                  {chat.branch_from && (
                    <svg className="w-3 h-3 text-tavern-accent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 3v12M18 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM18 9a9 9 0 01-9 9" />
                    </svg>
                  )}
                  {chat.name}
                </span>
              )}
              <div className="flex items-center flex-shrink-0">
                {/* Folder assignment button */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFolderDropdownChatId(folderDropdownChatId === chat.id ? null : chat.id);
                    }}
                    className="text-tavern-dim hover:text-tavern-text text-xs p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-all hover:bg-tavern-hover"
                    title="Move to folder"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                  </button>
                  {folderDropdownChatId === chat.id && (
                    <div className="absolute left-0 top-full mt-1 bg-tavern-surface2 border border-tavern-border rounded-lg shadow-xl z-50 py-1 min-w-[140px]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveChatToFolder(chat.id, '');
                          setFolderDropdownChatId(null);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-tavern-hover transition-colors ${!chat.folder ? 'text-tavern-accent' : 'text-tavern-text'}`}
                      >
                        No folder
                      </button>
                      {chatFolders.map(folder => (
                        <button
                          key={folder}
                          onClick={(e) => {
                            e.stopPropagation();
                            moveChatToFolder(chat.id, folder);
                            setFolderDropdownChatId(null);
                          }}
                          className={`w-full text-left px-3 py-1.5 text-xs hover:bg-tavern-hover transition-colors ${chat.folder === folder ? 'text-tavern-accent' : 'text-tavern-text'}`}
                        >
                          {folder}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteChat(chat.id); }}
                  className="text-tavern-dim hover:text-tavern-danger text-xs p-1.5 rounded-md hover:bg-tavern-hover transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          );

          return (
            <>
              {/* Foldered chats */}
              {chatFolders.map(folder => (
                <div key={folder} className="mb-1">
                  <button
                    onClick={() => setCollapsedFolders(prev => ({ ...prev, [folder]: !prev[folder] }))}
                    className="flex items-center gap-1.5 w-full text-left py-1.5 px-1.5 rounded-lg hover:bg-tavern-hover transition-colors"
                  >
                    <svg
                      className={`w-3 h-3 text-tavern-dim transition-transform ${collapsedFolders[folder] ? '' : 'rotate-90'}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <svg className="w-3.5 h-3.5 text-tavern-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <span className="text-xs text-tavern-dim font-medium flex-1">{folder}</span>
                    <span className="text-[10px] text-tavern-faint">{groupedChats[folder].length}</span>
                  </button>
                  {!collapsedFolders[folder] && (
                    <div className="ml-2">
                      {groupedChats[folder].map(renderChatItem)}
                    </div>
                  )}
                </div>
              ))}

              {/* Unfoldered chats */}
              {unfolderedChats.length > 0 && (
                <div>
                  {chatFolders.length > 0 && (
                    <div className="text-[10px] text-tavern-faint px-1.5 mb-1">No folder</div>
                  )}
                  {unfolderedChats.map(renderChatItem)}
                </div>
              )}
            </>
          );
        })()}
          </>
        )}
      </div>
    );
  };

  const renderSettingsPanel = () => (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* API Settings */}
      <div>
        <h3 className="text-sm font-medium mb-2 text-tavern-text-bright">API Settings</h3>
        <button
          onClick={() => setSettingsOpen(true)}
          className="w-full p-2.5 bg-tavern-input border border-tavern-border rounded-lg text-sm hover:bg-tavern-hover transition-colors text-left text-tavern-text"
        >
          Connection Settings
        </button>
      </div>

      {/* Theme */}
      <div>
        <h3 className="text-sm font-medium mb-2 text-tavern-text-bright">Theme</h3>
        <div className="grid grid-cols-3 gap-2">
          {(['dark', 'darker', 'light'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`p-2 rounded-lg text-xs capitalize transition-colors ${
                theme === t
                  ? 'bg-tavern-input border border-tavern-accent text-tavern-accent'
                  : 'bg-tavern-input border border-tavern-border text-tavern-muted hover:bg-tavern-hover'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* About */}
      <div>
        <h3 className="text-sm font-medium mb-2 text-tavern-text-bright">About</h3>
        <div className="p-3 bg-tavern-input border border-tavern-border rounded-lg text-xs text-tavern-dim space-y-1">
          <p>CozyTavern v0.0.1</p>
          <p>A SillyTavern-inspired chat interface</p>
        </div>
      </div>
    </div>
  );

  const renderLorebooksPanel = () => (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-tavern-text-bright">Lorebooks</h3>
        <button
          onClick={() => setLorebookEditorOpen(true)}
          className="text-tavern-accent hover:text-tavern-accent-hover text-xs font-medium"
        >
          + New
        </button>
      </div>
      {loadingLorebooks ? (
        <LorebookSkeleton />
      ) : (
        <>
          {lorebooks.map(l => (
            <div
              key={l.id}
              className={`p-2.5 rounded-lg cursor-pointer mb-1 transition-colors ${
                activeLorebook?.id === l.id ? 'bg-tavern-accent/20 text-tavern-accent' : 'hover:bg-tavern-hover text-tavern-text'
              }`}
              onClick={() => setActiveLorebook(activeLorebook?.id === l.id ? null : l)}
            >
              <span className="text-sm truncate">{l.name}</span>
            </div>
          ))}
          {lorebooks.length === 0 && (
            <p className="text-xs text-tavern-dim text-center py-4">No lorebooks yet</p>
          )}
        </>
      )}
    </div>
  );

  const renderPersonasPanel = () => (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-tavern-text-bright">Personas</h3>
        <button
          onClick={() => setPersonaEditorOpen(true)}
          className="text-tavern-accent hover:text-tavern-accent-hover text-xs font-medium"
        >
          + New
        </button>
      </div>
      {loadingPersonas ? (
        <PersonaSkeleton />
      ) : (
        <>
          {personas.map(p => (
            <div
              key={p.id}
              className={`p-2.5 rounded-lg cursor-pointer mb-1 transition-colors flex items-center justify-between ${
                activePersona?.id === p.id ? 'bg-tavern-accent/20 text-tavern-accent' : 'hover:bg-tavern-hover text-tavern-text'
              }`}
              onClick={() => setActivePersona(activePersona?.id === p.id ? null : p)}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-tavern-input border border-tavern-border flex items-center justify-center text-sm font-medium flex-shrink-0">
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm truncate font-medium">{p.name}</p>
                  {p.description && <p className="text-xs text-tavern-dim truncate">{p.description}</p>}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setPersonaEditorOpen(true, p); }}
                className="text-tavern-dim hover:text-tavern-text text-xs p-1.5 rounded-md hover:bg-tavern-hover transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
        </div>
      ))}
          {personas.length === 0 && (
            <p className="text-xs text-tavern-dim text-center py-4">No personas yet</p>
          )}
        </>
      )}
    </div>
  );

  const renderExtensionsPanel = () => (
    <div className="flex-1 overflow-y-auto p-4">
      <h3 className="text-sm font-medium mb-3 text-tavern-text-bright">Extensions</h3>
      <div className="space-y-2">
        <div className="p-3 bg-tavern-input border border-tavern-border rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-tavern-text">Prompt Builder</p>
              <p className="text-xs text-tavern-dim">Configure system prompts</p>
            </div>
            <div className="w-9 h-5 bg-tavern-accent rounded-full relative cursor-pointer">
              <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform" />
            </div>
          </div>
        </div>
        <div className="p-3 bg-tavern-input border border-tavern-border rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-tavern-text">Lorebook Scanner</p>
              <p className="text-xs text-tavern-dim">Auto-inject lore entries</p>
            </div>
            <div className="w-9 h-5 bg-tavern-accent rounded-full relative cursor-pointer">
              <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform" />
            </div>
          </div>
        </div>
        <div className="p-3 bg-tavern-input border border-tavern-border rounded-lg opacity-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-tavern-text">Voice Synthesis</p>
              <p className="text-xs text-tavern-dim">Coming soon</p>
            </div>
            <div className="w-9 h-5 bg-tavern-border rounded-full relative cursor-pointer">
              <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-tavern-dim rounded-full transition-transform" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const panelTitles: Record<string, string> = {
    characters: 'Characters',
    chats: 'Chats',
    personas: 'Personas',
    lorebooks: 'Lorebooks',
    extensions: 'Extensions',
    settings: 'Settings',
  };

  return (
    <div className="absolute left-0 top-0 bottom-0 w-72 bg-tavern-surface border-r border-tavern-border flex flex-col flex-shrink-0 z-30 animate-slide-in shadow-xl">
      {/* Panel Header */}
      <div className="h-[50px] border-b border-tavern-border flex items-center justify-between px-3 flex-shrink-0">
        <h2 className="text-sm font-semibold text-tavern-text-bright">{panelTitles[activePanel || 'characters']}</h2>
        <button
          onClick={() => useStore.setState({ panelOpen: false })}
          className="text-tavern-dim hover:text-tavern-text p-1.5 rounded-md hover:bg-tavern-hover transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Panel Content */}
      {activePanel === 'characters' && renderCharactersPanel()}
      {activePanel === 'chats' && renderChatsPanel()}
      {activePanel === 'personas' && renderPersonasPanel()}
      {activePanel === 'lorebooks' && renderLorebooksPanel()}
      {activePanel === 'extensions' && renderExtensionsPanel()}
      {activePanel === 'settings' && renderSettingsPanel()}
    </div>
  );
}
