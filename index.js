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
    const prompt = message.slice(4).trim();
    if (!prompt) return;

    try {
      const reply = await queryGemini(prompt);

      client.write('text', {
        type: 'chat',
        needs_translation: false,
        source_name: client.username,
        message: `${sender}: ${reply || "🤖 ..."}`
      });

    } catch (err) {
      console.error('❌ Gemini error:', err.response?.data || err.message);

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
  if (!API_KEY) return "❌ API key not set";

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";

  try {
    const res = await axios.post(
      url,
      {
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ]
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": API_KEY
        },
        timeout: 15000
      }
    );

    const text =
      res.data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text || typeof text !== "string") {
      return "🤖 (empty response)";
    }

    // Minecraft chat limit safety
    return text.slice(0, 250);

  } catch (e) {
    console.error("💥 Gemini failed:", e.response?.data || e.message);
    return "❌ Gemini error";
  }
}
