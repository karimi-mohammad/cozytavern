import { useState, useEffect } from 'react';
import { useStore } from '../store/state';
import { api } from '../api/client';

// ─── Types ───
interface SuggestedTopic {
  topic: string;
  category: 'location' | 'character' | 'item' | 'concept' | 'event';
  keywords: string[];
  note: string;
  _selected: boolean;
}

interface GeneratedEntry {
  keys: string[];
  keysecondary: string[];
  content: string;
  constant: boolean;
  selective: boolean;
  comment: string;
  insertion_order: number;
  position: string;
  disable: boolean;
  case_sensitive: boolean;
  use_regex: boolean;
  probability: number;
  _selected?: boolean;
}

type Mode = 'menu' | 'auto-suggest' | 'manual-topics' | 'single-topic';
type Step = 'config' | 'loading' | 'review-topics' | 'generating' | 'review-entries' | 'saving';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  targetLorebookId?: string;
}

export default function GenerateLorebookModal({ isOpen, onClose, targetLorebookId }: Props) {
  // استفاده از selector‌های جداگانه برای جلوگیری از re-render بی‌رویه
  const currentChat = useStore(s => s.currentChat);
  const currentCharacter = useStore(s => s.currentCharacter);
  const lorebooks = useStore(s => s.lorebooks);
  const loadLorebooks = useStore(s => s.loadLorebooks);
  const addChatLorebook = useStore(s => s.addChatLorebook);
  const loadChatLorebooks = useStore(s => s.loadChatLorebooks);
  const addToast = useStore(s => s.addToast);

  // ─── State ───
  const [mode, setMode] = useState<Mode>('menu');
  const [step, setStep] = useState<Step>('config');

  // Config
  const [selectedLorebookId, setSelectedLorebookId] = useState(targetLorebookId || '');
  const [isNewLorebook, setIsNewLorebook] = useState(!targetLorebookId);
  const [newLorebookName, setNewLorebookName] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');

  // Auto-suggest
  const [topics, setTopics] = useState<SuggestedTopic[]>([]);

  // Manual topics
  const [manualTopics, setManualTopics] = useState('');

  // Single topic
  const [singleTopic, setSingleTopic] = useState('');
  const [singleKeywords, setSingleKeywords] = useState('');

  // Generated entries
  const [generatedEntries, setGeneratedEntries] = useState<GeneratedEntry[]>([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generationInfo, setGenerationInfo] = useState<{ model: string; count: number } | null>(null);
  const [debugRaw, setDebugRaw] = useState<string | null>(null);

  // ─── Effects ───
  useEffect(() => {
    if (isOpen) {
      loadLorebooks();
      resetState();
    }
  }, [isOpen, targetLorebookId]);

  const resetState = () => {
    setMode('menu');
    setStep('config');
    setSelectedLorebookId(targetLorebookId || '');
    setIsNewLorebook(!targetLorebookId);
    setNewLorebookName('');
    setCustomPrompt('');
    setTopics([]);
    setManualTopics('');
    setSingleTopic('');
    setSingleKeywords('');
    setGeneratedEntries([]);
    setError(null);
    setGenerationInfo(null);
  };

  // ─── Handlers ───
  const handleAutoSuggest = async () => {
    if (!currentChat || !currentCharacter) return;

    setMode('auto-suggest');
    setStep('loading');
    setError(null);
    setLoading(true);
    setDebugRaw(null);

    try {
      const result = await api.suggestLorebookTopics({
        chat_id: currentChat.id,
        character_id: currentCharacter.id,
        lorebook_id: selectedLorebookId || undefined,
      });

      // اگر debug_raw وجود داشت (پاسخ خالی بود)
      if (result.debug_raw) {
        setDebugRaw(result.debug_raw);
        setTopics([]);
        setStep('review-topics');
        return;
      }

      setTopics(result.topics || []);
      setGenerationInfo({ model: result.model, count: result.topics?.length || 0 });
      setStep('review-topics');
    } catch (err: any) {
      setError(err.message || 'Failed to analyze conversation');
      setStep('config');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateFromTopics = async (topicsToUse: SuggestedTopic[]) => {
    if (!currentChat || !currentCharacter) return;

    setStep('generating');
    setError(null);
    setLoading(true);

    try {
      const result = await api.generateFromTopics({
        chat_id: currentChat.id,
        character_id: currentCharacter.id,
        topics: topicsToUse.map(t => ({
          topic: t.topic,
          category: t.category,
          keywords: t.keywords,
          note: t.note,
        })),
        custom_prompt: customPrompt || undefined,
      });

      const entries = (result.entries || []).map((e: GeneratedEntry) => ({
        ...e,
        _selected: true,
      }));

      setGeneratedEntries(entries);
      setGenerationInfo({ model: result.model, count: entries.length });
      setStep('review-entries');
    } catch (err: any) {
      setError(err.message || 'Failed to generate entries');
      setStep('review-topics');
    } finally {
      setLoading(false);
    }
  };

  const handleManualGenerate = async () => {
    if (!currentChat || !currentCharacter || !manualTopics.trim()) return;

    // Parse topics from textarea (one per line)
    const topicLines = manualTopics.split('\n').map(t => t.trim()).filter(Boolean);
    if (topicLines.length === 0) return;

    // Convert to topic objects
    const topicsToGenerate: SuggestedTopic[] = topicLines.map(t => ({
      topic: t,
      category: 'concept' as const,
      keywords: t.split(' ').slice(0, 3),
      note: '',
      _selected: true,
    }));

    await handleGenerateFromTopics(topicsToGenerate);
  };

  const handleSingleGenerate = async () => {
    if (!currentChat || !currentCharacter || !singleTopic.trim()) return;

    setStep('generating');
    setError(null);
    setLoading(true);

    try {
      const keywords = singleKeywords.split(',').map(k => k.trim()).filter(Boolean);
      const result = await api.generateSingleTopic({
        chat_id: currentChat.id,
        character_id: currentCharacter.id,
        topic: singleTopic.trim(),
        keywords: keywords.length > 0 ? keywords : undefined,
        custom_prompt: customPrompt || undefined,
      });

      if (result.entry) {
        setGeneratedEntries([{ ...result.entry, _selected: true }]);
        setGenerationInfo({ model: result.model, count: 1 });
        setStep('review-entries');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate entry');
      setStep('config');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentChat) return;

    setStep('saving');

    try {
      let targetId = selectedLorebookId;

      // ایجاد لوربوک جدید در صورت نیاز
      if (isNewLorebook || !targetId) {
        const name = newLorebookName.trim() || `${currentCharacter?.name || 'Chat'} Lorebook`;
        const newLb = await api.createLorebook({ name });
        targetId = newLb.id;
        await addChatLorebook(currentChat.id, targetId);
        await loadChatLorebooks(currentChat.id);
      }

      // فیلتر entryهای انتخاب شده
      const selectedEntries = generatedEntries
        .filter(e => e._selected)
        .map(({ _selected, ...entry }) => entry);

      if (selectedEntries.length === 0) {
        addToast('No entries selected', 'info');
        onClose();
        return;
      }

      await api.applyGeneratedEntries(targetId, selectedEntries);
      await loadLorebooks();

      addToast(`Added ${selectedEntries.length} entries to lorebook`, 'success');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save entries');
      setStep('review-entries');
    }
  };

  const toggleTopicSelection = (index: number) => {
    setTopics(prev => prev.map((t, i) => i === index ? { ...t, _selected: !t._selected } : t));
  };

  const toggleAllTopics = () => {
    const allSelected = topics.every(t => t._selected);
    setTopics(prev => prev.map(t => ({ ...t, _selected: !allSelected })));
  };

  const toggleEntrySelection = (index: number) => {
    setGeneratedEntries(prev => prev.map((e, i) => i === index ? { ...e, _selected: !e._selected } : e));
  };

  const toggleAllEntries = () => {
    const allSelected = generatedEntries.every(e => e._selected);
    setGeneratedEntries(prev => prev.map(e => ({ ...e, _selected: !allSelected })));
  };

  const removeEntry = (index: number) => {
    setGeneratedEntries(prev => prev.filter((_, i) => i !== index));
  };

  if (!isOpen) return null;

  const selectedTopicsCount = topics.filter(t => t._selected).length;
  const selectedEntriesCount = generatedEntries.filter(e => e._selected).length;

  // ─── Category icons ───
  const categoryIcons: Record<string, string> = {
    location: '📍',
    character: '👤',
    item: '🎒',
    concept: '💡',
    event: '📅',
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-3 md:p-4 modal-enter-overlay">
      <div className="bg-tavern-card border border-tavern-border rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl shadow-black/40 modal-enter-card">
        {/* Header */}
        <div className="p-4 border-b border-tavern-border flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-tavern-text-bright">AI Lorebook Generator</h2>
              <p className="text-xs text-tavern-dim">
                {mode === 'menu' && 'Choose a generation mode'}
                {mode === 'auto-suggest' && 'Step 1: Review suggested topics'}
                {mode === 'manual-topics' && 'Enter topics to generate'}
                {mode === 'single-topic' && 'Generate entry for one topic'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-md text-tavern-muted hover:text-tavern-text hover:bg-tavern-hover transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">

          {/* ════════════════════════════════════════════ */}
          {/* MODE: MENU - انتخاب حالت */}
          {/* ════════════════════════════════════════════ */}
          {mode === 'menu' && step === 'config' && (
            <div className="space-y-4">
              {/* Target Lorebook */}
              <div className="bg-tavern-bg/50 rounded-lg p-3 border border-tavern-border">
                <div className="flex items-center gap-2 text-sm mb-2">
                  <span className="text-tavern-dim">Character:</span>
                  <span className="text-tavern-text font-medium">{currentCharacter?.name || 'None'}</span>
                  <span className="text-tavern-dim ml-2">Messages:</span>
                  <span className="text-tavern-text">{currentChat?.messages?.length || 0}</span>
                </div>
              </div>

              {/* Target Lorebook Selection */}
              <div>
                <label className="block text-sm font-medium mb-2">Target Lorebook</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={isNewLorebook} onChange={() => { setIsNewLorebook(true); setSelectedLorebookId(''); }} className="accent-tavern-accent" />
                    <span className="text-sm">Create new lorebook</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={!isNewLorebook} onChange={() => setIsNewLorebook(false)} className="accent-tavern-accent" />
                    <span className="text-sm">Add to existing lorebook</span>
                  </label>
                </div>
                {isNewLorebook ? (
                  <input value={newLorebookName} onChange={(e) => setNewLorebookName(e.target.value)}
                    className="w-full mt-2 bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-tavern-accent"
                    placeholder={`${currentCharacter?.name || 'Chat'} Lorebook`} />
                ) : (
                  <select value={selectedLorebookId} onChange={(e) => setSelectedLorebookId(e.target.value)}
                    className="w-full mt-2 bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-tavern-accent">
                    <option value="">Select a lorebook...</option>
                    {lorebooks.map(lb => (<option key={lb.id} value={lb.id}>{lb.name}</option>))}
                  </select>
                )}
              </div>

              {/* Custom Instructions */}
              <div>
                <label className="block text-sm font-medium mb-2">Custom Instructions <span className="text-tavern-dim text-xs">(optional)</span></label>
                <textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)}
                  className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-tavern-accent resize-none" rows={2}
                  placeholder="e.g., Focus on locations only, include character relationships..." />
              </div>

              {/* 3 Mode Buttons */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-tavern-dim mb-3">Generation Mode</label>

                {/* Mode 1: Auto Suggest */}
                <button onClick={handleAutoSuggest}
                  disabled={!currentChat || !currentCharacter || (!isNewLorebook && !selectedLorebookId)}
                  className="w-full p-4 rounded-lg border border-tavern-border hover:border-tavern-accent/50 hover:bg-tavern-accent/5 transition-all text-left group disabled:opacity-30">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
                      <span className="text-xl">🔍</span>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-tavern-text group-hover:text-tavern-accent transition-colors">Auto-Suggest Topics</div>
                      <div className="text-xs text-tavern-dim">AI analyzes the story and suggests topics (locations, characters, items...)</div>
                    </div>
                  </div>
                </button>

                {/* Mode 2: Manual Topics */}
                <button onClick={() => setMode('manual-topics')}
                  disabled={!currentChat || !currentCharacter || (!isNewLorebook && !selectedLorebookId)}
                  className="w-full p-4 rounded-lg border border-tavern-border hover:border-tavern-accent/50 hover:bg-tavern-accent/5 transition-all text-left group disabled:opacity-30">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
                      <span className="text-xl">📝</span>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-tavern-text group-hover:text-tavern-accent transition-colors">Manual Topics</div>
                      <div className="text-xs text-tavern-dim">Enter your own topics and AI generates entries for them</div>
                    </div>
                  </div>
                </button>

                {/* Mode 3: Single Topic */}
                <button onClick={() => setMode('single-topic')}
                  disabled={!currentChat || !currentCharacter || (!isNewLorebook && !selectedLorebookId)}
                  className="w-full p-4 rounded-lg border border-tavern-border hover:border-tavern-accent/50 hover:bg-tavern-accent/5 transition-all text-left group disabled:opacity-30">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
                      <span className="text-xl">✨</span>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-tavern-text group-hover:text-tavern-accent transition-colors">Single Topic</div>
                      <div className="text-xs text-tavern-dim">Enter one topic and AI generates a detailed entry</div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════ */}
          {/* MODE: AUTO-SUGGEST - بررسی موضوعات پیشنهادی */}
          {/* ════════════════════════════════════════════ */}
          {mode === 'auto-suggest' && (step === 'review-topics' || step === 'generating') && (
            <div className="space-y-4">
              {step === 'generating' ? (
                <LoadingSpinner text="Generating entries from selected topics..." />
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-tavern-text">
                      Found <span className="font-bold text-tavern-accent">{topics.length}</span> topics
                    </span>
                    <div className="flex items-center gap-2">
                      <button onClick={toggleAllTopics} className="text-xs text-tavern-accent hover:text-tavern-accent-hover">
                        {topics.every(t => t._selected) ? 'Deselect All' : 'Select All'}
                      </button>
                      <button onClick={() => setMode('menu')} className="text-xs text-tavern-muted hover:text-tavern-text">← Back</button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {topics.map((topic, index) => (
                      <TopicCard key={index} topic={topic} onToggle={() => toggleTopicSelection(index)} categoryIcons={categoryIcons} />
                    ))}
                  </div>

                  {/* Debug: نمایش پاسخ خام */}
                  {debugRaw && (
                    <div className="mt-4 p-3 bg-tavern-bg rounded-lg border border-tavern-border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-tavern-dim">AI Raw Response (debug)</span>
                        <button onClick={() => setDebugRaw(null)} className="text-tavern-muted hover:text-tavern-text text-xs">✕</button>
                      </div>
                      <pre className="text-[10px] text-tavern-muted whitespace-pre-wrap overflow-auto max-h-60 overflow-y-auto">{debugRaw}</pre>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════ */}
          {/* MODE: MANUAL-TOPICS - ورود موضوعات دستی */}
          {/* ════════════════════════════════════════════ */}
          {mode === 'manual-topics' && step === 'config' && (
            <div className="space-y-4">
              <button onClick={() => setMode('menu')} className="text-xs text-tavern-accent hover:text-tavern-accent-hover">← Back to menu</button>

              <div>
                <label className="block text-sm font-medium mb-2">Enter Topics <span className="text-tavern-dim text-xs">(one per line)</span></label>
                <textarea value={manualTopics} onChange={(e) => setManualTopics(e.target.value)}
                  className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-tavern-accent resize-none font-mono" rows={8}
                  placeholder={"The Throne Room\nElena the Sorceress\nAncient Sword\nMagic System\nRoyal Palace"} />
                <p className="text-[10px] text-tavern-dim mt-1">
                  {manualTopics.split('\n').filter(t => t.trim()).length} topics entered
                </p>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════ */}
          {/* MODE: SINGLE-TOPIC - یک موضوع */}
          {/* ════════════════════════════════════════════ */}
          {mode === 'single-topic' && step === 'config' && (
            <div className="space-y-4">
              <button onClick={() => setMode('menu')} className="text-xs text-tavern-accent hover:text-tavern-accent-hover">← Back to menu</button>

              <div>
                <label className="block text-sm font-medium mb-2">Topic</label>
                <input value={singleTopic} onChange={(e) => setSingleTopic(e.target.value)}
                  className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-tavern-accent"
                  placeholder="e.g., The Throne Room, Elena the Sorceress, Ancient Sword" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Trigger Keywords <span className="text-tavern-dim text-xs">(comma-separated, optional)</span></label>
                <input value={singleKeywords} onChange={(e) => setSingleKeywords(e.target.value)}
                  className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-tavern-accent"
                  placeholder="throne room, royal hall, throne" dir="ltr" />
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════ */}
          {/* REVIEW ENTRIES - بررسی اینتری‌های تولید شده */}
          {/* ════════════════════════════════════════════ */}
          {step === 'review-entries' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-tavern-text">
                  Generated <span className="font-bold text-tavern-accent">{generatedEntries.length}</span> entries
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={toggleAllEntries} className="text-xs text-tavern-accent hover:text-tavern-accent-hover">
                    {generatedEntries.every(e => e._selected) ? 'Deselect All' : 'Select All'}
                  </button>
                  <button onClick={() => setMode('menu')} className="text-xs text-tavern-muted hover:text-tavern-text">← New Search</button>
                </div>
              </div>

              {generatedEntries.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-tavern-muted">No entries generated</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {generatedEntries.map((entry, index) => (
                    <GeneratedEntryCard key={index} entry={entry} onToggle={() => toggleEntrySelection(index)} onRemove={() => removeEntry(index)} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Loading states */}
          {step === 'loading' && <LoadingSpinner text="Analyzing conversation..." />}

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400 mt-4">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-tavern-border flex items-center justify-between flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-tavern-muted hover:text-tavern-text text-sm rounded-lg hover:bg-tavern-hover transition-colors">
            Cancel
          </button>

          <div className="flex items-center gap-2">
            {/* Menu mode: no button needed */}

            {/* Manual Topics: Generate button */}
            {mode === 'manual-topics' && step === 'config' && (
              <button onClick={handleManualGenerate}
                disabled={!manualTopics.trim()}
                className="px-6 py-2 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 disabled:opacity-30 text-white rounded-lg text-sm font-medium transition-all">
                Generate from Topics
              </button>
            )}

            {/* Single Topic: Generate button */}
            {mode === 'single-topic' && step === 'config' && (
              <button onClick={handleSingleGenerate}
                disabled={!singleTopic.trim()}
                className="px-6 py-2 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 disabled:opacity-30 text-white rounded-lg text-sm font-medium transition-all">
                Generate Entry
              </button>
            )}

            {/* Auto-Suggest: Generate from selected topics */}
            {mode === 'auto-suggest' && step === 'review-topics' && (
              <button onClick={() => handleGenerateFromTopics(topics.filter(t => t._selected))}
                disabled={selectedTopicsCount === 0}
                className="px-6 py-2 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 disabled:opacity-30 text-white rounded-lg text-sm font-medium transition-all">
                Generate {selectedTopicsCount} {selectedTopicsCount === 1 ? 'Topic' : 'Topics'}
              </button>
            )}

            {/* Review Entries: Save button */}
            {step === 'review-entries' && (
              <>
                <button onClick={() => setMode('menu')}
                  className="px-4 py-2 text-tavern-muted hover:text-tavern-text text-sm rounded-lg hover:bg-tavern-hover transition-colors">
                  Back
                </button>
                <button onClick={handleSave}
                  disabled={selectedEntriesCount === 0}
                  className="px-6 py-2 bg-tavern-accent hover:bg-tavern-accent-hover disabled:opacity-30 text-white rounded-lg text-sm font-medium transition-all">
                  Save {selectedEntriesCount} {selectedEntriesCount === 1 ? 'Entry' : 'Entries'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub Components ───

function TopicCard({ topic, onToggle, categoryIcons }: { topic: SuggestedTopic; onToggle: () => void; categoryIcons: Record<string, string> }) {
  return (
    <div onClick={onToggle}
      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
        topic._selected ? 'bg-tavern-bg border-tavern-accent/30' : 'bg-tavern-bg/50 border-tavern-border/50 opacity-60'
      }`}>
      <input type="checkbox" checked={topic._selected} onChange={onToggle} className="accent-tavern-accent w-4 h-4" />
      <span className="text-lg">{categoryIcons[topic.category] || '💡'}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-tavern-text">{topic.topic}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-tavern-dim capitalize">{topic.category}</span>
          <span className="text-[10px] text-tavern-muted">•</span>
          <span className="text-[10px] text-tavern-accent">{topic.keywords.join(', ')}</span>
        </div>
        {topic.note && <div className="text-[10px] text-tavern-dim mt-0.5">{topic.note}</div>}
      </div>
    </div>
  );
}

function GeneratedEntryCard({ entry, onToggle, onRemove }: { entry: GeneratedEntry; onToggle: () => void; onRemove: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`rounded-lg border transition-all ${
      entry._selected ? 'bg-tavern-bg border-tavern-accent/30' : 'bg-tavern-bg/50 border-tavern-border/50 opacity-60'
    }`}>
      <div className="flex items-center gap-2 p-3">
        <input type="checkbox" checked={entry._selected} onChange={onToggle} className="accent-tavern-accent w-4 h-4" />
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-center gap-1.5 flex-wrap">
            {entry.keys.map((k, i) => (
              <span key={i} className="text-[11px] px-1.5 py-0.5 rounded bg-tavern-accent/20 text-tavern-accent">{k}</span>
            ))}
          </div>
          {!expanded && <p className="text-[11px] text-tavern-muted mt-1 line-clamp-1">{entry.content}</p>}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {entry.constant && <span className="text-[9px] bg-blue-500/10 text-blue-400 px-1 py-0.5 rounded">const</span>}
          <button onClick={() => setExpanded(!expanded)} className="text-tavern-muted hover:text-tavern-text">
            <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button onClick={onRemove} className="text-tavern-muted hover:text-red-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      {expanded && (
        <div className="px-3 pb-3 border-t border-tavern-border/50 pt-2">
          <p className="text-xs text-tavern-text leading-relaxed whitespace-pre-wrap">{entry.content}</p>
          {entry.comment && <p className="text-[10px] text-tavern-dim mt-2">Note: {entry.comment}</p>}
        </div>
      )}
    </div>
  );
}

function LoadingSpinner({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-tavern-border rounded-full" />
        <div className="absolute inset-0 w-16 h-16 border-4 border-tavern-accent border-t-transparent rounded-full animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <svg className="w-6 h-6 text-tavern-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
      </div>
      <p className="text-sm text-tavern-text mt-4 font-medium">{text}</p>
      <p className="text-xs text-tavern-muted mt-1">This may take 10-30 seconds</p>
    </div>
  );
}
