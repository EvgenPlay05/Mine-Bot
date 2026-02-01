const bedrock = require("bedrock-protocol");
const axios = require("axios");
const { v4: uuidv4 } = require('uuid');

// ===== НАЛАШТУВАННЯ =====
const CONFIG = {
  host: process.env.MC_HOST,
  port: Number(process.env.MC_PORT),
  username: process.env.MC_NAME,
  aiModel: "gemini-2.5-flash",
  offline: true
};

const client = bedrock.createClient(CONFIG);

// ===== ПОДІЇ =====
client.on("join", () => console.log(`✅ Бот ${CONFIG.username} успішно зайшов на сервер!`));
client.on("spawn", () => console.log("🌍 Бот заспавнився"));

client.on("disconnect", (packet) => {
  console.log("❌ ВІДКЛЮЧЕНО:", packet.reason || "Невідома причина");
});

client.on("error", (err) => {
  if (err.message && err.message.includes('timeout')) return;
});

// ===== ОБРОБНИК ЧАТУ =====
client.on("text", async (packet) => {
  // Фільтрація
  if (['json', 'system', 'popup'].includes(packet.type)) return;

  let sender = packet.source_name;
  let message = packet.message;

  // Обробка Translation (стандарт для Bedrock серверів)
  if (packet.type === 'translation' && Array.isArray(packet.parameters) && packet.parameters.length >= 2) {
    sender = packet.parameters[0];
    message = packet.parameters[1];
  }

  // Ігноруємо себе, сервер та пусті повідомлення
  if (!sender || sender === client.username || !message || sender === "Server") return;

  const cleanMsg = String(message).replace(/§./g, '').trim();
  console.log(`💬 [${sender}]: ${cleanMsg}`);

  // Команда !ai
  if (!cleanMsg.toLowerCase().startsWith("!ai")) return;
  const prompt = cleanMsg.slice(3).trim();
  if (!prompt) return;

  console.log(`⏳ Думаю...`);

  const response = await queryGemini(prompt, sender);

  // Затримка 2с
  setTimeout(() => sendCommand(response), 2000);
});

// ===== ФУНКЦІЯ ВІДПРАВКИ (COMMAND REQUEST) =====
function sendCommand(text) {
  if (!text) return;

  // Чистка тексту
  let safeText = String(text)
    .replace(/[^\p{L}\p{N}\p{P}\p{Z}]/gu, "") // Видаляємо емоджі
    .replace(/["\\]/g, "") // Видаляємо лапки
    .trim()
    .substring(0, 150);

  console.log(`📤 Відправляю команду /me: ${safeText}`);

  try {
    const cmd = `/me ${safeText}`;

    client.queue('command_request', {
      command: cmd,
      origin: {
        type: 'player',  // Це правильно (рядок)
        uuid: uuidv4(),  // Це правильно (рядок-UUID)
        request_id: uuidv4(),
      },
      internal: false
      // 🔥 ВИДАЛЕНО: version: 66 (це викликало помилку)
    });
  } catch (e) {
    console.error("❌ Помилка команди:", e.message);
  }
}

// ===== GEMINI API =====
async function queryGemini(prompt, username) {
  const API_KEY = process.env.GOOGLE_API_KEY;
  if (!API_KEY) return "Немає ключа";

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.aiModel}:generateContent?key=${API_KEY}`;

  try {
    const res = await axios.post(url, {
      contents: [{
        parts: [{
          text: `Ти гравець у Minecraft.
          Правила:
          1. БЕЗ ЕМОДЖІ!
          2. Українська мова.
          3. Макс 1 речення.
          Питання від ${username}: ${prompt}`
        }]
      }]
    }, { headers: { "Content-Type": "application/json" }, timeout: 8000 });

    return res.data?.candidates?.[0]?.content?.parts?.[0]?.text || "Не знаю";
  } catch (e) {
    return "Помилка API";
  }
}
