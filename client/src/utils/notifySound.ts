/**
 * Notification Sound — یک صدای کوتاه و ملایم برای هشدار پاسخ AI
 * از Web Audio API استفاده می‌کنه و نیازی به فایل صوتی نداره.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

/**
 * پخش صدای کوتاه "ding" ملایم
 * @param volume - میزان صدا 0 تا 1 (پیش‌فرض 0.25)
 */
export function playNotifySound(volume: number = 0.25): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // ── Oscillator 1: تُن اصلی ──
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);       // A5
    osc1.frequency.exponentialRampToValueAtTime(1100, now + 0.06); // slide up
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12);  // slide back

    // ── Oscillator 2: هارمونیک ملایم ──
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1320, now);      // E6 (fifth above)
    osc2.frequency.exponentialRampToValueAtTime(1480, now + 0.06);
    osc2.frequency.exponentialRampToValueAtTime(1320, now + 0.12);

    // ── Gain envelopes ──
    const gain1 = ctx.createGain();
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(volume * 0.7, now + 0.01);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0, now);
    gain2.gain.linearRampToValueAtTime(volume * 0.3, now + 0.01);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    // ── وصل کردن ──
    osc1.connect(gain1);
    osc2.connect(gain2);
    gain1.connect(ctx.destination);
    gain2.connect(ctx.destination);

    // ── پخش ──
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.3);
    osc2.stop(now + 0.25);
  } catch {
    // silently fail — Web Audio ممکنه blocked باشه
  }
}

/**
 * پخش صدای کوتاه برای شروع تولید (اختیاری)
 */
export function playStartSound(volume: number = 0.15): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(500, now + 0.08);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume * 0.5, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  } catch {}
}
