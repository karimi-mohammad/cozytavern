import { useState, useEffect, useMemo } from 'react';
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

  // State برای تغییر start/end
  const [newStartId, setNewStartId] = useState(chapter.start_message_id);
  const [newEndId, setNewEndId] = useState(chapter.end_message_id);
  const [validationError, setValidationError] = useState<string | null>(null);

  const {
    updateChapter, deleteChapter, regenerateChapter,
    showConfirm, addToast, currentChat, chapters, chapterSettings,
  } = useStore();

  const messages = currentChat?.messages || [];
  const rawWindow = chapterSettings?.raw_window || 10;

  // محاسبه ایندکس پیام‌ها
  const currentStartIdx = messages.findIndex(m => m.id === chapter.start_message_id);
  const currentEndIdx = messages.findIndex(m => m.id === chapter.end_message_id);

  // محاسبه محدوده‌های مجاز بر اساس فصل‌های مجاور
  const validRanges = useMemo(() => {
    if (!currentChat) return { minStartIdx: 0, maxEndIdx: messages.length - 1 };

    // پیدا کردن فصل قبلی
    let prevChapterEndIdx = -1;
    // پیدا کردن فصل بعدی
    let nextChapterStartIdx = messages.length;

    const sortedChapters = [...chapters]
      .filter(c => c.id !== chapter.id)
      .sort((a, b) => {
        const aIdx = messages.findIndex(m => m.id === a.start_message_id);
        const bIdx = messages.findIndex(m => m.id === b.start_message_id);
        return aIdx - bIdx;
      });

    for (const ch of sortedChapters) {
      const chStartIdx = messages.findIndex(m => m.id === ch.start_message_id);
      const chEndIdx = messages.findIndex(m => m.id === ch.end_message_id);

      if (chEndIdx < currentStartIdx) {
        // این فصل قبل از فصل فعلی است
        prevChapterEndIdx = Math.max(prevChapterEndIdx, chEndIdx);
      } else if (chStartIdx > currentEndIdx) {
        // این فصل بعد از فصل فعلی است
        nextChapterStartIdx = Math.min(nextChapterStartIdx, chStartIdx);
      }
    }

    // حداقل start: بعد از فصل قبلی + 1
    const minStartIdx = prevChapterEndIdx + 1;
    // حداکثر end: قبل از فصل بعدی - 1 و قبل از rawWindow آخر
    const maxEndIdx = Math.min(nextChapterStartIdx - 1, messages.length - rawWindow - 1);

    return { minStartIdx, maxEndIdx };
  }, [chapters, chapter.id, messages, currentStartIdx, currentEndIdx, rawWindow, currentChat]);

  // Validation
  useEffect(() => {
    if (newStartId === chapter.start_message_id && newEndId === chapter.end_message_id) {
      setValidationError(null);
      return;
    }

    const startIdx = messages.findIndex(m => m.id === newStartId);
    const endIdx = messages.findIndex(m => m.id === newEndId);

    if (startIdx === -1 || endIdx === -1) {
      setValidationError('Invalid message selection');
      return;
    }

    if (startIdx >= endIdx) {
      setValidationError('Start message must come before end message');
      return;
    }

    if (endIdx > validRanges.maxEndIdx) {
      setValidationError(`End message must be at least ${rawWindow} messages before the last message`);
      return;
    }

    if (startIdx < validRanges.minStartIdx) {
      setValidationError('Start message would overlap with the previous chapter');
      return;
    }

    setValidationError(null);
  }, [newStartId, newEndId, messages, chapter, validRanges, rawWindow]);

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
      const updateData: any = { title, summary };

      // اگر start/end تغییر کرده
      if (newStartId !== chapter.start_message_id) {
        updateData.start_message_id = newStartId;
      }
      if (newEndId !== chapter.end_message_id) {
        updateData.end_message_id = newEndId;
      }

      await updateChapter(chapter.id, updateData);
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

  // محاسبه تعداد پیام‌ها در محدوده انتخاب شده
  const selectedStartIdx = messages.findIndex(m => m.id === newStartId);
  const selectedEndIdx = messages.findIndex(m => m.id === newEndId);
  const messageCount = selectedStartIdx !== -1 && selectedEndIdx !== -1
    ? selectedEndIdx - selectedStartIdx + 1
    : 0;
  const remainingAfter = selectedEndIdx !== -1
    ? messages.length - selectedEndIdx - 1
    : 0;

  // آیا تغییری ایجاد شده؟
  const hasRangeChanges = newStartId !== chapter.start_message_id || newEndId !== chapter.end_message_id;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] modal-enter-overlay p-3 md:p-4"
      onClick={onClose}
    >
      <div
        className="bg-tavern-bg border border-tavern-border rounded-xl shadow-2xl shadow-black/40 w-full max-w-2xl max-h-[85vh] flex flex-col modal-enter-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-tavern-border">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-tavern-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <h2 className="text-base font-semibold text-tavern-text-bright">Edit Chapter</h2>
          </div>
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
              rows={8}
              className="w-full bg-tavern-input border border-tavern-border rounded-lg px-3 py-2 text-sm text-tavern-text placeholder-tavern-faint outline-none focus:border-tavern-accent resize-y transition-colors"
            />
          </div>

          {/* ─── Chapter Range Selector ─── */}
          <div className="bg-tavern-input border border-tavern-border rounded-lg p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium text-tavern-dim">Chapter Range</h3>
              {hasRangeChanges && !validationError && (
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">Ready to apply</span>
              )}
              {hasRangeChanges && validationError && (
                <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">Invalid</span>
              )}
            </div>

            <div className="space-y-3">
              {/* Start Message Selector */}
              <div>
                <label className="text-[10px] text-emerald-400 font-medium mb-1 block">Start Message</label>
                <select
                  value={newStartId}
                  onChange={(e) => setNewStartId(e.target.value)}
                  className="w-full bg-tavern-bg border border-tavern-border rounded px-2 py-1.5 text-xs text-tavern-text focus:outline-none focus:border-tavern-accent"
                >
                  {messages.map((msg, i) => {
                    // فقط پیام‌هایی که قبل از end انتخاب شده باشند
                    const currentEndIdx = messages.findIndex(m => m.id === newEndId);
                    if (i >= currentEndIdx) return null;

                    // فقط پیام‌هایی که بعد از فصل قبلی باشند
                    if (i < validRanges.minStartIdx) return null;

                    const preview = msg.content.slice(0, 60).replace(/\n/g, ' ');
                    const isOriginal = msg.id === chapter.start_message_id;
                    return (
                      <option key={msg.id} value={msg.id}>
                        #{i + 1} — {msg.role === 'user' ? 'User' : 'AI'}: {preview}{msg.content.length > 60 ? '...' : ''}{isOriginal ? ' (current)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* End Message Selector */}
              <div>
                <label className="text-[10px] text-red-400 font-medium mb-1 block">End Message</label>
                <select
                  value={newEndId}
                  onChange={(e) => setNewEndId(e.target.value)}
                  className="w-full bg-tavern-bg border border-tavern-border rounded px-2 py-1.5 text-xs text-tavern-text focus:outline-none focus:border-tavern-accent"
                >
                  {messages.map((msg, i) => {
                    // فقط پیام‌هایی که بعد از start انتخاب شده باشند
                    const currentStartIdx = messages.findIndex(m => m.id === newStartId);
                    if (i <= currentStartIdx) return null;

                    // فقط پیام‌هایی که قبل از maxEnd باشند
                    if (i > validRanges.maxEndIdx) return null;

                    const preview = msg.content.slice(0, 60).replace(/\n/g, ' ');
                    const isOriginal = msg.id === chapter.end_message_id;
                    return (
                      <option key={msg.id} value={msg.id}>
                        #{i + 1} — {msg.role === 'user' ? 'User' : 'AI'}: {preview}{msg.content.length > 60 ? '...' : ''}{isOriginal ? ' (current)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Validation Error */}
              {validationError && (
                <div className="flex items-center gap-1.5 text-[10px] text-red-400 bg-red-500/10 px-2 py-1.5 rounded">
                  <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {validationError}
                </div>
              )}

              {/* Range Info */}
              <div className="flex items-center gap-4 text-[10px] text-tavern-dim pt-1 border-t border-tavern-border/30">
                <span>
                  Messages: <span className={`font-mono ${messageCount > 0 ? 'text-tavern-text' : 'text-tavern-dim'}`}>
                    {messageCount}
                  </span>
                </span>
                <span>
                  Remaining: <span className={`font-mono ${remainingAfter >= rawWindow ? 'text-emerald-400' : 'text-red-400'}`}>
                    {remainingAfter}
                  </span>
                  <span className="opacity-50"> (min {rawWindow})</span>
                </span>
              </div>

              {/* Navigation Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const el = document.querySelector(`[data-message-id="${newStartId}"]`);
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      el.classList.add('highlight-flash');
                      setTimeout(() => el.classList.remove('highlight-flash'), 2000);
                    }
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs hover:bg-emerald-500/20 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                  Go to Start
                </button>
                <button
                  onClick={() => {
                    const el = document.querySelector(`[data-message-id="${newEndId}"]`);
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      el.classList.add('highlight-flash');
                      setTimeout(() => el.classList.remove('highlight-flash'), 2000);
                    }
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs hover:bg-red-500/20 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                  Go to End
                </button>
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="bg-tavern-input border border-tavern-border rounded-lg p-3">
            <h3 className="text-xs font-medium text-tavern-dim mb-2">Generation Info</h3>
            <div className="grid grid-cols-2 gap-2 text-xs text-tavern-text">
              <div>
                <span className="text-tavern-dim">Model:</span>{' '}
                <span className="font-mono">{chapter.generation_model || '—'}</span>
              </div>
              <div>
                <span className="text-tavern-dim">Regenerations:</span>{' '}
                <span className="font-mono">{chapter.regeneration_count}</span>
              </div>
              <div>
                <span className="text-tavern-dim">Manually edited:</span>{' '}
                <span className={chapter.manually_edited ? 'text-tavern-accent' : ''}>
                  {chapter.manually_edited ? 'Yes' : 'No'}
                </span>
              </div>
              <div>
                <span className="text-tavern-dim">Created:</span>{' '}
                <span>{chapter.created_at ? new Date(chapter.created_at).toLocaleDateString('en-US') : '—'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-tavern-border">
          <button
            onClick={handleDelete}
            className="px-3 py-1.5 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 text-sm transition-all active:scale-[0.97] flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="px-3 py-1.5 rounded-lg bg-tavern-accent/20 text-tavern-accent hover:bg-tavern-accent/30 text-sm transition-all active:scale-[0.97] disabled:opacity-50 flex items-center gap-1.5"
            >
              <svg className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {regenerating ? 'Regenerating...' : 'Regenerate'}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || (!!validationError && hasRangeChanges)}
              className="px-4 py-1.5 rounded-lg bg-tavern-accent text-white hover:bg-tavern-accent-hover text-sm font-medium transition-all active:scale-[0.97] disabled:opacity-50 shadow-md shadow-tavern-accent/20 flex items-center gap-1.5"
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
