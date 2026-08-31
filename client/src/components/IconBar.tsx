import { useStore } from '../store/state';

export default function IconBar() {
  const { activePanel, setActivePanel, panelOpen, searchOpen, setSearchOpen, storyAdvisorOpen, setStoryAdvisorOpen } = useStore();

  const icons = [
    {
      id: 'characters' as const,
      label: 'Characters',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      id: 'chats' as const,
      label: 'Chats',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
    },
    {
      id: 'personas' as const,
      label: 'Personas',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    {
      id: 'lorebooks' as const,
      label: 'Lorebooks',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
    {
      id: 'chapters' as const,
      label: 'Chapters',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
    {
      id: 'plugins' as const,
      label: 'Plugins',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
        </svg>
      ),
    },
    {
      id: 'settings' as const,
      label: 'Settings',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="w-12 bg-tavern-surface border-r border-tavern-border flex flex-col items-center py-2 gap-1 flex-shrink-0">
      {icons.map((icon) => {
        const isActive = activePanel === icon.id && panelOpen;
        return (
          <button
            key={icon.id}
            onClick={() => setActivePanel(icon.id)}
            className={`relative w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200 group ${
              isActive
                ? 'bg-tavern-accent/20 text-tavern-accent'
                : 'text-tavern-muted hover:text-tavern-text-bright hover:bg-tavern-hover'
            } active:scale-90`}
            aria-label={icon.label}
          >
            {/* Active indicator pill */}
            <span
              className={`absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full bg-tavern-accent transition-all duration-300 ${
                isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-y-0'
              }`}
            />
            {icon.icon}
            {/* Custom tooltip */}
            <span className="pointer-events-none absolute left-full ml-2 px-2 py-1 rounded-md bg-tavern-surface2 border border-tavern-border text-[11px] font-medium text-tavern-text whitespace-nowrap shadow-lg shadow-black/30 opacity-0 translate-x-[-4px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 delay-300 z-50">
              {icon.label}
            </span>
          </button>
        );
      })}

      {/* Story Guide button */}
      <button
        onClick={() => setStoryAdvisorOpen(!storyAdvisorOpen)}
        className={`relative w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200 group ${
          storyAdvisorOpen
            ? 'bg-tavern-accent/20 text-tavern-accent'
            : 'text-tavern-muted hover:text-tavern-text-bright hover:bg-tavern-hover'
        } active:scale-90`}
        aria-label="Story Guide"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
        <span className="pointer-events-none absolute left-full ml-2 px-2 py-1 rounded-md bg-tavern-surface2 border border-tavern-border text-[11px] font-medium text-tavern-text whitespace-nowrap shadow-lg shadow-black/30 opacity-0 translate-x-[-4px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 delay-300 z-50">
          Story Guide
        </span>
      </button>

      {/* Separator */}
      <div className="w-6 h-px bg-tavern-border/50 my-1" />

      {/* Search button */}
      <button
        onClick={() => setSearchOpen(!searchOpen)}
        className={`relative w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200 group ${
          searchOpen
            ? 'bg-tavern-accent/20 text-tavern-accent'
            : 'text-tavern-muted hover:text-tavern-text-bright hover:bg-tavern-hover'
        } active:scale-90`}
        aria-label="Search"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className="pointer-events-none absolute left-full ml-2 px-2 py-1 rounded-md bg-tavern-surface2 border border-tavern-border text-[11px] font-medium text-tavern-text whitespace-nowrap shadow-lg shadow-black/30 opacity-0 translate-x-[-4px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 delay-300 z-50">
          Search
        </span>
      </button>
    </div>
  );
}
