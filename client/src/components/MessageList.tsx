import { useEffect, useRef } from 'react';
import { Message, Character, Chat, Persona } from '../types';
import MessageBubble from './MessageBubble';
import { MessageSkeleton } from './LoadingSkeleton';

interface Props {
  messages: Message[];
  currentCharacter: Character | null;
  currentChat: (Chat & { messages: Message[] }) | null;
  activePersona: Persona | null;
  isGenerating: boolean;
  loadingMessages: boolean;
  onEditMessage: (messageId: string, content: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onBranch: (messageId: string, sendDate: string) => void;
}

export default function MessageList({
  messages, currentCharacter, currentChat, activePersona, isGenerating, loadingMessages,
  onEditMessage, onDeleteMessage, onBranch,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevMessagesLengthRef = useRef(messages.length);
  const chatIdRef = useRef<string | null>(null);

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
          messages.map((msg) => (
          <MessageBubble
            key={msg.id}
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
        ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
