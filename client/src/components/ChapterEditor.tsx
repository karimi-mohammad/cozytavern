import { useState } from 'react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-tavern-bg rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-tavern-border">
          <h2 className="text-lg font-semibold text-tavern-text">Edit Chapter</h2>
          <button onClick={onClose} className="text-tavern-textDim hover:text-tavern-text text-xl">&times;</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm text-tavern-textDim mb-1">Chapter Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Chapter title..."
              className="w-full bg-tavern-input rounded px-3 py-2 text-tavern-text placeholder-tavern-textDim/50 outline-none focus:ring-1 focus:ring-tavern-accent"
            />
          </div>

          {/* Summary */}
          <div>
            <label className="block text-sm text-tavern-textDim mb-1">Summary</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Chapter summary..."
              rows={12}
              className="w-full bg-tavern-input rounded px-3 py-2 text-tavern-text placeholder-tavern-textDim/50 outline-none focus:ring-1 focus:ring-tavern-accent resize-y"
            />
          </div>

          {/* Metadata */}
          <div className="text-xs text-tavern-textDim space-y-1">
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
            className="px-3 py-1.5 rounded bg-red-600/20 text-red-400 hover:bg-red-600/30 text-sm"
          >
            Delete Chapter
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="px-3 py-1.5 rounded bg-tavern-accent/20 text-tavern-accent hover:bg-tavern-accent/30 text-sm disabled:opacity-50"
            >
              {regenerating ? 'Regenerating...' : 'Regenerate Summary'}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 rounded bg-tavern-accent text-white hover:opacity-90 text-sm disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
