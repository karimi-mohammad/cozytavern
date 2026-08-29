import { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/state';
import { api } from '../api/client';

export default function ChatSettings() {
  const {
    settingsOpen, setSettingsOpen, loadApiSettings, saveApiSettings, apiSettings,
    currentChat,
  } = useStore();
  const loadedRef = useRef(false);
  const [form, setForm] = useState({
    base_url: '', api_key: '', model: '',
    temperature: 0.7, max_tokens: 2048, max_context: 0, top_p: 1,
    frequency_penalty: 0, presence_penalty: 0,
    stream: true, stop: [] as string[],
    system_prompt: '',
    authors_note: '',
    authors_note_depth: 4,
    authors_note_position: 'in_chat' as 'after_char' | 'in_chat',
  });

  // وقتی مودال باز می‌شه، اول از store پر کن، بعد از سرور رفرش کن
  useEffect(() => {
    if (settingsOpen) {
      loadedRef.current = false;
      // اول از store موجود پر کن (فوری)
      const storeData = useStore.getState().apiSettings['openai'];
      const chat = useStore.getState().currentChat;
      const chatFields = chat ? {
        authors_note: chat.authors_note || '',
        authors_note_depth: chat.authors_note_depth ?? 4,
        authors_note_position: chat.authors_note_position || 'in_chat',
      } : {};
      if (storeData) {
        setForm({ ...storeData as any, ...chatFields });
      }
      // بعد از سرور رفرش کن
      (async () => {
        await loadApiSettings();
        const freshData = useStore.getState().apiSettings['openai'];
        if (freshData) setForm(f => ({ ...f, ...freshData as any, ...chatFields }));
        loadedRef.current = true;
      })();
    }
  }, [settingsOpen]);

  // بستن مودال با کلید Escape
  useEffect(() => {
    if (!settingsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSettingsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [settingsOpen]);

  if (!settingsOpen) return null;

  const handleSave = () => {
    const { authors_note, authors_note_depth, authors_note_position, ...apiFields } = form;
    saveApiSettings(apiFields);
    // ذخیره Author's Note در چت جاری
    if (currentChat) {
      api.updateChat(currentChat.id, { authors_note, authors_note_depth, authors_note_position })
        .catch((err: any) => console.error('Failed to save Author\'s Note:', err));
    }
    setSettingsOpen(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-3 md:p-4 modal-enter-overlay">
      <div className="bg-tavern-card border border-tavern-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl shadow-black/40 modal-enter-card">
        <div className="p-4 border-b border-tavern-border flex items-center justify-between sticky top-0 bg-tavern-card z-10 rounded-t-xl">
          <h2 className="text-lg font-bold text-tavern-text-bright">API Settings</h2>
          <button onClick={() => setSettingsOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-md text-tavern-muted hover:text-tavern-text hover:bg-tavern-hover transition-colors active:scale-90">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Author's Note (per-chat) */}
          {currentChat && (
            <div className="bg-tavern-bg/50 rounded-lg p-3 border border-tavern-border">
              <label className="block text-sm font-medium mb-1">Author's Note <span className="text-tavern-dim text-xs">(per-chat)</span></label>
              <p className="text-xs text-tavern-muted mb-2">
                Injected into the prompt. Depth: 0 = end of chat, higher = further up.
              </p>
              <textarea
                value={form.authors_note}
                onChange={(e) => setForm(f => ({ ...f, authors_note: e.target.value }))}
                className="w-full bg-tavern-card border border-tavern-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-tavern-accent resize-none"
                rows={3}
                placeholder="e.g. Use asterisks for actions. Write detailed descriptions."
              />
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-2 flex-1">
                  <label className="text-xs text-tavern-dim whitespace-nowrap">Depth</label>
                  <input
                    type="range" min="0" max="20" step="1"
                    value={form.authors_note_depth}
                    onChange={(e) => setForm(f => ({ ...f, authors_note_depth: parseInt(e.target.value) }))}
                    className="flex-1 accent-tavern-accent"
                  />
                  <span className="text-xs font-mono text-tavern-dim w-5 text-center">{form.authors_note_depth}</span>
                </div>
                <select
                  value={form.authors_note_position}
                  onChange={(e) => setForm(f => ({ ...f, authors_note_position: e.target.value as 'after_char' | 'in_chat' }))}
                  className="bg-tavern-card border border-tavern-border rounded px-2 py-1 text-xs"
                >
                  <option value="in_chat">In chat (at depth)</option>
                  <option value="after_char">After character info</option>
                </select>
              </div>
            </div>
          )}

          {/* System Prompt */}
          <div>
            <label className="block text-sm font-medium mb-1">System Prompt</label>
            <textarea
              value={form.system_prompt}
              onChange={(e) => setForm(f => ({ ...f, system_prompt: e.target.value }))}
              className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-tavern-accent resize-none"
              rows={4}
              placeholder="Behavioral instructions for the AI (optional)"
            />
            <p className="text-xs text-tavern-muted mt-1">If empty, only character and persona are used</p>
          </div>

          {/* Endpoint */}
          <div>
            <label className="block text-sm font-medium mb-1">Custom Endpoint</label>
            <input
              value={form.base_url}
              onChange={(e) => setForm(f => ({ ...f, base_url: e.target.value }))}
              className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-tavern-accent font-mono"
              placeholder="https://api.openai.com/v1/chat/completions"
              dir="ltr"
            />
            <p className="text-xs text-tavern-muted mt-1">
              If left empty, the OpenAI default is used.
            </p>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium mb-1">API Key</label>
            <input
              type="password"
              value={form.api_key}
              onChange={(e) => setForm(f => ({ ...f, api_key: e.target.value }))}
              className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-tavern-accent"
              placeholder="sk-..."
              dir="ltr"
            />
          </div>

          {/* Model */}
          <div>
            <label className="block text-sm font-medium mb-1">Model</label>
            <input
              value={form.model}
              onChange={(e) => setForm(f => ({ ...f, model: e.target.value }))}
              className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-tavern-accent"
              placeholder="gpt-4o, gpt-3.5-turbo, llama3, ..."
              dir="ltr"
            />
          </div>

          {/* Temperature */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Temperature: {form.temperature}
            </label>
            <input
              type="range" min="0" max="2" step="0.1"
              value={form.temperature}
              onChange={(e) => setForm(f => ({ ...f, temperature: parseFloat(e.target.value) }))}
              className="w-full accent-tavern-accent"
            />
          </div>

          {/* Max Tokens (Output) */}
          <div>
            <label className="block text-sm font-medium mb-1">Max Tokens (Output)</label>
            <input
              type="number"
              value={form.max_tokens}
              onChange={(e) => setForm(f => ({ ...f, max_tokens: parseInt(e.target.value) || 2048 }))}
              className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-tavern-accent"
            />
            <p className="text-[10px] text-tavern-dim mt-0.5">حداکثر توکن خروجی پاسخ مدل</p>
          </div>

          {/* Max Context (Input Window) */}
          <div>
            <label className="block text-sm font-medium mb-1">Max Context (Window)</label>
            <input
              type="number"
              value={form.max_context || ''}
              placeholder="خودکار (0 = بر اساس مدل)"
              onChange={(e) => setForm(f => ({ ...f, max_context: parseInt(e.target.value) || 0 }))}
              className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-tavern-accent placeholder:text-tavern-faint"
            />
            <p className="text-[10px] text-tavern-dim mt-0.5">کل فضای context مدل (0 = خودکار). مثال: 128000, 32000, 8192</p>
          </div>

          {/* Top P */}
          <div>
            <label className="block text-sm font-medium mb-1">Top P: {form.top_p}</label>
            <input
              type="range" min="0" max="1" step="0.05"
              value={form.top_p}
              onChange={(e) => setForm(f => ({ ...f, top_p: parseFloat(e.target.value) }))}
              className="w-full accent-tavern-accent"
            />
          </div>

          {/* Streaming */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.stream}
              onChange={(e) => setForm(f => ({ ...f, stream: e.target.checked }))}
              className="accent-tavern-accent"
              id="stream-toggle"
            />
            <label htmlFor="stream-toggle" className="text-sm font-medium">Streaming (live response)</label>
          </div>
        </div>

        <div className="p-4 border-t border-tavern-border flex justify-end gap-2 sticky bottom-0 bg-tavern-card rounded-b-xl">
          <button onClick={() => setSettingsOpen(false)} className="px-4 py-2 text-tavern-muted hover:text-tavern-text text-sm rounded-lg hover:bg-tavern-hover transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} className="px-6 py-2 bg-tavern-accent hover:bg-tavern-accent-hover text-white rounded-lg text-sm font-medium transition-all active:scale-[0.97] shadow-md shadow-tavern-accent/20">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
