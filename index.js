const bedrock = require('bedrock-protocol');
const axios = require('axios');

const client = bedrock.createClient({
  host: process.env.MC_HOST,
  port: Number(process.env.MC_PORT),
  username: process.env.MC_NAME,
  offline: true
});

client.on('join', () => {
  console.log('✅ Bot joined the server');
});

client.on('disconnect', reason => {
  console.log('❌ Disconnected:', reason);
});

// Чат
client.on('text', async (packet) => {
  const message = packet.message;
  const sender = packet.name;

  if(message.startsWith('!ai ')) {
    const prompt = message.replace('!ai ', '');
    console.log(`💬 ${sender}: ${prompt}`);

    try {
      const reply = await queryHF(prompt);
      client.queue('text', { message: `${sender}, ${reply}` });
    } catch(err) {
      console.error(err);
      client.queue('text', { message: '❌ Error: cannot get AI response' });
    }
  }
});

// Hugging Face AI
async function queryHF(prompt) {
  const HF_TOKEN = process.env.HF_TOKEN;
  const res = await axios.post(
    'https://api-inference.huggingface.co/models/mosaicml/mpt-7b-instruct',
    { inputs: prompt },
    { headers: { Authorization: `Bearer ${HF_TOKEN}` } }
  );

  return res.data[0]?.generated_text || '🤖 AI did not return a message';
}
