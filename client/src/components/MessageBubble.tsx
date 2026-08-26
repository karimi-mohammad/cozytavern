import { useState } from 'react';
import { useStore } from '../store/state';
import { Message, Character, Chat, Persona } from '../types';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CharacterAvatar from './CharacterAvatar';

function formatMessageTime(isoDate: string): string {
  const date = new Date(isoDate);
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };
  return date.toLocaleDateString('en-US', options);
}

interface Props {
  message: Message;
  isLast: boolean;
  onEditMessage: (messageId: string, content: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onBranch: (messageId: string, sendDate: string) => void;
  currentCharacter: Character | null;
  currentChat: (Chat & { messages: Message[] }) | null;
  activePersona: Persona | null;
  isGenerating: boolean;
}

export default function MessageBubble({
  message, isLast,
  onEditMessage, onDeleteMessage, onBranch,
  currentCharacter, currentChat, activePersona, isGenerating,
}: Props) {
  const { swipeMessage, regenerateMessage, markChapterBoundary, chapterStartId, chapterEndId } = useStore();
  const isMarkedStart = chapterStartId === message.id;
  const isMarkedEnd = chapterEndId === message.id;
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showControls, setShowControls] = useState(false);
  const [showThought, setShowThought] = useState(false);

  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const hasSwipes = message.swipes && message.swipes.length > 0;

  const handleSaveEdit = () => {
    onEditMessage(message.id, editContent);
    setIsEditing(false);
  };

  const handleBranch = () => {
    onBranch(message.id, message.send_date);
  };

  // Extract thinking content — supports multiple formats
  const thinkMatch = message.content.match(/<think>([\s\S]*?)<\/think>/)
    || message.content.match(/<reasoning>([\s\S]*?)<\/reasoning>/)
    || message.content.match(/<reflection>([\s\S]*?)<\/reflection>/)
    || message.content.match(/\[thinking\]([\s\S]*?)\[\/thinking\]/);
  const thinkingContent = thinkMatch ? thinkMatch[1].trim() : null;
  const mainContent = message.content
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/g, '')
    .replace(/<reflection>[\s\S]*?<\/reflection>/g, '')
    .replace(/\[thinking\][\s\S]*?\[\/thinking\]/g, '')
    .trim();

  // تخمین زمان تفکر بر اساس طول محتوا (~50 توکن در ثانیه)
  const thinkingTimeEstimate = thinkingContent
    ? Math.max(1, Math.ceil(thinkingContent.length / 200))
    : 0;

  return (
    <div
      className={`flex gap-3 py-3 group hover:bg-tavern-hover/20 transition-colors border-b border-tavern-border/30 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Avatar - only for AI */}
      {isAssistant && (
        <div className="flex-shrink-0 pt-0.5">
          <CharacterAvatar name={currentCharacter?.name || '?'} avatar={currentCharacter?.avatar} size="lg" />
        </div>
      )}
      {isUser && <div className="w-10 flex-shrink-0" />}

      {/* Message Content */}
      <div className={`flex flex-col flex-1 min-w-0 ${isUser ? 'max-w-[85%]' : 'max-w-full'}`}>
        {/* Name + Timestamp row */}
        <div className={`flex items-center gap-2 mb-1 ${isUser ? 'flex-row-reverse' : ''}`}>
          <span className="text-sm font-semibold text-tavern-text-bright">
            {isUser ? (activePersona?.name || 'You') : (currentCharacter?.name || 'Assistant')}
          </span>
          <span className="text-[11px] text-tavern-dim">{formatMessageTime(message.send_date)}</span>
          {message.is_edited && <span className="text-[10px] text-tavern-faint italic">(edited)</span>}
        </div>

        {/* Message Body */}
        {isEditing ? (
          <div className="w-full">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full bg-tavern-input border border-tavern-border rounded-lg p-3 text-sm resize-none min-h-[80px] focus:outline-none focus:border-tavern-accent text-tavern-text"
              rows={4}
            />
            <div className="flex gap-2 mt-2 justify-end">
              <button
                onClick={() => setIsEditing(false)}
                className="text-xs text-tavern-dim hover:text-tavern-text px-3 py-1 rounded-md hover:bg-tavern-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="text-xs bg-tavern-accent text-white px-3 py-1 rounded-md font-medium hover:bg-tavern-accent-hover transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Thinking section */}
            {thinkingContent && (
              <div className="mb-2">
                <button
                  onClick={() => setShowThought(!showThought)}
                  className="flex items-center gap-1.5 text-xs text-tavern-dim hover:text-tavern-accent bg-tavern-input/60 px-3 py-1.5 rounded-md transition-all border border-tavern-border/50 hover:border-tavern-accent/30"
                >
                  <svg
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${showThought ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <svg className="w-3.5 h-3.5 text-tavern-accent/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span>
                    {showThought ? 'Hide thinking' : `Thought for ~${thinkingTimeEstimate}s`}
                  </span>
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    showThought ? 'max-h-[500px] opacity-100 mt-2' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="text-sm text-tavern-dim pl-4 border-l-2 border-tavern-accent/40 leading-relaxed thinking-block bg-tavern-input/30 rounded-r-lg p-3">
                    {thinkingContent}
                  </div>
                </div>
              </div>
            )}

            {/* Main content */}
            {isAssistant ? (
              <div className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-pre:bg-tavern-bg prose-pre:border prose-pre:border-tavern-border leading-relaxed">
                <Markdown remarkPlugins={[remarkGfm]}>{mainContent}</Markdown>
              </div>
            ) : (
              <p className="text-[15px] whitespace-pre-wrap leading-7 text-tavern-text">{mainContent}</p>
            )}
          </>
        )}

        {/* Bottom controls row - all icons in one row */}
        {!isEditing && (
          <div className={`flex items-center gap-1 mt-2 pt-1.5 border-t border-tavern-border/30 ${isUser ? 'flex-row-reverse' : ''}`}>
            {/* Edit */}
            <button
              onClick={() => { setEditContent(message.content); setIsEditing(true); }}
              className={`text-tavern-dim hover:text-tavern-text p-1 rounded-md hover:bg-tavern-hover transition-opacity ${showControls ? 'opacity-100' : 'opacity-0'}`}
              title="Edit"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            {/* Delete */}
            <button
              onClick={() => onDeleteMessage(message.id)}
              className={`text-tavern-dim hover:text-tavern-danger p-1 rounded-md hover:bg-tavern-hover transition-opacity ${showControls ? 'opacity-100' : 'opacity-0'}`}
              title="Delete"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            {/* Branch */}
            <button
              onClick={handleBranch}
              className={`text-tavern-dim hover:text-tavern-text p-1 rounded-md hover:bg-tavern-hover transition-opacity ${showControls ? 'opacity-100' : 'opacity-0'}`}
              title="Branch"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 3v12M18 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM18 9a9 9 0 01-9 9" />
              </svg>
            </button>
            {/* Chapter start / end markers */}
            {currentChat && (
              <>
                <div className="w-px h-3.5 bg-tavern-border/50 mx-0.5" />
                <button
                  onClick={() => markChapterBoundary('start', message.id)}
                  className={`p-1 rounded-md transition-colors ${
                    isMarkedStart
                      ? 'bg-emerald-500/20 text-emerald-400 opacity-100'
                      : `text-tavern-dim hover:text-emerald-400 hover:bg-tavern-hover ${showControls ? 'opacity-100' : 'opacity-0'}`
                  }`}
                  title={isMarkedStart ? 'Remove chapter start marker' : 'Start chapter here'}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => markChapterBoundary('end', message.id)}
                  className={`p-1 rounded-md transition-colors ${
                    isMarkedEnd
                      ? 'bg-red-500/20 text-red-400 opacity-100'
                      : `text-tavern-dim hover:text-red-400 hover:bg-tavern-hover ${showControls ? 'opacity-100' : 'opacity-0'}`
                  }`}
                  title={isMarkedEnd ? 'Remove chapter end marker' : 'End chapter here'}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}
            {/* Regenerate - only for assistant last message */}
            {isAssistant && isLast && !isGenerating && (
              <button
                onClick={() => regenerateMessage()}
                className={`text-tavern-dim hover:text-tavern-text p-1 rounded-md hover:bg-tavern-hover transition-opacity ${showControls ? 'opacity-100' : 'opacity-0'}`}
                title="Regenerate"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}
            {/* Swipe controls - only for assistant */}
            {isAssistant && hasSwipes && (
              <>
                <div className="w-px h-3.5 bg-tavern-border/50 mx-0.5" />
                <button
                  onClick={() => swipeMessage(message.id, 'prev')}
                  disabled={message.swipe_id <= 0}
                  className="text-tavern-dim hover:text-tavern-text disabled:opacity-30 p-0.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-[11px] text-tavern-dim min-w-[24px] text-center font-mono">
                  {message.swipe_id + 1}/{message.swipes.length + 1}
                </span>
                <button
                  onClick={() => swipeMessage(message.id, 'next')}
                  disabled={message.swipe_id >= message.swipes.length}
                  className="text-tavern-dim hover:text-tavern-text disabled:opacity-30 p-0.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
