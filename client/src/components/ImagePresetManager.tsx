// ─── Image Preset Manager Modal ───
// مودال مدیریت پریست‌های تولید تصویر

import { useState, useEffect } from 'react';
import { useImageGeneration } from '../hooks/useImageGeneration';
import { api } from '../api/client';
import type { ImagePreset } from '../types/image';
import type { Character } from '../types';

interface ImagePresetManagerProps {
  onClose: () => void;
  onSelect?: (preset: ImagePreset) => void;
}

export function ImagePresetManager({ onClose, onSelect }: ImagePresetManagerProps) {
  const {
    getPresets,
    createPreset,
    updatePreset,
    deletePreset,
    clonePreset,
  } = useImageGeneration();

  const [presets, setPresets] = useState<ImagePreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPreset, setEditingPreset] = useState<ImagePreset | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [characters, setCharacters] = useState<Character[]>([]);

  // فرم
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPresetType, setFormPresetType] = useState<'scene' | 'portrait'>('scene');
  const [formModel, setFormModel] = useState('flux');
  const [formWidth, setFormWidth] = useState(1024);
  const [formHeight, setFormHeight] = useState(1024);
  const [formPromptTemplate, setFormPromptTemplate] = useState('');
  const [formNegativePrompt, setFormNegativePrompt] = useState('text, watermark, logo, blurry, deformed');
  const [formSelectedCharacterIds, setFormSelectedCharacterIds] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [presetsData, charactersData] = await Promise.all([
        getPresets(),
        api.getCharacters().catch(() => []),
      ]);
      setPresets(presetsData);
      setCharacters(charactersData as Character[]);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormPresetType('scene');
    setFormModel('flux');
    setFormWidth(1024);
    setFormHeight(1024);
    setFormPromptTemplate('');
    setFormNegativePrompt('text, watermark, logo, blurry, deformed');
    setFormSelectedCharacterIds([]);
  };

  const handleCreate = () => {
    resetForm();
    setIsCreating(true);
    setEditingPreset(null);
  };

  const handleEdit = (preset: ImagePreset) => {
    setFormName(preset.name);
    setFormDescription(preset.description);
    setFormPresetType(preset.presetType || 'scene');
    setFormModel(preset.model);
    setFormWidth(preset.width);
    setFormHeight(preset.height);
    setFormPromptTemplate(preset.promptTemplate);
    setFormNegativePrompt(preset.negativePrompt);
    setFormSelectedCharacterIds(preset.selectedCharacterIds || []);
    setEditingPreset(preset);
    setIsCreating(false);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;

    try {
      // profileId بر اساس presetType انتخاب می‌شود
      const profileId = formPresetType === 'portrait' ? 'portrait' : 'scene';

      const presetData = {
        name: formName,
        description: formDescription,
        presetType: formPresetType,
        profileId,
        model: formModel,
        width: formWidth,
        height: formHeight,
        promptTemplate: formPromptTemplate,
        negativePrompt: formNegativePrompt,
        selectedCharacterIds: formSelectedCharacterIds,
      };

      if (editingPreset) {
        await updatePreset(editingPreset.id, presetData);
      } else {
        await createPreset(presetData);
      }

      await loadData();
      setIsCreating(false);
      setEditingPreset(null);
      resetForm();
    } catch (err) {
      console.error('Failed to save preset:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this preset?')) return;
    
    try {
      await deletePreset(id);
      await loadData();
    } catch (err) {
      console.error('Failed to delete preset:', err);
    }
  };

  const handleClone = async (preset: ImagePreset) => {
    try {
      await clonePreset(preset.id, `${preset.name} (Copy)`);
      await loadData();
    } catch (err) {
      console.error('Failed to clone preset:', err);
    }
  };

  const handleSelect = (preset: ImagePreset) => {
    onSelect?.(preset);
    onClose();
  };

  const toggleCharacter = (charId: string) => {
    setFormSelectedCharacterIds(prev =>
      prev.includes(charId) ? prev.filter(id => id !== charId) : [...prev, charId]
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-tavern-bg border border-tavern-border rounded-lg w-full max-w-3xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-tavern-border">
          <h2 className="text-lg font-semibold">📋 Image Presets</h2>
          <button onClick={onClose} className="text-tavern-dim hover:text-tavern-text">
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex h-[70vh]">
          {/* Preset List */}
          <div className="w-1/2 border-r border-tavern-border overflow-y-auto">
            <div className="p-3 border-b border-tavern-border">
              <button
                onClick={handleCreate}
                className="w-full px-3 py-2 bg-tavern-accent hover:bg-tavern-accent-hover text-white rounded-lg text-sm font-medium transition-colors"
              >
                + Create New Preset
              </button>
            </div>

            {loading ? (
              <div className="p-4 text-center text-tavern-dim">Loading...</div>
            ) : presets.length === 0 ? (
              <div className="p-4 text-center text-tavern-dim">No presets yet</div>
            ) : (
              <div className="p-2 space-y-2">
                {presets.map((preset) => (
                  <div
                    key={preset.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      editingPreset?.id === preset.id
                        ? 'bg-tavern-accent/20 border-tavern-accent'
                        : 'bg-tavern-input border-tavern-border hover:border-tavern-accent/50'
                    }`}
                    onClick={() => handleEdit(preset)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{preset.name}</p>
                          {preset.isBuiltin && (
                            <span className="text-[10px] bg-tavern-dim/20 text-tavern-dim px-1.5 py-0.5 rounded">
                              Built-in
                            </span>
                          )}
                        </div>
                        {preset.description && (
                          <p className="text-xs text-tavern-dim mt-0.5 truncate">{preset.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-tavern-dim">
                          <span>{preset.presetType === 'portrait' ? '👤' : '🎬'} {preset.presetType || 'scene'}</span>
                          <span>🤖 {preset.model}</span>
                          <span>📐 {preset.width}x{preset.height}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        {onSelect && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleSelect(preset); }}
                            className="p-1.5 text-tavern-accent hover:bg-tavern-accent/20 rounded transition-colors"
                            title="Use this preset"
                          >
                            ✓
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleClone(preset); }}
                          className="p-1.5 text-tavern-dim hover:text-tavern-text hover:bg-tavern-hover rounded transition-colors"
                          title="Clone"
                        >
                          📋
                        </button>
                        {!preset.isBuiltin && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(preset.id); }}
                            className="p-1.5 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                            title="Delete"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Edit Panel */}
          <div className="w-1/2 overflow-y-auto">
            {(isCreating || editingPreset) ? (
              <div className="p-4 space-y-4">
                <h3 className="font-medium">
                  {isCreating ? 'Create New Preset' : `Edit: ${editingPreset?.name}`}
                </h3>

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium mb-1">Name *</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 text-sm"
                    placeholder="My Custom Preset"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <input
                    type="text"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 text-sm"
                    placeholder="Optional description"
                  />
                </div>

                {/* ═══ Preset Type ═══ */}
                <div className="border border-tavern-border rounded-lg p-3 bg-tavern-surface/30">
                  <label className="block text-sm font-medium mb-2">🎬 Preset Type *</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFormPresetType('scene')}
                      className={`flex-1 px-3 py-3 rounded-lg text-sm font-medium border transition-all ${
                        formPresetType === 'scene'
                          ? 'bg-tavern-accent text-white border-tavern-accent shadow-lg'
                          : 'bg-tavern-card text-tavern-text border-tavern-border hover:border-tavern-accent/50 hover:bg-tavern-hover'
                      }`}
                    >
                      <span className="text-lg">🎬</span>
                      <p className="font-medium">Scene</p>
                      <p className="text-[10px] font-normal mt-0.5 opacity-75">All characters included</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormPresetType('portrait')}
                      className={`flex-1 px-3 py-3 rounded-lg text-sm font-medium border transition-all ${
                        formPresetType === 'portrait'
                          ? 'bg-tavern-accent text-white border-tavern-accent shadow-lg'
                          : 'bg-tavern-card text-tavern-text border-tavern-border hover:border-tavern-accent/50 hover:bg-tavern-hover'
                      }`}
                    >
                      <span className="text-lg">👤</span>
                      <p className="font-medium">Portrait</p>
                      <p className="text-[10px] font-normal mt-0.5 opacity-75">Single character focus</p>
                    </button>
                  </div>
                  <p className="text-[10px] text-tavern-dim mt-2">
                    {formPresetType === 'scene'
                      ? '🎬 Scene mode: All characters from the chat will be included in the image context.'
                      : '👤 Portrait mode: Select a specific character to generate their portrait.'}
                  </p>
                </div>

                {/* ═══ Character Selection (for Portrait type) ═══ */}
                {formPresetType === 'portrait' && (
                  <div className="border border-tavern-border rounded-lg p-3 bg-tavern-surface/30">
                    <label className="block text-sm font-medium mb-2">
                      🎭 Select Characters
                      <span className="text-tavern-dim font-normal ml-1">(optional)</span>
                    </label>
                    {characters.length === 0 ? (
                      <p className="text-xs text-tavern-dim py-2">No characters available</p>
                    ) : (
                      <div className="max-h-36 overflow-y-auto border border-tavern-border rounded-lg p-2 space-y-1 bg-tavern-bg/50">
                        {characters.map((char) => (
                          <label
                            key={char.id}
                            className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                              formSelectedCharacterIds.includes(char.id)
                                ? 'bg-tavern-accent/20 border border-tavern-accent/50'
                                : 'hover:bg-tavern-hover border border-transparent'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={formSelectedCharacterIds.includes(char.id)}
                              onChange={() => toggleCharacter(char.id)}
                              className="rounded border-tavern-border"
                            />
                            {char.avatar ? (
                              <img src={char.avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
                            ) : (
                              <span className="w-6 h-6 rounded-full bg-tavern-accent/30 flex items-center justify-center text-xs">
                                {char.name[0]}
                              </span>
                            )}
                            <span className="text-sm">{char.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    <p className="text-[10px] text-tavern-dim mt-2">
                      {formSelectedCharacterIds.length === 0
                        ? '💡 Character will be selected when generating the image'
                        : `✓ ${formSelectedCharacterIds.length} character(s) selected as default`}
                    </p>
                  </div>
                )}

                {/* Model */}
                <div>
                  <label className="block text-sm font-medium mb-1">Model</label>
                  <select
                    value={formModel}
                    onChange={(e) => setFormModel(e.target.value)}
                    className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="flux">Flux (Default)</option>
                    <option value="flux-realism">Flux Realism</option>
                    <option value="flux-anime">Flux Anime</option>
                    <option value="flux-3d">Flux 3D</option>
                    <option value="flux-turbo">Flux Turbo</option>
                    <option value="dreamshaper">DreamShaper</option>
                  </select>
                </div>

                {/* Dimensions */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Width</label>
                    <input
                      type="number"
                      value={formWidth}
                      onChange={(e) => setFormWidth(parseInt(e.target.value) || 1024)}
                      min={256}
                      max={2048}
                      className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Height</label>
                    <input
                      type="number"
                      value={formHeight}
                      onChange={(e) => setFormHeight(parseInt(e.target.value) || 1024)}
                      min={256}
                      max={2048}
                      className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                {/* Prompt Template */}
                <div>
                  <label className="block text-sm font-medium mb-1">Prompt Template (optional)</label>
                  <textarea
                    value={formPromptTemplate}
                    onChange={(e) => setFormPromptTemplate(e.target.value)}
                    rows={3}
                    className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 text-sm resize-none"
                    placeholder="Leave empty to use default prompt generation..."
                  />
                  <p className="text-[10px] text-tavern-dim mt-1">
                    Custom template for prompt generation. Use {'{{context}}'} for chat context.
                  </p>
                </div>

                {/* Negative Prompt */}
                <div>
                  <label className="block text-sm font-medium mb-1">Negative Prompt</label>
                  <input
                    type="text"
                    value={formNegativePrompt}
                    onChange={(e) => setFormNegativePrompt(e.target.value)}
                    className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 text-sm"
                    placeholder="text, watermark, logo, blurry..."
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-tavern-border">
                  <button
                    onClick={() => { setIsCreating(false); setEditingPreset(null); resetForm(); }}
                    className="flex-1 px-4 py-2 text-tavern-dim hover:text-tavern-text transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!formName.trim()}
                    className="flex-1 px-4 py-2 bg-tavern-accent hover:bg-tavern-accent-hover text-white rounded-lg font-medium disabled:opacity-50"
                  >
                    {editingPreset ? 'Update' : 'Create'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-tavern-dim">
                <span className="text-4xl mb-3">📋</span>
                <p>Select a preset to edit</p>
                <p className="text-sm">or create a new one</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-tavern-border text-xs text-tavern-dim">
          {presets.length} presets ({presets.filter(p => p.isBuiltin).length} built-in)
        </div>
      </div>
    </div>
  );
}
