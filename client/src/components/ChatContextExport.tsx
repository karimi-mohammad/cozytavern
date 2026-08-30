import { useState, useEffect } from 'react';
import { useStore } from '../store/state';
import { api } from '../api/client';
import { estimateTokens, formatTokenCount } from '../utils/tokenEstimate';

interface ContextExportData {
  endpoint: string;
  model: string;
  params: Record<string, any>;
  messages: { role: string; content: string }[];
  mode?: string;
  source?: string;
}

export default function ChatContextExport({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { currentChat, currentCharacter, activePersona } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ContextExportData | null>(null);
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!isOpen) {
      setData(null);
      setError(null);
      setCopied(false);
      setCollapsed({});
      return;
    }

    if (!currentChat || !currentCharacter) {
      setError('No chat or character selected');
      return;
    }

    const fetchContext = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.inspectChat({
          chat_id: currentChat.id,
          character_id: currentCharacter.id,
          persona_id: activePersona?.id,
        });
        setData(result);
      } catch (e: any) {
        setError(e.message || 'Failed to export context');
      } finally {
        setLoading(false);
      }
    };

    fetchContext();
  }, [isOpen, currentChat?.id, currentCharacter?.id, activePersona?.id]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const totalTokens = data?.messages.reduce((sum, m) => sum + estimateTokens(m.content), 0) || 0;

  const copyJson = () => {
    if (!data) return;
    const json = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const downloadJson = () => {
    if (!data) return;
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `context-${currentChat?.name || 'chat'}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const ROLE_STYLES: Record<string, string> = {
    system: 'bg-amber-500/20 text-amber-500',
    user: 'bg-blue-500/20 text-blue-400',
    assistant: 'bg-emerald-500/20 text-emerald-500',
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[90] flex items-center justify-center p-3 md:p-4 modal-enter-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-tavern-card border border-tavern-border rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl shadow-black/40 modal-enter-card">
        {/* Header */}
        <div className="p-4 border-b border-tavern-border flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-500 font-medium">
                Context Export
              </span>
              {data && (
                <>
                  <span className="text-sm font-bold truncate" dir="ltr">{data.model}</span>
                  <span className="text-[10px] text-tavern-dim font-mono" dir="ltr">
                    {data.messages.length} messages
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono">
                    ~{formatTokenCount(totalTokens)}
                  </span>
                </>
              )}
            </div>
            {data && (
              <div className="text-[10px] text-tavern-dim font-mono truncate mt-1" dir="ltr">
                {data.endpoint}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md text-tavern-dim hover:text-tavern-text hover:bg-tavern-hover transition-colors flex-shrink-0"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <svg className="w-8 h-8 text-tavern-accent animate-spin mb-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-xs text-tavern-dim">Building context...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-sm text-red-400 mb-2">Error</p>
              <p className="text-xs text-tavern-dim">{error}</p>
            </div>
          ) : data ? (
            <div className="space-y-2">
              {data.messages.map((m, i) => (
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
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide flex-shrink-0 ${
                        ROLE_STYLES[m.role] || 'bg-tavern-border/40 text-tavern-dim'
                      }`}
                    >
                      {m.role}
                    </span>
                    <span className="text-[11px] text-tavern-dim truncate flex-1" dir="auto">
                      {m.content.slice(0, 100)}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-tavern-surface2 border border-tavern-border text-tavern-dim font-mono flex-shrink-0">
                      {formatTokenCount(estimateTokens(m.content))}
                    </span>
                  </button>
                  {!collapsed[i] && (
                    <pre
                      className="px-3 py-2 text-xs font-mono whitespace-pre-wrap break-words max-h-64 overflow-y-auto text-tavern-text border-t border-tavern-border"
                      dir="auto"
                    >{m.content}</pre>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-tavern-border flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-tavern-muted hover:text-tavern-text rounded-lg hover:bg-tavern-hover transition-colors"
          >
            Close
          </button>
          {data && (
            <>
              <button
                onClick={copyJson}
                className="px-4 py-2 text-sm text-tavern-muted hover:text-tavern-text rounded-lg hover:bg-tavern-hover transition-colors"
              >
                {copied ? 'Copied ✓' : 'Copy JSON'}
              </button>
              <button
                onClick={downloadJson}
                className="px-4 py-2 bg-tavern-accent hover:bg-tavern-accent-hover text-white rounded-lg text-sm font-semibold shadow-lg shadow-tavern-accent/20 transition-colors"
              >
                Download JSON
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
