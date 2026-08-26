// Test LLM API directly using settings from the running server
const BASE = 'http://localhost:3002';

async function test() {
  const settings = await fetch(`${BASE}/api/api-settings`).then(r => r.json());
  console.log('Endpoint:', settings.base_url);
  console.log('Model:', settings.model);

  const endpoint = settings.base_url.includes('/v1/')
    ? settings.base_url
    : settings.base_url.replace(/\/$/, '') + '/v1/chat/completions';

  console.log('Full endpoint:', endpoint);

  // Test non-streaming first
  console.log('\n--- Non-streaming test ---');
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.api_key}`,
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [{ role: 'user', content: 'Say hello in one word' }],
        max_tokens: 10,
        stream: false,
      }),
      signal: AbortSignal.timeout(10000),
    });
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Response:', JSON.stringify(data, null, 2).slice(0, 500));
  } catch (e) {
    console.log('Non-streaming error:', e.message);
  }

  // Test streaming
  console.log('\n--- Streaming test ---');
  try {
    const res2 = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.api_key}`,
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [{ role: 'user', content: 'Say hi' }],
        max_tokens: 10,
        stream: true,
      }),
      signal: AbortSignal.timeout(10000),
    });
    console.log('Status:', res2.status);
    console.log('Content-Type:', res2.headers.get('content-type'));

    if (res2.body) {
      const reader = res2.body.getReader();
      const decoder = new TextDecoder();
      let count = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        process.stdout.write(chunk);
        count++;
        if (count > 20) break;
      }
    }
  } catch (e) {
    console.log('Streaming error:', e.message);
  }
  console.log('\n--- Done ---');
}

test().catch(console.error);
