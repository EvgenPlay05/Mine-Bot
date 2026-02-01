const bedrock = require("bedrock-protocol");
const axios = require("axios");
const { v4: uuidv4 } = require('uuid');

const CONFIG = {
  host: process.env.MC_HOST,
  port: Number(process.env.MC_PORT),
  username: process.env.MC_NAME,
  // Змінив модель на ту, що точно працює з твого списку
  aiModel: "gemini-2.5-flash-lite",
  offline: true
};

const client = bedrock.createClient(CONFIG);

// ===== ПОДІЇ =====
client.on("join", () => console.log(`✅ Бот ${CONFIG.username} на сервері!`));
client.on("spawn", () => console.log("🌍 Бот заспавнився"));
client.on("disconnect", (packet) => console.log("❌ ВІДКЛЮЧЕНО:", packet.reason || "Невідома причина"));
client.on("error", (err) => { if (!err.message?.includes('timeout')) console.error("⚠️", err.message); });

// ===== ЧАТ =====
client.on("text", async (packet) => {
  if (['json', 'system', 'popup'].includes(packet.type)) return;

  let sender = packet.source_name;
  let message = packet.message;

  if (packet.type === 'translation' && Array.isArray(packet.parameters) && packet.parameters.length >= 2) {
    sender = packet.parameters[0];
    message = packet.parameters[1];
  }

  if (!sender || sender === client.username || !message || sender === "Server") return;

  const cleanMsg = String(message).replace(/§./g, '').trim();
  console.log(`💬 [${sender}]: ${cleanMsg}`);

  if (!cleanMsg.toLowerCase().startsWith("!ai")) return;
  const prompt = cleanMsg.slice(3).trim();
  if (!prompt) return;

  console.log(`⏳ Думаю...`);
  
  const response = await queryGemini(prompt, sender);
  
  // Затримка 3 секунди
  await sleep(3000);
  
  sendCommand(response);
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== ФУНКЦІЯ ВІДПРАВКИ =====
function sendCommand(text) {
  if (!text) return;

  let safeText = String(text)
    .replace(/[^\p{L}\p{N}\p{P}\p{Z}]/gu, "") 
    .replace(/["\\]/g, "") 
    .trim()
    .substring(0, 150);

  console.log(`📤 Команда /me: ${safeText}`);

  try {
    // ВСІ ПОЛЯ ЯК РЯДКИ
    client.write("command_request", {
      command: `/me ${safeText}`,
      origin: {
        type: 'player',
        uuid: uuidv4(),
        request_id: uuidv4()
      },
      internal: false,
      version: '52' // РЯДОК!
    });
    console.log("✅ Команду надіслано");
  } catch (e) {
    console.error("❌ command_request помилка:", e.message);
    
    // Fallback - пробуємо без version взагалі
    try {
      console.log("🔄 Пробую без version...");
      client.write("command_request", {
        command: `/me ${safeText}`,
        origin: {
          type: 'player',
          uuid: uuidv4(),
          request_id: uuidv4()
        },
        internal: false
      });
    } catch (e2) {
      console.error("❌ Все одно помилка:", e2.message);
    }
  }
}

// ===== GEMINI API (з fallback на інші моделі) =====
async function queryGemini(prompt, username) {
  const API_KEY = process.env.GOOGLE_API_KEY;
  if (!API_KEY) return "Немає ключа";

  // Список моделей для fallback (всі з твого списку ✅)
  const models = [
    "gemini-2.5-flash-lite",
    "gemini-flash-latest", 
    "gemma-3-4b-it",
    "gemma-3n-e4b-it"
  ];

  for (const model of models) {
    try {
      console.log(`🔄 Пробую модель: ${model}`);
      const res = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`,
        {
          contents: [{ parts: [{ text: `Ти гравець Minecraft. Українська. Без емоджі. Коротко. Питання від ${username}: ${prompt}` }] }]
        },
        { headers: { "Content-Type": "application/json" }, timeout: 15000 }
      );
      const answer = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (answer) {
        console.log(`✅ [${model}]: ${answer}`);
        return answer;
      }
    } catch (e) {
      console.log(`⚠️ ${model} не працює: ${e.response?.status || e.message}`);
      // Продовжуємо до наступної моделі
    }
  }
  
  return "Всі моделі зайняті";
}
