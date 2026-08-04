import { useState } from 'react';
import { useStore } from '../store/state';
import { Message } from '../types';
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

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

interface Props {
  message: Message;
  isLast: boolean;
}

export default function MessageBubble({ message, isLast }: Props) {
  const { editMessage, swipeMessage, regenerateMessage, branchChat, selectChat, currentChat, currentCharacter, isGenerating, activePersona } = useStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showControls, setShowControls] = useState(false);
  const [showThought, setShowThought] = useState(false);

  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const hasSwipes = message.swipes && message.swipes.length > 0;
  const tokenCount = estimateTokens(message.content);

  const handleSaveEdit = () => {
    editMessage(message.id, editContent);
    setIsEditing(false);
  };

  const handleBranch = async () => {
    if (!currentChat || !currentCharacter) return;
    const newChat = await branchChat(currentCharacter.id, currentChat.id, message.send_date);
    await selectChat(newChat.id);
  };

  // Extract thinking content
  const thinkMatch = message.content.match(/<think>([\s\S]*?)<\/think>/);
  const thinkingContent = thinkMatch ? thinkMatch[1] : null;
  const mainContent = message.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

  return (
    <div
      className={`flex gap-3 px-4 py-3 group hover:bg-tavern-hover/20 transition-colors border-b border-tavern-border/30 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Avatar - only for AI */}
      {isAssistant && (
        <div className="flex-shrink-0">
          <CharacterAvatar name={currentCharacter?.name || '?'} avatar={currentCharacter?.avatar} size="lg" />
        </div>
      )}
      {isUser && <div className="w-10 flex-shrink-0" />}

      {/* Message Content */}
      <div className={`flex flex-col flex-1 min-w-0 max-w-[88%] md:max-w-[82%]`}>
        {/* Name + Timestamp row */}
        <div className={`flex items-center gap-2 mb-1 ${isUser ? 'flex-row-reverse' : ''}`}>
          <span className="text-[15px] font-bold text-tavern-text-bright">
            {isUser ? (activePersona?.name || 'You') : (currentCharacter?.name || 'Assistant')}
          </span>
          <span className="text-xs text-tavern-dim">{formatMessageTime(message.send_date)}</span>
          {message.is_edited && <span className="text-[10px] text-tavern-faint italic">(edited)</span>}
          {/* Edit button - top right */}
          <div className={`ml-auto ${isUser ? 'ml-0 mr-auto' : ''}`}>
            <button
              onClick={() => { setEditContent(message.content); setIsEditing(true); }}
              className={`text-tavern-dim hover:text-tavern-text p-1.5 rounded-md hover:bg-tavern-hover transition-opacity ${showControls ? 'opacity-100' : 'opacity-0'}`}
              title="Edit"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Message Body */}
        {isEditing ? (
          <div className="w-full">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full bg-tavern-input border border-tavern-border rounded-lg p-3 text-sm resize-none min-h-[100px] focus:outline-none focus:border-tavern-accent text-tavern-text"
              rows={5}
            />
            <div className="flex gap-2 mt-2 justify-end">
              <button
                onClick={() => setIsEditing(false)}
                className="text-xs text-tavern-dim hover:text-tavern-text px-3 py-1.5 rounded-md hover:bg-tavern-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="text-xs bg-tavern-accent text-white px-4 py-1.5 rounded-md font-medium hover:bg-tavern-accent-hover transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Thinking section */}
            {thinkingContent && (
              <div className="mb-3">
                <button
                  onClick={() => setShowThought(!showThought)}
                  className="flex items-center gap-2 text-sm text-tavern-dim hover:text-tavern-text bg-tavern-input px-4 py-2 rounded-lg transition-colors border border-tavern-border"
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${showThought ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="font-medium">Thought for {Math.floor(Math.random() * 20 + 5)} seconds</span>
                </button>
                {showThought && (
                  <div className="mt-3 text-sm text-tavern-dim pl-5 border-l-2 border-tavern-accent/30 leading-relaxed thinking-block">
                    {thinkingContent}
                  </div>
                )}
              </div>
            )}

            {/* Main content */}
            {isAssistant ? (
              <div className="prose prose-invert prose-sm max-w-none prose-p:my-1.5 prose-pre:bg-tavern-bg prose-pre:border prose-pre:border-tavern-border leading-relaxed">
                <Markdown remarkPlugins={[remarkGfm]}>{mainContent}</Markdown>
              </div>
            ) : (
              <p className="text-[15px] whitespace-pre-wrap leading-7 text-tavern-text">{mainContent}</p>
            )}
          </>
        )}

        {/* Bottom controls row */}
        {!isEditing && (
          <div className={`flex items-center gap-2 mt-1.5 ${isUser ? 'flex-row-reverse' : ''}`}>
            {/* Swipe controls - only for assistant */}
            {isAssistant && hasSwipes && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => swipeMessage(message.id, 'prev')}
                  disabled={message.swipe_id <= 0}
                  className="text-tavern-dim hover:text-tavern-text disabled:opacity-30 p-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-xs text-tavern-dim min-w-[28px] text-center font-mono">
                  {message.swipe_id + 1}/{message.swipes.length + 1}
                </span>
                <button
                  onClick={() => swipeMessage(message.id, 'next')}
                  disabled={message.swipe_id >= message.swipes.length}
                  className="text-tavern-dim hover:text-tavern-text disabled:opacity-30 p-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}

            {/* Branch + Regenerate buttons - show on hover */}
            <div className={`flex items-center gap-1 transition-opacity ${showControls ? 'opacity-100' : 'opacity-0'}`}>
              <button
                onClick={handleBranch}
                className="text-tavern-dim hover:text-tavern-text p-1.5 rounded-md hover:bg-tavern-hover transition-colors"
                title="Branch"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 3v12M18 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM18 9a9 9 0 01-9 9" />
                </svg>
              </button>

              {isAssistant && isLast && !isGenerating && (
                <button
                  onClick={() => regenerateMessage()}
                  className="text-tavern-dim hover:text-tavern-text p-1.5 rounded-md hover:bg-tavern-hover transition-colors"
                  title="Regenerate"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
