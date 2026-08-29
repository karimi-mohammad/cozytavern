import { useEffect, useState } from 'react';
import { useStore } from '../store/state';

export default function ChapterReviewModal() {
  const {
    chapterFlowReviewOpen,
    chapterFlowIsGenerating,
    chapterFlowSummary,
    chapterFlowSummaryMetadata,
    cancelChapterCreation,
    updateChapterFlowSummary,
    regenerateChapterFlowSummary,
    saveChapterFromFlow,
  } = useStore();

  const [localSummary, setLocalSummary] = useState('');

  // Sync summary from store
  useEffect(() => {
    if (chapterFlowReviewOpen) {
      setLocalSummary(chapterFlowSummary);
    }
  }, [chapterFlowReviewOpen, chapterFlowSummary]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelChapterCreation();
    };
    if (chapterFlowReviewOpen) {
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
  }, [chapterFlowReviewOpen, cancelChapterCreation]);

  if (!chapterFlowReviewOpen) return null;

  const hasChanges = localSummary !== chapterFlowSummary;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] modal-enter-overlay p-3 md:p-4"
      onClick={cancelChapterCreation}
    >
      <div
        className="bg-tavern-bg border border-tavern-border rounded-xl shadow-2xl shadow-black/40 w-full max-w-2xl max-h-[85vh] flex flex-col modal-enter-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-tavern-border">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-tavern-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <h2 className="text-base font-semibold text-tavern-text-bright">Chapter Summary Review</h2>
          </div>
          <button onClick={cancelChapterCreation} className="w-8 h-8 flex items-center justify-center rounded-md text-tavern-muted hover:text-tavern-text hover:bg-tavern-hover transition-colors active:scale-90">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Generating state */}
          {chapterFlowIsGenerating && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-tavern-accent border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm text-tavern-dim">Generating summary...</p>
              <p className="text-xs text-tavern-muted mt-1">This may take 10-30 seconds</p>
            </div>
          )}

          {/* Summary Editor */}
          {!chapterFlowIsGenerating && (
            <>
              <div>
                <label className="block text-sm font-medium text-tavern-dim mb-2">Summary</label>
                <textarea
                  value={localSummary}
                  onChange={(e) => setLocalSummary(e.target.value)}
                  placeholder="Chapter summary will appear here..."
                  rows={10}
                  className="w-full bg-tavern-input border border-tavern-border rounded-lg px-3 py-2 text-sm text-tavern-text placeholder-tavern-faint outline-none focus:border-tavern-accent resize-y transition-colors"
                />
                <p className="text-xs text-tavern-muted mt-1">
                  Edit the summary as needed. The summary should be in the language of the conversation.
                </p>
              </div>

              {/* Metadata */}
              {chapterFlowSummaryMetadata && (
                <div className="bg-tavern-input border border-tavern-border rounded-lg p-3">
                  <h3 className="text-xs font-medium text-tavern-dim mb-2">Generation Info</h3>
                  <div className="flex gap-4 text-xs text-tavern-text">
                    <span>Model: <span className="text-tavern-accent">{chapterFlowSummaryMetadata.model}</span></span>
                    <span>Time: <span className="text-tavern-accent">{(chapterFlowSummaryMetadata.time / 1000).toFixed(1)}s</span></span>
                    <span>Tokens: <span className="text-tavern-accent">{chapterFlowSummaryMetadata.tokens}</span></span>
                  </div>
                </div>
              )}

              {hasChanges && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                  <p className="text-xs text-amber-400">You have unsaved changes to the summary.</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-tavern-border">
          <button
            onClick={cancelChapterCreation}
            className="px-4 py-2 rounded-lg bg-tavern-input border border-tavern-border text-tavern-dim hover:text-tavern-text hover:bg-tavern-hover text-sm transition-colors active:scale-[0.97]"
          >
            Cancel
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => {
                updateChapterFlowSummary(localSummary);
                regenerateChapterFlowSummary();
              }}
              disabled={chapterFlowIsGenerating}
              className="px-4 py-2 rounded-lg bg-tavern-accent/20 text-tavern-accent hover:bg-tavern-accent/30 text-sm transition-all active:scale-[0.97] disabled:opacity-50"
            >
              {chapterFlowIsGenerating ? 'Regenerating...' : '↻ Regenerate'}
            </button>
            <button
              onClick={() => {
                updateChapterFlowSummary(localSummary);
                saveChapterFromFlow();
              }}
              disabled={chapterFlowIsGenerating}
              className="px-4 py-2 rounded-lg bg-tavern-accent text-white hover:bg-tavern-accent-hover text-sm font-medium transition-all active:scale-[0.97] disabled:opacity-50 shadow-md shadow-tavern-accent/20"
            >
              ✓ Save Chapter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
