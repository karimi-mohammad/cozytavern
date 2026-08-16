// ============================================
// Skeleton Loading Components
// ============================================

// Base pulse animation div
function PulseBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-tavern-hover rounded ${className}`} />;
}

// ============================================
// Character List Skeleton (Sidebar)
// ============================================
export function CharacterSkeleton() {
  return (
    <div className="space-y-1 p-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-lg animate-pulse">
          <div className="w-7 h-7 rounded-full bg-tavern-hover flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <PulseBlock className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// Chat List Skeleton (Sidebar)
// ============================================
export function ChatSkeleton() {
  return (
    <div className="space-y-1 p-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between p-2.5 rounded-lg animate-pulse">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <PulseBlock className="h-3 w-3/4" />
          </div>
          <PulseBlock className="w-5 h-5 flex-shrink-0 ml-2" />
        </div>
      ))}
    </div>
  );
}

// ============================================
// Message List Skeleton (Chat View)
// ============================================
export function MessageSkeleton() {
  return (
    <div className="space-y-4 px-4 py-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
          <div className={`max-w-[70%] space-y-2 animate-pulse ${i % 2 === 0 ? 'mr-auto' : 'ml-auto'}`}>
            {i % 2 === 0 && (
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-tavern-hover" />
                <PulseBlock className="h-2.5 w-16" />
              </div>
            )}
            <div className={`${i % 2 === 0 ? 'bg-tavern-surface2' : 'bg-tavern-accent/20'} rounded-2xl px-4 py-3 space-y-2`}>
              <PulseBlock className="h-3 w-full" />
              <PulseBlock className="h-3 w-5/6" />
              <PulseBlock className="h-3 w-2/3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// Persona List Skeleton (Sidebar)
// ============================================
export function PersonaSkeleton() {
  return (
    <div className="space-y-1 p-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-lg animate-pulse">
          <div className="w-8 h-8 rounded-full bg-tavern-hover flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <PulseBlock className="h-3 w-1/2" />
            <PulseBlock className="h-2 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// Lorebook List Skeleton (Sidebar)
// ============================================
export function LorebookSkeleton() {
  return (
    <div className="space-y-1 p-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="p-2.5 rounded-lg animate-pulse">
          <PulseBlock className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

// ============================================
// Character Gallery Skeleton (Grid)
// ============================================
export function GallerySkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="bg-tavern-card border border-tavern-border rounded-xl overflow-hidden animate-pulse">
          {/* Avatar + Name */}
          <div className="p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-tavern-hover flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <PulseBlock className="h-3.5 w-2/3" />
              <PulseBlock className="h-2.5 w-1/2" />
            </div>
          </div>

          {/* Description */}
          <div className="px-4 pb-3 space-y-1.5">
            <PulseBlock className="h-2.5 w-full" />
            <PulseBlock className="h-2.5 w-4/5" />
            <PulseBlock className="h-2.5 w-3/5" />
          </div>

          {/* Tags */}
          <div className="px-4 pb-4 flex gap-1">
            <PulseBlock className="h-4 w-12 rounded" />
            <PulseBlock className="h-4 w-16 rounded" />
            <PulseBlock className="h-4 w-10 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// Welcome Screen Skeleton (Empty State)
// ============================================
export function WelcomeSkeleton() {
  return (
    <div className="flex-1 flex items-center justify-center animate-pulse">
      <div className="text-center space-y-4">
        <div className="w-20 h-20 rounded-full bg-tavern-hover mx-auto" />
        <div className="space-y-2">
          <PulseBlock className="h-4 w-48 mx-auto" />
          <PulseBlock className="h-3 w-64 mx-auto" />
        </div>
      </div>
    </div>
  );
}
