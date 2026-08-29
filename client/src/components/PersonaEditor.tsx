import { useState, useEffect } from 'react';
import { useStore } from '../store/state';

export default function PersonaEditor() {
  const { personaEditorOpen, editingPersona, setPersonaEditorOpen, createPersona, updatePersona, deletePersona, showConfirm } = useStore();

  const [form, setForm] = useState({
    name: '', description: '', personality: '', avatar: '',
  });

  useEffect(() => {
    if (editingPersona) {
      setForm({
        name: editingPersona.name || '',
        description: editingPersona.description || '',
        personality: editingPersona.personality || '',
        avatar: editingPersona.avatar || '',
      });
    } else {
      setForm({ name: '', description: '', personality: '', avatar: '' });
    }
  }, [editingPersona, personaEditorOpen]);

  // بستن مودال با کلید Escape
  useEffect(() => {
    if (!personaEditorOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPersonaEditorOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [personaEditorOpen]);

  if (!personaEditorOpen) return null;

  const handleSave = async () => {
    if (!form.name.trim()) return;
    if (editingPersona) {
      await updatePersona(editingPersona.id, form);
    } else {
      await createPersona(form);
    }
    setPersonaEditorOpen(false);
  };

  const handleDelete = async () => {
    if (!editingPersona) return;
    const ok = await showConfirm('Are you sure you want to delete this persona?');
    if (ok) {
      deletePersona(editingPersona.id);
      setPersonaEditorOpen(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-3 md:p-4 modal-enter-overlay">
      <div className="bg-tavern-card border border-tavern-border rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl shadow-black/40 modal-enter-card">
        <div className="p-4 border-b border-tavern-border flex items-center justify-between sticky top-0 bg-tavern-card z-10 rounded-t-xl">
          <h2 className="text-lg font-bold text-tavern-text-bright">{editingPersona ? 'Edit Persona' : 'New Persona'}</h2>
          <button onClick={() => setPersonaEditorOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-md text-tavern-muted hover:text-tavern-text hover:bg-tavern-hover transition-colors active:scale-90">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-tavern-accent"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-tavern-accent resize-none"
              rows={3}
              placeholder="A description of you for the AI"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Personality Traits</label>
            <input
              value={form.personality}
              onChange={(e) => setForm(f => ({ ...f, personality: e.target.value }))}
              className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-tavern-accent"
              placeholder="e.g. patient, curious"
            />
          </div>
        </div>

        <div className="p-4 border-t border-tavern-border flex justify-between sticky bottom-0 bg-tavern-card rounded-b-xl">
          {editingPersona && (
            <button
              onClick={handleDelete}
              className="px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg text-sm transition-colors"
            >
              Delete
            </button>
          )}
          <div className="flex gap-2 mr-auto">
            <button onClick={() => setPersonaEditorOpen(false)} className="px-4 py-2 text-tavern-muted hover:text-tavern-text text-sm rounded-lg hover:bg-tavern-hover transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!form.name.trim()}
              className="px-6 py-2 bg-tavern-accent hover:bg-tavern-accent-hover disabled:opacity-30 text-white rounded-lg text-sm font-medium transition-all active:scale-[0.97] shadow-md shadow-tavern-accent/20"
            >
              {editingPersona ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
