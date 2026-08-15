import { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/state';

export default function ChatSettings() {
  const { settingsOpen, setSettingsOpen, loadApiSettings, saveApiSettings, apiSettings } = useStore();
  const loadedRef = useRef(false);
  const [form, setForm] = useState({
    base_url: '', api_key: '', model: '',
    temperature: 0.7, max_tokens: 2048, top_p: 1,
    frequency_penalty: 0, presence_penalty: 0,
    stream: true, stop: [] as string[],
    system_prompt: '',
  });

  // وقتی مودال باز می‌شه، اول از store پر کن، بعد از سرور رفرش کن
  useEffect(() => {
    if (settingsOpen) {
      loadedRef.current = false;
      // اول از store موجود پر کن (فوری)
      const storeData = useStore.getState().apiSettings['openai'];
      if (storeData) {
        setForm(storeData);
      }
      // بعد از سرور رفرش کن
      (async () => {
        await loadApiSettings();
        const freshData = useStore.getState().apiSettings['openai'];
        if (freshData) setForm(freshData);
        loadedRef.current = true;
      })();
    }
  }, [settingsOpen]);

  if (!settingsOpen) return null;

  const handleSave = () => {
    saveApiSettings(form);
    setSettingsOpen(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3 md:p-4">
      <div className="bg-tavern-card rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-tavern-border flex items-center justify-between">
          <h2 className="text-lg font-bold">تنظیمات API</h2>
          <button onClick={() => setSettingsOpen(false)} className="text-tavern-muted hover:text-tavern-text">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* System Prompt */}
          <div>
            <label className="block text-sm font-medium mb-1">System Prompt</label>
            <textarea
              value={form.system_prompt}
              onChange={(e) => setForm(f => ({ ...f, system_prompt: e.target.value }))}
              className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-tavern-accent resize-none"
              rows={4}
              placeholder="دستورال ngữلی برای رفتار AI (اختیاری)"
            />
            <p className="text-xs text-tavern-muted mt-1">اگر خالی باشد، فقط از کاراکتر و پرسونا استفاده می‌شود</p>
          </div>

          {/* Endpoint */}
          <div>
            <label className="block text-sm font-medium mb-1">Endpoint سفارشی</label>
            <input
              value={form.base_url}
              onChange={(e) => setForm(f => ({ ...f, base_url: e.target.value }))}
              className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-tavern-accent font-mono"
              placeholder="https://api.openai.com/v1/chat/completions"
              dir="ltr"
            />
            <p className="text-xs text-tavern-muted mt-1">
              خالی باشد از OpenAI پیش‌فرض استفاده می‌شه.
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

          {/* مدل */}
          <div>
            <label className="block text-sm font-medium mb-1">مدل</label>
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

          {/* Max Tokens */}
          <div>
            <label className="block text-sm font-medium mb-1">حداکثر توکن</label>
            <input
              type="number"
              value={form.max_tokens}
              onChange={(e) => setForm(f => ({ ...f, max_tokens: parseInt(e.target.value) || 2048 }))}
              className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-tavern-accent"
            />
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
            <label htmlFor="stream-toggle" className="text-sm font-medium">Streaming (پاسخ زنده)</label>
          </div>
        </div>

        <div className="p-4 border-t border-tavern-border flex justify-end gap-2">
          <button onClick={() => setSettingsOpen(false)} className="px-4 py-2 text-tavern-muted hover:text-tavern-text text-sm">
            لغو
          </button>
          <button onClick={handleSave} className="px-6 py-2 bg-tavern-accent hover:bg-tavern-accent-hover text-white rounded-lg text-sm font-medium">
            ذخیره
          </button>
        </div>
      </div>
    </div>
  );
}
