import { useState, useEffect } from 'react';
import { useStore } from '../store/state';
import { api } from '../api/client';
import { ChatLorebook, Lorebook } from '../types';
import GenerateLorebookModal from './GenerateLorebookModal';

export default function LorebookPanel() {
  const {
    currentChat, chatLorebooks, loadingChatLorebooks, lorebooks,
    loadChatLorebooks, addChatLorebook, updateChatLorebook, removeChatLorebook,
    loadLorebooks, setLorebookEditorOpen,
  } = useStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (currentChat) {
      loadChatLorebooks(currentChat.id);
      loadLorebooks();
    }
  }, [currentChat?.id]);

  if (!currentChat) return null;

  // لوربوک‌هایی که هنوز به چت اضافه نشدن
  const assignedIds = new Set(chatLorebooks.map(cl => cl.lorebook_id));
  const availableLorebooks = lorebooks.filter(lb => !assignedIds.has(lb.id));
  const filteredAvailable = searchQuery
    ? availableLorebooks.filter(lb => lb.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : availableLorebooks;

  const handleAdd = async (lorebookId: string) => {
    await addChatLorebook(currentChat.id, lorebookId);
    setShowAddModal(false);
    setSearchQuery('');
  };

  const handleToggle = async (cl: ChatLorebook) => {
    await updateChatLorebook(currentChat.id, cl.id, { is_active: !cl.is_active });
  };

  const handleRemove = async (cl: ChatLorebook) => {
    await removeChatLorebook(currentChat.id, cl.id);
  };

  const totalActiveEntries = chatLorebooks
    .filter(cl => cl.is_active)
    .reduce((sum, cl) => sum + (cl.active_entries || 0), 0);

  return (
    <div className="p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-medium text-tavern-dim">Lorebooks</h3>
          {chatLorebooks.length > 0 && (
            <span className="text-[10px] bg-tavern-accent/20 text-tavern-accent px-1.5 py-0.5 rounded-full">
              {chatLorebooks.filter(cl => cl.is_active).length}/{chatLorebooks.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowGenerateModal(true)}
            className="text-tavern-accent hover:text-tavern-accent-hover text-[10px] px-1.5 py-0.5 rounded hover:bg-tavern-hover transition-colors flex items-center gap-1"
            title="AI Generate Lorebook"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            AI
          </button>
          <button
            onClick={() => setLorebookEditorOpen(true)}
            className="text-tavern-muted hover:text-tavern-accent text-[10px] px-1.5 py-0.5 rounded hover:bg-tavern-hover transition-colors"
            title="Manage Lorebooks"
          >
            Edit
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="text-tavern-accent hover:text-tavern-accent-hover text-lg leading-none px-1 rounded hover:bg-tavern-hover transition-colors"
            title="Add Lorebook"
          >
            +
          </button>
        </div>
      </div>

      {/* Stats */}
      {chatLorebooks.length > 0 && (
        <div className="text-[10px] text-tavern-dim">
          {totalActiveEntries} active entries
        </div>
      )}

      {/* Lorebook List */}
      {loadingChatLorebooks ? (
        <div className="text-center py-4">
          <div className="w-4 h-4 border-2 border-tavern-accent border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : chatLorebooks.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-[11px] text-tavern-muted mb-2">No lorebooks assigned</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="text-[11px] text-tavern-accent hover:text-tavern-accent-hover transition-colors"
          >
            Add your first lorebook
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {chatLorebooks.map(cl => (
            <ChatLorebookCard
              key={cl.id}
              chatLorebook={cl}
              onToggle={() => handleToggle(cl)}
              onRemove={() => handleRemove(cl)}
              onEdit={() => setLorebookEditorOpen(true)}
            />
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <AddLorebookModal
          available={filteredAvailable}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onAdd={handleAdd}
          onClose={() => { setShowAddModal(false); setSearchQuery(''); }}
        />
      )}

      {/* AI Generate Modal */}
      <GenerateLorebookModal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
      />
    </div>
  );
}

// ─── Chat Lorebook Card ───

function ChatLorebookCard({
  chatLorebook: cl,
  onToggle,
  onRemove,
  onEdit,
}: {
  chatLorebook: ChatLorebook;
  onToggle: () => void;
  onRemove: () => void;
  onEdit: () => void;
}) {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className={`group rounded-lg border transition-all ${
      cl.is_active
        ? 'bg-tavern-bg border-tavern-border hover:border-tavern-accent/30'
        : 'bg-tavern-bg/50 border-tavern-border/50 opacity-60'
    }`}>
      <div className="flex items-center gap-2 p-2">
        {/* Toggle */}
        <button
          onClick={onToggle}
          className={`w-8 h-4 rounded-full transition-all flex-shrink-0 ${
            cl.is_active
              ? 'bg-tavern-accent'
              : 'bg-tavern-border'
          }`}
          title={cl.is_active ? 'Click to deactivate' : 'Click to activate'}
        >
          <div className={`w-3 h-3 rounded-full bg-white transition-transform mt-0.5 ${
            cl.is_active ? 'translate-x-4.5 ml-[1px]' : 'translate-x-0.5 ml-[1px]'
          }`} />
        </button>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`text-xs font-medium truncate ${
              cl.is_active ? 'text-tavern-text' : 'text-tavern-muted'
            }`}>
              {cl.lorebook_name}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-tavern-dim">
              {cl.active_entries}/{cl.total_entries} entries
            </span>
            {cl.token_budget > 0 && (
              <span className="text-[10px] text-tavern-dim">
                {cl.token_budget} tokens
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="w-5 h-5 flex items-center justify-center rounded text-tavern-muted hover:text-tavern-accent hover:bg-tavern-hover transition-colors"
            title="Edit lorebook"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          {!showConfirm ? (
            <button
              onClick={() => setShowConfirm(true)}
              className="w-5 h-5 flex items-center justify-center rounded text-tavern-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Remove from chat"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={() => { onRemove(); setShowConfirm(false); }}
                className="text-[10px] text-red-400 hover:text-red-300 px-1 py-0.5 rounded bg-red-500/10"
              >
                Remove
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="text-[10px] text-tavern-muted hover:text-tavern-text px-1 py-0.5 rounded hover:bg-tavern-hover"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar for token usage */}
      {cl.is_active && cl.token_budget > 0 && (
        <div className="px-2 pb-2">
          <div className="h-0.5 bg-tavern-border rounded-full overflow-hidden">
            <div
              className="h-full bg-tavern-accent/40 rounded-full transition-all"
              style={{ width: `${Math.min(100, (cl.active_entries / Math.max(1, cl.total_entries)) * 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Add Lorebook Modal ───

function AddLorebookModal({
  available,
  searchQuery,
  onSearchChange,
  onAdd,
  onClose,
}: {
  available: Lorebook[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onAdd: (id: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-[1px] z-50 flex items-center justify-center p-4 animate-enter">
      <div className="bg-tavern-card border border-tavern-border rounded-xl w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="p-3 border-b border-tavern-border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-tavern-text-bright">Add Lorebook</h3>
            <button onClick={onClose} className="text-tavern-muted hover:text-tavern-text">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-tavern-input border border-tavern-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-tavern-accent"
            placeholder="Search lorebooks..."
            autoFocus
          />
        </div>
        <div className="max-h-60 overflow-y-auto p-2">
          {available.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-xs text-tavern-muted">
                {searchQuery ? 'No matching lorebooks' : 'All lorebooks are already assigned'}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {available.map(lb => (
                <button
                  key={lb.id}
                  onClick={() => onAdd(lb.id)}
                  className="w-full text-left p-2 rounded-lg hover:bg-tavern-hover transition-colors group"
                >
                  <div className="text-xs font-medium text-tavern-text group-hover:text-tavern-accent transition-colors">
                    {lb.name}
                  </div>
                  <div className="text-[10px] text-tavern-dim mt-0.5">
                    {lb.entry_count || lb.entries?.length || 0} entries
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
