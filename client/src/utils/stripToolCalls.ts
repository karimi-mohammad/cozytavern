/**
 * Strip tool call text artifacts from assistant message content.
 *
 * Some models output tool calls as text in the content instead of using
 * the proper OpenAI tool_call streaming format. These artifacts get
 * accumulated into the message content and displayed in the UI.
 * This function removes them before rendering or saving.
 *
 * Handles:
 * - <antml:invoke name="...">...</antml:invoke> blocks
 * - ```` blocks
 * - <function=name>...</function> blocks
 * - update_story_state({...}) function call syntax
 * - <|tool_call_begin|>...<|tool_call_end|> format
 * - Escaped variants (backslash-prefixed tags)
 */
export function stripToolCalls(text: string): string {
  if (!text) return text;

  let result = text;

  // 1. <antml:invoke> blocks (Anthropic-style tool use rendered as text)
  result = result.replace(/<antml:invoke[^>]*>[\s\S]*?<\/antml:invoke>/gi, '');

  // 2. <tool_call>...</tool_call> (greedy, multiline)
  result = result.replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '');

  // 3. Escaped variants (backslash-escaped tags)
  result = result.replace(/\\<tool_call\\?>[\s\S]*?<\/tool_call>/gi, '');

  // 4. <function=name>...</function> blocks
  result = result.replace(/<function=\w+>[\s\S]*?<\/function>/gi, '');

  // 5. update_story_state({...}) — function call syntax with balanced braces
  result = stripFunctionCalls(result);

  // 6. <|tool_call_begin|>...<|tool_call_end|> format (DeepSeek-style)
  result = result.replace(/<\|tool_call_begin\|>[\s\S]*?<\|tool_call_end\|>/gi, '');

  // 7. [TOOL_CALL]... format
  result = result.replace(/\[TOOL_CALL\][\s\S]*/gi, '');

  // Clean up excessive blank lines left behind
  result = result.replace(/\n{3,}/g, '\n\n').trim();

  return result;
}

/**
 * Strip update_story_state({...}) function call syntax with balanced brace matching.
 */
function stripFunctionCalls(text: string): string {
  const funcCallRegex = /(?:<function=\w+>|update_story_state\s*\(\s*)\{/g;
  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = funcCallRegex.exec(text)) !== null) {
    const openBraceIdx = match[0].lastIndexOf('{');
    const searchFrom = match.index + openBraceIdx;
    let braceCount = 0;
    let i = searchFrom;
    let foundEnd = false;

    while (i < text.length) {
      if (text[i] === '{') braceCount++;
      else if (text[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          foundEnd = true;
          break;
        }
      }
      i++;
    }

    if (foundEnd) {
      result += text.slice(lastIndex, match.index);
      lastIndex = i + 1;
    }
  }

  result += text.slice(lastIndex);
  return result;
}
