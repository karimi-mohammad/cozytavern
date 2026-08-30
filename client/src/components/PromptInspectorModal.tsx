import { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/state';
import { PromptInspection, PromptPart } from '../types';
import { estimateTokens, formatTokenCount } from '../utils/tokenEstimate';

// ─── Role chip رنگ‌بندی نقش پیام ───
const ROLE_STYLES: Record<string, string> = {
  system: 'bg-amber-500/20 text-amber-500',
  user: 'bg-blue-500/20 text-blue-400',
  assistant: 'bg-emerald-500/20 text-emerald-500',
};

function RoleChip({ role }: { role: string }) {
  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide flex-shrink-0 ${
        ROLE_STYLES[role] || 'bg-tavern-border/40 text-tavern-dim'
      }`}
    >
      {role}
    </span>
  );
}

export default function PromptInspectorModal() {
  const {
    promptInspection, resolveInspection, promptInspectHistory,
  } = useStore();
  // null = نمای زنده (entry در انتظار تصمیم)؛ در غیر این صورت id از تاریخچه
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editedMessages, setEditedMessages] = useState<PromptPart[]>([]);
  // ref برای دسترسی به viewingId داخل listener بدون stale closure
  const viewingIdRef = useRef<string | null>(null);
  useEffect(() => { viewingIdRef.current = viewingId; }, [viewingId]);

  // ورود بازرسی جدید → برگشت خودکار به نمای زنده + ریست state
  useEffect(() => {
    setViewingId(null);
    setCollapsed({});
    setCopied(false);
    setEditing(false);
    setEditedMessages([]);
  }, [promptInspection?.id]);

  // بستن با Escape در سطح پنجره: اگر روی تاریخچه‌ای هستیم اول برگرده به نمای زنده
  const inspectionId = promptInspection?.id;
  useEffect(() => {
    if (!inspectionId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (viewingIdRef.current !== null) {
          setViewingId(null);
        } else {
          useStore.getState().resolveInspection(false);
        }
      }
      // Ctrl/Cmd+Enter: تایید و ارسال (فقط در نمای زنده)
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && viewingIdRef.current === null) {
        useStore.getState().resolveInspection(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inspectionId]);

  // وقتی editing فعال می‌شود، پیام‌های فعلی رو کپی کن
  useEffect(() => {
    if (editing && view) {
      setEditedMessages(view.messages.map(m => ({ ...m })));
    }
  }, [editing]);

  if (!promptInspection) return null;

  const isLive = viewingId === null;
  const view: PromptInspection | undefined = isLive
    ? promptInspection
    : promptInspectHistory.find(h => h.id === viewingId);
  if (!view) return null;

  // Calculate token counts for each message and total
  const calculateTokenCounts = () => {
    const messages = editing ? editedMessages : view.messages;
    const tokenCounts = messages.map(m => estimateTokens(m.content));
    const totalTokens = tokenCounts.reduce((sum, count) => sum + count, 0);
    return { tokenCounts, totalTokens };
  };

  const { tokenCounts, totalTokens } = calculateTokenCounts();

  const decide = (send: boolean, withEdits?: boolean) => {
    if (isLive) {
      if (withEdits && editing && editedMessages.length > 0) {
        resolveInspection(true, editedMessages);
      } else {
        resolveInspection(send);
      }
    }
  };

  const copyJson = () => {
    const json = JSON.stringify(
      { endpoint: view.endpoint, model: view.model, params: view.params, messages: view.messages },
      null, 2
    );
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const updateEditedMessage = (index: number, content: string) => {
    setEditedMessages(prev => {
      const next = [...prev];
      next[index] = { ...next[index], content };
      return next;
    });
  };

  const historyOthers = promptInspectHistory.filter(h => h.id !== promptInspection.id);
  const activeMessages = editing ? editedMessages : view.messages;
  const hasEdits = editing && editedMessages.some((m, i) => m.content !== view.messages[i]?.content);

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[90] flex items-center justify-center p-3 md:p-4 modal-enter-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) decide(false); }}
      tabIndex={-1}
    >
      <div className="bg-tavern-card border border-tavern-border rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl shadow-black/40 modal-enter-card">
        {/* Header */}
        <div className="p-4 border-b border-tavern-border flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs px-2 py-0.5 rounded bg-tavern-accent/20 text-tavern-accent font-medium">
                {view.label}
              </span>
              {view.mode && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-tavern-surface2 border border-tavern-border text-tavern-dim font-mono" dir="ltr">
                  {view.mode}
                </span>
              )}
              <span className="text-sm font-bold truncate" dir="ltr">{view.model}</span>
              {!isLive && (
                <span className="text-[10px] text-tavern-dim font-mono" dir="ltr">
                  {new Date(view.created_at).toLocaleTimeString('en-US')}
                </span>
              )}
            </div>
            <div className="text-[10px] text-tavern-dim font-mono truncate mt-1" dir="ltr">
              {view.endpoint}
            </div>
          </div>
          <button
            onClick={() => decide(false)}
            className="w-7 h-7 flex items-center justify-center rounded-md text-tavern-dim hover:text-tavern-text hover:bg-tavern-hover transition-colors flex-shrink-0"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Params grid */}
        <div className="px-4 py-2 border-b border-tavern-border grid grid-cols-3 gap-x-4 gap-y-1 text-[11px] font-mono" dir="ltr">
          {Object.entries(view.params).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2 min-w-0">
              <span className="text-tavern-dim truncate">{k}</span>
              <span className="text-tavern-text truncate">{String(v)}</span>
            </div>
          ))}
          <div className="flex justify-between gap-2">
            <span className="text-tavern-dim">messages</span>
            <span className="text-tavern-text">{view.messages.length}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-tavern-dim">total tokens</span>
            <span className="text-tavern-accent font-semibold">{formatTokenCount(totalTokens)}</span>
          </div>
        </div>

        {/* Edit toolbar */}
        {isLive && (
          <div className="px-4 py-1.5 border-b border-tavern-border flex items-center gap-2">
            <button
              onClick={() => setEditing(e => !e)}
              className={`px-2.5 py-1 text-[11px] rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                editing
                  ? 'bg-tavern-accent/20 text-tavern-accent border border-tavern-accent/40'
                  : 'bg-tavern-surface2 border border-tavern-border text-tavern-dim hover:text-tavern-text hover:bg-tavern-hover'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              {editing ? 'Editing' : 'Edit'}
            </button>
            {editing && hasEdits && (
              <span className="text-[10px] text-tavern-dim">
                {editedMessages.filter((m, i) => m.content !== view.messages[i]?.content).length} message(s) modified
              </span>
            )}
          </div>
        )}

        {/* Messages list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
          {activeMessages.map((m, i) => (
            <div key={i} className="border border-tavern-border rounded-lg overflow-hidden bg-tavern-bg/50">
              <button
                onClick={() => setCollapsed(c => ({ ...c, [i]: !c[i] }))}
                className="w-full px-3 py-1.5 flex items-center gap-2 bg-tavern-surface2 hover:bg-tavern-hover transition-colors text-left"
              >
                <svg
                  className={`w-3 h-3 text-tavern-dim transition-transform flex-shrink-0 ${collapsed[i] ? '-rotate-90' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                <RoleChip role={m.role} />
                <span className="text-[11px] text-tavern-dim truncate flex-1" dir="auto">
                  {m.content.slice(0, 100)}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-tavern-surface2 border border-tavern-border text-tavern-dim font-mono flex-shrink-0">
                  {formatTokenCount(tokenCounts[i])}
                </span>
                {editing && m.content !== view.messages[i]?.content && (
                  <span className="text-[9px] px-1 py-0.5 rounded bg-tavern-accent/20 text-tavern-accent flex-shrink-0">
                    edited
                  </span>
                )}
              </button>
              {!collapsed[i] && (
                editing ? (
                  <textarea
                    className="w-full px-3 py-2 text-xs font-mono bg-transparent border-t border-tavern-border resize-y min-h-[60px] max-h-64 text-tavern-text focus:outline-none focus:ring-1 focus:ring-tavern-accent/50"
                    dir="auto"
                    value={m.content}
                    onChange={(e) => updateEditedMessage(i, e.target.value)}
                    rows={Math.min(Math.max(m.content.split('\n').length, 3), 20)}
                  />
                ) : (
                  <pre
                    className="px-3 py-2 text-xs font-mono whitespace-pre-wrap break-words max-h-64 overflow-y-auto text-tavern-text"
                    dir="auto"
                  >{m.content}</pre>
                )
              )}
            </div>
          ))}
        </div>

        {/* History strip */}
        {(historyOthers.length > 0 || !isLive) && (
          <div className="px-4 py-2 border-t border-tavern-border flex items-center gap-1.5 overflow-x-auto">
            <span className="text-[10px] text-tavern-dim flex-shrink-0 ml-1">History:</span>
            <button
              onClick={() => setViewingId(null)}
              className={`px-2 py-0.5 rounded-full text-[10px] whitespace-nowrap transition-colors flex-shrink-0 ${
                isLive
                  ? 'bg-tavern-accent text-white'
                  : 'bg-tavern-surface2 border border-tavern-border text-tavern-dim hover:text-tavern-text'
              }`}
            >
              Current ({promptInspection.label})
            </button>
            {historyOthers.slice(0, 19).map(h => (
              <button
                key={h.id}
                onClick={() => setViewingId(h.id)}
                className={`px-2 py-0.5 rounded-full text-[10px] whitespace-nowrap transition-colors flex-shrink-0 ${
                  viewingId === h.id
                    ? 'bg-tavern-accent/30 text-tavern-accent border border-tavern-accent/50'
                    : 'bg-tavern-surface2 border border-tavern-border text-tavern-dim hover:text-tavern-text'
                }`}
              >
                {h.label} · {new Date(h.created_at).toLocaleTimeString('en-US')}
              </button>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-tavern-border flex items-center justify-end gap-2">
          {isLive && (
            <span className="text-[11px] text-tavern-dim ml-auto mr-2 hidden md:block">
              This request has not been sent to the model yet
            </span>
          )}
          <button
            onClick={copyJson}
            className="px-3 py-2 text-sm text-tavern-muted hover:text-tavern-text rounded-lg hover:bg-tavern-hover transition-colors"
          >
            {copied ? 'Copied ✓' : 'Copy JSON'}
          </button>
          {isLive ? (
            <>
              <button
                onClick={() => decide(false)}
                className="px-4 py-2 text-sm text-tavern-muted hover:text-tavern-text rounded-lg hover:bg-tavern-hover transition-colors"
              >
                Cancel
              </button>
              {editing && hasEdits ? (
                <button
                  onClick={() => decide(true, true)}
                  className="px-6 py-2 bg-tavern-accent hover:bg-tavern-accent-hover text-white rounded-lg text-sm font-semibold shadow-lg shadow-tavern-accent/20 transition-colors"
                >
                  Send Edited
                </button>
              ) : (
                <button
                  onClick={() => decide(true)}
                  className="px-6 py-2 bg-tavern-accent hover:bg-tavern-accent-hover text-white rounded-lg text-sm font-semibold shadow-lg shadow-tavern-accent/20 transition-colors"
                >
                  Send
                </button>
              )}
            </>
          ) : (
            <span className="text-xs text-tavern-dim">Viewing history (read-only)</span>
          )}
        </div>
      </div>
    </div>
  );
}
