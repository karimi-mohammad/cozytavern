// ─── Scene Gallery Component ───
// کامپوننت گالری تصاویر صحنه

import { useState, useEffect } from 'react';
import { useImageGeneration } from '../hooks/useImageGeneration';
import type { SceneImage } from '../types/image';

interface SceneGalleryProps {
  chatId: string;
  onSelect?: (image: SceneImage) => void;
  onClose?: () => void;
}

export function SceneGallery({ chatId, onSelect, onClose }: SceneGalleryProps) {
  const { getSceneImages, getSceneGallery, pinScene, deleteScene } = useImageGeneration();
  const [scenes, setScenes] = useState<SceneImage[]>([]);
  const [filter, setFilter] = useState<'all' | 'pinned'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadScenes();
  }, [chatId, filter]);

  const loadScenes = async () => {
    setLoading(true);
    try {
      const data = filter === 'pinned' 
        ? await getSceneGallery(chatId)
        : await getSceneImages(chatId);
      setScenes(data);
    } catch (err) {
      console.error('Failed to load scenes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePin = async (id: string, pinned: boolean) => {
    await pinScene(id, pinned);
    await loadScenes();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this scene?')) {
      await deleteScene(id);
      await loadScenes();
    }
  };

  return (
    <div className="bg-tavern-bg border border-tavern-border rounded-lg h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-tavern-border">
        <h3 className="font-semibold">🎨 Scene Gallery</h3>
        {onClose && (
          <button onClick={onClose} className="text-tavern-dim hover:text-tavern-text">
            ✕
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-tavern-border">
        <button
          onClick={() => setFilter('all')}
          className={`flex-1 py-2 text-sm font-medium ${
            filter === 'all' 
              ? 'text-tavern-accent border-b-2 border-tavern-accent' 
              : 'text-tavern-dim hover:text-tavern-text'
          }`}
        >
          All ({scenes.length})
        </button>
        <button
          onClick={() => setFilter('pinned')}
          className={`flex-1 py-2 text-sm font-medium ${
            filter === 'pinned' 
              ? 'text-tavern-accent border-b-2 border-tavern-accent' 
              : 'text-tavern-dim hover:text-tavern-text'
          }`}
        >
          Pinned ({scenes.filter(s => s.isPinned).length})
        </button>
      </div>

      {/* Gallery Grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="text-center text-tavern-dim py-8">Loading...</div>
        ) : scenes.length === 0 ? (
          <div className="text-center text-tavern-dim py-8">
            No scenes yet. Generate one to get started!
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {scenes.map((scene) => (
              <div
                key={scene.id}
                className="relative group cursor-pointer"
                onClick={() => onSelect?.(scene)}
              >
                <img
                  src={scene.imageUrl}
                  alt={scene.imagePrompt}
                  className="w-full aspect-square object-cover rounded-lg"
                />
                
                {/* Overlay Controls */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors rounded-lg flex items-end p-2 opacity-0 group-hover:opacity-100">
                  <div className="flex gap-1 w-full">
                    <button
                      onClick={(e) => { e.stopPropagation(); handlePin(scene.id, !scene.isPinned); }}
                      className={`p-1.5 rounded ${scene.isPinned ? 'bg-tavern-accent' : 'bg-tavern-bg/80'}`}
                      title={scene.isPinned ? 'Unpin' : 'Pin'}
                    >
                      📌
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(scene.id); }}
                      className="p-1.5 bg-tavern-bg/80 rounded hover:bg-red-500/80"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Seed Badge */}
                <div className="absolute top-1 right-1 bg-tavern-bg/80 text-xs px-1.5 py-0.5 rounded">
                  #{scene.seed}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="p-3 border-t border-tavern-border text-xs text-tavern-dim">
        Total: {scenes.length} scenes | Pinned: {scenes.filter(s => s.isPinned).length}
      </div>
    </div>
  );
}
