import { useState, useRef, useCallback, useEffect } from 'react';
import { useStore } from '../store/state';
import CharacterAvatar from './CharacterAvatar';
import LorebookPanel from './LorebookPanel';

const MIN_WIDTH = 240;
const MAX_WIDTH = 420;
const DEFAULT_WIDTH = 288; // w-72 = 288px

function getStoredWidth(): number {
  try {
    const stored = localStorage.getItem('cozytavern.rightPanelWidth');
    if (stored) {
      const w = parseInt(stored);
      if (w >= MIN_WIDTH && w <= MAX_WIDTH) return w;
    }
  } catch {}
  return DEFAULT_WIDTH;
}

export default function RightPanel() {
  // استفاده از selector‌های جداگانه برای جلوگیری از re-render بی‌رویه
  const rightPanelOpen = useStore(s => s.rightPanelOpen);
  const currentCharacter = useStore(s => s.currentCharacter);
  const currentChat = useStore(s => s.currentChat);
  const setCharacterEditorOpen = useStore(s => s.setCharacterEditorOpen);

  const [panelWidth, setPanelWidth] = useState(getStoredWidth);
  const [isResizing, setIsResizing] = useState(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startX.current = e.clientX;
    startWidth.current = panelWidth;
  }, [panelWidth]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = startX.current - e.clientX; // منفی چون پنل سمت راسته
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta));
      setPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      // ذخیره عرض
      try {
        localStorage.setItem('cozytavern.rightPanelWidth', String(panelWidth));
      } catch {}
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, panelWidth]);

  // ذخیره عند تغییر
  useEffect(() => {
    try {
      localStorage.setItem('cozytavern.rightPanelWidth', String(panelWidth));
    } catch {}
  }, [panelWidth]);

  if (!rightPanelOpen) return null;

  return (
    <div
      className="absolute right-0 top-0 bottom-0 bg-tavern-surface border-l border-tavern-border flex flex-col flex-shrink-0 z-30 animate-slide-in-left shadow-xl overflow-y-auto overflow-x-hidden"
      style={{ width: panelWidth }}
    >
      {/* Resize Handle */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-tavern-accent/50 transition-colors z-50 ${
          isResizing ? 'bg-tavern-accent/70' : ''
        }`}
        onMouseDown={handleMouseDown}
      >
        {/* Visual indicator */}
        <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r transition-opacity ${
          isResizing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        } bg-tavern-accent`} />
      </div>

      {currentCharacter ? (
        <>
          {/* Character Info Header */}
          <div className="p-4 border-b border-tavern-border">
            <div className="flex items-center gap-3 mb-3">
              <CharacterAvatar name={currentCharacter.name} avatar={currentCharacter.avatar} size="lg" />
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-tavern-text-bright truncate">{currentCharacter.name}</h3>
                {currentCharacter.personality && (
                  <p className="text-xs text-tavern-dim truncate">{currentCharacter.personality}</p>
                )}
              </div>
            </div>
            <button
              onClick={() => setCharacterEditorOpen(true, currentCharacter)}
              className="w-full text-xs text-tavern-accent hover:text-tavern-accent-hover transition-colors font-medium"
            >
              Edit Character
            </button>
          </div>

          {/* Character Description */}
          {currentCharacter.description && (
            <div className="p-4 border-b border-tavern-border">
              <h4 className="text-xs font-medium text-tavern-dim mb-2">Description</h4>
              <p className="text-xs text-tavern-text leading-relaxed line-clamp-6">
                {currentCharacter.description}
              </p>
            </div>
          )}

          {/* Lorebook Panel (چند لور بوک به ازای هر چت) */}
          {currentChat && (
            <div className="border-b border-tavern-border">
              <LorebookPanel />
            </div>
          )}

          {/* Scenario */}
          {currentCharacter.scenario && (
            <div className="p-4 border-b border-tavern-border">
              <h4 className="text-xs font-medium text-tavern-dim mb-2">Scenario</h4>
              <p className="text-xs text-tavern-text leading-relaxed">
                {currentCharacter.scenario}
              </p>
            </div>
          )}

          {/* First Message */}
          {currentCharacter.first_mes && (
            <div className="p-4">
              <h4 className="text-xs font-medium text-tavern-dim mb-2">First Message</h4>
              <p className="text-xs text-tavern-text leading-relaxed line-clamp-4">
                {currentCharacter.first_mes}
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <svg className="w-14 h-14 mx-auto mb-4 text-tavern-text opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-tavern-text font-medium">Select a character</p>
            <p className="text-xs mt-1.5 text-tavern-muted">to view details</p>
          </div>
        </div>
      )}
    </div>
  );
}
