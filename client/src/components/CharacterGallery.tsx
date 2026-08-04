import { useStore } from '../store/state';
import CharacterAvatar from './CharacterAvatar';

export default function CharacterGallery() {
  const {
    characters, selectCharacter, setCharacterEditorOpen,
    setGalleryView, selectChat, chats,
  } = useStore();

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
          <h2 className="text-lg font-bold text-tavern-text">گالری کاراکترها</h2>
          <span className="text-xs text-tavern-muted bg-tavern-card px-2 py-0.5 rounded-full">{characters.length}</span>
        </div>
        <button
          onClick={() => setCharacterEditorOpen(true)}
          className="bg-tavern-accent hover:bg-tavern-accent-hover text-white text-sm px-3 py-1.5 rounded-lg transition-colors"
        >
          + کاراکتر جدید
        </button>
      </div>

      {/* Grid */}
      {characters.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[60vh] text-tavern-muted">
          <svg className="w-16 h-16 mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-sm">هیچ کاراکتری وجود ندارد</p>
          <button
            onClick={() => setCharacterEditorOpen(true)}
            className="mt-3 text-tavern-accent hover:text-tavern-accent-hover text-sm transition-colors"
          >
            اولین کاراکتر را بسازید
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-6">
          {characters.map(char => (
            <div
              key={char.id}
              className="bg-tavern-card border border-tavern-border rounded-xl overflow-hidden hover:border-tavern-accent/50 transition-all cursor-pointer group"
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
                <button
                  onClick={(e) => { e.stopPropagation(); setCharacterEditorOpen(true, char); }}
                  className="text-tavern-muted hover:text-tavern-text opacity-0 group-hover:opacity-100 transition-opacity p-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
