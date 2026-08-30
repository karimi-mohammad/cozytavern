import { useState } from 'react';
import { useStore } from '../store/state';
import CharacterAvatar from './CharacterAvatar';

interface Props {
  onClose: () => void;
}

export default function GroupChatManager({ onClose }: Props) {
  // استفاده از selector‌های جداگانه برای جلوگیری از re-render بی‌رویه
  const characters = useStore(s => s.characters);
  const currentChat = useStore(s => s.currentChat);
  const groupChatParticipants = useStore(s => s.groupChatParticipants);
  const addParticipant = useStore(s => s.addParticipant);
  const removeParticipant = useStore(s => s.removeParticipant);
  const toggleParticipant = useStore(s => s.toggleParticipant);
  const addCharacterToChat = useStore(s => s.addCharacterToChat);
  const generateGroupResponse = useStore(s => s.generateGroupResponse);
  const selectedCharacterForResponse = useStore(s => s.selectedCharacterForResponse);
  const setSelectedCharacterForResponse = useStore(s => s.setSelectedCharacterForResponse);
  const isGenerating = useStore(s => s.isGenerating);
  const groupChatGenerating = useStore(s => s.groupChatGenerating);

  const [showAddCharacter, setShowAddCharacter] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  if (!currentChat) return null;

  const isGroupChat = currentChat.is_group_chat;

  // Characters not yet in the group
  const participantCharIds = new Set(groupChatParticipants.map(p => p.character_id));
  // Also exclude the main character of the chat
  const availableCharacters = characters.filter(c =>
    c.id !== currentChat.character_id &&
    !participantCharIds.has(c.id) &&
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeParticipants = groupChatParticipants.filter(p => p.is_active);
  const inactiveParticipants = groupChatParticipants.filter(p => !p.is_active);

  const handleAddCharacter = async (charId: string) => {
    if (isGroupChat) {
      addParticipant(currentChat.id, charId);
    } else {
      // Convert normal chat to group chat
      await addCharacterToChat(currentChat.id, charId);
    }
    setSearchQuery('');
    setShowAddCharacter(false);
  };

  return (
    <div className="bg-tavern-surface border-b border-tavern-border px-4 py-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-tavern-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-sm font-medium text-tavern-text-bright">
            {isGroupChat
              ? `Group Chat Members (${activeParticipants.length} active)`
              : 'Add Character to Chat'
            }
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddCharacter(!showAddCharacter)}
            className="text-xs text-tavern-accent hover:text-tavern-accent-hover transition-colors px-2 py-1 rounded hover:bg-tavern-hover"
          >
            {showAddCharacter ? 'Cancel' : '+ Add'}
          </button>
          <button
            onClick={onClose}
            className="text-tavern-dim hover:text-tavern-text p-1 rounded hover:bg-tavern-hover transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Info for normal chats */}
      {!isGroupChat && !showAddCharacter && (
        <p className="text-xs text-tavern-dim mb-2">
          Add another character to turn this into a group chat.
        </p>
      )}

      {/* Add Character Search */}
      {showAddCharacter && (
        <div className="mb-3 p-2 bg-tavern-input rounded-lg border border-tavern-border">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search characters to add..."
            className="w-full bg-tavern-surface border border-tavern-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-tavern-accent text-tavern-text placeholder-tavern-dim mb-2"
            autoFocus
          />
          <div className="max-h-32 overflow-y-auto">
            {availableCharacters.length === 0 ? (
              <p className="text-xs text-tavern-dim text-center py-2">No characters available</p>
            ) : (
              availableCharacters.map(char => (
                <button
                  key={char.id}
                  onClick={() => handleAddCharacter(char.id)}
                  className="w-full flex items-center gap-2 p-1.5 rounded hover:bg-tavern-hover transition-colors text-left"
                >
                  <CharacterAvatar name={char.name} avatar={char.avatar} size="sm" />
                  <span className="text-xs text-tavern-text truncate">{char.name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Participants List (only for group chats) */}
      {isGroupChat && (
        <div className="flex flex-wrap gap-2">
          {activeParticipants.map(p => {
            const char = characters.find(c => c.id === p.character_id);
            return (
              <div
                key={p.id}
                className="flex items-center gap-2 bg-tavern-accent/15 border border-tavern-accent/30 rounded-lg px-2.5 py-1.5 group"
              >
                <CharacterAvatar
                  name={char?.name || p.display_name}
                  avatar={char?.avatar || p.display_avatar}
                  size="sm"
                />
                <span className="text-xs font-medium text-tavern-text truncate max-w-[80px]">
                  {char?.name || p.display_name}
                </span>
                {/* Generate button */}
                <button
                  onClick={() => generateGroupResponse(currentChat.id, p.character_id)}
                  disabled={isGenerating}
                  className="text-tavern-accent hover:text-tavern-accent-hover disabled:opacity-30 p-0.5 rounded transition-colors"
                  title={`Generate response as ${char?.name}`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
                {/* Toggle active */}
                <button
                  onClick={() => toggleParticipant(currentChat.id, p.id, false)}
                  className="text-tavern-dim hover:text-tavern-danger p-0.5 rounded transition-colors"
                  title="Deactivate"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </button>
                {/* Remove */}
                <button
                  onClick={() => removeParticipant(currentChat.id, p.id)}
                  className="text-tavern-dim hover:text-tavern-danger p-0.5 rounded opacity-0 group-hover:opacity-100 transition-all"
                  title="Remove"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}

          {/* Inactive participants */}
          {inactiveParticipants.map(p => {
            const char = characters.find(c => c.id === p.character_id);
            return (
              <div
                key={p.id}
                className="flex items-center gap-2 bg-tavern-input border border-tavern-border rounded-lg px-2.5 py-1.5 opacity-50 group"
              >
                <CharacterAvatar
                  name={char?.name || p.display_name}
                  avatar={char?.avatar || p.display_avatar}
                  size="sm"
                />
                <span className="text-xs text-tavern-dim truncate max-w-[80px]">
                  {char?.name || p.display_name}
                </span>
                <button
                  onClick={() => toggleParticipant(currentChat.id, p.id, true)}
                  className="text-tavern-accent hover:text-tavern-accent-hover p-0.5 rounded transition-colors"
                  title="Activate"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
                <button
                  onClick={() => removeParticipant(currentChat.id, p.id)}
                  className="text-tavern-dim hover:text-tavern-danger p-0.5 rounded opacity-0 group-hover:opacity-100 transition-all"
                  title="Remove"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
