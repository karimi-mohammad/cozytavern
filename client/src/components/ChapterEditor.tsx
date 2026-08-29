import { useState, useEffect } from 'react';
import { useStore } from '../store/state';
import { Chapter } from '../types';

interface Props {
  chapter: Chapter;
  onClose: () => void;
}

export default function ChapterEditor({ chapter, onClose }: Props) {
  const [title, setTitle] = useState(chapter.title);
  const [summary, setSummary] = useState(chapter.summary);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const { updateChapter, deleteChapter, regenerateChapter, showConfirm, addToast } = useStore();

  // بستن مودال با کلید Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateChapter(chapter.id, { title, summary });
      onClose();
    } catch (err: any) {
      addToast(`Error: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = async () => {
    const confirmed = await showConfirm('Regenerate summary? The current content will be replaced.');
    if (!confirmed) return;

    setRegenerating(true);
    try {
      await regenerateChapter(chapter.id);
      onClose();
    } catch (err: any) {
      addToast(`Error: ${err.message}`, 'error');
    } finally {
      setRegenerating(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = await showConfirm('Delete this chapter? Messages will not be deleted.');
    if (!confirmed) return;

    try {
      await deleteChapter(chapter.id);
      onClose();
    } catch (err: any) {
      addToast(`Error: ${err.message}`, 'error');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] modal-enter-overlay p-3 md:p-4"
      onClick={onClose}
    >
      <div
        className="bg-tavern-bg border border-tavern-border rounded-xl shadow-2xl shadow-black/40 w-full max-w-2xl max-h-[80vh] flex flex-col modal-enter-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-tavern-border">
          <h2 className="text-base font-semibold text-tavern-text-bright">Edit Chapter</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-md text-tavern-muted hover:text-tavern-text hover:bg-tavern-hover transition-colors active:scale-90">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm text-tavern-dim mb-1">Chapter Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Chapter title..."
              className="w-full bg-tavern-input border border-tavern-border rounded-lg px-3 py-2 text-sm text-tavern-text placeholder-tavern-faint outline-none focus:border-tavern-accent transition-colors"
            />
          </div>

          {/* Summary */}
          <div>
            <label className="block text-sm text-tavern-dim mb-1">Summary</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Chapter summary..."
              rows={12}
              className="w-full bg-tavern-input border border-tavern-border rounded-lg px-3 py-2 text-sm text-tavern-text placeholder-tavern-faint outline-none focus:border-tavern-accent resize-y transition-colors"
            />
          </div>

          {/* Metadata */}
          <div className="text-xs text-tavern-dim space-y-1">
            <div>Generation model: {chapter.generation_model || '—'}</div>
            <div>Regeneration count: {chapter.regeneration_count}</div>
            <div>Manually edited: {chapter.manually_edited ? 'Yes' : 'No'}</div>
            <div>Created: {new Date(chapter.created_at).toLocaleDateString('en-US')}</div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-tavern-border">
          <button
            onClick={handleDelete}
            className="px-3 py-1.5 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 text-sm transition-all active:scale-[0.97]"
          >
            Delete Chapter
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="px-3 py-1.5 rounded-lg bg-tavern-accent/20 text-tavern-accent hover:bg-tavern-accent/30 text-sm transition-all active:scale-[0.97] disabled:opacity-50"
            >
              {regenerating ? 'Regenerating...' : 'Regenerate Summary'}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-tavern-accent text-white hover:bg-tavern-accent-hover text-sm font-medium transition-all active:scale-[0.97] disabled:opacity-50 shadow-md shadow-tavern-accent/20"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
