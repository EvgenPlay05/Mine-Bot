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

client.on('text', async (packet) => {
  const message = packet.message || packet.parameters?.[0];
  const sender = packet.source_name;
  if (!message || !sender) return;

  console.log(`💬 ${sender}: ${message}`);

  if (message.startsWith('!ai ')) {
    const prompt = message.slice(4);

    try {
      const reply = await queryGemini(prompt);

      client.write('text', {
        type: 'chat',
        needs_translation: false,
        source_name: client.username,
        message: `${sender}: ${reply}`
      });

    } catch (err) {
      console.error('Gemini error:', err);

      client.write('text', {
        type: 'chat',
        needs_translation: false,
        source_name: client.username,
        message: '❌ AI error'
      });
    }
  }
});

// Google Gemini
async function queryGemini(prompt) {
  const API_KEY = process.env.GOOGLE_API_KEY;
  if (!API_KEY) throw new Error("GOOGLE_API_KEY не встановлений!");

  const url = `https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText?key=${API_KEY}`;

  const res = await axios.post(
    url,
    {
      prompt: { text: prompt },
      temperature: 0.7,
      maxOutputTokens: 512
    },
    {
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );

  return res.data?.candidates?.[0]?.output || '🤖 No response';
}
