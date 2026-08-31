import { useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

export interface ToolCallData {
  id: string;
  name: string;
  arguments: Record<string, any>;
  raw_arguments?: string;
}

interface ToolCallCardProps {
  toolCall: ToolCallData;
  onApprove: (toolName: string, args: Record<string, any>) => void;
  onReject: () => void;
  onInsert?: (args: Record<string, any>) => void;
  isExecuting?: boolean;
  result?: { success: boolean; message: string } | null;
}

const TOOL_LABELS: Record<string, { icon: string; label: string; description: string }> = {
  create_lorebook: { icon: '📚', label: 'ساخت لوربوک', description: 'ایجاد یک لوربوک جدید با entries' },
  add_lorebook_entries: { icon: '➕', label: 'افزودن Entry به لوربوک', description: 'اضافه کردن entries جدید به لوربوک موجود' },
  update_lorebook_entry: { icon: '✏️', label: 'ویرایش Entry لوربوک', description: 'تغییر محتوای یک entry موجود' },
  create_character: { icon: '👤', label: 'ساخت کاراکتر', description: 'ایجاد یک کاراکتر جدید' },
  update_character: { icon: '🔄', label: 'ویرایش کاراکتر', description: 'تغییر اطلاعات کاراکتر موجود' },
  generate_character_message: {
    icon: '🎭',
    label: 'تولید پیام کاراکتر',
    description: 'تولید یک پیام از طرف کاراکتر بر اساس دستورالعمل'
  },
};

function formatArguments(name: string, args: Record<string, any>): { label: string; value: string }[] {
  const items: { label: string; value: string }[] = [];

  if (name === 'create_lorebook') {
    if (args.name) items.push({ label: 'نام', value: args.name });
    if (args.entries?.length) {
      items.push({ label: 'تعداد Entries', value: `${args.entries.length} مورد` });
      args.entries.forEach((entry: any, i: number) => {
        const keys = Array.isArray(entry.keys) ? entry.keys.join(', ') : entry.key || '-';
        items.push({ label: `Entry ${i + 1} - کلمات کلیدی`, value: keys });
        items.push({ label: `Entry ${i + 1} - محتوا`, value: (entry.content || '-').slice(0, 200) + (entry.content?.length > 200 ? '...' : '') });
      });
    }
  } else if (name === 'add_lorebook_entries') {
    if (args.lorebook_id) items.push({ label: 'شناسه لوربوک', value: args.lorebook_id });
    if (args.entries?.length) {
      items.push({ label: 'تعداد Entries', value: `${args.entries.length} مورد` });
      args.entries.forEach((entry: any, i: number) => {
        const keys = Array.isArray(entry.keys) ? entry.keys.join(', ') : entry.key || '-';
        items.push({ label: `Entry ${i + 1} - کلمات کلیدی`, value: keys });
        items.push({ label: `Entry ${i + 1} - محتوا`, value: (entry.content || '-').slice(0, 200) + (entry.content?.length > 200 ? '...' : '') });
      });
    }
  } else if (name === 'update_lorebook_entry') {
    if (args.entry_id) items.push({ label: 'شناسه Entry', value: args.entry_id });
    if (args.keys) {
      const keys = Array.isArray(args.keys) ? args.keys.join(', ') : args.keys;
      items.push({ label: 'کلمات کلیدی جدید', value: keys });
    }
    if (args.content) items.push({ label: 'محتوای جدید', value: args.content.slice(0, 200) + (args.content.length > 200 ? '...' : '') });
    if (args.disable !== undefined) items.push({ label: 'وضعیت', value: args.disable ? 'غیرفعال' : 'فعال' });
  } else if (name === 'create_character') {
    if (args.name) items.push({ label: 'نام', value: args.name });
    if (args.description) items.push({ label: 'توضیحات ظاهری', value: (args.description || '-').slice(0, 200) + (args.description?.length > 200 ? '...' : '') });
    if (args.personality) items.push({ label: 'شخصیت', value: (args.personality || '-').slice(0, 200) + (args.personality?.length > 200 ? '...' : '') });
    if (args.scenario) items.push({ label: 'سناریو', value: (args.scenario || '-').slice(0, 200) + (args.scenario?.length > 200 ? '...' : '') });
    if (args.first_mes) items.push({ label: 'پیام اول', value: (args.first_mes || '-').slice(0, 200) + (args.first_mes?.length > 200 ? '...' : '') });
  } else if (name === 'update_character') {
    if (args.character_id) items.push({ label: 'شناسه کاراکتر', value: args.character_id });
    if (args.name) items.push({ label: 'نام جدید', value: args.name });
    if (args.description) items.push({ label: 'توضیحات ظاهری', value: args.description.slice(0, 200) + (args.description.length > 200 ? '...' : '') });
    if (args.personality) items.push({ label: 'شخصیت', value: args.personality.slice(0, 200) + (args.personality.length > 200 ? '...' : '') });
  } else if (name === 'generate_character_message') {
    if (args.character_id) items.push({ label: 'شناسه کاراکتر', value: args.character_id });
    if (args.instruction) items.push({ label: 'دستورالعمل', value: args.instruction });
    if (args.generated_content) items.push({ label: 'پیام تولید شده', value: '✅ نمایش در زیر' });
  }

  // Fallback: show all args if no specific handling
  if (items.length === 0) {
    for (const [key, value] of Object.entries(args)) {
      const strValue = typeof value === 'string' ? value : JSON.stringify(value);
      items.push({ label: key, value: strValue.slice(0, 200) + (strValue.length > 200 ? '...' : '') });
    }
  }

  return items;
}

export default function ToolCallCard({ toolCall, onApprove, onReject, onInsert, isExecuting, result }: ToolCallCardProps) {
  const [showRaw, setShowRaw] = useState(false);
  const toolInfo = TOOL_LABELS[toolCall.name] || { icon: '🔧', label: toolCall.name, description: '' };
  const argItems = formatArguments(toolCall.name, toolCall.arguments);

  return (
    <div className={`rounded-xl border transition-all duration-200 ${
      result?.success ? 'border-green-500/30 bg-green-500/5' :
      result && !result.success ? 'border-red-500/30 bg-red-500/5' :
      'border-tavern-accent/30 bg-tavern-accent/5'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-tavern-border/30">
        <div className="flex items-center gap-2">
          <span className="text-lg">{toolInfo.icon}</span>
          <div>
            <span className="text-xs font-semibold text-tavern-text">{toolInfo.label}</span>
            {toolInfo.description && (
              <p className="text-[10px] text-tavern-dim">{toolInfo.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="text-[10px] text-tavern-faint hover:text-tavern-dim px-1.5 py-0.5 rounded hover:bg-tavern-hover transition-colors"
          >
            {showRaw ? 'ساده' : 'JSON'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-3 py-2">
        {showRaw ? (
          <pre className="text-[10px] text-tavern-dim bg-tavern-input rounded-lg p-2 overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap">
            {JSON.stringify(toolCall.arguments, null, 2)}
          </pre>
        ) : (
          <div className="space-y-1.5">
            {argItems.map((item, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-[10px] text-tavern-faint min-w-[100px] shrink-0">{item.label}:</span>
                <span className="text-[10px] text-tavern-text break-words">{item.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Generated Message Preview (for generate_character_message) */}
      {!showRaw && toolCall.arguments.generated_content && (
        <div className="mt-3 border-t border-tavern-border/30 pt-3">
          <p className="text-[10px] text-tavern-faint mb-2">پیام تولید شده:</p>
          <div className="bg-tavern-input rounded-lg p-3 border border-tavern-border/50">
            <div dir="auto" className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-pre:bg-tavern-bg prose-pre:border prose-pre:border-tavern-border leading-relaxed text-xs">
              <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                {toolCall.arguments.generated_content}
              </Markdown>
            </div>
          </div>
        </div>
      )}

      {/* Result (if executed) */}
      {result && (
        <div className={`px-3 py-2 border-t border-tavern-border/30 text-[10px] ${
          result.success ? 'text-green-400' : 'text-red-400'
        }`}>
          {result.message}
        </div>
      )}

      {/* Actions */}
      {!result && !isExecuting && (
        <div className="flex items-center gap-2 px-3 py-2 border-t border-tavern-border/30">
          <button
            onClick={() => onApprove(toolCall.name, toolCall.arguments)}
            className="flex-1 py-1.5 bg-green-500/10 border border-green-500/30 rounded-lg text-[10px] text-green-400 hover:bg-green-500/20 transition-colors font-medium"
          >
            ✅ تایید و اجرا
          </button>
          <button
            onClick={onReject}
            className="flex-1 py-1.5 bg-red-500/10 border border-red-500/30 rounded-lg text-[10px] text-red-400 hover:bg-red-500/20 transition-colors font-medium"
          >
            ❌ رد
          </button>
        </div>
      )}

      {/* Insert button for generated messages */}
      {!result && !isExecuting && toolCall.arguments.generated_content && onInsert && (
        <div className="flex items-center gap-2 px-3 py-2 border-t border-tavern-border/30">
          <button
            onClick={() => onInsert(toolCall.arguments)}
            className="flex-1 py-1.5 bg-green-500/10 border border-green-500/30 rounded-lg text-[10px] text-green-400 hover:bg-green-500/20 transition-colors font-medium"
          >
            ✅ درج در چت
          </button>
          <button
            onClick={onReject}
            className="flex-1 py-1.5 bg-red-500/10 border border-red-500/30 rounded-lg text-[10px] text-red-400 hover:bg-red-500/20 transition-colors font-medium"
          >
            ❌ رد
          </button>
        </div>
      )}

      {/* Loading */}
      {isExecuting && (
        <div className="px-3 py-2 border-t border-tavern-border/30 flex items-center gap-2">
          <div className="w-3 h-3 border border-tavern-accent/30 border-t-tavern-accent rounded-full animate-spin" />
          <span className="text-[10px] text-tavern-dim">در حال اجرا...</span>
        </div>
      )}
    </div>
  );
}
