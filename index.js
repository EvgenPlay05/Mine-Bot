const bedrock = require("bedrock-protocol");
const axios = require("axios");

const CONFIG = {
  host: process.env.MC_HOST,
  port: Number(process.env.MC_PORT),
  username: process.env.MC_NAME,
  aiModel: "gemini-2.5-flash",
  offline: true
};

const client = bedrock.createClient(CONFIG);

// ===== ПОДІЇ =====
client.on("join", () => console.log(`✅ Бот ${CONFIG.username} на сервері!`));
client.on("spawn", () => console.log("🌍 Бот заспавнився"));

client.on("disconnect", (packet) => {
  console.log("❌ ВІДКЛЮЧЕНО:", packet.reason || "Невідома причина");
});

client.on("error", (err) => {
  if (err.message?.includes('timeout')) return;
  console.error("⚠️ Помилка:", err.message);
});

// ===== ЧАТ =====
client.on("text", async (packet) => {
  // Фільтруємо системні пакети
  if (['json', 'system', 'popup', 'jukebox_popup'].includes(packet.type)) return;

  let sender = packet.source_name;
  let message = packet.message;

  // Розбираємо translation-пакет (стандарт для серверів)
  if (packet.type === 'translation' && Array.isArray(packet.parameters) && packet.parameters.length >= 2) {
    sender = packet.parameters[0];
    message = packet.parameters[1];
  }

  // Ігноруємо себе та пусті повідомлення
  if (!sender || sender === client.username || !message) return;

  // Чистимо вхідне повідомлення від кодів кольорів (§)
  const cleanMsg = String(message).replace(/§./g, '').trim();

  console.log(`💬 [${sender}]: ${cleanMsg}`);

  // Команда !ai
  if (!cleanMsg.toLowerCase().startsWith("!ai")) return;
  const prompt = cleanMsg.slice(3).trim();
  if (!prompt) return;

  console.log(`⏳ Думаю...`);

  // Запит до AI
  const response = await queryGemini(prompt, sender);

  // Затримка 2с перед відправкою (анти-спам)
  setTimeout(() => sendChatMessage(response), 2000);
});

// ===== ВІДПРАВКА (MAX SECURITY) =====
function sendChatMessage(text) {
  if (!text) return;

  // 1. Прибираємо Markdown
  let safeText = String(text)
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/`/g, "")
    .replace(/\n/g, " ");

  // 2. ЖОРСТКИЙ ФІЛЬТР: Залишаємо тільки букви (всіх мов), цифри, пробіли і знаки пунктуації.
  // Цей RegEx видалить всі емоджі та спецсимволи.
  safeText = safeText.replace(/[^\p{L}\p{N}\p{P}\p{Z}]/gu, "");

  // 3. Обрізаємо
  safeText = safeText.trim().substring(0, 200);

  console.log(`📤 Відправляю: ${safeText}`);

  try {
    client.queue("text", {
      type: "chat",
      needs_translation: false,
      source_name: client.username, // Обов'язково нік бота
      xuid: "",                     // ПУСТИЙ РЯДОК (згідно документації для offline ботів)
      platform_chat_id: "",
      message: safeText
    });
  } catch (e) {
    console.error("❌ Помилка черги:", e.message);
  }
}

// ===== AI ЗАПИТ =====
async function queryGemini(prompt, username) {
  const API_KEY = process.env.GOOGLE_API_KEY;
  if (!API_KEY) return "Немає ключа";

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.aiModel}:generateContent?key=${API_KEY}`;

  try {
    const res = await axios.post(url, {
      contents: [{
        parts: [{
          // СУВОРА ІНСТРУКЦІЯ
          text: `Ти гравець Minecraft (нік ${CONFIG.username}).
          Правила:
          1. Тільки текст. НІЯКИХ ЕМОДЖІ ❌. НІЯКИХ СМАЙЛИКІВ ❌.
          2. Без форматування (жирний, курсив - заборонено).
          3. Мова: Українська.
          4. Довжина: Максимум 1 коротке речення.
          
          Питання від ${username}: ${prompt}`
        }]
      }]
    }, { headers: { "Content-Type": "application/json" }, timeout: 8000 });

    return res.data?.candidates?.[0]?.content?.parts?.[0]?.text || "Не знаю";
  } catch (e) {
    return "Помилка";
  }
}
