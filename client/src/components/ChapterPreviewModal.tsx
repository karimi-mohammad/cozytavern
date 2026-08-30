import { useEffect, useState } from 'react';
import { useStore } from '../store/state';
import { api } from '../api/client';
import CharacterAvatar from './CharacterAvatar';

export default function ChapterPreviewModal() {
  const {
    chapterFlowPreviewOpen,
    chapterFlowPreviewData,
    chapterFlowStartId,
    chapterFlowEndId,
    cancelChapterCreation,
    sendChapterForSummary,
    currentChat,
    chapterSettings,
    chapters,
  } = useStore();

  // قابلیت ویرایش شروع/پایان
  const [editStartId, setEditStartId] = useState<string | null>(null);
  const [editEndId, setEditEndId] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // همگام‌سازی با state اصلی
  useEffect(() => {
    if (chapterFlowPreviewOpen) {
      setEditStartId(chapterFlowStartId);
      setEditEndId(chapterFlowEndId);
    }
  }, [chapterFlowPreviewOpen, chapterFlowStartId, chapterFlowEndId]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelChapterCreation();
    };
    if (chapterFlowPreviewOpen) {
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
  }, [chapterFlowPreviewOpen, cancelChapterCreation]);

  if (!chapterFlowPreviewOpen) return null;

  const data = chapterFlowPreviewData;
  const messages = currentChat?.messages || [];
  const rawWindow = chapterSettings?.raw_window || 10;

  // پیدا کردن ایندکس پیام‌ها
  const startIdx = editStartId ? messages.findIndex(m => m.id === editStartId) : -1;
  const endIdx = editEndId ? messages.findIndex(m => m.id === editEndId) : -1;

  // محدوده پیام‌های قابل انتخاب
  // شروع: از اولین پیام تا یکی قبل از پایان
  // پایان: از یکی بعد از شروع تا آخرین پیام - rawWindow
  const maxEndIndex = messages.length - rawWindow - 1;

  // بارگذاری مجدد preview با تغییر شروع/پایان
  const handleRangeChange = async (newStartId: string, newEndId: string) => {
    if (!currentChat || !newStartId || !newEndId) return;

    const newStartIdx = messages.findIndex(m => m.id === newStartId);
    const newEndIdx = messages.findIndex(m => m.id === newEndId);

    // اعتبارسنجی
    if (newStartIdx === -1 || newEndIdx === -1) return;
    if (newStartIdx >= newEndIdx) return;
    if (messages.length - newEndIdx - 1 < rawWindow) return;

    setEditStartId(newStartId);
    setEditEndId(newEndId);

    // بارگذاری مجدد preview
    setLoadingPreview(true);
    try {
      const previewData = await api.previewChapter({
        chat_id: currentChat.id,
        start_message_id: newStartId,
        end_message_id: newEndId,
      });
      useStore.setState({ chapterFlowPreviewData: previewData });
    } catch (err: any) {
      useStore.getState().addToast(`Error: ${err.message}`, 'error');
    } finally {
      setLoadingPreview(false);
    }
  };

  // آیا تغییری ایجاد شده؟
  const hasChanges = editStartId !== chapterFlowStartId || editEndId !== chapterFlowEndId;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] modal-enter-overlay p-3 md:p-4"
      onClick={cancelChapterCreation}
    >
      <div
        className="bg-tavern-bg border border-tavern-border rounded-xl shadow-2xl shadow-black/40 w-full max-w-3xl max-h-[85vh] flex flex-col modal-enter-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-tavern-border">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-tavern-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h2 className="text-base font-semibold text-tavern-text-bright">Chapter Preview</h2>
          </div>
          <button onClick={cancelChapterCreation} className="w-8 h-8 flex items-center justify-center rounded-md text-tavern-muted hover:text-tavern-text hover:bg-tavern-hover transition-colors active:scale-90">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Loading state */}
          {!data && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-tavern-accent border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm text-tavern-dim">Loading preview...</p>
            </div>
          )}

          {data && (
            <>
              {/* ─── Chapter Range (قابل ویرایش) ─── */}
              <div className="bg-tavern-input border border-tavern-border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-medium text-tavern-dim">Chapter Range</h3>
                  {hasChanges && (
                    <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">Modified</span>
                  )}
                </div>

                <div className="space-y-3">
                  {/* Start Message Selector */}
                  <div>
                    <label className="text-[10px] text-emerald-400 font-medium mb-1 block">Start Message</label>
                    <select
                      value={editStartId || ''}
                      onChange={(e) => {
                        const newStartId = e.target.value;
                        if (newStartId && editEndId) {
                          handleRangeChange(newStartId, editEndId);
                        }
                      }}
                      className="w-full bg-tavern-bg border border-tavern-border rounded px-2 py-1.5 text-xs text-tavern-text focus:outline-none focus:border-tavern-accent"
                    >
                      {messages.map((msg, i) => {
                        // فقط پیام‌هایی که قبل از پایان باشند
                        const msgEndIdx = editEndId ? messages.findIndex(m => m.id === editEndId) : messages.length;
                        if (i >= msgEndIdx) return null;
                        // فقط پیام‌هایی که بعد از آخرین فصل باشند
                        let minStartIdx = 0;
                        const lastCh = chapters.length > 0 ? chapters[chapters.length - 1] : null;
                        if (lastCh) {
                          const lastEnd = messages.findIndex(m => m.id === lastCh.end_message_id);
                          if (lastEnd !== -1) minStartIdx = lastEnd + 1;
                        }
                        if (i < minStartIdx) return null;

                        const preview = msg.content.slice(0, 60).replace(/\n/g, ' ');
                        return (
                          <option key={msg.id} value={msg.id}>
                            #{i + 1} — {msg.role === 'user' ? 'User' : 'AI'}: {preview}{msg.content.length > 60 ? '...' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* End Message Selector */}
                  <div>
                    <label className="text-[10px] text-red-400 font-medium mb-1 block">End Message</label>
                    <select
                      value={editEndId || ''}
                      onChange={(e) => {
                        const newEndId = e.target.value;
                        if (editStartId && newEndId) {
                          handleRangeChange(editStartId, newEndId);
                        }
                      }}
                      className="w-full bg-tavern-bg border border-tavern-border rounded px-2 py-1.5 text-xs text-tavern-text focus:outline-none focus:border-tavern-accent"
                    >
                      {messages.map((msg, i) => {
                        // فقط پیام‌هایی که بعد از شروع باشند
                        const msgStartIdx = editStartId ? messages.findIndex(m => m.id === editStartId) : 0;
                        if (i <= msgStartIdx) return null;
                        // فقط پیام‌هایی که قبل از rawWindow آخر باشند
                        if (i > maxEndIndex) return null;

                        const preview = msg.content.slice(0, 60).replace(/\n/g, ' ');
                        return (
                          <option key={msg.id} value={msg.id}>
                            #{i + 1} — {msg.role === 'user' ? 'User' : 'AI'}: {preview}{msg.content.length > 60 ? '...' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Range Info */}
                  <div className="flex items-center gap-4 text-[10px] text-tavern-dim">
                    <span>
                      Messages in chapter: <span className="text-tavern-text font-mono">
                        {startIdx !== -1 && endIdx !== -1 ? endIdx - startIdx + 1 : '—'}
                      </span>
                    </span>
                    <span>
                      Remaining after: <span className={`font-mono ${messages.length - endIdx - 1 >= rawWindow ? 'text-emerald-400' : 'text-red-400'}`}>
                        {endIdx !== -1 ? messages.length - endIdx - 1 : '—'}
                      </span>
                      <span className="opacity-50"> (min {rawWindow})</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Character Info */}
              {data.character && (
                <div className="bg-tavern-input border border-tavern-border rounded-lg p-3">
                  <h3 className="text-xs font-medium text-tavern-dim mb-2">Character</h3>
                  <div className="flex items-center gap-3">
                    <CharacterAvatar name={data.character.name} size="md" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-tavern-text">{data.character.name}</p>
                      {data.character.description && (
                        <p className="text-xs text-tavern-dim line-clamp-2">{data.character.description}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Previous Summaries */}
              {data.previous_summaries.length > 0 && (
                <div className="bg-tavern-input border border-tavern-border rounded-lg p-3">
                  <h3 className="text-xs font-medium text-tavern-dim mb-2">Previous Chapter Summaries</h3>
                  <div className="space-y-2">
                    {data.previous_summaries.map((summary, i) => (
                      <div key={i} className="text-xs text-tavern-text bg-tavern-bg rounded p-2 line-clamp-3">
                        <span className="text-tavern-accent">Chapter {i + 1}:</span> {summary}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Messages Preview */}
              <div className="bg-tavern-input border border-tavern-border rounded-lg p-3">
                <h3 className="text-xs font-medium text-tavern-dim mb-2">Messages Preview ({data.total_messages} total)</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {data.messages_preview.map((msg, i) => (
                    <div key={msg.id + i} className="text-xs">
                      {msg.id === '__omitted__' ? (
                        <div className="text-tavern-muted italic text-center py-1">{msg.content}</div>
                      ) : (
                        <div className="flex gap-2">
                          <span className={`font-medium min-w-[60px] ${msg.role === 'user' ? 'text-blue-400' : 'text-emerald-400'}`}>
                            {msg.role === 'user' ? 'User' : 'Assistant'}:
                          </span>
                          <span className="text-tavern-text line-clamp-2">{msg.content}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Full Payload */}
              <div className="bg-tavern-input border border-tavern-border rounded-lg p-3">
                <h3 className="text-xs font-medium text-tavern-dim mb-2">Full LLM Payload</h3>
                <div className="bg-tavern-bg rounded p-3 max-h-64 overflow-auto">
                  <pre className="text-xs text-tavern-text whitespace-pre-wrap font-mono">
                    {JSON.stringify(data.full_payload, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Summarizer Settings */}
              <div className="bg-tavern-input border border-tavern-border rounded-lg p-3">
                <h3 className="text-xs font-medium text-tavern-dim mb-2">Summarizer Settings</h3>
                <div className="flex gap-4 text-xs text-tavern-text">
                  <span>Model: <span className="text-tavern-accent">{data.settings.model}</span></span>
                  <span>Temperature: <span className="text-tavern-accent">{data.settings.temperature}</span></span>
                  <span>Max tokens: <span className="text-tavern-accent">{data.settings.max_tokens}</span></span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-tavern-border">
          <button
            onClick={cancelChapterCreation}
            className="px-4 py-2 rounded-lg bg-tavern-input border border-tavern-border text-tavern-dim hover:text-tavern-text hover:bg-tavern-hover text-sm transition-colors active:scale-[0.97]"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              // اگر تغییرات ذخیره شده، start/end رو آپدیت کن
              if (hasChanges && editStartId && editEndId) {
                useStore.setState({
                  chapterFlowStartId: editStartId,
                  chapterFlowEndId: editEndId,
                });
              }
              sendChapterForSummary();
            }}
            disabled={!data || loadingPreview}
            className="px-4 py-2 rounded-lg bg-tavern-accent text-white hover:bg-tavern-accent-hover text-sm font-medium transition-all active:scale-[0.97] disabled:opacity-50 shadow-md shadow-tavern-accent/20"
          >
            {loadingPreview ? 'Loading...' : 'Send for Summary →'}
          </button>
        </div>
      </div>
    </div>
  );
}
