import { useState, useRef } from 'react';
import { useStore } from '../store/state';
import { Chapter } from '../types';
import CharacterAvatar from './CharacterAvatar';
import PluginsPanel from './PluginsPanel';
import ChapterEditor from './ChapterEditor';
import { CharacterSkeleton, ChatSkeleton, PersonaSkeleton, LorebookSkeleton } from './LoadingSkeleton';
import { useDebounce } from '../hooks/useDebounce';

export default function Sidebar() {
  const {
    characters, currentCharacter, chats, currentChat,
    selectCharacter, selectChat, createChat, deleteCharacter, deleteChat, renameChat, moveChatToFolder,
    setCharacterEditorOpen, setSettingsOpen, setActivePanel,
    exportChatAction, importChatFile, importCharacterFromFile, exportCharacter,
    personas, activePersona, setActivePersona,
    lorebooks, activeLorebook, setActiveLorebook,
    loadLorebooks, setLorebookEditorOpen, setPersonaEditorOpen,
    exportBackup, restoreBackupFile, setTheme, theme,
    showConfirm, addToast,
    activePanel, panelOpen,
    loadingCharacters, loadingChats, loadingPersonas, loadingLorebooks,
    chapters, chapterSettings, deleteChapter,
    createGroupChat, selectChat: selectChatAction,
  } = useStore();

  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 150);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [folderMenuChatId, setFolderMenuChatId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [folderDropdownChatId, setFolderDropdownChatId] = useState<string | null>(null);
  const [showGroupChatDialog, setShowGroupChatDialog] = useState(false);
  const [groupChatName, setGroupChatName] = useState('');
  const [selectedGroupChars, setSelectedGroupChars] = useState<string[]>([]);
  const chatImportRef = useRef<HTMLInputElement>(null);

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
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json,.png';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) importCharacterFromFile(file);
                };
                input.click();
              }}
              className="text-tavern-dim hover:text-tavern-accent text-xs font-medium px-1.5 py-0.5 rounded hover:bg-tavern-hover transition-colors"
              title="Import Character (JSON or PNG)"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </button>
            <button
              onClick={() => setCharacterEditorOpen(true)}
              className="text-tavern-accent hover:text-tavern-accent-hover text-xs font-medium"
            >
              + New
            </button>
          </div>
        </div>
        {loadingCharacters ? (
          <CharacterSkeleton />
        ) : (
          filteredCharacters.map(char => (
            <div
              key={char.id}
              className={`p-2.5 rounded-lg cursor-pointer mb-1 transition-all duration-150 group relative overflow-hidden ${
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
                <div className="flex gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); setCharacterEditorOpen(true, char); }}
                    className="text-tavern-dim hover:text-tavern-text text-xs p-1.5 rounded-md hover:bg-tavern-hover transition-colors active:scale-90"
                    title="Edit"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); exportCharacter(char.id, 'json'); }}
                    className="text-tavern-dim hover:text-tavern-accent text-xs p-1.5 rounded-md hover:bg-tavern-hover transition-colors active:scale-90"
                    title="Export JSON"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); exportCharacter(char.id, 'png'); }}
                    className="text-tavern-dim hover:text-tavern-accent text-xs p-1.5 rounded-md hover:bg-tavern-hover transition-colors active:scale-90"
                    title="Export PNG"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteCharacter(char.id); }}
                    className="text-tavern-dim hover:text-tavern-danger text-xs p-1.5 rounded-md hover:bg-tavern-hover transition-colors active:scale-90"
                    title="Delete"
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
              onClick={() => setShowGroupChatDialog(true)}
              className="text-tavern-dim hover:text-tavern-accent text-xs px-1.5 py-0.5 rounded border border-tavern-border hover:border-tavern-accent/30 transition-colors"
              title="New group chat"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button
              onClick={() => createChat(currentCharacter.id)}
              className="text-tavern-accent hover:text-tavern-accent-hover text-xs font-medium"
            >
              + New
            </button>
            <button
              onClick={() => chatImportRef.current?.click()}
              className="text-tavern-dim hover:text-tavern-accent text-xs px-1.5 py-0.5 rounded border border-tavern-border hover:border-tavern-accent/30 transition-colors"
              title="Import chat from file"
            >
              ↓
            </button>
            <input
              ref={chatImportRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && currentCharacter) importChatFile(currentCharacter.id, file);
                e.target.value = '';
              }}
            />
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
                  const folderName = newFolderName.trim();
                  setCollapsedFolders(prev => ({ ...prev, [folderName]: false }));
                  // Move the current chat into the new folder so it actually appears
                  if (currentChat) {
                    moveChatToFolder(currentChat.id, folderName);
                  }
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
                  const folderName = newFolderName.trim();
                  setCollapsedFolders(prev => ({ ...prev, [folderName]: false }));
                  if (currentChat) {
                    moveChatToFolder(currentChat.id, folderName);
                  }
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
              className={`p-2.5 rounded-lg cursor-pointer mb-1 transition-all duration-150 flex items-center justify-between group ${
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
                    <>
                      {/* لایه نامرئی برای بستن منو با کلیک بیرون */}
                      <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setFolderDropdownChatId(null); }} />
                      <div className="absolute left-0 top-full mt-1 bg-tavern-surface2 border border-tavern-border rounded-lg shadow-xl shadow-black/30 z-50 py-1 min-w-[140px] animate-pop-in origin-top-left">
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
                    </>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); exportChatAction(chat.id, chat.name); }}
                  className="text-tavern-dim hover:text-tavern-accent text-xs p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-all hover:bg-tavern-hover"
                  title="Export chat"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </button>
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

  const backupImportRef = useRef<HTMLInputElement>(null);

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

      {/* Backup & Restore */}
      <div>
        <h3 className="text-sm font-medium mb-2 text-tavern-text-bright">Backup & Restore</h3>
        <div className="space-y-2">
          <button
            onClick={() => exportBackup()}
            className="w-full p-2.5 bg-tavern-input border border-tavern-border rounded-lg text-sm hover:bg-tavern-hover transition-colors text-left text-tavern-text flex items-center gap-2"
          >
            <svg className="w-4 h-4 text-tavern-accent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download Backup
          </button>
          <button
            onClick={() => backupImportRef.current?.click()}
            className="w-full p-2.5 bg-tavern-input border border-tavern-border rounded-lg text-sm hover:bg-tavern-hover transition-colors text-left text-tavern-text flex items-center gap-2"
          >
            <svg className="w-4 h-4 text-tavern-accent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Restore from Backup
          </button>
          <input
            ref={backupImportRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) restoreBackupFile(file);
              e.target.value = '';
            }}
          />
          <p className="text-[10px] text-tavern-muted">⚠ Restore replaces ALL data including characters, chats, and settings.</p>
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

  const renderChaptersPanel = () => {
    if (!currentChat) {
      return (
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm text-tavern-dim text-center">Select a chat first</p>
        </div>
      );
    }

    return (
      <div className="flex-1 overflow-y-auto p-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-tavern-dim font-medium">Chapters</span>
        </div>

        {chapters.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-10 h-10 mx-auto mb-2 text-tavern-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="text-xs text-tavern-dim">No chapters yet</p>
            <p className="text-[10px] text-tavern-faint mt-1">Create chapters from messages</p>
          </div>
        ) : (
          <div className="space-y-1">
            {chapters.map((ch, chIdx) => (
              <div
                key={ch.id}
                className="p-2.5 rounded-lg cursor-pointer mb-1 transition-colors hover:bg-tavern-hover text-tavern-text group"
              >
                <div className="flex items-start justify-between" onClick={() => {
                  const marker = document.getElementById(`chapter-marker-${ch.id}`);
                  if (marker) {
                    marker.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                  closeSidebarIfMobile();
                }}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3 h-3 text-tavern-accent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      <span className="text-sm truncate font-medium">
                        {ch.title || `Chapter ${chIdx + 1}`}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-tavern-faint">
                      <span>{ch.created_at ? new Date(ch.created_at).toLocaleDateString('en-US') : ''}</span>
                      {ch.manually_edited && <span className="text-tavern-accent">edited</span>}
                      {ch.generation_model && (
                        <span className="truncate max-w-[80px]" title={ch.generation_model}>{ch.generation_model}</span>
                      )}
                    </div>
                  </div>
                </div>
                {/* Action buttons */}
                <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingChapter(ch);
                      closeSidebarIfMobile();
                    }}
                    className="text-tavern-dim hover:text-tavern-accent text-[10px] px-2 py-0.5 rounded hover:bg-tavern-hover transition-colors flex items-center gap-1"
                    title="Edit chapter"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    Edit
                  </button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const ok = await showConfirm(`Delete "${ch.title || `Chapter ${chIdx + 1}`}"? Messages will not be deleted.`);
                      if (ok) deleteChapter(ch.id);
                    }}
                    className="text-tavern-dim hover:text-red-400 text-[10px] px-2 py-0.5 rounded hover:bg-tavern-hover transition-colors flex items-center gap-1"
                    title="Delete chapter"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* اطلاعات تنظیمات */}
        {chapterSettings && (
          <div className="mt-4 pt-3 border-t border-tavern-border">
            <div className="text-[10px] text-tavern-faint space-y-0.5">
              <p>Raw message window: {chapterSettings.raw_window}</p>
              <p>Auto detection: {chapterSettings.auto_detect_enabled ? 'On' : 'Off'}</p>
            </div>
            <button
              onClick={() => setActivePanel('plugins')}
              className="mt-2 text-[10px] text-tavern-accent hover:underline"
            >
              Settings are in the Plugins section
            </button>
          </div>
        )}
      </div>
    );
  };

  const panelTitles: Record<string, string> = {
    characters: 'Characters',
    chats: 'Chats',
    personas: 'Personas',
    lorebooks: 'Lorebooks',
    chapters: 'Chapters',
    plugins: 'Plugins',
    settings: 'Settings',
  };

  return panelOpen ? (
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
      {activePanel === 'plugins' && <PluginsPanel />}
      {activePanel === 'chapters' && renderChaptersPanel()}
      {activePanel === 'settings' && renderSettingsPanel()}

      {/* Group Chat Creation Dialog */}
      {showGroupChatDialog && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-tavern-surface border border-tavern-border rounded-xl shadow-2xl w-80 max-h-[80vh] overflow-hidden animate-pop-in">
            <div className="px-4 py-3 border-b border-tavern-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-tavern-text-bright">Create Group Chat</h3>
              <button
                onClick={() => { setShowGroupChatDialog(false); setSelectedGroupChars([]); setGroupChatName(''); }}
                className="text-tavern-dim hover:text-tavern-text p-1 rounded hover:bg-tavern-hover transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Chat name */}
              <div>
                <label className="text-xs text-tavern-dim mb-1 block">Chat Name (optional)</label>
                <input
                  value={groupChatName}
                  onChange={(e) => setGroupChatName(e.target.value)}
                  placeholder="Group Chat..."
                  className="w-full bg-tavern-input border border-tavern-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-tavern-accent text-tavern-text placeholder-tavern-dim"
                />
              </div>

              {/* Character selection */}
              <div>
                <label className="text-xs text-tavern-dim mb-1 block">
                  Select Characters ({selectedGroupChars.length} selected)
                </label>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {characters.map(char => {
                    const isSelected = selectedGroupChars.includes(char.id);
                    return (
                      <button
                        key={char.id}
                        onClick={() => {
                          setSelectedGroupChars(prev =>
                            isSelected ? prev.filter(id => id !== char.id) : [...prev, char.id]
                          );
                        }}
                        className={`w-full flex items-center gap-2 p-2 rounded-lg transition-all text-left ${
                          isSelected
                            ? 'bg-tavern-accent/20 border border-tavern-accent/30'
                            : 'hover:bg-tavern-hover border border-transparent'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          isSelected ? 'bg-tavern-accent border-tavern-accent' : 'border-tavern-border'
                        }`}>
                          {isSelected && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <CharacterAvatar name={char.name} avatar={char.avatar} size="sm" />
                        <span className="text-sm text-tavern-text truncate">{char.name}</span>
                      </button>
                    );
                  })}
                  {characters.length === 0 && (
                    <p className="text-xs text-tavern-dim text-center py-4">No characters created yet</p>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="px-4 py-3 border-t border-tavern-border flex gap-2 justify-end">
              <button
                onClick={() => { setShowGroupChatDialog(false); setSelectedGroupChars([]); setGroupChatName(''); }}
                className="px-4 py-1.5 text-sm text-tavern-dim hover:text-tavern-text rounded-lg hover:bg-tavern-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (selectedGroupChars.length < 1) {
                    addToast('Select at least one character', 'error');
                    return;
                  }
                  try {
                    const chat = await createGroupChat({
                      name: groupChatName.trim() || undefined,
                      character_ids: selectedGroupChars,
                    });
                    await selectChatAction(chat.id);
                    setShowGroupChatDialog(false);
                    setSelectedGroupChars([]);
                    setGroupChatName('');
                  } catch (error: any) {
                    addToast(`Error: ${error.message}`, 'error');
                  }
                }}
                disabled={selectedGroupChars.length < 1}
                className="px-4 py-1.5 text-sm bg-tavern-accent text-white rounded-lg font-medium hover:bg-tavern-accent-hover transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Create ({selectedGroupChars.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chapter Editor Modal */}
      {editingChapter && (
        <ChapterEditor
          chapter={editingChapter}
          onClose={() => setEditingChapter(null)}
        />
      )}
    </div>
  ) : null;
}
