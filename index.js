const bedrock = require("bedrock-protocol");
const axios = require("axios");

const CONFIG = {
  host: process.env.MC_HOST,
  port: Number(process.env.MC_PORT),
  username: process.env.MC_NAME,
  aiModel: "gemini-2.5-flash-lite",
  offline: true
};

const client = bedrock.createClient(CONFIG);

// ===== ПОДІЇ =====
client.on("join", () => console.log(`✅ Бот ${CONFIG.username} (OP) на сервері!`));
client.on("spawn", () => console.log("🌍 Бот заспавнився"));
client.on("disconnect", (packet) => console.log("❌ ВІДКЛЮЧЕНО:", packet.reason || "Невідома причина"));
client.on("error", (err) => { if (!err.message?.includes('timeout')) console.error("⚠️", err.message); });

// ===== ЧАТ =====
client.on("text", async (packet) => {
  // Фільтруємо
  if (['json', 'system', 'popup'].includes(packet.type)) return;

  let sender = packet.source_name;
  let message = packet.message;

  // Розбір вхідного translation пакету (так спілкуються гравці)
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
  
  // Затримка 2с
  await sleep(2000);
  
  sendAsVanillaClient(response);
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== ФУНКЦІЯ ВІДПРАВКИ (Метод Хамелеона) =====
function sendAsVanillaClient(text) {
  if (!text) return;

  // Чистка
  let safeText = String(text)
    .replace(/[^\p{L}\p{N}\p{P}\p{Z}]/gu, "") 
    .replace(/["\\]/g, "")
    .trim()
    .substring(0, 200);

  console.log(`📤 Translation: ${safeText}`);

  try {
    // 🔥 ГОЛОВНИЙ ФОКУС 🔥
    // Ми не використовуємо 'chat'. Ми використовуємо 'translation'.
    // Саме так робить справжній Minecraft.
    client.queue('text', {
      type: 'translation',
      needs_translation: true,
      source_name: client.username,
      xuid: '', // Для offline ботів це OK
      platform_chat_id: '',
      message: '%chat.type.text', // Стандартний ключ чату Minecraft
      parameters: [client.username, safeText] // [Нік, Повідомлення]
    });

    console.log("✅ Надіслано як ванільний клієнт");
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
      {
        contents: [{ parts: [{ text: `Ти гравець Minecraft. Українська. Без емоджі. Коротко. Питання від ${username}: ${prompt}` }] }]
      },
      { headers: { "Content-Type": "application/json" }, timeout: 10000 }
    );
    return res.data?.candidates?.[0]?.content?.parts?.[0]?.text || "Не знаю";
  } catch (e) {
    return "Помилка API";
  }
}
