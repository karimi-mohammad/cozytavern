import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Message, Character, Chat, Persona } from '../types';
import MessageBubble from './MessageBubble';

const ESTIMATED_ROW_HEIGHT = 64;
const OVERSCAN = 8;

interface Props {
  messages: Message[];
  currentCharacter: Character | null;
  currentChat: (Chat & { messages: Message[] }) | null;
  activePersona: Persona | null;
  isGenerating: boolean;
  onEditMessage: (messageId: string, content: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onBranch: (messageId: string, sendDate: string) => void;
}

export default function MessageList({
  messages, currentCharacter, currentChat, activePersona, isGenerating,
  onEditMessage, onDeleteMessage, onBranch,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ top: 0, bottom: 0 });

  useEffect(() => {
    if (spacerRef.current) {
      spacerRef.current.style.height = `${messages.length * ESTIMATED_ROW_HEIGHT}px`;
    }
  }, [messages.length]);

  const updateViewport = () => {
    const container = containerRef.current;
    if (!container) return;
    setViewport({
      top: Math.max(0, container.scrollTop - OVERSCAN * ESTIMATED_ROW_HEIGHT),
      bottom: container.scrollTop + container.clientHeight + OVERSCAN * ESTIMATED_ROW_HEIGHT,
    });
  };

  useEffect(() => {
    updateViewport();
  }, [messages]);

  const rafRef = useRef<number | null>(null);
  const handleScroll = () => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      updateViewport();
    });
  };

  useLayoutEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // اسکرول به پایین موقع تغییر پیام‌ها — اگر کاربر به پایین نزدیک است
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const lastMessage = messages[messages.length - 1];
    const shouldScroll = distanceFromBottom < 80 || !lastMessage?.content;
    if (shouldScroll) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  const startIndex = Math.max(0, Math.floor(viewport.top / ESTIMATED_ROW_HEIGHT));
  const endIndex = Math.min(messages.length, Math.ceil(viewport.bottom / ESTIMATED_ROW_HEIGHT));
  const visible = messages.slice(startIndex, endIndex);

  return (
    <div ref={containerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto py-2 relative z-10 px-[60px]">
      <div ref={spacerRef} className="relative">
        {visible.map((msg) => (
          <div
            key={msg.id}
            className="absolute left-0 right-0"
            style={{ top: messages.indexOf(msg) * ESTIMATED_ROW_HEIGHT }}
          >
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
        ))}
      </div>
    </div>
  );
}
