// ─── Image Controls Component ───
// کامپوننت کنترل‌های تصویر (ریجنریت، variations، ذخیره، حذف)

import type { ImageControlsProps } from '../types/image';

export function ImageControls({
  image,
  type,
  onRegenerate,
  onVariations,
  onSave,
  onDelete,
  onViewPrompt,
}: ImageControlsProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Regenerate */}
      <button
        onClick={onRegenerate}
        className="px-3 py-1.5 bg-tavern-accent/20 text-tavern-accent rounded-lg text-sm hover:bg-tavern-accent/30 transition-colors"
        title="Regenerate with same prompt"
      >
        🔄 Regenerate
      </button>

      {/* Variations */}
      <button
        onClick={onVariations}
        className="px-3 py-1.5 bg-tavern-accent/20 text-tavern-accent rounded-lg text-sm hover:bg-tavern-accent/30 transition-colors"
        title="Generate variations"
      >
        🔀 Variations
      </button>

      {/* Save/Pin */}
      <button
        onClick={onSave}
        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
          image.isPinned
            ? 'bg-tavern-accent text-white'
            : 'bg-tavern-accent/20 text-tavern-accent hover:bg-tavern-accent/30'
        }`}
        title={image.isPinned ? 'Unpin from gallery' : 'Pin to gallery'}
      >
        💾 {image.isPinned ? 'Unpin' : 'Save'}
      </button>

      {/* View Prompt */}
      <button
        onClick={onViewPrompt}
        className="px-3 py-1.5 bg-tavern-bg border border-tavern-border text-tavern-dim rounded-lg text-sm hover:text-tavern-text transition-colors"
        title="View generation prompt"
      >
        📝 Prompt
      </button>

      {/* Delete */}
      <button
        onClick={onDelete}
        className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/30 transition-colors"
        title="Delete image"
      >
        🗑️ Delete
      </button>

      {/* Portrait-specific: Use as Avatar */}
      {type === 'portrait' && (
        <button
          onClick={() => {/* TODO: Implement use as avatar */}}
          className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-sm hover:bg-green-500/30 transition-colors"
          title="Use as character avatar"
        >
          ✅ Use as Avatar
        </button>
      )}
    </div>
  );
}
