import { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/state';
import CharacterAvatar from './CharacterAvatar';

export default function CharacterEditor() {
  const { characterEditorOpen, editingCharacter, setCharacterEditorOpen, createCharacter, updateCharacter, lorebooks, loadLorebooks, addToast } = useStore();

  const [form, setForm] = useState({
    name: '', nickname: '', description: '', personality: '', scenario: '',
    first_mes: '', mes_example: '', creator_notes: '',
    system_prompt: '', post_history_instructions: '',
    alternate_greetings: [] as string[],
    group_only_greetings: [] as string[],
    creator: '', character_version: '',
    tags: [] as string[],
    lorebook_id: '', avatar: '',
  });
  const [tagInput, setTagInput] = useState('');
  const [altGreetingInput, setAltGreetingInput] = useState('');
  const [groupOnlyInput, setGroupOnlyInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (characterEditorOpen) loadLorebooks();
  }, [characterEditorOpen]);

  // بستن مودال با کلید Escape
  useEffect(() => {
    if (!characterEditorOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCharacterEditorOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [characterEditorOpen]);

  useEffect(() => {
    if (editingCharacter) {
      setForm({
        name: editingCharacter.name || '',
        nickname: editingCharacter.nickname || '',
        description: editingCharacter.description || '',
        personality: editingCharacter.personality || '',
        scenario: editingCharacter.scenario || '',
        first_mes: editingCharacter.first_mes || '',
        mes_example: editingCharacter.mes_example || '',
        creator_notes: editingCharacter.creator_notes || '',
        system_prompt: editingCharacter.system_prompt || '',
        post_history_instructions: editingCharacter.post_history_instructions || '',
        alternate_greetings: editingCharacter.alternate_greetings || [],
        group_only_greetings: editingCharacter.group_only_greetings || [],
        creator: editingCharacter.creator || '',
        character_version: editingCharacter.character_version || '',
        tags: editingCharacter.tags || [],
        lorebook_id: editingCharacter.lorebook_id || '',
        avatar: editingCharacter.avatar || '',
      });
    } else {
      setForm({
        name: '', nickname: '', description: '', personality: '', scenario: '',
        first_mes: '', mes_example: '', creator_notes: '',
        system_prompt: '', post_history_instructions: '',
        alternate_greetings: [], group_only_greetings: [],
        creator: '', character_version: '',
        tags: [], lorebook_id: '', avatar: '',
      });
    }
  }, [editingCharacter, characterEditorOpen]);

  if (!characterEditorOpen) return null;

  const handleSave = async () => {
    if (!form.name.trim()) return;
    if (editingCharacter) {
      await updateCharacter(editingCharacter.id, form);
    } else {
      await createCharacter(form);
    }
    setCharacterEditorOpen(false);
  };

  const addTag = () => {
    if (tagInput.trim() && !form.tags.includes(tagInput.trim())) {
      setForm(f => ({ ...f, tags: [...f.tags, tagInput.trim()] }));
      setTagInput('');
    }
  };

  const addAltGreeting = () => {
    if (altGreetingInput.trim()) {
      setForm(f => ({ ...f, alternate_greetings: [...f.alternate_greetings, altGreetingInput.trim()] }));
      setAltGreetingInput('');
    }
  };

  const addGroupOnlyGreeting = () => {
    if (groupOnlyInput.trim()) {
      setForm(f => ({ ...f, group_only_greetings: [...f.group_only_greetings, groupOnlyInput.trim()] }));
      setGroupOnlyInput('');
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      addToast('Image must be smaller than 2MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm(f => ({ ...f, avatar: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-3 md:p-4 modal-enter-overlay">
      <div className="bg-tavern-card border border-tavern-border rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl shadow-black/40 modal-enter-card">
        <div className="p-4 border-b border-tavern-border flex items-center justify-between sticky top-0 bg-tavern-card z-10 rounded-t-xl">
          <h2 className="text-lg font-bold text-tavern-text-bright">
            {editingCharacter ? 'Edit Character' : 'New Character'}
          </h2>
          <button
            onClick={() => setCharacterEditorOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-md text-tavern-muted hover:text-tavern-text hover:bg-tavern-hover transition-colors active:scale-90"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div
              className="relative cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
            >
              <CharacterAvatar name={form.name || '?'} avatar={form.avatar} size="lg" />
              <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
            <div className="text-xs text-tavern-muted">
              <p>Click the icon to upload a photo</p>
              <p>Max 2MB</p>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-1">Character Name *</label>
            <input
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-tavern-accent"
              placeholder="Character name"
            />
          </div>

          {/* Nickname */}
          <div>
            <label className="block text-sm font-medium mb-1">Nickname</label>
            <input
              value={form.nickname}
              onChange={(e) => setForm(f => ({ ...f, nickname: e.target.value }))}
              className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-tavern-accent"
              placeholder="Short name or alias"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-tavern-accent resize-none"
              rows={4}
              placeholder="Physical appearance, core personality, key traits..."
            />
          </div>

          {/* Personality */}
          <div>
            <label className="block text-sm font-medium mb-1">Personality Traits</label>
            <input
              value={form.personality}
              onChange={(e) => setForm(f => ({ ...f, personality: e.target.value }))}
              className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-tavern-accent"
              placeholder="e.g. mysterious, kind, clever"
            />
          </div>

          {/* Scenario */}
          <div>
            <label className="block text-sm font-medium mb-1">Scenario</label>
            <textarea
              value={form.scenario}
              onChange={(e) => setForm(f => ({ ...f, scenario: e.target.value }))}
              className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-tavern-accent resize-none"
              rows={2}
              placeholder="The opening situation of the conversation"
            />
          </div>

          {/* Character System Prompt */}
          <div>
            <label className="block text-sm font-medium mb-1">Character System Prompt</label>
            <textarea
              value={form.system_prompt}
              onChange={(e) => setForm(f => ({ ...f, system_prompt: e.target.value }))}
              className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-tavern-accent resize-none font-mono text-xs"
              rows={3}
              placeholder="Special instructions for this character (prepended to system prompt)"
            />
            <p className="text-xs text-tavern-muted mt-1">Injected before the character block in the prompt</p>
          </div>

          {/* Post-History Instructions */}
          <div>
            <label className="block text-sm font-medium mb-1">Post-History Instructions</label>
            <textarea
              value={form.post_history_instructions}
              onChange={(e) => setForm(f => ({ ...f, post_history_instructions: e.target.value }))}
              className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-tavern-accent resize-none font-mono text-xs"
              rows={3}
              placeholder="Instructions injected after the chat history"
            />
            <p className="text-xs text-tavern-muted mt-1">Appended after all messages in the prompt</p>
          </div>

          {/* Alternate Greetings */}
          <div>
            <label className="block text-sm font-medium mb-1">Alternate Greetings</label>
            <div className="space-y-2">
              {form.alternate_greetings.map((g, idx) => (
                <div key={idx} className="flex gap-2">
                  <textarea
                    value={g}
                    readOnly
                    className="flex-1 bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 text-xs focus:outline-none resize-none"
                    rows={2}
                  />
                  <button
                    onClick={() => setForm(f => ({ ...f, alternate_greetings: f.alternate_greetings.filter((_, i) => i !== idx) }))}
                    className="text-tavern-muted hover:text-red-400 text-xs px-1"
                  >
                    ×
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <textarea
                  value={altGreetingInput}
                  onChange={(e) => setAltGreetingInput(e.target.value)}
                  className="flex-1 bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-tavern-accent resize-none"
                  rows={2}
                  placeholder="Add an alternate opening message..."
                />
                <button onClick={addAltGreeting} className="bg-tavern-accent text-white px-3 py-2 rounded-lg text-sm self-end">
                  +
                </button>
              </div>
            </div>
            <p className="text-xs text-tavern-muted mt-1">Optional alternative first messages</p>
          </div>

          {/* Group-Only Greetings */}
          <div>
            <label className="block text-sm font-medium mb-1">Group-Only Greetings</label>
            <div className="space-y-2">
              {form.group_only_greetings.map((g, idx) => (
                <div key={idx} className="flex gap-2">
                  <textarea
                    value={g}
                    readOnly
                    className="flex-1 bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 text-xs focus:outline-none resize-none"
                    rows={2}
                  />
                  <button
                    onClick={() => setForm(f => ({ ...f, group_only_greetings: f.group_only_greetings.filter((_, i) => i !== idx) }))}
                    className="text-tavern-muted hover:text-red-400 text-xs px-1"
                  >
                    ×
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <textarea
                  value={groupOnlyInput}
                  onChange={(e) => setGroupOnlyInput(e.target.value)}
                  className="flex-1 bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-tavern-accent resize-none"
                  rows={2}
                  placeholder="Add a greeting for group chats only..."
                />
                <button onClick={addGroupOnlyGreeting} className="bg-tavern-accent text-white px-3 py-2 rounded-lg text-sm self-end">
                  +
                </button>
              </div>
            </div>
            <p className="text-xs text-tavern-muted mt-1">Greetings used only in group chats</p>
          </div>

          {/* First message */}
          <div>
            <label className="block text-sm font-medium mb-1">First Message</label>
            <textarea
              value={form.first_mes}
              onChange={(e) => setForm(f => ({ ...f, first_mes: e.target.value }))}
              className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-tavern-accent resize-none"
              rows={3}
              placeholder="The character's opening message"
            />
          </div>

          {/* Dialogue examples */}
          <div>
            <label className="block text-sm font-medium mb-1">Example Dialogues</label>
            <textarea
              value={form.mes_example}
              onChange={(e) => setForm(f => ({ ...f, mes_example: e.target.value }))}
              className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-tavern-accent resize-none font-mono text-xs"
              rows={5}
              placeholder={`<START>\n{{char}}: Hello...\n{{user}}: Hi...\n<END>`}
            />
          </div>

          {/* Lorebook */}
          <div>
            <label className="block text-sm font-medium mb-1">Default Lorebook</label>
            <select
              value={form.lorebook_id}
              onChange={(e) => setForm(f => ({ ...f, lorebook_id: e.target.value }))}
              className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-tavern-accent"
            >
              <option value="">No lorebook</option>
              {lorebooks.map(lb => (
                <option key={lb.id} value={lb.id}>{lb.name}</option>
              ))}
            </select>
            <p className="text-xs text-tavern-muted mt-1">The selected lorebook is active in all chats with this character</p>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium mb-1">Tags</label>
            <div className="flex gap-2">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                className="flex-1 bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-tavern-accent"
                placeholder="Add a tag"
              />
              <button onClick={addTag} className="bg-tavern-accent text-white px-3 py-2 rounded-lg text-sm">
                +
              </button>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {form.tags.map(tag => (
                <span
                  key={tag}
                  className="bg-tavern-accent/20 text-tavern-accent text-xs px-2 py-1 rounded-full flex items-center gap-1"
                >
                  {tag}
                  <button
                    onClick={() => setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }))}
                    className="hover:text-white"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Creator notes */}
          <div>
            <label className="block text-sm font-medium mb-1">Creator Notes</label>
            <textarea
              value={form.creator_notes}
              onChange={(e) => setForm(f => ({ ...f, creator_notes: e.target.value }))}
              className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-tavern-accent resize-none"
              rows={2}
              placeholder="Notes (not sent to the AI)"
            />
          </div>

          {/* Creator & Version */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Creator</label>
              <input
                value={form.creator}
                onChange={(e) => setForm(f => ({ ...f, creator: e.target.value }))}
                className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-tavern-accent"
                placeholder="Creator name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Character Version</label>
              <input
                value={form.character_version}
                onChange={(e) => setForm(f => ({ ...f, character_version: e.target.value }))}
                className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-tavern-accent"
                placeholder="e.g. 1.0"
              />
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-tavern-border flex justify-end gap-2 sticky bottom-0 bg-tavern-card rounded-b-xl">
          <button
            onClick={() => setCharacterEditorOpen(false)}
            className="px-4 py-2 text-tavern-muted hover:text-tavern-text text-sm rounded-lg hover:bg-tavern-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!form.name.trim()}
            className="px-6 py-2 bg-tavern-accent hover:bg-tavern-accent-hover disabled:opacity-30 text-white rounded-lg text-sm font-medium transition-all active:scale-[0.97] shadow-md shadow-tavern-accent/20"
          >
            {editingCharacter ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
