// Final test: through CozyTavern server
const s = await fetch('http://localhost:3002/api/api-settings').then(r => r.json());
const chars = await fetch('http://localhost:3002/api/characters').then(r => r.json());
const chats = await fetch(`http://localhost:3002/api/chats/character/${chars[0].id}`).then(r => r.json());

await fetch('http://localhost:3002/api/messages', {
  method: 'POST', headers: {'Content-Type':'application/json'},
  body: JSON.stringify({chat_id:chats[0].id,role:'user',content:'Say hello in one word'}),
});

console.log('Sending to server...');
const res = await fetch('http://localhost:3002/api/chat', {
  method: 'POST', headers: {'Content-Type':'application/json'},
  body: JSON.stringify({chat_id:chats[0].id, character_id:chars[0].id}),
  signal: AbortSignal.timeout(20000),
});

console.log('Status:', res.status, 'Type:', res.headers.get('content-type'));

const reader = res.body.getReader();
const dec = new TextDecoder();
let tokens = '', count = 0;
while (true) {
  const {done, value} = await reader.read();
  if (done) break;
  const lines = dec.decode(value,{stream:true}).split('\n');
  for (const line of lines) {
    const t = line.trim();
    if (!t.startsWith('data: ')) continue;
    const d = t.slice(6);
    if (d === '[DONE]') { console.log('\n[DONE]'); continue; }
    try {
      const j = JSON.parse(d);
      if (j.token) { tokens += j.token; process.stdout.write(j.token); count++; }
      if (j.message_id) console.log('msg_id:', j.message_id);
      if (j.error) console.log('ERROR:', j.error);
    } catch {}
  }
}
console.log(`\n\nTotal: ${count} tokens, content: "${tokens}"`);
