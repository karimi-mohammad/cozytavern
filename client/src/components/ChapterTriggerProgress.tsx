import { useState } from 'react';
import { useStore } from '../store/state';

/**
 * نمایش پیشرفت تریگر خودکار فصل
 * نشان می‌دهد از آخرین فصل چند پیام رد شده و فاصله از هر تریگر چقدر است
 * قابلیت collapse/expand برای صرفه‌جویی در فضا
 */
export default function ChapterTriggerProgress() {
  const [expanded, setExpanded] = useState(false);
  const currentChat = useStore(s => s.currentChat);
  const chapters = useStore(s => s.chapters);
  const chapterSettings = useStore(s => s.chapterSettings);
  const chapterSuggestion = useStore(s => s.chapterSuggestion);

  if (!currentChat || !chapterSettings || !chapterSettings.auto_detect_enabled) return null;

  const messages = currentChat.messages;
  if (messages.length === 0) return null;

  // پیدا کردن شروع اسکن: بعد از آخرین فصل
  let scanStartIndex = 0;
  let lastChapterEndIndex = -1;
  const lastChapter = chapters.length > 0 ? chapters[chapters.length - 1] : null;

  if (lastChapter) {
    if (lastChapter.trigger_message_id) {
      const triggerIndex = messages.findIndex(m => m.id === lastChapter.trigger_message_id);
      if (triggerIndex !== -1) {
        scanStartIndex = triggerIndex + 1;
        lastChapterEndIndex = triggerIndex;
      }
    } else {
      const lastEndIdx = messages.findIndex(m => m.id === lastChapter.end_message_id);
      if (lastEndIdx !== -1) {
        scanStartIndex = lastEndIdx + 2;
        lastChapterEndIndex = lastEndIdx;
      }
    }
  }

  // فاصله از آخرین چپتر (تعداد پیام بعد از آخرین چپتر)
  const lastChapterDistance = lastChapterEndIndex !== -1
    ? messages.length - 1 - lastChapterEndIndex
    : messages.length;

  const rawWindow = chapterSettings.raw_window || 10;
  const progress = Math.min(1, lastChapterDistance / rawWindow);
  const isReady = lastChapterDistance >= rawWindow;
  const remaining = Math.max(0, rawWindow - lastChapterDistance);

  // اگر تریگری فعال باشد، نمایش نده (چون ChapterSuggestion نمایش داده می‌شود)
  if (chapterSuggestion) return null;

  // اگر هیچ تریگری تنظیم نشده، نمایش نده
  const triggerPhrases = chapterSettings.trigger_phrases || [];
  if (triggerPhrases.length === 0) return null;

  // ساخت مجموعه ایندکس‌هایی که داخل فصل‌ها هستند
  const chapterMessageIndices = new Set<number>();
  for (const ch of chapters) {
    const startIdx = messages.findIndex(m => m.id === ch.start_message_id);
    const endIdx = messages.findIndex(m => m.id === ch.end_message_id);
    if (startIdx !== -1 && endIdx !== -1) {
      for (let i = startIdx; i <= endIdx; i++) {
        chapterMessageIndices.add(i);
      }
    }
  }

  // پیدا کردن تمام پیام‌های تریگر در تمام چت
  const allTriggerMatches: {
    msgIndex: number;
    phrase: string;
    distance: number;
    isInChapter: boolean;
    isActive: boolean;
  }[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg.content) continue;
    for (const phrase of triggerPhrases) {
      if (msg.content.toLowerCase().includes(phrase.toLowerCase())) {
        const isInChapter = chapterMessageIndices.has(i);
        // تریگر فعال فقط وقتی هست که: بعد از آخرین فصل باشه AND داخل هیچ فصلی نباشه
        const isActive = !isInChapter && i >= scanStartIndex;

        allTriggerMatches.push({
          msgIndex: i,
          phrase,
          distance: messages.length - 1 - i,
          isInChapter,
          isActive,
        });
        break; // فقط یک تریگر به ازای هر پیام
      }
    }
  }

  // فقط تریگرهای فعال (نه داخل فصل، و بعد از آخرین فصل)
  const activeTriggers = allTriggerMatches.filter(t => t.isActive);
  const hasTriggerInScan = activeTriggers.length > 0;

  // تعداد آیتم‌ها برای نمایش در حالت collapsed
  const triggerCount = allTriggerMatches.length;
  const activeTriggerCount = activeTriggers.length;
  const inChapterTriggerCount = allTriggerMatches.filter(t => t.isInChapter).length;

  return (
    <div className="my-2 mx-4">
      <div className={`rounded-lg border text-xs transition-all ${
        isReady
          ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
          : hasTriggerInScan
            ? 'bg-amber-500/10 border-amber-500/25 text-amber-400'
            : 'bg-tavern-input border-tavern-border text-tavern-dim'
      }`}>
        {/* ─── Header (always visible) ─── */}
        <div
          className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-tavern-hover/30 transition-colors rounded-t-lg"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-2">
            {/* Collapse/Expand icon */}
            <svg
              className={`w-3 h-3 flex-shrink-0 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <svg className="w-3 h-3 flex-shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="font-medium text-[11px]">
              {isReady
                ? 'Auto-trigger ready'
                : hasTriggerInScan
                  ? 'Trigger detected'
                  : 'Auto-trigger scanning'}
            </span>
            {/* Compact info badges */}
            {!expanded && (
              <div className="flex items-center gap-1.5">
                {lastChapter && (
                  <span className="px-1.5 py-0.5 rounded bg-tavern-border/20 text-[9px] font-mono opacity-70">
                    {lastChapterDistance} msgs since chapter
                  </span>
                )}
                {triggerCount > 0 && (
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${
                    activeTriggerCount > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-tavern-border/20 opacity-70'
                  }`}>
                    {triggerCount} trigger{triggerCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] opacity-70">
              {lastChapterDistance}/{rawWindow}
            </span>
            {/* Progress bar mini */}
            <div className="w-16 h-1 bg-tavern-border/30 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isReady ? 'bg-emerald-500' : hasTriggerInScan ? 'bg-amber-500' : 'bg-tavern-accent'
                }`}
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* ─── Expanded Content ─── */}
        {expanded && (
          <div className="px-3 pb-3 space-y-3 animate-fade-in">
            {/* Status text */}
            <div className="text-[10px] opacity-70">
              {isReady
                ? 'Trigger detection active — new triggers will suggest chapters'
                : hasTriggerInScan
                  ? `Trigger found! ${remaining} more message${remaining !== 1 ? 's' : ''} needed for context`
                  : `${remaining} more message${remaining !== 1 ? 's' : ''} until trigger detection activates`}
            </div>

            {/* Last Chapter Distance */}
            {lastChapter && (
              <div className="flex items-center gap-1.5 text-[10px]">
                <svg className="w-2.5 h-2.5 flex-shrink-0 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span className="opacity-60">Last chapter:</span>
                <span className="font-mono font-medium text-tavern-text">
                  {lastChapter.title || `Chapter ${chapters.indexOf(lastChapter) + 1}`}
                </span>
                <span className="opacity-50 mx-0.5">—</span>
                <span className={`font-mono ${lastChapterDistance >= rawWindow ? 'text-emerald-400' : 'text-tavern-text'}`}>
                  {lastChapterDistance} msgs ago
                </span>
              </div>
            )}

            {/* All Trigger Messages with Distance */}
            {allTriggerMatches.length > 0 && (
              <div>
                <div className="text-[10px] opacity-60 mb-1.5">
                  Trigger phrases in chat:
                  {inChapterTriggerCount > 0 && (
                    <span className="ml-1 opacity-50">({inChapterTriggerCount} in chapters)</span>
                  )}
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {allTriggerMatches.map((trigger, i) => (
                    <div
                      key={`trigger-${trigger.msgIndex}-${i}`}
                      className={`flex items-center gap-1.5 text-[10px] px-2 py-1 rounded ${
                        trigger.isActive
                          ? 'bg-amber-500/10 text-amber-400'
                          : trigger.isInChapter
                            ? 'bg-tavern-surface/50 text-tavern-dim opacity-60'
                            : 'bg-tavern-surface/50 text-tavern-dim'
                      }`}
                    >
                      <svg className="w-2 h-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253" />
                      </svg>
                      <span className="font-mono opacity-70">"{trigger.phrase}"</span>
                      <span className="opacity-50 mx-0.5">—</span>
                      <span className={`font-mono font-medium ${trigger.isActive ? 'text-amber-400' : 'text-tavern-text'}`}>
                        msg #{trigger.msgIndex + 1}
                      </span>
                      <span className="opacity-40 mx-0.5">•</span>
                      <span className="font-mono opacity-70">
                        {trigger.distance} msgs ago
                      </span>
                      {trigger.isActive && (
                        <span className="ml-auto px-1 py-0.5 rounded bg-amber-500/20 text-[9px] font-medium">
                          ACTIVE
                        </span>
                      )}
                      {trigger.isInChapter && (
                        <span className="ml-auto px-1 py-0.5 rounded bg-tavern-accent/20 text-[9px] font-medium text-tavern-accent">
                          IN CHAPTER
                        </span>
                      )}
                      {!trigger.isActive && !trigger.isInChapter && (
                        <span className="ml-auto px-1 py-0.5 rounded bg-tavern-border/30 text-[9px] opacity-50">
                          PASSED
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No triggers found */}
            {allTriggerMatches.length === 0 && triggerPhrases.length > 0 && (
              <div>
                <div className="text-[10px] opacity-50 flex items-center gap-1.5">
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span>No trigger phrases found in {messages.length} messages</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {triggerPhrases.map((phrase, i) => (
                    <span key={`${phrase}-${i}`} className="px-1.5 py-0.5 rounded bg-tavern-border/20 text-[10px] opacity-50 font-mono">
                      "{phrase}"
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
