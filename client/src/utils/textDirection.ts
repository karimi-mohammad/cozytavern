/**
 * RTL/LTR text direction detection utility.
 * Detects if text is primarily RTL (Persian, Arabic, Hebrew, etc.) or LTR.
 */

// Unicode ranges for RTL scripts
const RTL_PATTERNS = [
  /[\u0600-\u06FF]/,   // Arabic
  /[\u0750-\u077F]/,   // Arabic Supplement
  /[\u08A0-\u08FF]/    // Arabic Extended-A
];

const LTR_PATTERNS = [
  /[a-zA-Z]/,          // Latin
  /[\u00C0-\u00FF]/,   // Latin Extended
  /[\u0400-\u04FF]/,   // Cyrillic
  /[\u3040-\u309F]/,   // Hiragana
  /[\u30A0-\u30FF]/,   // Katakana
  /[\u4E00-\u9FFF]/,   // CJK
];

/**
 * Detect if text is primarily RTL.
 * Returns true if the text has more RTL characters than LTR.
 */
export function isRTL(text: string): boolean {
  if (!text) return false;

  let rtlCount = 0;
  let ltrCount = 0;

  // Remove markdown formatting, code blocks, and URLs for cleaner detection
  const cleaned = text
    .replace(/```[\s\S]*?```/g, '')  // Remove code blocks
    .replace(/`[^`]+`/g, '')         // Remove inline code
    .replace(/https?:\/\/\S+/g, '')  // Remove URLs
    .replace(/[*_~#>\-|=]/g, '');    // Remove markdown formatting chars

  for (const char of cleaned) {
    if (char.trim() === '') continue;

    let isRtl = false;
    let isLtr = false;

    for (const pattern of RTL_PATTERNS) {
      if (pattern.test(char)) { isRtl = true; break; }
    }
    for (const pattern of LTR_PATTERNS) {
      if (pattern.test(char)) { isLtr = true; break; }
    }

    if (isRtl) rtlCount++;
    else if (isLtr) ltrCount++;
  }

  // If no script characters found, default to LTR
  if (rtlCount === 0 && ltrCount === 0) return false;

  return rtlCount > ltrCount;
}

/**
 * Get CSS direction classes for a given text.
 */
export function getTextDirectionClasses(text: string): string {
  return isRTL(text) ? 'text-right direction-rtl' : 'text-left direction-ltr';
}
