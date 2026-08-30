/**
 * Parse tool calls from text content.
 *
 * When a model outputs tool calls as text (instead of using the proper
 * OpenAI tool_call streaming format), this module extracts them and
 * returns structured tool call objects for processing.
 *
 * Supports:
 * - update_story_state({...}) function call syntax
 * - JSON code blocks with function call
 * - <invoke name="update_story_state"> with <parameter> children
 * - <function=update_story_state> with <parameter> children
 * - <tool_call> wrapping function/parameter tags
 * - Nested JSON objects (balanced brace matching)
 */

function extractBalancedJson(source: string, startIdx: number): string | null {
  if (source[startIdx] !== '{') return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = startIdx; i < source.length; i++) {
    const ch = source[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return source.slice(startIdx, i + 1); }
  }
  return null;
}

function makeToolCall(args: Record<string, any>) {
  return {
    id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'function',
    function: {
      name: 'update_story_state',
      arguments: JSON.stringify(args),
    },
  };
}

function extractParameters(block: string): Record<string, any> {
  const args: Record<string, any> = {};
  const paramRegex = /<parameter\s+name\s*=\s*"(\w+)"\s*>([\s\S]*?)<\/parameter>/gi;
  let m: RegExpExecArray | null;
  while ((m = paramRegex.exec(block)) !== null) {
    const key = m[1];
    let val: any = m[2].trim();
    try { val = JSON.parse(val); } catch {}
    args[key] = val;
  }
  return args;
}

export function parseToolCallsFromText(text: string): any[] {
  const toolCalls: any[] = [];

  // Pattern 1: update_story_state({...}) function call syntax
  const funcCallRegex = /update_story_state\s*\(\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = funcCallRegex.exec(text)) !== null) {
    const braceIdx = text.indexOf('{', match.index);
    const jsonStr = extractBalancedJson(text, braceIdx);
    if (jsonStr) {
      try {
        toolCalls.push(makeToolCall(JSON.parse(jsonStr)));
      } catch (e) {
        console.log('[StoryState] Failed to parse tool call (func call):', e);
      }
    }
  }

  // Pattern 2: JSON code block with function call
  const jsonBlockRegex = /```json\s*\{\s*"name"\s*:\s*"update_story_state"[\s\S]*?"arguments"\s*:\s*\{/gi;
  while ((match = jsonBlockRegex.exec(text)) !== null) {
    const argsStart = text.lastIndexOf('{', match.index + match[0].length);
    if (argsStart < 0) continue;
    const jsonStr = extractBalancedJson(text, argsStart);
    if (jsonStr) {
      try {
        toolCalls.push(makeToolCall(JSON.parse(jsonStr)));
      } catch (e) {
        console.log('[StoryState] Failed to parse tool call (json block):', e);
      }
    }
  }

  // Pattern 3: <invoke name="update_story_state"> or <antml:invoke> with <parameter> children
  const invokeRegex = /<(?:antml:)?invoke\s+name\s*=\s*"update_story_state"\s*>/gi;
  while ((match = invokeRegex.exec(text)) !== null) {
    const closeTag1 = text.indexOf('</invoke>', match.index);
    const closeTag2 = text.indexOf('</antml:invoke>', match.index);
    const endIdx = closeTag1 >= 0 ? closeTag1 : closeTag2;
    if (endIdx < 0) continue;
    const block = text.slice(match.index, endIdx);
    const args = extractParameters(block);
    if (Object.keys(args).length > 0) toolCalls.push(makeToolCall(args));
  }

  // Pattern 4: <function=update_story_state> with <parameter> children
  const funcTagRegex = /<function=update_story_state\s*>/gi;
  while ((match = funcTagRegex.exec(text)) !== null) {
    const closeTag = text.indexOf('</function>', match.index);
    if (closeTag < 0) continue;
    const block = text.slice(match.index, closeTag);
    const args = extractParameters(block);
    if (Object.keys(args).length > 0) toolCalls.push(makeToolCall(args));
  }

  // Pattern 5: <tool_call> wrapping <function=update_story_state> with <parameter> children
  const tcRegex = /<tool_call>[\s\S]*?<function=update_story_state\s*>([\s\S]*?)<\/function>[\s\S]*?<\/tool_call>/gi;
  while ((match = tcRegex.exec(text)) !== null) {
    const args = extractParameters(match[1]);
    if (Object.keys(args).length > 0) toolCalls.push(makeToolCall(args));
  }

  // Deduplicate by arguments
  const seen = new Set<string>();
  return toolCalls.filter(tc => {
    const key = tc.function.arguments;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
