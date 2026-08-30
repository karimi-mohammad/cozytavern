import { useState, useEffect } from 'react';
import { useStore } from '../store/state';
import { api } from '../api/client';
import { StoryState, CharacterState } from '../types';

interface Props {
  messageId: string;
  isUser: boolean;
}

interface StateDiff {
  characters?: Record<string, Partial<CharacterState>>;
  relationships?: Record<string, string>;
  relationship_details?: Record<string, any>;
  current_situation?: string;
  rules?: string[];
  memories?: any[];
}

export default function StateChangeIndicator({ messageId, isUser }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [diff, setDiff] = useState<StateDiff | null>(null);
  const { storyState, currentChat } = useStore();

  useEffect(() => {
    if (currentChat && !snapshot) {
      loadSnapshot();
    }
  }, [messageId, currentChat]);

  useEffect(() => {
    if (snapshot && storyState) {
      calculateDiff(snapshot);
    }
  }, [storyState, snapshot]);

  const loadSnapshot = async () => {
    if (!currentChat) return;
    setLoading(true);
    try {
      const snap = await api.getSnapshot(currentChat.id, messageId);
      setSnapshot(snap);
      calculateDiff(snap);
    } catch (e) {
      console.log('No snapshot found for this message');
    } finally {
      setLoading(false);
    }
  };

  const calculateDiff = (snap: any) => {
    if (!snap || !storyState) return;

    const diff: StateDiff = {};

    // Character changes
    const oldChars = snap.characters || {};
    const newChars = storyState.characters || {};
    const charDiff: Record<string, Partial<CharacterState>> = {};

    for (const name of Object.keys(newChars)) {
      const oldChar = oldChars[name] || {};
      const newChar = newChars[name] || {};
      const changes: Partial<CharacterState> = {};

      if (newChar.location !== oldChar.location) {
        changes.location = newChar.location;
      }
      if (newChar.position !== oldChar.position) {
        changes.position = newChar.position;
      }
      if (newChar.clothing !== oldChar.clothing) {
        changes.clothing = newChar.clothing;
      }

      if (Object.keys(changes).length > 0) {
        charDiff[name] = changes;
      }
    }

    if (Object.keys(charDiff).length > 0) {
      diff.characters = charDiff;
    }

    // Relationship changes
    if (JSON.stringify(storyState.relationships) !== JSON.stringify(snap.relationships)) {
      diff.relationships = storyState.relationships;
    }

    // Situation changes
    if (storyState.current_situation !== snap.current_situation) {
      diff.current_situation = storyState.current_situation;
    }

    // Rules changes
    if (JSON.stringify(storyState.rules) !== JSON.stringify(snap.rules)) {
      diff.rules = storyState.rules;
    }

    // Relationship Details changes
    const oldDetails = (snap as any).relationship_details || {};
    const newDetails = (storyState as any).relationship_details || {};
    if (JSON.stringify(oldDetails) !== JSON.stringify(newDetails)) {
      diff.relationship_details = newDetails;
    }

    // Memories changes
    const oldMemories = (snap as any).memories || [];
    const newMemories = (storyState as any).memories || [];
    if (JSON.stringify(oldMemories) !== JSON.stringify(newMemories)) {
      diff.memories = newMemories;
    }

    if (Object.keys(diff).length > 0) {
      setDiff(diff);
    }
  };

  if (isUser) return null;

  return (
    <div className="mt-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-md transition-all duration-200 ${
          diff
            ? 'text-tavern-accent bg-tavern-accent/10 hover:bg-tavern-accent/20 border border-tavern-accent/20'
            : 'text-tavern-faint hover:text-tavern-dim hover:bg-tavern-hover'
        }`}
      >
        <svg
          className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
        </svg>
        <span>{diff ? 'State changes' : 'No state changes'}</span>
      </button>

      {isOpen && (
        <div className="mt-2 p-3 bg-tavern-surface border border-tavern-border rounded-lg text-xs">
          {loading ? (
            <div className="flex items-center gap-2 text-tavern-dim">
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading...
            </div>
          ) : diff ? (
            <div className="space-y-3">
              {/* Characters */}
              {diff.characters && Object.keys(diff.characters).length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <svg className="w-3 h-3 text-tavern-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="font-medium text-tavern-text-bright">Characters</span>
                  </div>
                  <div className="space-y-2 pl-4">
                    {Object.entries(diff.characters).map(([name, changes]) => (
                      <div key={name} className="bg-tavern-bg rounded p-2">
                        <span className="font-medium text-tavern-accent">{name}</span>
                        <div className="mt-1 space-y-1">
                          {Object.entries(changes).map(([field, value]) => (
                            <div key={field} className="flex items-center gap-2">
                              <span className="text-tavern-dim capitalize">{field}:</span>
                              <span className="text-tavern-text">{value || '(empty)'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Relationships */}
              {diff.relationships && Object.keys(diff.relationships).length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <svg className="w-3 h-3 text-tavern-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    <span className="font-medium text-tavern-text-bright">Relationships</span>
                  </div>
                  <div className="space-y-1 pl-4">
                    {Object.entries(diff.relationships).map(([pair, status]) => (
                      <div key={pair} className="flex items-center gap-2 text-tavern-text">
                        <span className="text-tavern-accent">{pair}</span>
                        <span className="text-tavern-dim">→</span>
                        <span>{status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Situation */}
              {diff.current_situation && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <svg className="w-3 h-3 text-tavern-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span className="font-medium text-tavern-text-bright">Situation</span>
                  </div>
                  <p className="text-tavern-text pl-4">{diff.current_situation}</p>
                </div>
              )}

              {/* Rules */}
              {diff.rules && diff.rules.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <svg className="w-3 h-3 text-tavern-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <span className="font-medium text-tavern-text-bright">Rules</span>
                  </div>
                  <ul className="space-y-1 pl-4">
                    {diff.rules.map((rule, i) => (
                      <li key={i} className="text-tavern-text">• {rule}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Relationship Details */}
              {diff.relationship_details && Object.keys(diff.relationship_details).length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <svg className="w-3 h-3 text-tavern-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    <span className="font-medium text-tavern-text-bright">Emotions</span>
                  </div>
                  <div className="space-y-2 pl-4">
                    {Object.entries(diff.relationship_details).map(([pair, detail]: [string, any]) => (
                      <div key={pair} className="bg-tavern-bg rounded p-2">
                        <span className="font-medium text-tavern-accent text-[10px]">{pair}</span>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {Object.entries(detail).filter(([k]) => k !== 'summary').map(([emotion, value]) => (
                            <span key={emotion} className="text-[10px] text-tavern-dim">
                              {emotion}: <span className="text-tavern-text">{value as number}%</span>
                            </span>
                          ))}
                        </div>
                        {detail.summary && (
                          <p className="text-[10px] text-tavern-dim mt-1 italic">{detail.summary}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Memories */}
              {diff.memories && diff.memories.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <svg className="w-3 h-3 text-tavern-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <span className="font-medium text-tavern-text-bright">Memories</span>
                  </div>
                  <ul className="space-y-1 pl-4">
                    {diff.memories.map((mem: any, i: number) => (
                      <li key={i} className="text-tavern-text text-[10px]">• {mem.content}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-tavern-dim text-center py-2">No state changes for this message</p>
          )}
        </div>
      )}
    </div>
  );
}
