const bedrock = require("bedrock-protocol");
const axios = require("axios");

const CONFIG = {
  host: process.env.MC_HOST,
  port: Number(process.env.MC_PORT),
  username: process.env.MC_NAME,
  aiModel: "gemini-2.5-flash-lite",
  // 🔥 ГОЛОВНА ЗМІНА: Вимикаємо offline режим
  offline: false
};

const client = bedrock.createClient(CONFIG);

// При першому запуску бібліотека відкриє посилання для авторизації Microsoft
// Після авторизації токен зберігається і наступні рази входить автоматично

client.on("join", () => console.log(`✅ Бот ${CONFIG.username} на сервері!`));
client.on("spawn", () => console.log("🌍 Бот заспавнився"));
client.on("disconnect", (p) => console.log("❌ ВІДКЛЮЧЕНО:", p.reason || "Невідома причина"));
client.on("error", (e) => console.error("⚠️", e.message));

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
  
  await sleep(2000);
  
  // 🔥 Тепер можна просто писати в чат!
  sendChat(response);
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== ПРОСТА ВІДПРАВКА (працює з авторизованим ботом) =====
function sendChat(text) {
  if (!text) return;

  let safeText = String(text)
    .replace(/[^\p{L}\p{N}\p{P}\p{Z}]/gu, "")
    .trim()
    .substring(0, 200);

  console.log(`📤 Чат: ${safeText}`);

  try {
    client.queue('text', {
      type: 'chat',
      needs_translation: false,
      source_name: client.username,
      xuid: client.profile?.xuid || '',
      platform_chat_id: '',
      message: safeText
    });
    console.log("✅ Надіслано");
  } catch (e) {
    console.error("❌ Помилка:", e.message);
  }
}

// ===== GEMINI API =====
async function queryGemini(prompt, username) {
  const API_KEY = process.env.GOOGLE_API_KEY;
  if (!API_KEY) return "Немає ключа";

  try {
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.aiModel}:generateContent?key=${API_KEY}`,
      { contents: [{ parts: [{ text: `Ти гравець Minecraft. Українська. Без емоджі. Коротко. Питання від ${username}: ${prompt}` }] }] },
      { headers: { "Content-Type": "application/json" }, timeout: 10000 }
    );
    return res.data?.candidates?.[0]?.content?.parts?.[0]?.text || "Не знаю";
  } catch (e) {
    return "Помилка";
  }
}
