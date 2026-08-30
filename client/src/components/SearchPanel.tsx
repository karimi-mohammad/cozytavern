import { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/state';
import { useDebounce } from '../hooks/useDebounce';
import CharacterAvatar from './CharacterAvatar';

export default function SearchPanel() {
  // استفاده از selector‌های جداگانه برای جلوگیری از re-render بی‌رویه
  const searchQuery = useStore(s => s.searchQuery);
  const searchResults = useStore(s => s.searchResults);
  const searchTotal = useStore(s => s.searchTotal);
  const searchLoading = useStore(s => s.searchLoading);
  const searchOpen = useStore(s => s.searchOpen);
  const setSearchQuery = useStore(s => s.setSearchQuery);
  const setSearchOpen = useStore(s => s.setSearchOpen);
  const searchMessages = useStore(s => s.searchMessages);
  const loadMoreSearchResults = useStore(s => s.loadMoreSearchResults);
  const scrollToMessage = useStore(s => s.scrollToMessage);

  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'assistant'>('all');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(localQuery, 300);

  useEffect(() => {
    if (debouncedQuery.trim()) {
      searchMessages(debouncedQuery, roleFilter !== 'all' ? { role: roleFilter } : undefined);
    }
  }, [debouncedQuery, roleFilter]);

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [searchOpen]);

  if (!searchOpen) return null;

  const handleClickResult = (result: typeof searchResults[0]) => {
    // Select the chat if it exists
    const { currentChat } = useStore.getState();
    if (currentChat?.id !== result.chat_id) {
      // We need to select the chat first
      useStore.getState().selectCharacter({ id: '', name: '', nickname: '', description: '', personality: '', scenario: '', first_mes: '', mes_example: '', creator_notes: '', system_prompt: '', post_history_instructions: '', alternate_greetings: [], group_only_greetings: [], creator: '', character_version: '', tags: [], avatar: '', lorebook_id: '', created_at: '', updated_at: '' } as any);
    }
    scrollToMessage(result.id);
    setSearchOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setSearchOpen(false);
    }
  };

  return (
    <div className="absolute left-0 top-0 bottom-0 w-72 bg-tavern-surface border-r border-tavern-border flex flex-col flex-shrink-0 z-30 animate-slide-in shadow-xl">
      {/* Header */}
      <div className="h-[50px] border-b border-tavern-border flex items-center justify-between px-3 flex-shrink-0">
        <h2 className="text-sm font-semibold text-tavern-text-bright flex items-center gap-2">
          <svg className="w-4 h-4 text-tavern-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Search Messages
        </h2>
        <button
          onClick={() => setSearchOpen(false)}
          className="text-tavern-dim hover:text-tavern-text p-1.5 rounded-md hover:bg-tavern-hover transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Search Input */}
      <div className="p-3 border-b border-tavern-border/50">
        <div className="relative">
          <input
            ref={inputRef}
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-tavern-input border border-tavern-border rounded-lg px-3 py-2 pl-9 text-sm focus:outline-none focus:border-tavern-accent transition-colors text-tavern-text placeholder-tavern-dim"
            placeholder="Search in messages..."
          />
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-tavern-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Role Filter */}
        <div className="flex gap-1.5 mt-2">
          {(['all', 'user', 'assistant'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                roleFilter === r
                  ? 'bg-tavern-accent/20 text-tavern-accent border border-tavern-accent/30'
                  : 'bg-tavern-input border border-tavern-border text-tavern-dim hover:text-tavern-text hover:bg-tavern-hover'
              }`}
            >
              {r === 'all' ? 'All' : r === 'user' ? 'User' : 'AI'}
            </button>
          ))}
        </div>

        {/* Result count */}
        {searchTotal > 0 && (
          <p className="text-[11px] text-tavern-dim mt-2">
            {searchTotal} result{searchTotal !== 1 ? 's' : ''} found
          </p>
        )}
      </div>

      {/* Results */}
      <div ref={listRef} className="flex-1 overflow-y-auto">
        {searchLoading && searchResults.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-tavern-accent/30 border-t-tavern-accent rounded-full animate-spin" />
          </div>
        ) : searchResults.length === 0 ? (
          <div className="text-center py-12 px-4">
            {localQuery.trim() ? (
              <>
                <svg className="w-10 h-10 mx-auto mb-3 text-tavern-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-tavern-dim">No results found</p>
                <p className="text-xs text-tavern-faint mt-1">Try different keywords</p>
              </>
            ) : (
              <>
                <svg className="w-10 h-10 mx-auto mb-3 text-tavern-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p className="text-sm text-tavern-dim">Type to search messages</p>
              </>
            )}
          </div>
        ) : (
          <div className="p-2">
            {searchResults.map((result) => (
              <div
                key={result.id}
                onClick={() => handleClickResult(result)}
                className="p-2.5 rounded-lg cursor-pointer mb-1 transition-all duration-150 hover:bg-tavern-hover group"
              >
                {/* Header: chat name + role badge */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] text-tavern-faint truncate flex-1">{result.chat_name || 'Unknown Chat'}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    result.role === 'user'
                      ? 'bg-blue-500/15 text-blue-400'
                      : 'bg-emerald-500/15 text-emerald-400'
                  }`}>
                    {result.role === 'user' ? 'User' : 'AI'}
                  </span>
                </div>

                {/* Snippet */}
                <p className="text-xs text-tavern-text leading-relaxed line-clamp-3">
                  {result.snippet}
                </p>

                {/* Footer: timestamp */}
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] text-tavern-faint">
                    {new Date(result.send_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                  </span>
                  {result.is_edited && (
                    <span className="text-[10px] text-tavern-faint italic">(edited)</span>
                  )}
                </div>
              </div>
            ))}

            {/* Load more button */}
            {searchResults.length < searchTotal && (
              <button
                onClick={loadMoreSearchResults}
                disabled={searchLoading}
                className="w-full py-2 text-xs text-tavern-accent hover:text-tavern-accent-hover transition-colors disabled:opacity-50"
              >
                {searchLoading ? 'Loading...' : 'Load more results'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
