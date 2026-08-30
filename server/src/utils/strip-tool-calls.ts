/**
 * حذف tool call‌هایی که مدل به صورت متن در content برگردانده
 * (وقتی مدل به جای OpenAI tool_call format، tool call رو به صورت متن ساده برمیگردونه)
 */
export function stripToolCallsFromContent(text: string): string {
  if (!text) return text;
  let result = text;

  // 1. <invoke>...</tool_call> (with any content including nested XML)
  result = result.replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '');

  // 2. Escaped variants (backslash-escaped tags)
  result = result.replace(/\\<tool_call\\?>[\s\S]*?<\/tool_call>/gi, '');

  // 3. <function=name>...</function> blocks
  result = result.replace(/<function=\w+>[\s\S]*?<\/function>/gi, '');

  // 4. update_story_state({...}) — function call syntax with balanced braces
  const funcRegex = /update_story_state\s*\(\s*\{/g;
  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = funcRegex.exec(result)) !== null) {
    let depth = 0;
    let i = result.indexOf('{', m.index);
    let end = -1;
    while (i < result.length) {
      if (result[i] === '{') depth++;
      else if (result[i] === '}') {
        depth--;
        if (depth === 0) { end = i; break; }
      }
      i++;
    }
    if (end >= 0) {
      out += result.slice(last, m.index);
      last = end + 1;
    }
  }
  out += result.slice(last);
  result = out;

  // 5. <|tool_call_begin|>...<|tool_call_end|> format
  result = result.replace(/<\|tool_call_begin\|>[\s\S]*?<\|tool_call_end\|>/gi, '');

  // 6. Clean up excessive blank lines
  result = result.replace(/\n{3,}/g, '\n\n').trim();

  return result;
}
