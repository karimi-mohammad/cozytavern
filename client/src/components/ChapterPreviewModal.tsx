import { useEffect } from 'react';
import { useStore } from '../store/state';
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
  } = useStore();

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
  const startMsg = messages.find(m => m.id === chapterFlowStartId);
  const endMsg = messages.find(m => m.id === chapterFlowEndId);

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
              {/* Chapter Range */}
              <div className="bg-tavern-input border border-tavern-border rounded-lg p-3">
                <h3 className="text-xs font-medium text-tavern-dim mb-2">Chapter Range</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-400 font-medium min-w-[40px]">Start:</span>
                    <span className="text-tavern-text">
                      {startMsg ? (
                        <>
                          <span className="text-tavern-dim text-xs">#{messages.findIndex(m => m.id === chapterFlowStartId) + 1}</span>{' '}
                          "{startMsg.content.slice(0, 80)}{startMsg.content.length > 80 ? '...' : ''}"
                        </>
                      ) : '—'}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-red-400 font-medium min-w-[40px]">End:</span>
                    <span className="text-tavern-text">
                      {endMsg ? (
                        <>
                          <span className="text-tavern-dim text-xs">#{messages.findIndex(m => m.id === chapterFlowEndId) + 1}</span>{' '}
                          "{endMsg.content.slice(0, 80)}{endMsg.content.length > 80 ? '...' : ''}"
                        </>
                      ) : '—'}
                    </span>
                  </div>
                  <div className="text-tavern-dim text-xs">
                    Total: {data.total_messages} messages
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
                <h3 className="text-xs font-medium text-tavern-dim mb-2">Messages Preview</h3>
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
            onClick={sendChapterForSummary}
            disabled={!data}
            className="px-4 py-2 rounded-lg bg-tavern-accent text-white hover:bg-tavern-accent-hover text-sm font-medium transition-all active:scale-[0.97] disabled:opacity-50 shadow-md shadow-tavern-accent/20"
          >
            Send for Summary →
          </button>
        </div>
      </div>
    </div>
  );
}
