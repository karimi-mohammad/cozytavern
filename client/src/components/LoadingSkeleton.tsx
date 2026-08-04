export function CharacterSkeleton() {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-2 animate-pulse">
          <div className="w-7 h-7 rounded-full bg-tavern-hover" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 bg-tavern-hover rounded w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MessageSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
          <div className={`max-w-[70%] space-y-2 animate-pulse ${i % 2 === 0 ? 'mr-auto' : 'ml-auto'}`}>
            <div className="h-3 bg-tavern-hover rounded w-full" />
            <div className="h-3 bg-tavern-hover rounded w-5/6" />
            <div className="h-3 bg-tavern-hover rounded w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
