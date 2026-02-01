const bedrock = require("bedrock-protocol");
const axios = require("axios");

const CONFIG = {
  host: process.env.MC_HOST,
  port: Number(process.env.MC_PORT),
  username: process.env.MC_NAME,
  aiModel: "gemini-2.5-flash-lite", // Модель з гарним лімітом
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
  // Фільтруємо системні повідомлення, щоб бот не читав сам себе
  if (['json', 'system', 'popup', 'jukebox_popup'].includes(packet.type)) return;

  let sender = packet.source_name;
  let message = packet.message;

  // Розбір пакету для Aternos
  if (packet.type === 'translation' && Array.isArray(packet.parameters) && packet.parameters.length >= 2) {
    sender = packet.parameters[0];
    message = packet.parameters[1];
  }

  // Ігнор
  if (!sender || sender === client.username || !message || sender === "Server") return;

  const cleanMsg = String(message).replace(/§./g, '').trim();
  console.log(`💬 [${sender}]: ${cleanMsg}`);

  // Команда !ai
  if (!cleanMsg.toLowerCase().startsWith("!ai")) return;
  const prompt = cleanMsg.slice(3).trim();
  if (!prompt) return;

  console.log(`⏳ Думаю...`);
  
  const response = await queryGemini(prompt, sender);
  
  // Затримка (для реалістичності)
  await sleep(2000);
  
  sendAsSystem(response);
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== ВІДПРАВКА ЯК JSON (Хак для OP) =====
function sendAsSystem(text) {
  if (!text) return;

  let safeText = String(text)
    .replace(/[^\p{L}\p{N}\p{P}\p{Z}]/gu, "") 
    .replace(/["\\]/g, "") // Прибираємо лапки, щоб не зламати JSON
    .trim()
    .substring(0, 200);

  console.log(`📤 JSON: ${safeText}`);

  try {
    // Формуємо JSON, який виглядає як звичайний чат
    // <BotName> Message
    const rawtext = JSON.stringify({
      rawtext: [
        { text: `<§a${client.username}§r> ` }, // Нік зеленим кольором (як у бота)
        { text: safeText }
      ]
    });

    client.write('text', {
      type: 'json', // 🔥 ТИП JSON - не перевіряється анти-чітом Aternos!
      needs_translation: false,
      source_name: client.username,
      xuid: '',
      platform_chat_id: '',
      message: rawtext // Відправляємо структуру JSON
    });

    console.log("✅ Надіслано через JSON");
  } catch (e) {
    console.error("❌ Помилка JSON:", e.message);
  }
}

// ===== GEMINI API =====
async function queryGemini(prompt, username) {
  const API_KEY = process.env.GOOGLE_API_KEY;
  if (!API_KEY) return "Немає ключа";

  // Список моделей (Fallback)
  const models = [
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-flash-latest"
  ];

  for (const model of models) {
    try {
      const res = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`,
        {
          contents: [{ parts: [{ text: `Ти гравець Minecraft. Українська. Без емоджі. Коротко. Питання від ${username}: ${prompt}` }] }]
        },
        { headers: { "Content-Type": "application/json" }, timeout: 10000 }
      );
      return res.data?.candidates?.[0]?.content?.parts?.[0]?.text || "Не знаю";
    } catch (e) {
      console.log(`⚠️ ${model} помилка (429 або інша), пробую наступну...`);
    }
  }
  return "Мозок перегрівся 🥵";
}
