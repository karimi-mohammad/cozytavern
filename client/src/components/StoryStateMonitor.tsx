import { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/state';
import { StoryState, CharacterState } from '../types';

interface StateLogEntry {
  timestamp: string;
  type: 'update' | 'initial' | 'manual' | 'rollback';
  changes: Partial<StoryState>;
  description: string;
}

export default function StoryStateMonitor() {
  const { storyStateOpen, setStoryStateOpen, storyState, loadingStoryState, loadStoryState, currentChat, updateStoryState } = useStore();
  const [activeTab, setActiveTab] = useState<'state' | 'log' | 'raw'>('state');
  const [stateLog, setStateLog] = useState<StateLogEntry[]>([]);
  const [expandedChars, setExpandedChars] = useState<Record<string, boolean>>({});
  const prevStoryState = useRef<StoryState | null>(null);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editState, setEditState] = useState<StoryState | null>(null);

  // Helper functions (defined before useEffect to avoid hoisting issues)
  const detectChanges = (oldState: StoryState, newState: StoryState): Partial<StoryState> | null => {
    const changes: any = {};

    const oldChars = oldState.characters || {};
    const newChars = newState.characters || {};
    const charChanges: Record<string, Partial<CharacterState>> = {};

    for (const name of Object.keys(newChars)) {
      const oldChar = oldChars[name] || {};
      const newChar = newChars[name] || {};
      const charDiff: Partial<CharacterState> = {};

      if (newChar.location !== oldChar.location) charDiff.location = newChar.location;
      if (newChar.position !== oldChar.position) charDiff.position = newChar.position;
      if (newChar.clothing !== oldChar.clothing) charDiff.clothing = newChar.clothing;

      if (Object.keys(charDiff).length > 0) {
        charChanges[name] = charDiff;
      }
    }

    if (Object.keys(charChanges).length > 0) {
      changes.characters = charChanges;
    }

    if (JSON.stringify(newState.relationships) !== JSON.stringify(oldState.relationships)) {
      changes.relationships = newState.relationships;
    }

    if (newState.current_situation !== oldState.current_situation) {
      changes.current_situation = newState.current_situation;
    }

    if (JSON.stringify(newState.rules) !== JSON.stringify(oldState.rules)) {
      changes.rules = newState.rules;
    }

    return Object.keys(changes).length > 0 ? changes : null;
  };

  const generateDescription = (changes: Partial<StoryState>): string => {
    const parts: string[] = [];

    if (changes.characters) {
      for (const [name, charChanges] of Object.entries(changes.characters)) {
        const updated = Object.keys(charChanges).filter(k => charChanges[k as keyof CharacterState]);
        if (updated.length > 0) {
          parts.push(`${name}'s ${updated.join(', ')} updated`);
        }
      }
    }

    if (changes.current_situation) {
      parts.push('Situation changed');
    }

    if (changes.relationships) {
      parts.push('Relationships updated');
    }

    if (changes.rules) {
      parts.push(`${changes.rules.length} rules`);
    }

    return parts.join(', ') || 'State updated';
  };

  const toggleCharExpanded = (name: string) => {
    setExpandedChars(prev => ({ ...prev, [name]: !prev[name] }));
  };

  // Load state when modal opens
  useEffect(() => {
    if (storyStateOpen && currentChat) {
      loadStoryState(currentChat.id);
    }
  }, [storyStateOpen, currentChat]);

  // Track state changes for log
  useEffect(() => {
    if (storyState && prevStoryState.current) {
      const changes = detectChanges(prevStoryState.current, storyState);
      if (changes) {
        const entry: StateLogEntry = {
          timestamp: new Date().toISOString(),
          type: 'update',
          changes: changes,
          description: generateDescription(changes),
        };
        setStateLog(prev => [entry, ...prev].slice(0, 50));
      }
    } else if (storyState && !prevStoryState.current) {
      setStateLog([{
        timestamp: new Date().toISOString(),
        type: 'initial',
        changes: storyState,
        description: 'Initial state loaded',
      }]);
    }
    prevStoryState.current = storyState ? { ...storyState } : null;
  }, [storyState]);

  // Listen for story_state_updated events from SSE
  useEffect(() => {
    if (!currentChat) return;

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'story_state_update' && e.newValue) {
        try {
          const update = JSON.parse(e.newValue);
          if (update.chat_id === currentChat.id) {
            loadStoryState(currentChat.id);
          }
        } catch {}
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [currentChat]);

  // بستن مودال با کلید Escape
  useEffect(() => {
    if (!storyStateOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEditing) {
          setIsEditing(false);
          setEditState(null);
        } else {
          setStoryStateOpen(false);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [storyStateOpen, isEditing]);

  if (!storyStateOpen) return null;

  // Start editing
  const startEditing = () => {
    setEditState(storyState ? { ...storyState } : null);
    setIsEditing(true);
  };

  // Cancel editing
  const cancelEditing = () => {
    setIsEditing(false);
    setEditState(null);
  };

  // Save edited state
  const saveEditedState = async () => {
    if (!currentChat || !editState) return;
    await updateStoryState(currentChat.id, editState);
    setIsEditing(false);
    setEditState(null);
    useStore.getState().addToast('State saved', 'success');
  };

  // Add new character
  const addCharacter = () => {
    const name = prompt('Character name:');
    if (name && editState) {
      setEditState({
        ...editState,
        characters: {
          ...editState.characters,
          [name]: { location: '', position: '', clothing: '' },
        },
      });
      setExpandedChars(prev => ({ ...prev, [name]: true }));
    }
  };

  // Remove character
  const removeCharacter = (name: string) => {
    if (!editState) return;
    const newChars = { ...editState.characters };
    delete newChars[name];
    setEditState({ ...editState, characters: newChars });
  };

  // Update character field
  const updateCharacterField = (name: string, field: keyof CharacterState, value: string) => {
    if (!editState) return;
    setEditState({
      ...editState,
      characters: {
        ...editState.characters,
        [name]: {
          ...(editState.characters[name] || {}),
          [field]: value,
        },
      },
    });
  };

  // Add relationship
  const addRelationship = () => {
    const pair = prompt('Relationship pair (e.g., Alice-Bob):');
    if (pair && editState) {
      setEditState({
        ...editState,
        relationships: {
          ...editState.relationships,
          [pair]: '',
        },
      });
    }
  };

  // Update relationship
  const updateRelationship = (pair: string, value: string) => {
    if (!editState) return;
    setEditState({
      ...editState,
      relationships: {
        ...editState.relationships,
        [pair]: value,
      },
    });
  };

  // Remove relationship
  const removeRelationship = (pair: string) => {
    if (!editState) return;
    const newRels = { ...editState.relationships };
    delete newRels[pair];
    setEditState({ ...editState, relationships: newRels });
  };

  // Add relationship detail
  const addRelationshipDetail = () => {
    const pair = prompt('Relationship pair (e.g., Alice-Bob):');
    if (pair && editState) {
      const newDetails = { ...(editState as any).relationship_details || {} };
      newDetails[pair] = {
        love: 50, trust: 50, respect: 50, anger: 0, fear: 0,
        gratitude: 0, jealousy: 0, shame: 0, affection: 50, summary: ''
      };
      setEditState({ ...editState, relationship_details: newDetails } as any);
    }
  };

  // Update relationship detail emotion
  const updateRelationshipDetailEmotion = (pair: string, emotion: string, value: number) => {
    if (!editState) return;
    const newDetails = { ...(editState as any).relationship_details || {} };
    if (!newDetails[pair]) {
      newDetails[pair] = {};
    }
    newDetails[pair][emotion] = Math.max(0, Math.min(100, value));
    setEditState({ ...editState, relationship_details: newDetails } as any);
  };

  // Update relationship detail summary
  const updateRelationshipDetailSummary = (pair: string, summary: string) => {
    if (!editState) return;
    const newDetails = { ...(editState as any).relationship_details || {} };
    if (!newDetails[pair]) {
      newDetails[pair] = {};
    }
    newDetails[pair].summary = summary;
    setEditState({ ...editState, relationship_details: newDetails } as any);
  };

  // Remove relationship detail
  const removeRelationshipDetail = (pair: string) => {
    if (!editState) return;
    const newDetails = { ...(editState as any).relationship_details || {} };
    delete newDetails[pair];
    setEditState({ ...editState, relationship_details: newDetails } as any);
  };

  // Add rule
  const addRule = () => {
    const rule = prompt('New rule:');
    if (rule && editState) {
      setEditState({
        ...editState,
        rules: [...(editState.rules || []), rule],
      });
    }
  };

  // Update rule
  const updateRule = (index: number, value: string) => {
    if (!editState) return;
    const newRules = [...editState.rules];
    newRules[index] = value;
    setEditState({ ...editState, rules: newRules });
  };

  // Remove rule
  const removeRule = (index: number) => {
    if (!editState) return;
    const newRules = [...editState.rules];
    newRules.splice(index, 1);
    setEditState({ ...editState, rules: newRules });
  };

  const displayState = isEditing ? editState : storyState;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-3 md:p-4 modal-enter-overlay">
      <div className="bg-tavern-card border border-tavern-border rounded-xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl shadow-black/40 modal-enter-card">
        {/* Header */}
        <div className="p-4 border-b border-tavern-border flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-tavern-accent/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-tavern-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-tavern-text-bright">Story State</h2>
              <p className="text-xs text-tavern-dim">
                {isEditing ? 'Editing mode' : 'Real-time state tracking'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={cancelEditing}
                  className="px-3 py-1.5 text-xs text-tavern-dim hover:text-tavern-text rounded-lg hover:bg-tavern-hover transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEditedState}
                  className="px-3 py-1.5 text-xs bg-tavern-accent hover:bg-tavern-accent-hover text-white rounded-lg font-medium transition-colors"
                >
                  Save
                </button>
              </>
            ) : (
              <button
                onClick={startEditing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-tavern-accent hover:bg-tavern-accent/10 rounded-lg transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
            )}
            <button onClick={() => setStoryStateOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-md text-tavern-muted hover:text-tavern-text hover:bg-tavern-hover transition-colors active:scale-90">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-tavern-border">
          <button
            onClick={() => setActiveTab('state')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'state' ? 'text-tavern-accent border-b-2 border-tavern-accent' : 'text-tavern-muted hover:text-tavern-text'
            }`}
          >
            Current State
          </button>
          <button
            onClick={() => setActiveTab('log')}
            className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
              activeTab === 'log' ? 'text-tavern-accent border-b-2 border-tavern-accent' : 'text-tavern-muted hover:text-tavern-text'
            }`}
          >
            Change Log
            {stateLog.length > 0 && (
              <span className="absolute top-2 right-4 w-2 h-2 bg-tavern-accent rounded-full animate-pulse" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('raw')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'raw' ? 'text-tavern-accent border-b-2 border-tavern-accent' : 'text-tavern-muted hover:text-tavern-text'
            }`}
          >
            Raw JSON
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loadingStoryState ? (
            <div className="text-center py-8">
              <svg className="w-8 h-8 mx-auto mb-2 text-tavern-accent animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-tavern-dim">Loading state...</p>
            </div>
          ) : (
            <>
              {/* Current State Tab */}
              {activeTab === 'state' && displayState && (
                <div className="space-y-6">
                  {/* Current Situation */}
                  <div className="bg-tavern-bg border border-tavern-border rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="w-4 h-4 text-tavern-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <h3 className="text-sm font-semibold text-tavern-text-bright">Current Situation</h3>
                    </div>
                    {isEditing ? (
                      <textarea
                        value={editState?.current_situation || ''}
                        onChange={(e) => setEditState(prev => prev ? { ...prev, current_situation: e.target.value } : null)}
                        className="w-full bg-tavern-surface border border-tavern-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-tavern-accent resize-none"
                        rows={2}
                        placeholder="What is happening right now..."
                      />
                    ) : (
                      displayState.current_situation ? (
                        <p className="text-sm text-tavern-text leading-relaxed">{displayState.current_situation}</p>
                      ) : (
                        <p className="text-xs text-tavern-dim italic">No situation defined</p>
                      )
                    )}
                  </div>

                  {/* Characters */}
                  <div className="bg-tavern-bg border border-tavern-border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-tavern-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <h3 className="text-sm font-semibold text-tavern-text-bright">Characters</h3>
                        <span className="text-xs text-tavern-dim">({Object.keys(displayState.characters || {}).length})</span>
                      </div>
                      {isEditing && (
                        <button onClick={addCharacter} className="text-xs text-tavern-accent hover:underline">+ Add</button>
                      )}
                    </div>
                    {Object.keys(displayState.characters || {}).length > 0 ? (
                      <div className="space-y-3">
                        {Object.entries(displayState.characters || {}).map(([name, state]) => (
                          <div key={name} className="bg-tavern-surface rounded-lg border border-tavern-border overflow-hidden">
                            <button
                              onClick={() => toggleCharExpanded(name)}
                              className="w-full px-3 py-2 flex items-center justify-between hover:bg-tavern-hover transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-tavern-accent/20 flex items-center justify-center">
                                  <span className="text-xs font-medium text-tavern-accent">{name.charAt(0)}</span>
                                </div>
                                <span className="text-sm font-medium text-tavern-text-bright">{name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {isEditing && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); removeCharacter(name); }}
                                    className="text-red-400 text-xs hover:underline"
                                  >Remove</button>
                                )}
                                <svg
                                  className={`w-4 h-4 text-tavern-dim transition-transform ${expandedChars[name] ? 'rotate-180' : ''}`}
                                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </button>
                            {expandedChars[name] && (
                              <div className="px-3 pb-3 pt-1 border-t border-tavern-border space-y-2">
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                  {(['location', 'position', 'clothing'] as const).map(field => (
                                    <div key={field} className="bg-tavern-bg rounded p-2">
                                      <span className="text-tavern-dim block mb-1 capitalize">{field}</span>
                                      {isEditing ? (
                                        <input
                                          value={state?.[field] || ''}
                                          onChange={(e) => updateCharacterField(name, field, e.target.value)}
                                          className="w-full bg-tavern-surface border border-tavern-border rounded px-2 py-1 text-xs focus:outline-none focus:border-tavern-accent"
                                          placeholder={field}
                                        />
                                      ) : (
                                        <span className="text-tavern-text">{state?.[field] || '-'}</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-tavern-dim text-center py-3">No characters tracked</p>
                    )}
                  </div>

                  {/* Relationships */}
                  <div className="bg-tavern-bg border border-tavern-border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-tavern-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                        <h3 className="text-sm font-semibold text-tavern-text-bright">Relationships</h3>
                        <span className="text-xs text-tavern-dim">({Object.keys(displayState.relationships || {}).length})</span>
                      </div>
                      {isEditing && (
                        <button onClick={addRelationship} className="text-xs text-tavern-accent hover:underline">+ Add</button>
                      )}
                    </div>
                    {Object.keys(displayState.relationships || {}).length > 0 ? (
                      <div className="space-y-2">
                        {Object.entries(displayState.relationships || {}).map(([pair, status]) => (
                          <div key={pair} className="flex items-center gap-3 bg-tavern-surface rounded-lg p-2">
                            <div className="flex items-center gap-1 min-w-[100px]">
                              <span className="text-xs font-medium text-tavern-text-bright">{pair.split('-')[0]}</span>
                              <svg className="w-3 h-3 text-tavern-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                              </svg>
                              <span className="text-xs font-medium text-tavern-text-bright">{pair.split('-')[1]}</span>
                            </div>
                            {isEditing ? (
                              <div className="flex-1 flex items-center gap-2">
                                <input
                                  value={status as string}
                                  onChange={(e) => updateRelationship(pair, e.target.value)}
                                  className="flex-1 bg-tavern-bg border border-tavern-border rounded px-2 py-1 text-xs focus:outline-none focus:border-tavern-accent"
                                />
                                <button
                                  onClick={() => removeRelationship(pair)}
                                  className="text-red-400 text-xs"
                                >×</button>
                              </div>
                            ) : (
                              <span className="text-xs text-tavern-text">{status}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-tavern-dim text-center py-3">No relationships tracked</p>
                    )}
                  </div>

                  {/* Relationship Details (Emotions) */}
                  <div className="bg-tavern-bg border border-tavern-border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-tavern-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                        <h3 className="text-sm font-semibold text-tavern-text-bright">Relationship Details</h3>
                        <span className="text-xs text-tavern-dim">({Object.keys((displayState as any).relationship_details || {}).length})</span>
                      </div>
                      {isEditing && (
                        <button onClick={addRelationshipDetail} className="text-xs text-tavern-accent hover:underline">+ Add</button>
                      )}
                    </div>
                    {Object.keys((displayState as any).relationship_details || {}).length > 0 ? (
                      <div className="space-y-3">
                        {Object.entries((displayState as any).relationship_details || {}).map(([pair, detail]: [string, any]) => (
                          <div key={pair} className="bg-tavern-surface rounded-lg border border-tavern-border p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-1">
                                <span className="text-xs font-medium text-tavern-text-bright">{pair.split('-')[0]}</span>
                                <svg className="w-3 h-3 text-tavern-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                                <span className="text-xs font-medium text-tavern-text-bright">{pair.split('-')[1]}</span>
                              </div>
                              {isEditing && (
                                <button
                                  onClick={() => removeRelationshipDetail(pair)}
                                  className="text-red-400 text-xs hover:underline"
                                >Remove</button>
                              )}
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              {[
                                { key: 'love', label: 'Love', color: 'bg-pink-500' },
                                { key: 'trust', label: 'Trust', color: 'bg-green-500' },
                                { key: 'respect', label: 'Respect', color: 'bg-blue-500' },
                                { key: 'anger', label: 'Anger', color: 'bg-red-500' },
                                { key: 'fear', label: 'Fear', color: 'bg-purple-500' },
                                { key: 'gratitude', label: 'Gratitude', color: 'bg-yellow-500' },
                                { key: 'jealousy', label: 'Jealousy', color: 'bg-orange-500' },
                                { key: 'shame', label: 'Shame', color: 'bg-gray-500' },
                                { key: 'affection', label: 'Affection', color: 'bg-rose-500' },
                              ].map(({ key, label, color }) => (
                                <div key={key} className="text-center">
                                  <span className="text-[10px] text-tavern-dim block mb-1">{label}</span>
                                  {isEditing ? (
                                    <div className="flex flex-col items-center gap-1">
                                      <input
                                        type="range"
                                        min={0}
                                        max={100}
                                        value={detail[key] || 0}
                                        onChange={(e) => updateRelationshipDetailEmotion(pair, key, parseInt(e.target.value))}
                                        className="w-full h-1 accent-tavern-accent"
                                      />
                                      <span className="text-[10px] text-tavern-text">{detail[key] || 0}%</span>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="relative h-2 bg-tavern-bg rounded-full overflow-hidden">
                                        <div
                                          className={`absolute left-0 top-0 h-full ${color} rounded-full`}
                                          style={{ width: `${detail[key] || 0}%` }}
                                        />
                                      </div>
                                      <span className="text-[10px] text-tavern-text">{detail[key] || 0}%</span>
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                            {isEditing ? (
                              <div className="mt-2">
                                <input
                                  value={detail.summary || ''}
                                  onChange={(e) => updateRelationshipDetailSummary(pair, e.target.value)}
                                  className="w-full bg-tavern-bg border border-tavern-border rounded px-2 py-1 text-[10px] focus:outline-none focus:border-tavern-accent"
                                  placeholder="Summary..."
                                />
                              </div>
                            ) : detail.summary ? (
                              <p className="text-[10px] text-tavern-dim mt-2 italic">{detail.summary}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-tavern-dim text-center py-3">No relationship details tracked</p>
                    )}
                  </div>

                  {/* Important Memories */}
                  <div className="bg-tavern-bg border border-tavern-border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-tavern-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        <h3 className="text-sm font-semibold text-tavern-text-bright">Important Memories</h3>
                        <span className="text-xs text-tavern-dim">({((displayState as any).memories || []).length})</span>
                      </div>
                    </div>
                    {((displayState as any).memories || []).length > 0 ? (
                      <div className="space-y-2">
                        {(displayState as any).memories.map((memory: any, i: number) => (
                          <div key={i} className="flex items-start gap-2 bg-tavern-surface rounded-lg p-2">
                            <span className="text-tavern-accent text-xs">•</span>
                            <div className="flex-1">
                              <p className="text-xs text-tavern-text">{memory.content}</p>
                              {memory.importance && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded mt-1 inline-block ${
                                  memory.importance === 'high' ? 'bg-red-500/20 text-red-400' :
                                  memory.importance === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                  'bg-tavern-bg text-tavern-dim'
                                }`}>
                                  {memory.importance}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-tavern-dim text-center py-3">No important memories yet</p>
                    )}
                  </div>

                  {/* Rules */}
                  <div className="bg-tavern-bg border border-tavern-border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-tavern-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        <h3 className="text-sm font-semibold text-tavern-text-bright">Story Rules</h3>
                        <span className="text-xs text-tavern-dim">({(displayState.rules || []).length})</span>
                      </div>
                      {isEditing && (
                        <button onClick={addRule} className="text-xs text-tavern-accent hover:underline">+ Add</button>
                      )}
                    </div>
                    {(displayState.rules || []).length > 0 ? (
                      <div className="space-y-2">
                        {displayState.rules.map((rule, i) => (
                          <div key={i} className="flex items-start gap-2 bg-tavern-surface rounded-lg p-2">
                            <span className="text-tavern-accent text-xs font-medium">{i + 1}.</span>
                            {isEditing ? (
                              <div className="flex-1 flex items-center gap-2">
                                <input
                                  value={rule}
                                  onChange={(e) => updateRule(i, e.target.value)}
                                  className="flex-1 bg-tavern-bg border border-tavern-border rounded px-2 py-1 text-xs focus:outline-none focus:border-tavern-accent"
                                />
                                <button
                                  onClick={() => removeRule(i)}
                                  className="text-red-400 text-xs"
                                >×</button>
                              </div>
                            ) : (
                              <span className="text-xs text-tavern-text">{rule}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-tavern-dim text-center py-3">No rules defined</p>
                    )}
                  </div>
                </div>
              )}

              {/* Change Log Tab */}
              {activeTab === 'log' && (
                <div className="space-y-3">
                  {stateLog.length > 0 ? (
                    stateLog.map((entry, i) => (
                      <div key={i} className="bg-tavern-bg border border-tavern-border rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${
                              entry.type === 'update' ? 'bg-tavern-accent' :
                              entry.type === 'initial' ? 'bg-blue-400' :
                              entry.type === 'rollback' ? 'bg-yellow-400' : 'bg-green-400'
                            }`} />
                            <span className="text-xs font-medium text-tavern-text-bright">{entry.description}</span>
                          </div>
                          <span className="text-[10px] text-tavern-dim">
                            {new Date(entry.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="bg-tavern-surface rounded p-2 text-[10px] text-tavern-dim font-mono overflow-x-auto">
                          {JSON.stringify(entry.changes, null, 2)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <svg className="w-12 h-12 mx-auto mb-3 text-tavern-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-tavern-dim">No changes recorded yet</p>
                    </div>
                  )}
                </div>
              )}

              {/* Raw JSON Tab */}
              {activeTab === 'raw' && displayState && (
                <div className="bg-tavern-surface rounded-xl border border-tavern-border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-tavern-text-bright">Raw State JSON</h3>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(displayState, null, 2));
                        useStore.getState().addToast('Copied to clipboard', 'success');
                      }}
                      className="text-xs text-tavern-accent hover:underline"
                    >
                      Copy
                    </button>
                  </div>
                  <pre className="text-xs text-tavern-text font-mono overflow-x-auto whitespace-pre-wrap bg-tavern-bg rounded-lg p-3 border border-tavern-border max-h-96 overflow-y-auto">
                    {JSON.stringify(displayState, null, 2)}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-tavern-border flex items-center justify-between">
          <div className="text-xs text-tavern-dim">
            {storyState?.updated_at && (
              <span>Last updated: {new Date(storyState.updated_at).toLocaleString()}</span>
            )}
          </div>
          <button
            onClick={() => loadStoryState(currentChat?.id || '')}
            disabled={!currentChat}
            className="text-xs text-tavern-accent hover:underline disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
