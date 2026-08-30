import { memo, useState, useMemo } from 'react';
import { useStore } from '../store/state';
import { Message, Character, Chat, Persona } from '../types';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import type { Components } from 'react-markdown';
import CharacterAvatar from './CharacterAvatar';
import CodeBlock from './CodeBlock';
import StateChangeIndicator from './StateChangeIndicator';
import { DialogueParagraph, renderHighlightedText } from '../utils/remarkDialogue';
import { stripToolCalls } from '../utils/stripToolCalls';

// Custom Markdown components for enhanced rendering - memoized outside render
const markdownComponents: Components = {
  code: ({ className, children, ...props }) => {
    const isInline = !className && typeof children === 'string' && !children.includes('\n');
    return <CodeBlock className={className} inline={isInline}>{children}</CodeBlock>;
  },
  em: ({ children, ...props }) => (
    <em {...props} className="msg-narration">{children}</em>
  ),
  strong: ({ children, ...props }) => (
    <strong {...props} className="msg-emphasis">{children}</strong>
  ),
  u: ({ children, ...props }) => (
    <u {...props} className="msg-underlined">{children}</u>
  ),
  a: ({ children, ...props }) => (
    <a {...props} target="_blank" rel="noopener noreferrer" className="text-tavern-accent hover:text-tavern-accent-hover underline underline-offset-2 transition-colors">
      {children}
    </a>
  ),
  table: ({ children, ...props }) => (
    <div className="overflow-x-auto my-2 rounded-lg border border-tavern-border/50">
      <table {...props} className="w-full text-sm">{children}</table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead {...props} className="bg-tavern-surface2/80 border-b border-tavern-border/50">{children}</thead>
  ),
  th: ({ children, ...props }) => (
    <th {...props} className="px-3 py-2 text-left text-xs font-medium text-tavern-dim">{children}</th>
  ),
  td: ({ children, ...props }) => (
    <td {...props} className="px-3 py-2 border-t border-tavern-border/30 text-tavern-text">{children}</td>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote {...props} className="border-l-4 border-tavern-accent/40 pl-4 my-2 text-tavern-dim italic">
      {children}
    </blockquote>
  ),
  p: DialogueParagraph,
  hr: (props) => (
    <hr {...props} className="my-4 border-tavern-border/50" />
  ),
};

// Memoized remark/rehype plugins
const remarkPlugins = [remarkGfm];
const rehypePlugins = [rehypeHighlight];

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

function MessageBubbleInner({
  message, isLast,
  onEditMessage, onDeleteMessage, onBranch,
  currentCharacter, currentChat, activePersona, isGenerating,
}: Props) {
  // Use individual selectors to avoid re-rendering on every store change (e.g. streaming tokens)
  const swipeMessage = useStore(s => s.swipeMessage);
  const regenerateMessage = useStore(s => s.regenerateMessage);
  const markChapterBoundary = useStore(s => s.markChapterBoundary);
  const startChapterCreation = useStore(s => s.startChapterCreation);
  const chapterStartId = useStore(s => s.chapterStartId);
  const chapterEndId = useStore(s => s.chapterEndId);
  const chapterFlowEndId = useStore(s => s.chapterFlowEndId);
  const chapterSettings = useStore(s => s.chapterSettings);

  // Check if message contains a trigger phrase
  const triggerPhrases = chapterSettings?.trigger_phrases || [];
  const matchedTrigger = triggerPhrases.length > 0
    ? triggerPhrases.find(phrase =>
        message.content?.toLowerCase().includes(phrase.toLowerCase())
      )
    : null;
  const isMarkedStart = chapterStartId === message.id;
  const isMarkedEnd = chapterEndId === message.id;
  const isFlowEnd = chapterFlowEndId === message.id;
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showControls, setShowControls] = useState(false);
  const [showThought, setShowThought] = useState(false);

  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isSystem = message.is_system || message.role === 'system';
  const hasSwipes = message.swipes && message.swipes.length > 0;

  // System messages render differently
  if (isSystem) {
    return (
      <div className="flex justify-center py-2 my-1">
        <div dir="auto" className="text-xs text-tavern-dim italic px-4 py-1.5 bg-tavern-surface/50 rounded-full border border-tavern-border/30">
          {message.content}
        </div>
      </div>
    );
  }

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
  const mainContent = stripToolCalls(
    message.content
      .replace(/<think>[\s\S]*?<\/think>/g, '')
      .replace(/<reasoning>[\s\S]*?<\/reasoning>/g, '')
      .replace(/<reflection>[\s\S]*?<\/reflection>/g, '')
      .replace(/\[thinking\][\s\S]*?\[\/thinking\]/g, '')
      .trim()
  );

  // تخمین زمان تفکر بر اساس طول محتوا (~50 توکن در ثانیه)
  const thinkingTimeEstimate = thinkingContent
    ? Math.max(1, Math.ceil(thinkingContent.length / 200))
    : 0;

  // Group chat sender info
  const senderName = (message as any).sender_name || '';
  const senderAvatar = (message as any).sender_avatar || '';
  const senderCharId = (message as any).sender_character_id || '';
  const isGroupChatMessage = !!(senderCharId || senderName);

  // Determine avatar and name to display
  const displayName = isGroupChatMessage
    ? senderName || (isUser ? (activePersona?.name || 'You') : (currentCharacter?.name || 'Assistant'))
    : (isUser ? (activePersona?.name || 'You') : (currentCharacter?.name || 'Assistant'));
  const displayAvatar = isGroupChatMessage && senderAvatar ? senderAvatar : (isUser ? undefined : currentCharacter?.avatar);

  return (
    <div
      className={`flex gap-3 py-3 group hover:bg-tavern-hover/20 transition-colors border-b border-tavern-border/30 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Avatar - for AI messages (including group chat) */}
      {isAssistant && (
        <div className="flex-shrink-0 pt-0.5">
          <CharacterAvatar name={displayName} avatar={displayAvatar} size="lg" />
        </div>
      )}
      {isUser && <div className="w-10 flex-shrink-0" />}

      {/* Message Content */}
      <div className={`flex flex-col flex-1 min-w-0 ${isUser ? 'max-w-[85%]' : 'max-w-full'}`}>
        {/* Name + Timestamp row */}
        <div className={`flex items-center gap-2 mb-1 ${isUser ? 'flex-row-reverse' : ''}`}>
          <span className="text-sm font-semibold text-tavern-text-bright">
            {displayName}
          </span>
          <span className="text-[11px] text-tavern-dim">{formatMessageTime(message.send_date)}</span>
          {message.is_edited && <span className="text-[10px] text-tavern-faint italic">(edited)</span>}
          {/* Trigger phrase indicator */}
          {matchedTrigger && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20 text-[10px] font-medium"
              title={`Trigger phrase: "${matchedTrigger}"`}
            >
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span className="hidden sm:inline">Trigger</span>
            </span>
          )}
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
                  <div dir="auto" className="text-sm text-tavern-dim pl-4 border-l-2 border-tavern-accent/40 leading-relaxed thinking-block bg-tavern-input/30 rounded-r-lg p-3">
                    {thinkingContent}
                  </div>
                </div>
              </div>
            )}

            {/* Main content */}
            {isAssistant ? (
              <div dir="auto" className={`prose prose-invert prose-sm max-w-none prose-p:my-1 prose-pre:bg-tavern-bg prose-pre:border prose-pre:border-tavern-border leading-relaxed ${isLast && isGenerating ? 'is-streaming' : ''}`}>
                <Markdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={markdownComponents}>{mainContent}</Markdown>
              </div>
            ) : (
              <div dir="auto" className={`text-[15px] text-tavern-text leading-7 whitespace-pre-wrap ${isLast && isGenerating ? 'is-streaming' : ''}`}>
                {renderHighlightedText(mainContent)}
                {isLast && isGenerating && <span className="streaming-caret" />}
              </div>
            )}

            {/* State Change Indicator */}
            <StateChangeIndicator messageId={message.id} isUser={isUser} />
          </>
        )}

        {/* Bottom controls row - all icons in one row */}
        {!isEditing && (
          <div className={`flex items-center gap-1 mt-2 pt-1.5 border-t border-tavern-border/30 ${isUser ? 'flex-row-reverse' : ''}`}>
            {/* Edit */}
            <button
              onClick={() => { setEditContent(message.content); setIsEditing(true); }}
              className={`text-tavern-dim hover:text-tavern-text p-1 rounded-md hover:bg-tavern-hover transition-all duration-150 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              title="Edit"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            {/* Delete */}
            <button
              onClick={() => onDeleteMessage(message.id)}
              className={`text-tavern-dim hover:text-tavern-danger p-1 rounded-md hover:bg-tavern-hover transition-all duration-150 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              title="Delete"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            {/* Branch */}
            <button
              onClick={handleBranch}
              className={`text-tavern-dim hover:text-tavern-text p-1 rounded-md hover:bg-tavern-hover transition-all duration-150 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              title="Branch"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 3v12M18 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM18 9a9 9 0 01-9 9" />
              </svg>
            </button>
            {/* Chapter creation button */}
            {currentChat && !isLast && (
              <>
                <div className="w-px h-3.5 bg-tavern-border/50 mx-0.5" />
                <button
                  onClick={() => startChapterCreation(message.id)}
                  className={`p-1 rounded-md transition-all duration-150 ${
                    isFlowEnd
                      ? 'bg-tavern-accent/20 text-tavern-accent opacity-100'
                      : `text-tavern-dim hover:text-tavern-accent hover:bg-tavern-hover ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`
                  }`}
                  title="Create chapter ending here"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </button>
              </>
            )}
            {/* Regenerate - only for assistant last message */}
            {isAssistant && isLast && !isGenerating && (
              <button
                onClick={() => regenerateMessage()}
                className={`text-tavern-dim hover:text-tavern-text p-1 rounded-md hover:bg-tavern-hover transition-all duration-150 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
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
                  className="text-tavern-dim hover:text-tavern-text disabled:opacity-30 p-0.5 rounded transition-all hover:bg-tavern-hover active:scale-90"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-[11px] text-tavern-dim min-w-[24px] text-center font-mono bg-tavern-input/70 border border-tavern-border/50 rounded px-1 py-px">
                  {message.swipe_id + 1}/{message.swipes.length + 1}
                </span>
                <button
                  onClick={() => swipeMessage(message.id, 'next')}
                  disabled={message.swipe_id >= message.swipes.length}
                  className="text-tavern-dim hover:text-tavern-text disabled:opacity-30 p-0.5 rounded transition-all hover:bg-tavern-hover active:scale-90"
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

// React.memo: only re-render when the message content/identity or streaming state changes.
// Non-last messages have stable message references (store spreads array but only mutates last element),
// so they skip re-rendering during streaming. This cuts ~200 × 100 = 20,000 renders/sec to ~100.
export default memo(MessageBubbleInner, (prev, next) => {
  return prev.message === next.message
    && prev.isLast === next.isLast
    && prev.isGenerating === next.isGenerating;
});
