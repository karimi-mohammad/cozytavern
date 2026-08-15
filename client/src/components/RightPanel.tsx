import { useStore } from '../store/state';
import CharacterAvatar from './CharacterAvatar';
import { api } from '../api/client';

export default function RightPanel() {
  const {
    rightPanelOpen, currentCharacter, currentChat, lorebooks,
    setLorebookEditorOpen, setCharacterEditorOpen,
  } = useStore();

  if (!rightPanelOpen) return null;

  return (
    <div className="absolute right-0 top-0 bottom-0 w-72 bg-tavern-surface border-l border-tavern-border flex flex-col flex-shrink-0 z-30 animate-slide-in shadow-xl overflow-hidden">
      {currentCharacter ? (
        <>
          {/* Character Info Header */}
          <div className="p-4 border-b border-tavern-border">
            <div className="flex items-center gap-3 mb-3">
              <CharacterAvatar name={currentCharacter.name} avatar={currentCharacter.avatar} size="lg" />
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-tavern-text-bright truncate">{currentCharacter.name}</h3>
                {currentCharacter.personality && (
                  <p className="text-xs text-tavern-dim truncate">{currentCharacter.personality}</p>
                )}
              </div>
            </div>
            <button
              onClick={() => setCharacterEditorOpen(true, currentCharacter)}
              className="w-full text-xs text-tavern-accent hover:text-tavern-accent-hover transition-colors font-medium"
            >
              Edit Character
            </button>
          </div>

          {/* Character Description */}
          {currentCharacter.description && (
            <div className="p-4 border-b border-tavern-border">
              <h4 className="text-xs font-medium text-tavern-dim mb-2">Description</h4>
              <p className="text-xs text-tavern-text leading-relaxed line-clamp-6">
                {currentCharacter.description}
              </p>
            </div>
          )}

          {/* Lorebook Selector */}
          <div className="p-4 border-b border-tavern-border">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-medium text-tavern-dim">Lorebook</h4>
              <button
                onClick={() => setLorebookEditorOpen(true)}
                className="text-tavern-accent hover:text-tavern-accent-hover text-xs font-medium"
              >
                Manage
              </button>
            </div>
            <select
              value={currentChat?.lorebook_id || ''}
              onChange={(e) => {
                if (currentChat) {
                  api.updateChat(currentChat.id, { lorebook_id: e.target.value });
                  useStore.setState(s => ({
                    currentChat: s.currentChat ? { ...s.currentChat, lorebook_id: e.target.value } : null,
                  }));
                }
              }}
              className="w-full bg-tavern-input border border-tavern-border rounded-md px-2 py-1.5 text-xs focus:outline-none focus:border-tavern-accent text-tavern-text"
            >
              <option value="">None</option>
              {lorebooks.map(lb => (
                <option key={lb.id} value={lb.id}>{lb.name}</option>
              ))}
            </select>
          </div>

          {/* Scenario */}
          {currentCharacter.scenario && (
            <div className="p-4 border-b border-tavern-border">
              <h4 className="text-xs font-medium text-tavern-dim mb-2">Scenario</h4>
              <p className="text-xs text-tavern-text leading-relaxed">
                {currentCharacter.scenario}
              </p>
            </div>
          )}

          {/* First Message */}
          {currentCharacter.first_mes && (
            <div className="p-4">
              <h4 className="text-xs font-medium text-tavern-dim mb-2">First Message</h4>
              <p className="text-xs text-tavern-text leading-relaxed line-clamp-4">
                {currentCharacter.first_mes}
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <svg className="w-14 h-14 mx-auto mb-4 text-tavern-text opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-tavern-text font-medium">Select a character</p>
            <p className="text-xs mt-1.5 text-tavern-muted">to view details</p>
          </div>
        </div>
      )}
    </div>
  );
}
