import { useState, useCallback } from 'react';
import type { ReactNode } from 'react';

interface CodeBlockProps {
  children: ReactNode;
  className?: string;
  inline?: boolean;
}

export default function CodeBlock({ children, className, inline }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const text = typeof children === 'string' ? children : String(children);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [children]);

  // Inline code (no backticks wrapper, small)
  if (inline || (!className && typeof children === 'string' && !children.includes('\n'))) {
    return (
      <code className="px-1.5 py-0.5 bg-tavern-input/80 border border-tavern-border/50 rounded text-tavern-accent font-mono text-[13px]">
        {children}
      </code>
    );
  }

  // Code block with header
  const langMatch = className?.match(/language-(\w+)/);
  const language = langMatch ? langMatch[1] : '';

  return (
    <div className="relative group my-2 rounded-lg border border-tavern-border/50 overflow-hidden bg-tavern-bg">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-tavern-surface2/80 border-b border-tavern-border/50">
        <span className="text-[11px] text-tavern-dim font-mono uppercase tracking-wider">
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] text-tavern-dim hover:text-tavern-accent transition-colors px-2 py-0.5 rounded hover:bg-tavern-hover"
          title="Copy code"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      {/* Code content */}
      <pre className="p-3 overflow-x-auto bg-tavern-bg">
        <code className={`${className || ''} text-[13px] leading-relaxed`}>
          {children}
        </code>
      </pre>
    </div>
  );
}
