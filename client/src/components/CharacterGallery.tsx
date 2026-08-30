import { useRef } from 'react';
import { useStore } from '../store/state';
import CharacterAvatar from './CharacterAvatar';
import { GallerySkeleton } from './LoadingSkeleton';

export default function CharacterGallery() {
  const {
    characters, selectCharacter, setCharacterEditorOpen,
    setGalleryView, loadingCharacters,
    importCharacterFromFile, exportCharacter,
    setCharacterWizardOpen,
  } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelectCharacter = async (char: typeof characters[0]) => {
    await selectCharacter(char);
    setGalleryView(false);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-tavern-bg">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-tavern-bg/95 backdrop-blur border-b border-tavern-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setGalleryView(false)}
            className="text-tavern-muted hover:text-tavern-text transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <h2 className="text-lg font-bold text-tavern-text">Character Gallery</h2>
          <span className="text-xs text-tavern-muted bg-tavern-card px-2 py-0.5 rounded-full">{characters.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCharacterWizardOpen(true)}
            className="text-tavern-dim hover:text-tavern-accent text-sm px-3 py-1.5 rounded-lg border border-tavern-border hover:border-tavern-accent/40 transition-colors flex items-center gap-1.5"
          >
            ✨ AI Wizard
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-tavern-dim hover:text-tavern-accent text-sm px-3 py-1.5 rounded-lg border border-tavern-border hover:border-tavern-accent/40 transition-colors"
          >
            ↓ Import
          </button>
          <button
            onClick={() => setCharacterEditorOpen(true)}
            className="bg-tavern-accent hover:bg-tavern-accent-hover text-white text-sm px-3 py-1.5 rounded-lg transition-colors"
          >
            + New Character
          </button>
        </div>
      </div>

      {/* Hidden file input for importing */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.png"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) importCharacterFromFile(file);
          e.target.value = '';
        }}
      />

      {/* Grid */}
      {loadingCharacters ? (
        <GallerySkeleton />
      ) : characters.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[60vh] text-tavern-muted">
          <svg className="w-16 h-16 mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-sm">No characters yet</p>
          <div className="flex flex-col gap-2 mt-3">
            <button
              onClick={() => setCharacterWizardOpen(true)}
              className="text-tavern-accent hover:text-tavern-accent-hover text-sm transition-colors flex items-center gap-1"
            >
              ✨ Create with AI Wizard
            </button>
            <button
              onClick={() => setCharacterEditorOpen(true)}
              className="text-tavern-muted hover:text-tavern-text text-sm transition-colors"
            >
              Or create manually
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-6">
          {characters.map((char, idx) => (
            <div
              key={char.id}
              className="bg-tavern-card border border-tavern-border rounded-xl overflow-hidden hover:border-tavern-accent/50 transition-all duration-200 cursor-pointer group hover:-translate-y-1 hover:shadow-lg hover:shadow-black/20 animate-fade-in-up"
              style={{ animationDelay: `${Math.min(idx, 11) * 50}ms` }}
              onClick={() => handleSelectCharacter(char)}
            >
              {/* Avatar + Name */}
              <div className="p-4 flex items-center gap-3">
                <CharacterAvatar name={char.name} avatar={char.avatar} size="lg" />
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-tavern-text truncate">{char.name}</h3>
                  {char.personality && (
                    <p className="text-[11px] text-tavern-muted truncate mt-0.5">{char.personality}</p>
                  )}
                </div>
              </div>

              {/* Description */}
              {char.description && (
                <div className="px-4 pb-3">
                  <p className="text-xs text-tavern-muted line-clamp-3 leading-relaxed">{char.description}</p>
                </div>
              )}

              {/* Tags + Actions */}
              <div className="px-4 pb-4 flex items-center justify-between">
                <div className="flex gap-1 flex-wrap min-w-0">
                  {char.tags?.slice(0, 3).map(tag => (
                    <span key={tag} className="text-[10px] bg-tavern-hover text-tavern-muted px-1.5 py-0.5 rounded">
                      {tag}
                    </span>
                  ))}
                  {(char.tags?.length ?? 0) > 3 && (
                    <span className="text-[10px] text-tavern-muted/50">+{char.tags.length - 3}</span>
                  )}
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); exportCharacter(char.id, 'json'); }}
                    className="text-tavern-muted hover:text-tavern-accent p-1 rounded hover:bg-tavern-hover transition-colors"
                    title="Export JSON"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); exportCharacter(char.id, 'png'); }}
                    className="text-tavern-muted hover:text-tavern-accent p-1 rounded hover:bg-tavern-hover transition-colors"
                    title="Export PNG Card"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setCharacterEditorOpen(true, char); }}
                    className="text-tavern-muted hover:text-tavern-text p-1 rounded hover:bg-tavern-hover transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
