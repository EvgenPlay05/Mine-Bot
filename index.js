const bedrock = require('bedrock-protocol');
const fetch = require('node-fetch');

const client = bedrock.createClient({
  host: process.env.MC_HOST,
  port: Number(process.env.MC_PORT),
  username: process.env.MC_NAME,
  offline: true
});

// --- Подія: при вході в сервер ---
client.on('join', () => {
  console.log('✅ Bot joined the server');
});

// --- Подія: відключення ---
client.on('disconnect', reason => {
  console.log('❌ Disconnected:', reason);
});

// --- Подія: чат ---
client.on('text', async (packet) => {
  const message = packet.message;
  const sender = packet.name;

  // Реагуємо тільки на команди, наприклад "!ai"
  if (message.startsWith('!ai ')) {
    const prompt = message.replace('!ai ', '');
    console.log(`💬 ${sender}: ${prompt}`);

    try {
      const reply = await queryOpenAssistant(prompt);
      client.chat(`${reply}`);
    } catch (err) {
      console.error('Error querying Open Assistant:', err);
      client.chat('❌ Error: cannot get response from AI.');
    }
  }
});

// --- Функція запиту до Open Assistant ---
async function queryOpenAssistant(prompt) {
  const response = await fetch('https://api.open-assistant.io/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: prompt
    })
  });

  const data = await response.json();
  // Повертаємо текст відповіді
  return data.output?.[0]?.content?.[0]?.text || "🤖 No response from AI";
}
