// ─── Character Portrait Button ───
// دکمه تولید پرتره کاراکتر

import { useState } from 'react';
import { ImageGenerator } from './ImageGenerator';

interface CharacterPortraitButtonProps {
  characterId: string;
  onPortraitGenerated?: (imageUrl: string) => void;
}

export function CharacterPortraitButton({ characterId, onPortraitGenerated }: CharacterPortraitButtonProps) {
  const [showGenerator, setShowGenerator] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowGenerator(true)}
        className="px-3 py-1.5 bg-tavern-accent/20 text-tavern-accent rounded-lg text-sm hover:bg-tavern-accent/30 transition-colors"
      >
        ✨ Generate Portrait
      </button>

      {showGenerator && (
        <ImageGenerator
          type="portrait"
          characterId={characterId}
          onClose={() => setShowGenerator(false)}
          onGenerated={(imageUrl) => {
            onPortraitGenerated?.(imageUrl);
            setShowGenerator(false);
          }}
        />
      )}
    </>
  );
}
