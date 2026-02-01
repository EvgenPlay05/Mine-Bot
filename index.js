const bedrock = require("bedrock-protocol");
const axios = require("axios");
const { v4: uuidv4 } = require('uuid'); // Потрібно для генерації ID пакетів

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
client.on("join", () => console.log(`✅ Бот ${CONFIG.username} зайшов на сервер!`));
client.on("spawn", () => console.log("🌍 Бот заспавнився"));

client.on("disconnect", (packet) => {
  console.log("❌ ВІДКЛЮЧЕНО:", packet.reason || "Невідома причина");
});

client.on("error", (err) => {
  if (err.message?.includes('timeout')) return;
});

// ===== ОБРОБНИК ЧАТУ =====
client.on("text", async (packet) => {
  // Фільтруємо сміття
  if (['json', 'system', 'popup'].includes(packet.type)) return;

  let sender = packet.source_name;
  let message = packet.message;

  // Обробка для Aternos
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

  // Затримка 2с і відправка через КОМАНДУ
  setTimeout(() => sendCommand(response), 2000);
});

// ===== ВІДПРАВКА ЧЕРЕЗ COMMAND REQUEST (Найбезпечніший метод) =====
function sendCommand(text) {
  if (!text) return;

  // Чистка тексту від емоджі та символів, що ламають команди
// ===== ВИПРАВЛЕНА ФУНКЦІЯ =====
function sendCommand(text) {
  if (!text) return;

  // Чистка тексту (емоджі, лапки, слеші)
  let safeText = String(text)
    .replace(/[^\p{L}\p{N}\p{P}\p{Z}]/gu, "") // Видаляємо емоджі
    .replace(/["\\]/g, "") // Видаляємо лапки, щоб не зламати JSON пакету
    .trim()
    .substring(0, 150);

  console.log(`📤 Відправляю команду /me: ${safeText}`);

  try {
    const cmd = `/me ${safeText}`;

    client.queue('command_request', {
      command: cmd,
      origin: {
        // 🔥 ТУТ БУЛА ПОМИЛКА 🔥
        // Було: type: 0
        // Стало: type: 'player' (бібліотека вимагає рядок)
        type: 'player', 
        uuid: uuidv4(),
        request_id: uuidv4(),
      },
      internal: false,
      version: 66 // Версія протоколу команд (можна спробувати прибрати, якщо не спрацює)
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
          1. СУВОРО БЕЗ ЕМОДЖІ!
          2. Українська мова.
          3. Дуже коротко (1 речення).
          Питання від ${username}: ${prompt}`
        }]
      }]
    }, { headers: { "Content-Type": "application/json" }, timeout: 8000 });

    return res.data?.candidates?.[0]?.content?.parts?.[0]?.text || "Не знаю";
  } catch (e) {
    return "Помилка";
  }
}

