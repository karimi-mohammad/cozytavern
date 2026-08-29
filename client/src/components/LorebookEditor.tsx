import { useState, useEffect, useMemo } from 'react';
import { useStore } from '../store/state';
import { LorebookEntry } from '../types';
import { api } from '../api/client';
import GenerateLorebookModal from './GenerateLorebookModal';

type EntryFilter = 'all' | 'active' | 'disabled' | 'constant' | 'selective';

export default function LorebookEditor() {
  const { lorebookEditorOpen, setLorebookEditorOpen, lorebooks, loadLorebooks } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lorebookData, setLorebookData] = useState<any>(null);
  const [newName, setNewName] = useState('');
  const [mobileTab, setMobileTab] = useState<'list' | 'detail'>('list');

  // Entry filters & search
  const [entryFilter, setEntryFilter] = useState<EntryFilter>('all');
  const [entrySearch, setEntrySearch] = useState('');
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  // Lorebook settings
  const [editingSettings, setEditingSettings] = useState(false);
  const [scanDepth, setScanDepth] = useState(50);
  const [tokenBudget, setTokenBudget] = useState(500);

  // New entry form
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [entryForm, setEntryForm] = useState({
    key: '', keysecondary: '', content: '',
    constant: false, selective: false,
    insertion_order: 100, position: 'before_main' as 'before_main' | 'after_main',
    disable: false, comment: '',
    case_sensitive: false, use_regex: false, probability: 100,
  });

  // Entry edit form
  const [editForm, setEditForm] = useState<any>(null);

  useEffect(() => {
    if (lorebookEditorOpen) loadLorebooks();
  }, [lorebookEditorOpen]);

  useEffect(() => {
    if (selectedId) {
      api.getLorebook(selectedId).then(data => {
        setLorebookData(data);
        setScanDepth(data.scan_depth || 50);
        setTokenBudget(data.token_budget || 500);
      });
      setMobileTab('detail');
    }
  }, [selectedId]);

  // Escape key
  useEffect(() => {
    if (!lorebookEditorOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLorebookEditorOpen(false);
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lorebookEditorOpen]);

  // Filtered entries
  const filteredEntries = useMemo(() => {
    if (!lorebookData?.entries) return [];
    let entries = lorebookData.entries;

    // Apply filter
    switch (entryFilter) {
      case 'active':
        entries = entries.filter((e: any) => !e.disable);
        break;
      case 'disabled':
        entries = entries.filter((e: any) => e.disable);
        break;
      case 'constant':
        entries = entries.filter((e: any) => e.constant);
        break;
      case 'selective':
        entries = entries.filter((e: any) => e.selective);
        break;
    }

    // Apply search
    if (entrySearch.trim()) {
      const q = entrySearch.toLowerCase();
      entries = entries.filter((e: any) =>
        e.content?.toLowerCase().includes(q) ||
        (e.key || []).some((k: string) => k.toLowerCase().includes(q)) ||
        (e.keysecondary || []).some((k: string) => k.toLowerCase().includes(q)) ||
        e.comment?.toLowerCase().includes(q)
      );
    }

    return entries;
  }, [lorebookData?.entries, entryFilter, entrySearch]);

  // Stats
  const stats = useMemo(() => {
    if (!lorebookData?.entries) return { total: 0, active: 0, disabled: 0, constant: 0, selective: 0 };
    const entries = lorebookData.entries;
    return {
      total: entries.length,
      active: entries.filter((e: any) => !e.disable).length,
      disabled: entries.filter((e: any) => e.disable).length,
      constant: entries.filter((e: any) => e.constant).length,
      selective: entries.filter((e: any) => e.selective).length,
    };
  }, [lorebookData?.entries]);

  if (!lorebookEditorOpen) return null;

  const handleCreateLorebook = async () => {
    if (!newName.trim()) return;
    const lb = await api.createLorebook({ name: newName.trim() });
    await loadLorebooks();
    setSelectedId(lb.id);
    setNewName('');
  };

  const handleSaveSettings = async () => {
    if (!selectedId) return;
    await api.updateLorebook(selectedId, { scan_depth: scanDepth, token_budget: tokenBudget });
    const updated = await api.getLorebook(selectedId);
    setLorebookData(updated);
    setEditingSettings(false);
  };

  const handleAddEntry = async () => {
    if (!selectedId || !entryForm.content.trim()) return;
    await api.addLorebookEntry(selectedId, {
      ...entryForm,
      key: entryForm.key.split(',').map(s => s.trim()).filter(Boolean),
      keysecondary: entryForm.keysecondary.split(',').map(s => s.trim()).filter(Boolean),
    });
    const updated = await api.getLorebook(selectedId);
    setLorebookData(updated);
    setShowNewEntry(false);
    setEntryForm({
      key: '', keysecondary: '', content: '',
      constant: false, selective: false,
      insertion_order: 100, position: 'before_main',
      disable: false, comment: '',
      case_sensitive: false, use_regex: false, probability: 100,
    });
  };

  const handleStartEditEntry = (entry: any) => {
    setEditingEntryId(entry.id);
    setEditForm({
      key: (entry.key || []).join(', '),
      keysecondary: (entry.keysecondary || []).join(', '),
      content: entry.content || '',
      constant: entry.constant,
      selective: entry.selective,
      insertion_order: entry.insertion_order,
      position: entry.position,
      disable: entry.disable,
      comment: entry.comment || '',
      case_sensitive: entry.case_sensitive,
      use_regex: entry.use_regex,
      probability: entry.probability,
    });
  };

  const handleSaveEditEntry = async () => {
    if (!editingEntryId || !editForm) return;
    await api.updateLorebookEntry(editingEntryId, {
      ...editForm,
      key: editForm.key.split(',').map((s: string) => s.trim()).filter(Boolean),
      keysecondary: editForm.keysecondary.split(',').map((s: string) => s.trim()).filter(Boolean),
    });
    const updated = await api.getLorebook(selectedId!);
    setLorebookData(updated);
    setEditingEntryId(null);
    setEditForm(null);
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!selectedId) return;
    await api.deleteLorebookEntry(entryId);
    const updated = await api.getLorebook(selectedId);
    setLorebookData(updated);
    setExpandedEntryId(null);
    setEditingEntryId(null);
  };

  const handleDeleteLorebook = async (id: string) => {
    await api.deleteLorebook(id);
    setSelectedId(null);
    setLorebookData(null);
    await loadLorebooks();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-3 md:p-4 modal-enter-overlay">
      <div className="bg-tavern-card border border-tavern-border rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl shadow-black/40 modal-enter-card">
        {/* Header */}
        <div className="p-4 border-b border-tavern-border flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-bold text-tavern-text-bright">Lorebooks (World Info)</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGenerateModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white rounded-lg text-xs font-medium transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              AI Generate
            </button>
            <button onClick={() => { setLorebookEditorOpen(false); setSelectedId(null); }} className="w-8 h-8 flex items-center justify-center rounded-md text-tavern-muted hover:text-tavern-text hover:bg-tavern-hover transition-colors active:scale-90">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile tabs */}
        <div className="flex md:hidden border-b border-tavern-border flex-shrink-0">
          <button
            onClick={() => setMobileTab('list')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              mobileTab === 'list' ? 'text-tavern-accent border-b-2 border-tavern-accent' : 'text-tavern-muted'
            }`}
          >
            List
          </button>
          <button
            onClick={() => setMobileTab('detail')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              mobileTab === 'detail' ? 'text-tavern-accent border-b-2 border-tavern-accent' : 'text-tavern-muted'
            }`}
            disabled={!selectedId}
          >
            Details
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* ─── لیست لوربوک‌ها ─── */}
          <div className={`${mobileTab === 'list' ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-72 border-r border-tavern-border p-3 space-y-2 overflow-y-auto`}>
            <div className="flex gap-1">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateLorebook()}
                className="flex-1 bg-tavern-bg border border-tavern-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-tavern-accent"
                placeholder="New lorebook name..."
              />
              <button onClick={handleCreateLorebook} className="bg-tavern-accent text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-tavern-accent-hover transition-colors">+</button>
            </div>

            {/* Lorebook list */}
            <div className="space-y-1">
              {lorebooks.map(lb => {
                return (
                  <div
                    key={lb.id}
                    className={`p-2.5 rounded-lg cursor-pointer text-sm flex items-center justify-between transition-colors group ${
                      selectedId === lb.id
                        ? 'bg-tavern-accent/20 text-tavern-accent border border-tavern-accent/30'
                        : 'hover:bg-tavern-hover border border-transparent'
                    }`}
                    onClick={() => { setSelectedId(lb.id); setMobileTab('detail'); }}
                  >
                    <div className="min-w-0">
                      <span className="truncate block">{lb.name}</span>
                      <span className="text-[10px] text-tavern-dim">{(lb as any).entry_count || 0} entries</span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteLorebook(lb.id); }}
                      className="text-tavern-muted hover:text-red-400 text-xs px-1.5 rounded hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ─── جزئیات ─── */}
          <div className={`${mobileTab === 'detail' ? 'flex' : 'hidden'} md:flex flex-1 flex-col overflow-hidden`}>
            {selectedId && lorebookData ? (
              <div className="flex flex-col h-full">
                {/* Mobile back button */}
                <button
                  onClick={() => setMobileTab('list')}
                  className="md:hidden text-tavern-accent text-sm flex items-center gap-1 p-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  Back to list
                </button>

                {/* Lorebook Settings */}
                <div className="p-3 border-b border-tavern-border">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-tavern-text-bright">{lorebookData.name}</h3>
                    <button
                      onClick={() => setEditingSettings(!editingSettings)}
                      className="text-tavern-accent hover:text-tavern-accent-hover text-xs font-medium"
                    >
                      {editingSettings ? 'Cancel' : 'Settings'}
                    </button>
                  </div>

                  {/* Stats bar */}
                  <div className="flex items-center gap-3 text-[10px] text-tavern-dim mb-2">
                    <span>Total: {stats.total}</span>
                    <span className="text-green-400">Active: {stats.active}</span>
                    {stats.disabled > 0 && <span className="text-red-400">Disabled: {stats.disabled}</span>}
                    {stats.constant > 0 && <span className="text-blue-400">Constant: {stats.constant}</span>}
                    {stats.selective > 0 && <span className="text-purple-400">Selective: {stats.selective}</span>}
                  </div>

                  {editingSettings ? (
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-tavern-dim">Scan Depth:</label>
                        <input
                          type="number"
                          value={scanDepth}
                          onChange={(e) => setScanDepth(parseInt(e.target.value) || 50)}
                          className="w-16 bg-tavern-bg border border-tavern-border rounded px-2 py-1 text-xs"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-tavern-dim">Token Budget:</label>
                        <input
                          type="number"
                          value={tokenBudget}
                          onChange={(e) => setTokenBudget(parseInt(e.target.value) || 500)}
                          className="w-16 bg-tavern-bg border border-tavern-border rounded px-2 py-1 text-xs"
                        />
                      </div>
                      <button
                        onClick={handleSaveSettings}
                        className="text-xs bg-tavern-accent text-white px-3 py-1 rounded hover:bg-tavern-accent-hover"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 text-xs text-tavern-muted">
                      <span>Scan Depth: {lorebookData.scan_depth}</span>
                      <span>Token Budget: {lorebookData.token_budget}</span>
                    </div>
                  )}
                </div>

                {/* Filters & Search */}
                <div className="p-3 border-b border-tavern-border space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      value={entrySearch}
                      onChange={(e) => setEntrySearch(e.target.value)}
                      className="flex-1 bg-tavern-bg border border-tavern-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-tavern-accent"
                      placeholder="Search entries..."
                    />
                    <button
                      onClick={() => setShowNewEntry(!showNewEntry)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                        showNewEntry
                          ? 'bg-tavern-hover text-tavern-text'
                          : 'bg-tavern-accent text-white hover:bg-tavern-accent-hover'
                      }`}
                    >
                      {showNewEntry ? 'Cancel' : '+ Entry'}
                    </button>
                  </div>

                  {/* Filter tabs */}
                  <div className="flex items-center gap-1 text-[11px]">
                    {(['all', 'active', 'disabled', 'constant', 'selective'] as EntryFilter[]).map(f => (
                      <button
                        key={f}
                        onClick={() => setEntryFilter(f)}
                        className={`px-2 py-1 rounded transition-colors capitalize ${
                          entryFilter === f
                            ? 'bg-tavern-accent/20 text-tavern-accent'
                            : 'text-tavern-muted hover:text-tavern-text hover:bg-tavern-hover'
                        }`}
                      >
                        {f}
                        {f === 'all' && ` (${stats.total})`}
                        {f === 'active' && ` (${stats.active})`}
                        {f === 'disabled' && ` (${stats.disabled})`}
                        {f === 'constant' && ` (${stats.constant})`}
                        {f === 'selective' && ` (${stats.selective})`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Entries List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {/* New Entry Form */}
                  {showNewEntry && (
                    <EntryForm
                      form={entryForm}
                      setForm={setEntryForm}
                      onSave={handleAddEntry}
                      onCancel={() => setShowNewEntry(false)}
                      isNew
                    />
                  )}

                  {/* Entry cards */}
                  {filteredEntries.length === 0 ? (
                    <div className="text-center text-tavern-muted text-sm py-8">
                      {entrySearch || entryFilter !== 'all' ? 'No matching entries' : 'No entries yet'}
                    </div>
                  ) : (
                    filteredEntries.map((entry: any) => (
                      <EntryCard
                        key={entry.id}
                        entry={entry}
                        isExpanded={expandedEntryId === entry.id}
                        isEditing={editingEntryId === entry.id}
                        editForm={editForm}
                        setEditForm={setEditForm}
                        onToggleExpand={() => setExpandedEntryId(expandedEntryId === entry.id ? null : entry.id)}
                        onStartEdit={() => handleStartEditEntry(entry)}
                        onCancelEdit={() => { setEditingEntryId(null); setEditForm(null); }}
                        onSaveEdit={handleSaveEditEntry}
                        onDelete={() => handleDeleteEntry(entry.id)}
                      />
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-tavern-muted text-sm">
                  <svg className="w-12 h-12 mx-auto mb-3 text-tavern-text opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  Select a lorebook or create a new one
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Generate Modal */}
      <GenerateLorebookModal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        targetLorebookId={selectedId || undefined}
      />
    </div>
  );
}

// ─── Entry Card Component ───

function EntryCard({
  entry,
  isExpanded,
  isEditing,
  editForm,
  setEditForm,
  onToggleExpand,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
}: {
  entry: any;
  isExpanded: boolean;
  isEditing: boolean;
  editForm: any;
  setEditForm: (f: any) => void;
  onToggleExpand: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className={`bg-tavern-bg rounded-lg border transition-all ${
      entry.disable
        ? 'border-tavern-border/50 opacity-50'
        : entry.constant
          ? 'border-blue-500/30'
          : 'border-tavern-border hover:border-tavern-accent/30'
    }`}>
      {/* Header */}
      <div
        className="flex items-center gap-2 p-2.5 cursor-pointer"
        onClick={onToggleExpand}
      >
        {/* Status indicator */}
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
          entry.disable ? 'bg-red-400' : entry.constant ? 'bg-blue-400' : 'bg-green-400'
        }`} />

        {/* Keys */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {(entry.key || []).map((k: string, i: number) => (
              <span key={i} className={`text-[11px] px-1.5 py-0.5 rounded ${
                entry.use_regex ? 'bg-amber-500/20 text-amber-400' : 'bg-tavern-accent/20 text-tavern-accent'
              }`}>
                {entry.use_regex ? `/${k}/` : k}
              </span>
            ))}
            {entry.selective && (entry.keysecondary || []).length > 0 && (
              <>
                <span className="text-tavern-dim text-[10px]">+</span>
                {(entry.keysecondary || []).map((k: string, i: number) => (
                  <span key={i} className="text-[11px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">
                    {k}
                  </span>
                ))}
              </>
            )}
          </div>

          {/* Preview */}
          {!isExpanded && (
            <p className="text-[11px] text-tavern-muted mt-1 line-clamp-1">{entry.content}</p>
          )}
        </div>

        {/* Badges */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {entry.constant && <span className="text-[9px] bg-blue-500/10 text-blue-400 px-1 py-0.5 rounded">const</span>}
          {entry.selective && <span className="text-[9px] bg-purple-500/10 text-purple-400 px-1 py-0.5 rounded">sel</span>}
          {entry.use_regex && <span className="text-[9px] bg-amber-500/10 text-amber-400 px-1 py-0.5 rounded">regex</span>}
          {entry.case_sensitive && <span className="text-[9px] bg-blue-500/10 text-blue-400 px-1 py-0.5 rounded">Aa</span>}
          {entry.probability < 100 && <span className="text-[9px] bg-purple-500/10 text-purple-400 px-1 py-0.5 rounded">{entry.probability}%</span>}
          {entry.disable && <span className="text-[9px] bg-red-500/10 text-red-400 px-1 py-0.5 rounded">OFF</span>}
        </div>

        {/* Expand icon */}
        <svg className={`w-4 h-4 text-tavern-dim transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-tavern-border">
          {isEditing && editForm ? (
            /* Edit mode */
            <EntryForm
              form={editForm}
              setForm={setEditForm}
              onSave={onSaveEdit}
              onCancel={onCancelEdit}
              isNew={false}
            />
          ) : (
            /* View mode */
            <div className="p-3 space-y-2">
              {/* Full content */}
              <div>
                <span className="text-[10px] text-tavern-dim font-medium">Content:</span>
                <p className="text-xs text-tavern-text leading-relaxed mt-1 whitespace-pre-wrap">{entry.content}</p>
              </div>

              {/* Details */}
              <div className="flex items-center gap-4 text-[10px] text-tavern-dim">
                <span>Order: {entry.insertion_order}</span>
                <span>Position: {entry.position === 'before_main' ? 'Before' : 'After'}</span>
                {entry.comment && <span>Note: {entry.comment}</span>}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={onStartEdit}
                  className="text-[11px] text-tavern-accent hover:text-tavern-accent-hover font-medium"
                >
                  Edit
                </button>
                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="text-[11px] text-red-400 hover:text-red-300 font-medium"
                  >
                    Delete
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { onDelete(); setConfirmDelete(false); }}
                      className="text-[11px] text-red-400 hover:text-red-300 px-2 py-0.5 rounded bg-red-500/10 font-medium"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="text-[11px] text-tavern-muted hover:text-tavern-text font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Entry Form Component ───

function EntryForm({
  form,
  setForm,
  onSave,
  onCancel,
  isNew,
}: {
  form: any;
  setForm: (f: any) => void;
  onSave: () => void;
  onCancel: () => void;
  isNew: boolean;
}) {
  return (
    <div className="bg-tavern-bg/50 rounded-lg border border-tavern-accent/30 p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-tavern-text-bright">
          {isNew ? 'New Entry' : 'Edit Entry'}
        </h4>
      </div>

      <input
        value={form.key}
        onChange={(e) => setForm((f: any) => ({ ...f, key: e.target.value }))}
        className="w-full bg-tavern-card border border-tavern-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-tavern-accent"
        placeholder="Keywords (comma-separated)"
      />

      <input
        value={form.keysecondary}
        onChange={(e) => setForm((f: any) => ({ ...f, keysecondary: e.target.value }))}
        className="w-full bg-tavern-card border border-tavern-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-tavern-accent"
        placeholder="Secondary keywords (for selective entries)"
      />

      <textarea
        value={form.content}
        onChange={(e) => setForm((f: any) => ({ ...f, content: e.target.value }))}
        className="w-full bg-tavern-card border border-tavern-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-tavern-accent resize-none"
        rows={4}
        placeholder="Content (injected into AI context when keywords match)"
      />

      <input
        value={form.comment}
        onChange={(e) => setForm((f: any) => ({ ...f, comment: e.target.value }))}
        className="w-full bg-tavern-card border border-tavern-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-tavern-accent"
        placeholder="Comment / note (optional)"
      />

      {/* Checkboxes */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={form.constant} onChange={(e) => setForm((f: any) => ({ ...f, constant: e.target.checked }))} className="accent-tavern-accent w-3.5 h-3.5" />
          <span>Constant</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={form.selective} onChange={(e) => setForm((f: any) => ({ ...f, selective: e.target.checked }))} className="accent-tavern-accent w-3.5 h-3.5" />
          <span>Selective</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={form.use_regex} onChange={(e) => setForm((f: any) => ({ ...f, use_regex: e.target.checked }))} className="accent-tavern-accent w-3.5 h-3.5" />
          <span>Regex</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={form.case_sensitive} onChange={(e) => setForm((f: any) => ({ ...f, case_sensitive: e.target.checked }))} className="accent-tavern-accent w-3.5 h-3.5" />
          <span>Case Sensitive</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={form.disable} onChange={(e) => setForm((f: any) => ({ ...f, disable: e.target.checked }))} className="accent-tavern-accent w-3.5 h-3.5" />
          <span className="text-red-400">Disabled</span>
        </label>
      </div>

      {/* Numeric fields */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <label className="text-tavern-dim">Order:</label>
          <input
            type="number"
            value={form.insertion_order}
            onChange={(e) => setForm((f: any) => ({ ...f, insertion_order: parseInt(e.target.value) || 100 }))}
            className="w-16 bg-tavern-card border border-tavern-border rounded px-2 py-1 text-xs"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-tavern-dim">Prob:</label>
          <input
            type="number"
            min={0}
            max={100}
            value={form.probability}
            onChange={(e) => setForm((f: any) => ({ ...f, probability: parseInt(e.target.value) || 100 }))}
            className="w-14 bg-tavern-card border border-tavern-border rounded px-2 py-1 text-xs"
          />
          <span className="text-tavern-dim">%</span>
        </div>
        <select
          value={form.position}
          onChange={(e) => setForm((f: any) => ({ ...f, position: e.target.value }))}
          className="bg-tavern-card border border-tavern-border rounded px-2 py-1 text-xs"
        >
          <option value="before_main">Before chat</option>
          <option value="after_main">After chat</option>
        </select>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onSave}
          disabled={!form.content?.trim()}
          className="flex-1 bg-tavern-accent hover:bg-tavern-accent-hover disabled:opacity-30 text-white rounded-lg py-2 text-xs font-medium transition-colors"
        >
          {isNew ? 'Add Entry' : 'Save Changes'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-tavern-muted hover:text-tavern-text text-xs rounded-lg hover:bg-tavern-hover transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
