import { useEffect, useRef, useCallback } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { Message, Character, Chat, Persona, Chapter } from '../types';
import { useStore } from '../store/state';
import MessageBubble from './MessageBubble';
import { MessageSkeleton } from './LoadingSkeleton';
import ChapterTriggerProgress from './ChapterTriggerProgress';

interface Props {
  messages: Message[];
  currentCharacter: Character | null;
  currentChat: (Chat & { messages: Message[] }) | null;
  activePersona: Persona | null;
  isGenerating: boolean;
  loadingMessages: boolean;
  chapters: Chapter[];
  onEditMessage: (messageId: string, content: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onBranch: (messageId: string, sendDate: string) => void;
  onChapterClick: (chapter: Chapter) => void;
}

export default function MessageList({
  messages, currentCharacter, currentChat, activePersona, isGenerating, loadingMessages, chapters,
  onEditMessage, onDeleteMessage, onBranch, onChapterClick,
}: Props) {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const prevMessagesLengthRef = useRef(messages.length);
  const chatIdRef = useRef<string | null>(null);
  const chapterStartId = useStore(s => s.chapterStartId);
  const chapterEndId = useStore(s => s.chapterEndId);

  // Map end_message_id to chapter for quick lookup
  const chapterByEndId = new Map(chapters.map(c => [c.end_message_id, c]));

  // وقتی چت عوض می‌شود به پایین برو
  useEffect(() => {
    if (!currentChat) return;
    if (chatIdRef.current !== currentChat.id) {
      chatIdRef.current = currentChat.id;
      prevMessagesLengthRef.current = messages.length;
      requestAnimationFrame(() => {
        virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, align: 'end' });
      });
    }
  }, [currentChat?.id, messages.length]);

  // اسکرول به پایین موقع پیام جدید یا استریم
  useEffect(() => {
    const prevLength = prevMessagesLengthRef.current;
    prevMessagesLengthRef.current = messages.length;
    const isNewMessage = messages.length > prevLength;
    const lastMessage = messages[messages.length - 1];
    // پیام جدید همیشه، استریم فقط اگر کاربر پایین باشد
    if (isNewMessage || !lastMessage?.content) {
      virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, align: 'end' });
    }
  }, [messages]);

  // Compute a flat list of items for Virtuoso
  type MessageItem = { type: 'message'; message: Message; isLast: boolean };
  type ChapterItem = { type: 'chapter'; chapter: Chapter };
  type StreamingItem = { type: 'streaming'; message: Message };

  const items: (MessageItem | ChapterItem | StreamingItem)[] = [];

  if (messages.length > 0) {
    const stableMessages = messages.length > 1 ? messages.slice(0, -1) : [];
    const streamingMessage = messages[messages.length - 1];

    stableMessages.forEach((msg, idx) => {
      // Check if previous message was a chapter end → insert marker after it
      if (idx > 0) {
        const prevMsg = stableMessages[idx - 1];
        const chapter = chapterByEndId.get(prevMsg.id);
        if (chapter) {
          items.push({ type: 'chapter', chapter });
        }
      }
      items.push({ type: 'message', message: msg, isLast: false });
    });

    // Chapter marker before streaming message
    if (stableMessages.length > 0) {
      const prevMsg = stableMessages[stableMessages.length - 1];
      const chapter = chapterByEndId.get(prevMsg.id);
      if (chapter) {
        items.push({ type: 'chapter', chapter });
      }
    }

    // Streaming message
    items.push({ type: 'streaming', message: streamingMessage });
  }

  const computeItemKey = useCallback((index: number) => {
    const item = items[index];
    if (!item) return `item-${index}`;
    if (item.type === 'chapter') return `chapter-${item.chapter.id}`;
    if (item.type === 'streaming') return `streaming-${item.message.id}`;
    return item.message.id;
  }, [items]);

  return (
    <div className="flex-1 overflow-hidden relative z-10">
      <div className="max-w-[50vw] min-w-0 mx-auto h-full">
        {loadingMessages ? (
          <div className="flex-1 overflow-y-auto">
            <MessageSkeleton />
          </div>
        ) : (
          <Virtuoso
            ref={virtuosoRef}
            totalCount={items.length}
            overscan={200}
            followOutput="smooth"
            initialTopMostItemIndex={Math.max(0, items.length - 1)}
            itemContent={(index) => {
              const item = items[index];
              if (!item) return null;

              if (item.type === 'chapter') {
                return (
                  <div
                    id={`chapter-marker-${item.chapter.id}`}
                    className="my-4 flex items-center gap-3 cursor-pointer group px-4"
                    onClick={() => onChapterClick(item.chapter)}
                  >
                    <div className="flex-1 h-px bg-tavern-accent/30" />
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-tavern-accent/10 border border-tavern-accent/20 group-hover:bg-tavern-accent/20 transition-colors">
                      <svg className="w-3.5 h-3.5 text-tavern-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5-1.253" />
                      </svg>
                      <span className="text-xs text-tavern-accent font-medium">
                        {item.chapter.title || 'Chapter'}
                      </span>
                    </div>
                    <div className="flex-1 h-px bg-tavern-accent/30" />
                  </div>
                );
              }

              const msg = item.message;
              const isStreaming = item.type === 'streaming';
              const isMarkedStart = chapterStartId === msg.id;
              const isMarkedEnd = chapterEndId === msg.id;

              return (
                <div data-message-id={msg.id} className="relative animate-fade-in-up">
                  {isMarkedStart && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 rounded-r bg-emerald-400/70" />
                  )}
                  {isMarkedEnd && (
                    <div className="absolute right-0 top-0 bottom-0 w-1 rounded-r bg-red-400/70" />
                  )}
                  <MessageBubble
                    message={msg}
                    isLast={isStreaming}
                    onEditMessage={onEditMessage}
                    onDeleteMessage={onDeleteMessage}
                    onBranch={onBranch}
                    currentCharacter={currentCharacter}
                    currentChat={currentChat}
                    activePersona={activePersona}
                    isGenerating={isStreaming && isGenerating}
                  />
                </div>
              );
            }}
            computeItemKey={computeItemKey}
          />
        )}
        {/* نمایش پیشرفت تریگر خودکار */}
        <ChapterTriggerProgress />
      </div>

      {/* دکمه ایجاد فصل بعد از انتخاب شروع و پایان */}
      <ChapterCreateBar />
    </div>
  );
}

// نوار شناور پایین لیست پیام‌ها — وقتی هر دو مرز انتخاب شده باشند نمایش داده می‌شود
function ChapterCreateBar() {
  const chapterStartId = useStore(s => s.chapterStartId);
  const chapterEndId = useStore(s => s.chapterEndId);
  const createChapterFromSelection = useStore(s => s.createChapterFromSelection);
  const clearChapterSelection = useStore(s => s.clearChapterSelection);

  if (!chapterStartId || !chapterEndId) return null;

  return (
    <div className="sticky bottom-4 mx-auto w-fit bg-tavern-surface border border-tavern-accent/30 rounded-lg shadow-xl shadow-black/30 px-4 py-2.5 flex items-center gap-3 z-20 animate-slide-up">
      <svg className="w-4 h-4 text-tavern-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5-1.253" />
      </svg>
      <span className="text-xs text-tavern-text">Chapter boundaries selected</span>
      <button
        onClick={clearChapterSelection}
        className="px-3 py-1 rounded bg-tavern-input border border-tavern-border text-tavern-dim hover:text-tavern-text hover:bg-tavern-hover text-xs transition-colors active:scale-[0.97]"
      >
        Clear
      </button>
      <button
        onClick={() => createChapterFromSelection()}
        className="px-3 py-1 rounded bg-tavern-accent text-white hover:bg-tavern-accent-hover text-xs font-medium transition-all active:scale-[0.97] shadow-md shadow-tavern-accent/20"
      >
        Create Chapter
      </button>
    </div>
  );
}
