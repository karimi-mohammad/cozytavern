import React from 'react';

/**
 * Splits a text string by dialogue quotes and returns React elements.
 * Text between "..." or \u201c...\u201d gets a styled span.
 */
function highlightString(text: string): React.ReactNode {
  const regex = /(\u201c[^\u201d]*\u201d|"[^"]*")/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <span key={key++} className="msg-dialogue">
        {match[0]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

/**
 * Walks a React children tree and wraps any raw text segments
 * that contain dialogue quotes ("...") in styled spans.
 */
function processChildren(children: React.ReactNode): React.ReactNode {
  return React.Children.map(children, (child) => {
    // Raw text node (string)
    if (typeof child === 'string') {
      if (!child.includes('"') && !child.includes('\u201c')) return child;
      return highlightString(child);
    }

    // React element — recurse into its children
    if (React.isValidElement(child) && (child.props as any).children != null) {
      const tag = (child as any).type;
      // Don't recurse into <code>, <pre>, <a> or already-styled dialogue spans
      if (tag === 'code' || tag === 'pre' || tag === 'a' || tag === 'span') return child;

      const newChildren = processChildren((child.props as any).children);
      return React.cloneElement(child as any, { children: newChildren });
    }

    return child;
  });
}

/**
 * Custom <p> component for react-markdown that applies dialogue
 * highlighting to raw text between quotes.
 *
 * Usage: <Markdown components={{ p: DialogueParagraph }}>
 */
export function DialogueParagraph({ children, ...props }: any) {
  return <p {...props}>{processChildren(children)}</p>;
}

/**
 * Helper for user messages: renders text with dialogue highlights as React elements.
 * Used outside of Markdown for plain-text user messages.
 */
export function renderHighlightedText(text: string): React.ReactNode[] {
  const regex = /(\u201c[^\u201d]*\u201d|"[^"]*")/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <span key={match.index} className="msg-dialogue">
        {match[0]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}
