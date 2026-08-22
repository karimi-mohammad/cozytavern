import { PromptPart } from '../types';

const DEFAULT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

export function buildEndpoint(customUrl?: string): string {
  if (!customUrl || !customUrl.trim()) return DEFAULT_ENDPOINT;

  let url = customUrl.trim();
  if (url.endsWith('/')) url = url.slice(0, -1);

  // اگر قبلاً /chat/completions داره، تغییر نده
  if (url.includes('/chat/completions')) return url;

  // اگر با /v1 ختم میشه (مثلاً http://host/v1 یا http://host/v1/)
  if (url.endsWith('/v1')) {
    return url + '/chat/completions';
  }

  // اگر /v1/ داره ولی chat/completions نداره
  if (url.includes('/v1/')) {
    return url + '/chat/completions';
  }

  // فقط host — مسیر کامل اضافه کن
  return url + '/v1/chat/completions';
}

export function buildHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey && apiKey.trim()) {
    headers['Authorization'] = `Bearer ${apiKey.trim()}`;
  }
  return headers;
}

export function buildRequestBody(
  messages: PromptPart[],
  settings: {
    model: string;
    temperature: number;
    max_tokens: number;
    top_p: number;
    frequency_penalty: number;
    presence_penalty: number;
    stream: boolean;
    stop: string[];
  }
): string {
  const body: any = {
    model: settings.model,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    temperature: settings.temperature,
    max_tokens: settings.max_tokens,
    stream: settings.stream,
  };

  if (settings.top_p !== undefined && settings.top_p < 1) body.top_p = settings.top_p;
  if (settings.frequency_penalty) body.frequency_penalty = settings.frequency_penalty;
  if (settings.presence_penalty) body.presence_penalty = settings.presence_penalty;
  if (settings.stop && settings.stop.length > 0) body.stop = settings.stop;

  return JSON.stringify(body);
}

export function createLineBuffer() {
  let buffer = '';
  return {
    push(chunk: string): string[] {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      return lines;
    },
    flush(): string[] {
      const lines = buffer.split('\n');
      buffer = '';
      return lines;
    },
  };
}

export function parseStreamChunk(data: string): string | null {
  try {
    const parsed = JSON.parse(data);
    // OpenAI-compatible streaming
    if (parsed.choices?.[0]?.delta?.content) {
      return parsed.choices[0].delta.content;
    }
    // DeepSeek/mimo style: reasoning tokens in stream
    if (parsed.choices?.[0]?.delta?.reasoning_content) {
      return parsed.choices[0].delta.reasoning_content;
    }
    if (parsed.choices?.[0]?.delta?.reasoning) {
      return parsed.choices[0].delta.reasoning;
    }
    //有些 API ها direct content برمیگردونن
    if (parsed.choices?.[0]?.text) {
      return parsed.choices[0].text;
    }
    return null;
  } catch {
    return null;
  }
}

export function parseNonStreamingResponse(data: any): string {
  // OpenAI-compatible response
  if (data.choices?.[0]?.message?.content) {
    return data.choices[0].message.content;
  }
  // DeepSeek/mimo style: reasoning only
  if (data.choices?.[0]?.message?.reasoning_content) {
    return data.choices[0].message.reasoning_content;
  }
  if (data.choices?.[0]?.message?.reasoning) {
    return data.choices[0].message.reasoning;
  }
  // Some APIs return content directly
  if (data.choices?.[0]?.text) {
    return data.choices[0].text;
  }
  if (typeof data.content === 'string') {
    return data.content;
  }
  return '';
}
