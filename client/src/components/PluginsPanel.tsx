import { useState, useEffect } from 'react';
import { useStore } from '../store/state';
import type { ChapterSettings, LorebookPluginSettings, QuickReplySettings } from '../types';

// ─── کارت آکاردئونی عمومی پلاگین ───
// تنظیمات هر پلاگین زیر کارت خودش باز می‌شود و draft/ذخیره مستقل دارد

interface PluginCardProps {
  icon: React.ReactNode;
  name: string;
  subtitle: string;
  disabled?: boolean;
  expanded: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}

function PluginCard({ icon, name, subtitle, disabled, expanded, onToggle, children }: PluginCardProps) {
  return (
    <div className={`bg-tavern-input border border-tavern-border rounded-lg overflow-hidden ${disabled ? 'opacity-50' : ''}`}>
      <button
        onClick={onToggle}
        disabled={disabled}
        className="w-full p-3 flex items-center justify-between text-right hover:bg-tavern-hover transition-colors disabled:cursor-not-allowed active:scale-[0.99]"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-tavern-accent flex-shrink-0">{icon}</span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-tavern-text">{name}</p>
            <p className="text-xs text-tavern-dim truncate">{subtitle}</p>
          </div>
        </div>
        {!disabled && (
          <svg
            className={`w-4 h-4 text-tavern-dim flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>
      {expanded && children && (
        <div className="border-t border-tavern-border p-3 animate-fade-in">{children}</div>
      )}
    </div>
  );
}

// ─── فرم تنظیمات فصل‌بندی خودکار ───

function ChaptersSettingsForm() {
  const chapterSettings = useStore(s => s.chapterSettings);
  const loadChapterSettings = useStore(s => s.loadChapterSettings);
  const updateChapterSettings = useStore(s => s.updateChapterSettings);

  const [form, setForm] = useState<ChapterSettings>({
    raw_window: 10,
    raw_mode: 'count',
    raw_token_budget: 3000,
    raw_min_messages: 3,
    raw_max_messages: 20,
    auto_detect_enabled: true,
    trigger_phrases: [],
    summarizer_model: '',
    summarizer_base_url: '',
    summarizer_api_key: '',
  });
  const [newTrigger, setNewTrigger] = useState('');

  // sync از store (چه در mount، چه بعد از لود سرور)
  useEffect(() => {
    if (chapterSettings) setForm(chapterSettings);
  }, [chapterSettings]);

  useEffect(() => {
    loadChapterSettings();
  }, [loadChapterSettings]);

  return (
    <div className="space-y-3">
      {/* Raw Window Mode */}
      <div>
        <label className="block text-sm font-medium mb-1">Raw Window Mode</label>
        <div className="flex gap-2">
          <button
            onClick={() => setForm(f => ({ ...f, raw_mode: 'count' }))}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              form.raw_mode === 'count'
                ? 'bg-tavern-accent text-white'
                : 'bg-tavern-bg border border-tavern-border text-tavern-dim hover:text-tavern-text'
            }`}
          >
            By Count
          </button>
          <button
            onClick={() => setForm(f => ({ ...f, raw_mode: 'tokens' }))}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              form.raw_mode === 'tokens'
                ? 'bg-tavern-accent text-white'
                : 'bg-tavern-bg border border-tavern-border text-tavern-dim hover:text-tavern-text'
            }`}
          >
            By Tokens
          </button>
        </div>
      </div>

      {/* Count Mode Settings */}
      {form.raw_mode === 'count' && (
        <div>
          <label className="block text-sm font-medium mb-1">
            Recent raw messages: {form.raw_window}
          </label>
          <input
            type="range" min="5" max="50" step="1"
            value={form.raw_window}
            onChange={(e) => setForm(f => ({ ...f, raw_window: parseInt(e.target.value) }))}
            className="w-full accent-tavern-accent"
          />
          <p className="text-xs text-tavern-muted mt-0.5">Number of messages sent as raw context</p>
        </div>
      )}

      {/* Token Mode Settings */}
      {form.raw_mode === 'tokens' && (
        <>
          <div>
            <label className="block text-sm font-medium mb-1">
              Token budget: {form.raw_token_budget.toLocaleString()}
            </label>
            <input
              type="range" min="500" max="20000" step="500"
              value={form.raw_token_budget}
              onChange={(e) => setForm(f => ({ ...f, raw_token_budget: parseInt(e.target.value) }))}
              className="w-full accent-tavern-accent"
            />
            <p className="text-xs text-tavern-muted mt-0.5">Max tokens for raw messages</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium mb-1">Min messages</label>
              <input
                type="number" min={1} max={50}
                value={form.raw_min_messages}
                onChange={(e) => setForm(f => ({ ...f, raw_min_messages: parseInt(e.target.value) || 3 }))}
                className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-tavern-accent"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Max messages</label>
              <input
                type="number" min={1} max={100}
                value={form.raw_max_messages}
                onChange={(e) => setForm(f => ({ ...f, raw_max_messages: parseInt(e.target.value) || 20 }))}
                className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-tavern-accent"
                dir="ltr"
              />
            </div>
          </div>
          <p className="text-xs text-tavern-muted">Token mode: messages are added from newest until budget is reached</p>
        </>
      )}

      {/* Auto Detect */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={form.auto_detect_enabled}
          onChange={(e) => setForm(f => ({ ...f, auto_detect_enabled: e.target.checked }))}
          className="accent-tavern-accent"
          id="plugin-auto-detect-toggle"
        />
        <label htmlFor="plugin-auto-detect-toggle" className="text-sm font-medium">Auto chapter detection</label>
      </div>

      {/* Trigger Phrases */}
      {form.auto_detect_enabled && (
        <div>
          <label className="block text-sm font-medium mb-1">Trigger phrases</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {form.trigger_phrases.map((trigger, i) => (
              <span key={`${trigger}-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 bg-tavern-accent/10 text-tavern-accent rounded text-xs">
                {trigger}
                <button
                  onClick={() => setForm(f => ({
                    ...f,
                    trigger_phrases: f.trigger_phrases.filter((_, j) => j !== i),
                  }))}
                  className="hover:text-red-400"
                >&times;</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newTrigger}
              onChange={(e) => setNewTrigger(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTrigger.trim()) {
                  setForm(f => ({ ...f, trigger_phrases: [...f.trigger_phrases, newTrigger.trim()] }));
                  setNewTrigger('');
                }
              }}
              className="flex-1 bg-tavern-bg border border-tavern-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-tavern-accent"
              placeholder="New phrase..."
            />
            <button
              onClick={() => {
                if (newTrigger.trim()) {
                  setForm(f => ({ ...f, trigger_phrases: [...f.trigger_phrases, newTrigger.trim()] }));
                  setNewTrigger('');
                }
              }}
              className="px-2 py-1 bg-tavern-accent/20 text-tavern-accent rounded text-sm hover:bg-tavern-accent/30"
            >+</button>
          </div>
        </div>
      )}

      {/* Summarizer */}
      <div className="border-t border-tavern-border pt-3 mt-3">
        <p className="text-xs text-tavern-muted mb-2">Summarizer model (empty = use main model)</p>
        <input
          value={form.summarizer_model}
          onChange={(e) => setForm(f => ({ ...f, summarizer_model: e.target.value }))}
          className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-tavern-accent mb-2"
          placeholder="gpt-4o-mini, ... (optional)"
          dir="ltr"
        />
        <input
          value={form.summarizer_base_url}
          onChange={(e) => setForm(f => ({ ...f, summarizer_base_url: e.target.value }))}
          className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-tavern-accent mb-2"
          placeholder="Base URL (optional)"
          dir="ltr"
        />
        <input
          type="password"
          value={form.summarizer_api_key}
          onChange={(e) => setForm(f => ({ ...f, summarizer_api_key: e.target.value }))}
          className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-tavern-accent"
          placeholder="API Key (optional)"
          dir="ltr"
        />
      </div>

      <div className="flex justify-end pt-1">
        <button
          onClick={() => updateChapterSettings(form)}
          className="px-4 py-1.5 bg-tavern-accent hover:bg-tavern-accent-hover text-white rounded-lg text-sm font-medium"
        >
          Save
        </button>
      </div>
    </div>
  );
}

// ─── فرم تنظیمات اسکنر لوربوک ───

function LorebookScannerForm() {
  const lorebookPluginSettings = useStore(s => s.lorebookPluginSettings);
  const loadLorebookPluginSettings = useStore(s => s.loadLorebookPluginSettings);
  const updateLorebookPluginSettings = useStore(s => s.updateLorebookPluginSettings);

  const [form, setForm] = useState<LorebookPluginSettings>({
    default_scan_depth: 50,
    default_token_budget: 500,
  });

  useEffect(() => {
    if (lorebookPluginSettings) setForm(lorebookPluginSettings);
  }, [lorebookPluginSettings]);

  useEffect(() => {
    loadLorebookPluginSettings();
  }, [loadLorebookPluginSettings]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-tavern-muted">Defaults for new lorebooks — each lorebook can override these values in its own editor.</p>

      <div>
        <label className="block text-sm font-medium mb-1">Scan depth (recent messages)</label>
        <input
          type="number" min={1} max={100}
          value={form.default_scan_depth}
          onChange={(e) => setForm(f => ({ ...f, default_scan_depth: parseInt(e.target.value) || 50 }))}
          className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-tavern-accent"
          dir="ltr"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Entry token budget</label>
        <input
          type="number" min={50} max={4000} step={50}
          value={form.default_token_budget}
          onChange={(e) => setForm(f => ({ ...f, default_token_budget: parseInt(e.target.value) || 500 }))}
          className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-tavern-accent"
          dir="ltr"
        />
      </div>

      <div className="flex justify-end pt-1">
        <button
          onClick={() => updateLorebookPluginSettings(form)}
          className="px-4 py-1.5 bg-tavern-accent hover:bg-tavern-accent-hover text-white rounded-lg text-sm font-medium"
        >
          Save
        </button>
      </div>
    </div>
  );
}

// ─── فرم تنظیمات پاسخ سریع ───

function QuickRepliesForm() {
  const quickReplySettings = useStore(s => s.quickReplySettings);
  const loadQuickReplies = useStore(s => s.loadQuickReplies);
  const updateQuickReplies = useStore(s => s.updateQuickReplies);

  const [form, setForm] = useState<QuickReplySettings>({
    enabled: true,
    replies: [],
  });
  const [newLabel, setNewLabel] = useState('');
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => {
    if (quickReplySettings) setForm(quickReplySettings);
  }, [quickReplySettings]);

  useEffect(() => {
    loadQuickReplies();
  }, [loadQuickReplies]);

  const addReply = () => {
    if (!newLabel.trim() || !newMessage.trim()) return;
    setForm(f => ({
      ...f,
      replies: [...f.replies, { label: newLabel.trim(), message: newMessage.trim() }],
    }));
    setNewLabel('');
    setNewMessage('');
  };

  const removeReply = (idx: number) => {
    setForm(f => ({
      ...f,
      replies: f.replies.filter((_, i) => i !== idx),
    }));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(e) => setForm(f => ({ ...f, enabled: e.target.checked }))}
          className="accent-tavern-accent"
          id="plugin-quick-replies-toggle"
        />
        <label htmlFor="plugin-quick-replies-toggle" className="text-sm font-medium">Enabled</label>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Quick Replies ({form.replies.length})</label>
        <div className="space-y-1.5 mb-2 max-h-48 overflow-y-auto">
          {form.replies.map((r, i) => (
            <div key={`${r.label}-${i}`} className="flex items-center gap-2 bg-tavern-bg rounded px-2 py-1 text-xs">
              <span className="font-medium text-tavern-accent min-w-[60px] truncate">{r.label}</span>
              <span className="text-tavern-dim flex-1 truncate">{r.message}</span>
              <button
                onClick={() => removeReply(i)}
                className="text-red-400 hover:text-red-300 px-1"
              >×</button>
            </div>
          ))}
          {form.replies.length === 0 && (
            <p className="text-xs text-tavern-muted">No quick replies yet</p>
          )}
        </div>

        <div className="flex gap-2">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className="w-24 bg-tavern-bg border border-tavern-border rounded px-2 py-1 text-xs focus:outline-none focus:border-tavern-accent"
            placeholder="Label"
          />
          <input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addReply()}
            className="flex-1 bg-tavern-bg border border-tavern-border rounded px-2 py-1 text-xs focus:outline-none focus:border-tavern-accent"
            placeholder="Message to send..."
          />
          <button
            onClick={addReply}
            disabled={!newLabel.trim() || !newMessage.trim()}
            className="px-2 py-1 bg-tavern-accent/20 text-tavern-accent rounded text-xs hover:bg-tavern-accent/30 disabled:opacity-30"
          >+</button>
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <button
          onClick={() => updateQuickReplies(form)}
          className="px-4 py-1.5 bg-tavern-accent hover:bg-tavern-accent-hover text-white rounded-lg text-sm font-medium"
        >
          Save
        </button>
      </div>
    </div>
  );
}

// ─── پنل اصلی پلاگین‌ها ───

const CHAPTER_ICON = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

const LOREBOOK_ICON = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13M20 11V9a2 2 0 00-2-2h-4m0 0V5a2 2 0 00-2-2H6a2 2 0 00-2 2v14a2 2 0 002 2h6m-8-9h6" />
  </svg>
);

const VOICE_ICON = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
  </svg>
);

const QUICK_REPLIES_ICON = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

export default function PluginsPanel() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggle = (id: string) => setExpandedId(prev => (prev === id ? null : id));

  return (
    <div className="flex-1 overflow-y-auto p-3">
      <div className="mb-3">
        <span className="text-xs text-tavern-dim font-medium">Plugins</span>
      </div>
      <div className="space-y-2">
        <PluginCard
          icon={CHAPTER_ICON}
          name="Auto Chaptering"
          subtitle="Chapter memory and conversation summarization"
          expanded={expandedId === 'chapters'}
          onToggle={() => toggle('chapters')}
        >
          <ChaptersSettingsForm />
        </PluginCard>

        <PluginCard
          icon={LOREBOOK_ICON}
          name="Lorebook Scanner"
          subtitle="Automatically inject world info into the prompt"
          expanded={expandedId === 'lorebook_scanner'}
          onToggle={() => toggle('lorebook_scanner')}
        >
          <LorebookScannerForm />
        </PluginCard>

        <PluginCard
          icon={QUICK_REPLIES_ICON}
          name="Quick Replies"
          subtitle="Pre-defined message buttons for quick access"
          expanded={expandedId === 'quick_replies'}
          onToggle={() => toggle('quick_replies')}
        >
          <QuickRepliesForm />
        </PluginCard>

        <PluginCard
          icon={VOICE_ICON}
          name="Text to Speech"
          subtitle="Coming soon"
          disabled
          expanded={false}
          onToggle={() => {}}
        />
      </div>
    </div>
  );
}
