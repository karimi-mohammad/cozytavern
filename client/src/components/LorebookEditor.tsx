import { useState, useEffect } from 'react';
import { useStore } from '../store/state';
import { LorebookEntry } from '../types';
import { api } from '../api/client';

export default function LorebookEditor() {
  const { lorebookEditorOpen, setLorebookEditorOpen, lorebooks, loadLorebooks, setActiveLorebook } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lorebookData, setLorebookData] = useState<any>(null);
  const [newName, setNewName] = useState('');
  const [mobileTab, setMobileTab] = useState<'list' | 'detail'>('list');

  const [entryForm, setEntryForm] = useState({
    key: '', keysecondary: '', content: '',
    constant: false, selective: false,
    insertion_order: 100, position: 'before_main' as 'before_main' | 'after_main',
    disable: false, comment: '',
  });

  useEffect(() => {
    if (lorebookEditorOpen) loadLorebooks();
  }, [lorebookEditorOpen]);

  useEffect(() => {
    if (selectedId) {
      api.getLorebook(selectedId).then(setLorebookData);
      setMobileTab('detail');
    }
  }, [selectedId]);

  if (!lorebookEditorOpen) return null;

  const handleCreateLorebook = async () => {
    if (!newName.trim()) return;
    const lb = await api.createLorebook({ name: newName.trim() });
    await loadLorebooks();
    setSelectedId(lb.id);
    setNewName('');
  };

  const handleAddEntry = async () => {
    if (!selectedId || !entryForm.content.trim()) return;
    await api.addLorebookEntry(selectedId, {
      ...entryForm,
      key: entryForm.key.split(',').map(s => s.trim()).filter(Boolean),
      keysecondary: entryForm.keysecondary.split(',').map(s => s.trim()).filter(Boolean),
    });
    const updated = await api.getLorebook(selectedId);
    setLorebookData(updated);
    setEntryForm({
      key: '', keysecondary: '', content: '',
      constant: false, selective: false,
      insertion_order: 100, position: 'before_main',
      disable: false, comment: '',
    });
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!selectedId) return;
    await api.deleteLorebookEntry(entryId);
    const updated = await api.getLorebook(selectedId);
    setLorebookData(updated);
  };

  const handleDeleteLorebook = async (id: string) => {
    await api.deleteLorebook(id);
    setSelectedId(null);
    setLorebookData(null);
    await loadLorebooks();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3 md:p-4">
      <div className="bg-tavern-card rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-tavern-border flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-bold">لوربوک (World Info)</h2>
          <button onClick={() => { setLorebookEditorOpen(false); setSelectedId(null); }} className="text-tavern-muted hover:text-tavern-text">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Mobile tabs */}
        <div className="flex md:hidden border-b border-tavern-border flex-shrink-0">
          <button
            onClick={() => setMobileTab('list')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              mobileTab === 'list' ? 'text-tavern-accent border-b-2 border-tavern-accent' : 'text-tavern-muted'
            }`}
          >
            لیست
          </button>
          <button
            onClick={() => setMobileTab('detail')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              mobileTab === 'detail' ? 'text-tavern-accent border-b-2 border-tavern-accent' : 'text-tavern-muted'
            }`}
            disabled={!selectedId}
          >
            جزئیات
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* لیست لوربوک‌ها */}
          <div className={`${mobileTab === 'list' ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-1/3 border-l md:border-l border-tavern-border p-3 space-y-2 overflow-y-auto`}>
            <div className="flex gap-1">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateLorebook()}
                className="flex-1 bg-tavern-bg border border-tavern-border rounded px-2 py-1 text-xs focus:outline-none focus:border-tavern-accent"
                placeholder="نام جدید"
              />
              <button onClick={handleCreateLorebook} className="bg-tavern-accent text-white px-2 py-1 rounded text-xs">+</button>
            </div>
            {lorebooks.map(lb => (
              <div
                key={lb.id}
                className={`p-2 rounded cursor-pointer text-sm flex items-center justify-between ${
                  selectedId === lb.id ? 'bg-tavern-accent/20 text-tavern-accent' : 'hover:bg-tavern-hover'
                }`}
                onClick={() => { setSelectedId(lb.id); setMobileTab('detail'); }}
              >
                <span className="truncate">{lb.name}</span>
                <button onClick={(e) => { e.stopPropagation(); handleDeleteLorebook(lb.id); }} className="text-tavern-muted hover:text-red-400 text-xs">×</button>
              </div>
            ))}
          </div>

          {/* جزئیات */}
          <div className={`${mobileTab === 'detail' ? 'flex' : 'hidden'} md:flex flex-1 flex-col p-4 overflow-y-auto`}>
            {selectedId && lorebookData ? (
              <div className="space-y-4">
                {/* Mobile back button */}
                <button
                  onClick={() => setMobileTab('list')}
                  className="md:hidden text-tavern-accent text-sm flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  بازگشت به لیست
                </button>

                {/* entries موجود */}
                <div>
                  <h3 className="text-sm font-medium mb-2">Entries ({lorebookData.entries?.length || 0})</h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {lorebookData.entries?.map((entry: LorebookEntry & { key: string[]; keysecondary: string[] }) => (
                      <div key={entry.id} className="bg-tavern-bg rounded p-2 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex gap-1 flex-wrap">
                            {entry.key.map((k, i) => (
                              <span key={i} className="bg-tavern-accent/20 text-tavern-accent px-1.5 py-0.5 rounded">{k}</span>
                            ))}
                          </div>
                          <button onClick={() => handleDeleteEntry(entry.id)} className="text-red-400 hover:text-red-300">حذف</button>
                        </div>
                        <p className="text-tavern-muted mt-1 line-clamp-2">{entry.content}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* فرم entry جدید */}
                <div className="border-t border-tavern-border pt-4">
                  <h3 className="text-sm font-medium mb-2">Entry جدید</h3>
                  <div className="space-y-2">
                    <input
                      value={entryForm.key}
                      onChange={(e) => setEntryForm(f => ({ ...f, key: e.target.value }))}
                      className="w-full bg-tavern-bg border border-tavern-border rounded px-3 py-2 text-sm focus:outline-none focus:border-tavern-accent"
                      placeholder="کلمات کلیدی (با کاما جدا کنید)"
                    />
                    <input
                      value={entryForm.keysecondary}
                      onChange={(e) => setEntryForm(f => ({ ...f, keysecondary: e.target.value }))}
                      className="w-full bg-tavern-bg border border-tavern-border rounded px-3 py-2 text-sm focus:outline-none focus:border-tavern-accent"
                      placeholder="کلمات کلیدی ثانویه (اختیاری)"
                    />
                    <textarea
                      value={entryForm.content}
                      onChange={(e) => setEntryForm(f => ({ ...f, content: e.target.value }))}
                      className="w-full bg-tavern-bg border border-tavern-border rounded px-3 py-2 text-sm focus:outline-none focus:border-tavern-accent resize-none"
                      rows={3}
                      placeholder="محتوا (به context AI اضافه می‌شود)"
                    />
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <label className="flex items-center gap-1">
                        <input type="checkbox" checked={entryForm.constant} onChange={(e) => setEntryForm(f => ({ ...f, constant: e.target.checked }))} className="accent-tavern-accent" />
                        همیشه فعال
                      </label>
                      <label className="flex items-center gap-1">
                        <input type="checkbox" checked={entryForm.selective} onChange={(e) => setEntryForm(f => ({ ...f, selective: e.target.checked }))} className="accent-tavern-accent" />
                        انتخابی
                      </label>
                      <select
                        value={entryForm.position}
                        onChange={(e) => setEntryForm(f => ({ ...f, position: e.target.value as any }))}
                        className="bg-tavern-bg border border-tavern-border rounded px-2 py-1 text-xs"
                      >
                        <option value="before_main">قبل از چت</option>
                        <option value="after_main">بعد از چت</option>
                      </select>
                    </div>
                    <button
                      onClick={handleAddEntry}
                      disabled={!entryForm.content.trim()}
                      className="w-full bg-tavern-accent hover:bg-tavern-accent-hover disabled:opacity-30 text-white rounded py-2 text-sm"
                    >
                      اضافه کردن Entry
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-tavern-muted text-sm py-8">
                یک لوربوک انتخاب کنید یا جدید بسازید
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
