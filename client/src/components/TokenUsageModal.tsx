import { useState, useEffect } from 'react';
import { useStore } from '../store/state';
import { formatTokenCount } from '../utils/tokenEstimate';

interface TokenUsageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TokenUsageModal({ isOpen, onClose }: TokenUsageModalProps) {
  const contextUsage = useStore(s => s.contextUsage);
  const lastApiUsage = useStore(s => s.lastApiUsage);
  const chapters = useStore(s => s.chapters);
  const chatLorebooks = useStore(s => s.chatLorebooks);
  const currentCharacter = useStore(s => s.currentCharacter);
  const currentChat = useStore(s => s.currentChat);
  const activePersona = useStore(s => s.activePersona);
  const apiSettings = useStore(s => s.apiSettings);
  const messages = useStore(s => s.currentChat?.messages || []);

  // Keyboard shortcut
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !contextUsage) return null;

  const settings = apiSettings['openai'];

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[90] flex items-center justify-center p-3 md:p-4 modal-enter-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-tavern-card border border-tavern-border rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl shadow-black/40 modal-enter-card">
        {/* Header */}
        <div className="p-4 border-b border-tavern-border flex items-center justify-between">
          <h2 className="text-lg font-bold text-tavern-text-bright">Token Usage Details</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md text-tavern-dim hover:text-tavern-text hover:bg-tavern-hover transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Overall Progress */}
          <div className="bg-tavern-bg/50 rounded-lg p-4 border border-tavern-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-tavern-text">Context Window</span>
              <span className="text-sm font-mono text-tavern-accent">
                {formatTokenCount(contextUsage.used)} / {formatTokenCount(contextUsage.max)}
              </span>
            </div>
            <div className="w-full h-3 bg-tavern-border rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  contextUsage.percentage < 50
                    ? 'bg-emerald-500'
                    : contextUsage.percentage < 80
                    ? 'bg-amber-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(100, contextUsage.percentage)}%` }}
              />
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-tavern-dim">
              <span>{contextUsage.percentage}% used</span>
              <span>{formatTokenCount(contextUsage.max - contextUsage.used)} remaining</span>
            </div>
          </div>

          {/* Token Breakdown */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-tavern-text-bright">Token Breakdown</h3>
            
            {/* System Prompt */}
            <TokenRow
              label="System Prompt"
              tokens={contextUsage.breakdown.system}
              max={contextUsage.max}
              icon="⚙️"
            />

            {/* Character Card */}
            <TokenRow
              label="Character Card"
              tokens={contextUsage.breakdown.character}
              max={contextUsage.max}
              icon="👤"
              details={currentCharacter ? [
                { label: 'Name', value: currentCharacter.name },
                { label: 'Description', value: currentCharacter.description },
                { label: 'Personality', value: currentCharacter.personality },
                { label: 'Scenario', value: currentCharacter.scenario },
                { label: 'Examples', value: currentCharacter.mes_example },
              ] : undefined}
            />

            {/* Persona */}
            <TokenRow
              label="Persona"
              tokens={contextUsage.breakdown.persona}
              max={contextUsage.max}
              icon="🎭"
              details={activePersona ? [
                { label: 'Name', value: activePersona.name },
                { label: 'Description', value: activePersona.description },
              ] : undefined}
            />

            {/* Lorebook */}
            <TokenRow
              label="Lorebook Entries"
              tokens={contextUsage.breakdown.lorebook}
              max={contextUsage.max}
              icon="📚"
              details={chatLorebooks.length > 0 ? chatLorebooks.map(lb => ({
                label: lb.lorebook_name,
                value: `${lb.active_entries}/${lb.total_entries} active entries`
              })) : undefined}
            />

            {/* Chapters */}
            <TokenRow
              label="Chapter Summaries"
              tokens={contextUsage.breakdown.chapters}
              max={contextUsage.max}
              icon="📖"
              details={chapters.length > 0 ? chapters.map(ch => ({
                label: ch.title || 'Untitled',
                value: ch.summary?.substring(0, 50) + '...' || 'No summary'
              })) : undefined}
            />

            {/* Chat History */}
            <TokenRow
              label="Chat History"
              tokens={contextUsage.breakdown.history}
              max={contextUsage.max}
              icon="💬"
              details={[
                { label: 'Total Messages', value: String(messages.length) },
                { label: 'User Messages', value: String(messages.filter(m => m.role === 'user').length) },
                { label: 'Assistant Messages', value: String(messages.filter(m => m.role === 'assistant').length) },
              ]}
            />

            {/* Story State */}
            {contextUsage.breakdown.storyState > 0 && (
              <TokenRow
                label="Story State"
                tokens={contextUsage.breakdown.storyState}
                max={contextUsage.max}
                icon="🌍"
              />
            )}

            {/* Author's Note */}
            {contextUsage.breakdown.authorsNote > 0 && (
              <TokenRow
                label="Author's Note"
                tokens={contextUsage.breakdown.authorsNote}
                max={contextUsage.max}
                icon="📝"
              />
            )}

            {/* Post-History Instructions */}
            {contextUsage.breakdown.postHistory > 0 && (
              <TokenRow
                label="Post-History Instructions"
                tokens={contextUsage.breakdown.postHistory}
                max={contextUsage.max}
                icon="📋"
              />
            )}

            {/* Tool Definition */}
            {contextUsage.breakdown.toolDefinition > 0 && (
              <TokenRow
                label="Tool Definition"
                tokens={contextUsage.breakdown.toolDefinition}
                max={contextUsage.max}
                icon="🔧"
              />
            )}

            {/* Tool Instruction */}
            {contextUsage.breakdown.toolInstruction > 0 && (
              <TokenRow
                label="Tool Instruction"
                tokens={contextUsage.breakdown.toolInstruction}
                max={contextUsage.max}
                icon="⚡"
              />
            )}

            {/* Group Chat Rules */}
            {contextUsage.breakdown.groupChatRules > 0 && (
              <TokenRow
                label="Group Chat Rules"
                tokens={contextUsage.breakdown.groupChatRules}
                max={contextUsage.max}
                icon="👥"
              />
            )}

            {/* Overhead */}
            <TokenRow
              label="API Overhead"
              tokens={contextUsage.breakdown.overhead}
              max={contextUsage.max}
              icon="🔧"
            />
          </div>

          {/* Model Info */}
          <div className="bg-tavern-bg/50 rounded-lg p-3 border border-tavern-border">
            <div className="flex items-center justify-between text-xs">
              <span className="text-tavern-dim">Model</span>
              <span className="font-mono text-tavern-text">{settings?.model || 'Not set'}</span>
            </div>
            {settings?.max_tokens && (
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-tavern-dim">Max Output Tokens</span>
                <span className="font-mono text-tavern-text">{formatTokenCount(settings.max_tokens)}</span>
              </div>
            )}
          </div>

          {/* Real API Usage (if available) */}
          {lastApiUsage && lastApiUsage.prompt_tokens && (
            <div className="bg-tavern-bg/50 rounded-lg p-3 border border-tavern-border">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-tavern-text">API Usage (Real)</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded">VERIFIED</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-tavern-dim">Prompt Tokens</span>
                  <span className="font-mono text-tavern-text">{formatTokenCount(lastApiUsage.prompt_tokens)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-tavern-dim">Completion Tokens</span>
                  <span className="font-mono text-tavern-text">{formatTokenCount(lastApiUsage.completion_tokens || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-tavern-dim">Total Tokens</span>
                  <span className="font-mono text-tavern-text">{formatTokenCount(lastApiUsage.total_tokens || 0)}</span>
                </div>
                {contextUsage && (
                  <div className="flex justify-between pt-1 border-t border-tavern-border/50">
                    <span className="text-tavern-dim">Estimation Error</span>
                    <span className={`font-mono ${Math.abs(contextUsage.used - lastApiUsage.prompt_tokens) / lastApiUsage.prompt_tokens > 0.15 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {contextUsage.used > lastApiUsage.prompt_tokens ? '+' : ''}
                      {formatTokenCount(contextUsage.used - lastApiUsage.prompt_tokens)}
                      ({Math.round(Math.abs(contextUsage.used - lastApiUsage.prompt_tokens) / lastApiUsage.prompt_tokens * 100)}%)
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-tavern-border">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-tavern-surface2 border border-tavern-border rounded-lg text-sm text-tavern-text hover:bg-tavern-hover transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper component for token rows
function TokenRow({ 
  label, 
  tokens, 
  max, 
  icon, 
  details 
}: { 
  label: string; 
  tokens: number; 
  max: number; 
  icon: string;
  details?: { label: string; value: string }[];
}) {
  const [expanded, setExpanded] = useState(false);
  const percentage = max > 0 ? (tokens / max) * 100 : 0;

  return (
    <div className="bg-tavern-bg/30 rounded-lg border border-tavern-border overflow-hidden">
      <button
        onClick={() => details && setExpanded(!expanded)}
        className={`w-full px-3 py-2.5 flex items-center gap-3 text-left transition-colors ${
          details ? 'hover:bg-tavern-hover' : ''
        }`}
      >
        <span className="text-base">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-sm text-tavern-text font-medium">{label}</span>
            <span className="text-sm font-mono text-tavern-accent">{formatTokenCount(tokens)}</span>
          </div>
          <div className="w-full h-1.5 bg-tavern-border rounded-full mt-1.5 overflow-hidden">
            <div
              className="h-full bg-tavern-accent/60 rounded-full"
              style={{ width: `${Math.min(100, percentage)}%` }}
            />
          </div>
        </div>
        {details && (
          <svg
            className={`w-4 h-4 text-tavern-dim transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>
      
      {expanded && details && details.length > 0 && (
        <div className="px-3 pb-2 pt-1 border-t border-tavern-border/50 space-y-1">
          {details.map((d, i) => (
            <div key={i} className="flex items-start gap-2 text-[11px]">
              <span className="text-tavern-dim whitespace-nowrap">{d.label}:</span>
              <span className="text-tavern-text truncate" title={d.value}>{d.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
