// Test script to debug streaming
const BASE = 'http://localhost:3002';

async function test() {
  // Get character
  const chars = await fetch(`${BASE}/api/characters`).then(r => r.json());
  const char = chars[0];
  console.log('Character:', char.name, char.id);

  // Get chats
  const chats = await fetch(`${BASE}/api/chats/character/${char.id}`).then(r => r.json());
  const chat = chats[0];
  console.log('Chat:', chat.name, chat.id);

  // Create user message
  const msg = await fetch(`${BASE}/api/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat.id, role: 'user', content: 'سلام' }),
  }).then(r => r.json());
  console.log('User message created:', msg.id);

  // Now test streaming
  console.log('\n--- Starting stream test ---');
  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat.id, character_id: char.id }),
  });

  console.log('Status:', res.status);
  console.log('Content-Type:', res.headers.get('content-type'));

  if (!res.ok) {
    const err = await res.text();
    console.log('Error:', err);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let tokenCount = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('data: ')) {
        const data = trimmed.slice(6);
        if (data === '[DONE]') {
          console.log('\n--- [DONE] received ---');
          break;
        }
        try {
          const parsed = JSON.parse(data);
          if (parsed.message_id) {
            console.log('Message ID:', parsed.message_id);
          } else if (parsed.token) {
            process.stdout.write(parsed.token);
            tokenCount++;
          } else if (parsed.error) {
            console.log('\nError in stream:', parsed.error);
          }
        } catch (e) {
          console.log('Parse error:', e.message, 'Data:', data);
        }
      }
    }
  }

  console.log(`\n\nTotal tokens received: ${tokenCount}`);
}

test().catch(console.error);
