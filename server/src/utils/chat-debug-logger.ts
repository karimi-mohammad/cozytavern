/**
 * Chat Debug Logger — Two-Phase Flow Tracing
 *
 * Usage: همه لاگ‌ها با prefix `[CHAT-DEBUG]` شروع میشن تا راحت filتر بشن.
 * برای فعال/غیرفعال کردن: متغیر محیطی DEBUG_CHAT=true
 *
 * فرمت خروجی:
 *   [CHAT-DEBUG] [timestamp] [requestId] [phase] message  {optional data}
 */

const DEBUG_ENABLED = process.env.DEBUG_CHAT === 'true' || process.env.DEBUG_CHAT === '1';

export interface ChatDebugContext {
  requestId: string;
  chatId?: string;
  characterId?: string;
  twoPhaseEnabled: boolean;
  streamEnabled: boolean;
}

function ts(): string {
  return new Date().toISOString();
}

function formatMsg(ctx: ChatDebugContext, phase: string, msg: string, data?: any): string {
  const base = `[CHAT-DEBUG] [${ts()}] [${ctx.requestId}] [${phase}]`;
  const ids = ctx.chatId ? ` chat=${ctx.chatId.slice(0, 8)}` : '';
  const d = data !== undefined ? ` ${typeof data === 'string' ? data : JSON.stringify(data).slice(0, 500)}` : '';
  return `${base}${ids} ${msg}${d}`;
}

export function createChatDebugger(ctx: ChatDebugContext) {
  return {
    /** فاز اول — شروع درخواست */
    start() {
      if (!DEBUG_ENABLED) return;
      console.log(formatMsg(ctx, 'START', `New chat request — twoPhase=${ctx.twoPhaseEnabled} stream=${ctx.streamEnabled}`));
    },

    /** پارامترهای ورودی */
    params(data: Record<string, any>) {
      if (!DEBUG_ENABLED) return;
      console.log(formatMsg(ctx, 'PARAMS', '', data));
    },

    /** Phase 1 — ارسال درخواست به LLM */
    phase1Request(endpoint: string, bodyPreview: string) {
      if (!DEBUG_ENABLED) return;
      console.log(formatMsg(ctx, 'PHASE1', `→ Sending to LLM: ${endpoint}`));
      console.log(formatMsg(ctx, 'PHASE1', `  body preview: ${bodyPreview.slice(0, 300)}`));
    },

    /** Phase 1 — دریافت پاسخ */
    phase1Response(status: number, ok: boolean) {
      if (!DEBUG_ENABLED) return;
      console.log(formatMsg(ctx, 'PHASE1', `← Response status=${status} ok=${ok}`));
    },

    /** Phase 1 streaming — شروع */
    streamStart() {
      if (!DEBUG_ENABLED) return;
      console.log(formatMsg(ctx, 'STREAM', '▶ Stream reading started'));
    },

    /** Phase 1 streaming — هر چانک */
    streamChunk(chunkNum: number, data: string, toolCallsCount: number) {
      if (!DEBUG_ENABLED) return;
      console.log(formatMsg(ctx, 'STREAM', `  chunk#${chunkNum} toolCalls=${toolCallsCount} data=${data.slice(0, 200)}`));
    },

    /** Phase 1 streaming — پایان */
    streamEnd(fullContentLength: number, toolCallsCount: number, aborted: boolean) {
      if (!DEBUG_ENABLED) return;
      console.log(formatMsg(ctx, 'STREAM', `⏹ Stream ended — contentLen=${fullContentLength} toolCalls=${toolCallsCount} aborted=${aborted}`));
    },

    /** Phase 1 streaming — tool call detected */
    toolCallDetected(index: number, name: string, argsPreview: string) {
      if (!DEBUG_ENABLED) return;
      console.log(formatMsg(ctx, 'PHASE1', `🔧 Tool call [${index}]: ${name} args=${argsPreview.slice(0, 200)}`));
    },

    /** Phase 2 — تصمیم‌گیری */
    phase2Decision(shouldRun: boolean, reason: string) {
      if (!DEBUG_ENABLED) return;
      console.log(formatMsg(ctx, 'PHASE2', `${shouldRun ? '✅' : '⏭'} Phase 2 decision: ${reason}`));
    },

    /** Phase 2 — شروع درخواست */
    phase2RequestStart(endpoint: string) {
      if (!DEBUG_ENABLED) return;
      console.log(formatMsg(ctx, 'PHASE2', `→ Sending extraction request to: ${endpoint}`));
    },

    /** Phase 2 — دریافت پاسخ */
    phase2Response(status: number, ok: boolean) {
      if (!DEBUG_ENABLED) return;
      console.log(formatMsg(ctx, 'PHASE2', `← Phase 2 response status=${status} ok=${ok}`));
    },

    /** Phase 2 — پاسخ خام */
    phase2RawResponse(content: string) {
      if (!DEBUG_ENABLED) return;
      console.log(formatMsg(ctx, 'PHASE2', `  raw response: ${content.slice(0, 400)}`));
    },

    /** Phase 2 — بعد از پارس JSON */
    phase2Parsed(toolCallsCount: number, method: string) {
      if (!DEBUG_ENABLED) return;
      console.log(formatMsg(ctx, 'PHASE2', `📋 Parsed: ${toolCallsCount} tool calls via ${method}`));
    },

    /** Phase 2 — خطا */
    phase2Error(error: any) {
      if (!DEBUG_ENABLED) return;
      console.error(formatMsg(ctx, 'PHASE2', `❌ Phase 2 error: ${error?.message || error}`));
    },

    /** Phase 2 — timeout */
    phase2Timeout(ms: number) {
      if (!DEBUG_ENABLED) return;
      console.warn(formatMsg(ctx, 'PHASE2', `⏰ Phase 2 timeout after ${ms}ms`));
    },

    /** ذخیره state */
    stateUpdate(method: string, statePreview: string) {
      if (!DEBUG_ENABLED) return;
      console.log(formatMsg(ctx, 'STATE', `💾 State updated via ${method}: ${statePreview.slice(0, 300)}`));
    },

    /** ارسال SSE event به کلاینت */
    sseEvent(eventType: string, dataPreview: string) {
      if (!DEBUG_ENABLED) return;
      console.log(formatMsg(ctx, 'SSE', `📤 Sending SSE: ${eventType} — ${dataPreview.slice(0, 200)}`));
    },

    /** ارسال DONE */
    done(aborted: boolean) {
      if (!DEBUG_ENABLED) return;
      console.log(formatMsg(ctx, 'DONE', `${aborted ? '🚫 ABORTED (no DONE sent)' : '🏁 [DONE] sent → res.end()'}`));
    },

    /** خطا در مسیر اصلی */
    error(phase: string, error: any) {
      if (!DEBUG_ENABLED) return;
      console.error(formatMsg(ctx, 'ERROR', `❌ Error in ${phase}: ${error?.message || error}`));
      if (error?.stack) {
        console.error(formatMsg(ctx, 'ERROR', `  stack: ${error.stack.split('\n').slice(0, 3).join(' | ')}`));
      }
    },

    /** Res lifecycle */
    resLifecycle(event: string, details?: string) {
      if (!DEBUG_ENABLED) return;
      console.log(formatMsg(ctx, 'RES', `🔗 res.${event}${details ? ': ' + details : ''}`));
    },

    /** فاز اول — پیام ذخیره شد */
    messageSaved(msgId: string, role: string, contentLen: number) {
      if (!DEBUG_ENABLED) return;
      console.log(formatMsg(ctx, 'DB', `📝 Message saved: id=${msgId.slice(0, 8)} role=${role} contentLen=${contentLen}`));
    },

    /** خلاصه کل فلو */
    summary(data: Record<string, any>) {
      if (!DEBUG_ENABLED) return;
      console.log(formatMsg(ctx, 'SUMMARY', '══════════════════════════════════'));
      console.log(formatMsg(ctx, 'SUMMARY', JSON.stringify(data, null, 2)));
      console.log(formatMsg(ctx, 'SUMMARY', '══════════════════════════════════'));
    },
  };
}

export type ChatDebugger = ReturnType<typeof createChatDebugger>;
