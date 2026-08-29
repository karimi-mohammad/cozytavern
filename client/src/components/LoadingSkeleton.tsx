// ============================================
// Skeleton Loading Components
// Shimmer-based placeholders with staggered reveal
// ============================================

// Base shimmer block
function PulseBlock({ className = '', delay = 0 }: { className?: string; delay?: number }) {
  return (
    <div
      className={`skeleton-shimmer rounded ${className}`}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    />
  );
}

const STAGGER = 70; // ms between items

// ============================================
// Character List Skeleton (Sidebar)
// ============================================
export function CharacterSkeleton() {
  return (
    <div className="space-y-1 p-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-lg animate-fade-in-up" style={{ animationDelay: `${i * STAGGER}ms` }}>
          <PulseBlock className="w-7 h-7 rounded-full flex-shrink-0" delay={i * STAGGER} />
          <div className="flex-1 space-y-1.5">
            <PulseBlock className="h-3 w-3/4" delay={i * STAGGER + 40} />
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
        <div key={i} className="flex items-center justify-between p-2.5 rounded-lg animate-fade-in-up" style={{ animationDelay: `${i * STAGGER}ms` }}>
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <PulseBlock className="h-3 w-3/4" delay={i * STAGGER} />
          </div>
          <PulseBlock className="w-5 h-5 rounded-md flex-shrink-0 ml-2" delay={i * STAGGER + 40} />
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
          <div className={`max-w-[70%] space-y-2 animate-fade-in-up ${i % 2 === 0 ? 'mr-auto' : 'ml-auto'}`} style={{ animationDelay: `${i * STAGGER}ms` }}>
            {i % 2 === 0 && (
              <div className="flex items-center gap-2 mb-2">
                <PulseBlock className="w-6 h-6 rounded-full" delay={i * STAGGER} />
                <PulseBlock className="h-2.5 w-16 rounded" delay={i * STAGGER} />
              </div>
            )}
            <div className={`${i % 2 === 0 ? 'bg-tavern-surface2/70' : 'bg-tavern-accent/15'} rounded-2xl px-4 py-3 space-y-2 border border-tavern-border/30`}>
              <PulseBlock className="h-3 w-full rounded" delay={i * STAGGER + 40} />
              <PulseBlock className="h-3 w-5/6 rounded" delay={i * STAGGER + 80} />
              <PulseBlock className="h-3 w-2/3 rounded" delay={i * STAGGER + 120} />
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
        <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-lg animate-fade-in-up" style={{ animationDelay: `${i * STAGGER}ms` }}>
          <PulseBlock className="w-8 h-8 rounded-full flex-shrink-0" delay={i * STAGGER} />
          <div className="flex-1 space-y-1.5">
            <PulseBlock className="h-3 w-1/2 rounded" delay={i * STAGGER + 40} />
            <PulseBlock className="h-2 w-2/3 rounded" delay={i * STAGGER + 80} />
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
        <div key={i} className="p-2.5 rounded-lg animate-fade-in-up" style={{ animationDelay: `${i * STAGGER}ms` }}>
          <PulseBlock className="h-3 w-2/3 rounded" delay={i * STAGGER} />
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
        <div
          key={i}
          className="bg-tavern-card border border-tavern-border rounded-xl overflow-hidden animate-fade-in-up"
          style={{ animationDelay: `${i * STAGGER}ms` }}
        >
          {/* Avatar + Name */}
          <div className="p-4 flex items-center gap-3">
            <PulseBlock className="w-12 h-12 rounded-full flex-shrink-0" delay={i * STAGGER} />
            <div className="flex-1 space-y-2">
              <PulseBlock className="h-3.5 w-2/3 rounded" delay={i * STAGGER + 40} />
              <PulseBlock className="h-2.5 w-1/2 rounded" delay={i * STAGGER + 80} />
            </div>
          </div>

          {/* Description */}
          <div className="px-4 pb-3 space-y-1.5">
            <PulseBlock className="h-2.5 w-full rounded" delay={i * STAGGER + 40} />
            <PulseBlock className="h-2.5 w-4/5 rounded" delay={i * STAGGER + 80} />
            <PulseBlock className="h-2.5 w-3/5 rounded" delay={i * STAGGER + 120} />
          </div>

          {/* Tags */}
          <div className="px-4 pb-4 flex gap-1">
            <PulseBlock className="h-4 w-12 rounded" delay={i * STAGGER + 80} />
            <PulseBlock className="h-4 w-16 rounded" delay={i * STAGGER + 120} />
            <PulseBlock className="h-4 w-10 rounded" delay={i * STAGGER + 160} />
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
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-4">
        <PulseBlock className="w-20 h-20 rounded-full mx-auto" />
        <div className="space-y-2">
          <PulseBlock className="h-4 w-48 mx-auto rounded" delay={100} />
          <PulseBlock className="h-3 w-64 mx-auto rounded" delay={200} />
        </div>
      </div>
    </div>
  );
}
