const bedrock = require('bedrock-protocol');
const axios = require('axios');

const client = bedrock.createClient({
  host: process.env.MC_HOST,
  port: Number(process.env.MC_PORT),
  username: process.env.MC_NAME,
  offline: true
});

// Коли бот заходить
client.on('join', () => {
  console.log('✅ Bot joined the server');
});

// Коли бот відключається
client.on('disconnect', reason => {
  console.log('❌ Disconnected:', reason);
});

// Чат
client.on('text', async (packet) => {
  const message = packet.message;
  const sender = packet.name;

  // Реагуємо тільки на команду !ai
  if (message.startsWith('!ai ')) {
    const prompt = message.replace('!ai ', '');
    console.log(`💬 ${sender}: ${prompt}`);

    try {
      const reply = await queryOpenAssistant(prompt);
      client.chat(`${sender}, ${reply}`);
    } catch (err) {
      console.error(err);
      client.chat('❌ Error: cannot get AI response');
    }
  }
});

// --- Простий запит до Open Assistant ---
async function queryOpenAssistant(prompt) {
  const res = await axios.post('https://api.open-assistant.io/message', {
    input: prompt
  });
  
  // Найпростіше діставання відповіді
  if(res.data?.output && res.data.output[0]?.content) {
    for(const c of res.data.output[0].content) {
      if(c.type === 'text') return c.text;
    }
  }
  
  return '🤖 AI did not return a message';
}
