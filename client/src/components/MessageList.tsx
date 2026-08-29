import { useEffect, useRef } from 'react';
import { Message, Character, Chat, Persona, Chapter } from '../types';
import { useStore } from '../store/state';
import MessageBubble from './MessageBubble';
import { MessageSkeleton } from './LoadingSkeleton';

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
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevMessagesLengthRef = useRef(messages.length);
  const chatIdRef = useRef<string | null>(null);
  const chapterStartId = useStore(s => s.chapterStartId);
  const chapterEndId = useStore(s => s.chapterEndId);

  // وقتی چت عوض می‌شود به پایین برو
  useEffect(() => {
    if (!currentChat) return;
    if (chatIdRef.current !== currentChat.id) {
      chatIdRef.current = currentChat.id;
      prevMessagesLengthRef.current = messages.length;
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'instant' });
      });
    }
  }, [currentChat?.id, messages.length]);

  // اسکرول به پایین موقع پیام جدید یا استریم
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const prevLength = prevMessagesLengthRef.current;
    prevMessagesLengthRef.current = messages.length;
    const isNewMessage = messages.length > prevLength;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const lastMessage = messages[messages.length - 1];
    // پیام جدید همیشه، استریم فقط اگر کاربر پایین باشد
    if (isNewMessage || distanceFromBottom < 80 || !lastMessage?.content) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto relative z-10">
      <div className="max-w-[50vw] min-w-0 mx-auto px-4 py-4">
        {loadingMessages ? (
          <MessageSkeleton />
        ) : (
          (() => {
            // Map end_message_id to chapter for quick lookup
            const chapterByEndId = new Map(chapters.map(c => [c.end_message_id, c]));

            return messages.map((msg, idx) => {
              const elements: React.ReactNode[] = [];

              // Check if previous message was a chapter end → insert marker after it
              if (idx > 0) {
                const prevMsg = messages[idx - 1];
                const chapter = chapterByEndId.get(prevMsg.id);
                if (chapter) {
                  elements.push(
                    <div
                      key={`chapter-${chapter.id}`}
                      id={`chapter-marker-${chapter.id}`}
                      className="my-4 flex items-center gap-3 cursor-pointer group"
                      onClick={() => onChapterClick(chapter)}
                    >
                      <div className="flex-1 h-px bg-tavern-accent/30" />
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-tavern-accent/10 border border-tavern-accent/20 group-hover:bg-tavern-accent/20 transition-colors">
                        <svg className="w-3.5 h-3.5 text-tavern-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        <span className="text-xs text-tavern-accent font-medium">
                          {chapter.title || 'Chapter'}
                        </span>
                      </div>
                      <div className="flex-1 h-px bg-tavern-accent/30" />
                    </div>
                  );
                }
              }

              // نوار کناری برای پیام‌های علامت‌گذاری‌شده به‌عنوان مرز فصل
              const isMarkedStart = chapterStartId === msg.id;
              const isMarkedEnd = chapterEndId === msg.id;

              elements.push(
                <div key={msg.id} data-message-id={msg.id} className="relative animate-fade-in-up">
                  {isMarkedStart && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 rounded-r bg-emerald-400/70" />
                  )}
                  {isMarkedEnd && (
                    <div className="absolute right-0 top-0 bottom-0 w-1 rounded-r bg-red-400/70" />
                  )}
                  <MessageBubble
                    message={msg}
                    isLast={messages[messages.length - 1]?.id === msg.id}
                    onEditMessage={onEditMessage}
                    onDeleteMessage={onDeleteMessage}
                    onBranch={onBranch}
                    currentCharacter={currentCharacter}
                    currentChat={currentChat}
                    activePersona={activePersona}
                    isGenerating={isGenerating}
                  />
                </div>
              );

              return elements;
            }).flat();
          })()
        )}
        <div ref={bottomRef} />
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
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
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
