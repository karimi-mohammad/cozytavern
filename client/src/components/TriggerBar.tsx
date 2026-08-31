import { useStore } from '../store/state';
import CharacterAvatar from './CharacterAvatar';

interface Props {
  chatId: string;
}

export default function TriggerBar({ chatId }: Props) {
  const groupChatParticipants = useStore(s => s.groupChatParticipants);
  const characters = useStore(s => s.characters);
  const generateGroupResponse = useStore(s => s.generateGroupResponse);
  const isGenerating = useStore(s => s.isGenerating);

  const activeParticipants = groupChatParticipants.filter(p => p.is_active);

  const handleTrigger = (characterId: string) => {
    if (isGenerating) return;
    generateGroupResponse(chatId, characterId);
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-t border-tavern-border bg-tavern-surface/50">
      <span className="text-xs text-tavern-dim">Trigger:</span>
      {activeParticipants.map(p => {
        const char = characters.find(c => c.id === p.character_id);
        return (
          <button
            key={p.character_id}
            onClick={() => handleTrigger(p.character_id)}
            disabled={isGenerating}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-tavern-accent/10 text-tavern-accent
                       hover:bg-tavern-accent/20 disabled:opacity-50 transition-colors"
            title={`Generate response as ${char?.name || p.display_name}`}
          >
            <CharacterAvatar name={char?.name || p.display_name} avatar={char?.avatar} size="xs" />
            <span className="truncate max-w-[80px]">{char?.name || p.display_name}</span>
          </button>
        );
      })}
    </div>
  );
}
