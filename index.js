const bedrock = require("bedrock-protocol");
const axios = require("axios");

// Налаштування клієнта
const client = bedrock.createClient({
  host: process.env.MC_HOST,
  port: Number(process.env.MC_PORT),
  username: process.env.MC_NAME,
  offline: true,
  version: '1.21.130 // Aternos зазвичай підтримує цю версію для протоколу
});

// ===== ПОДІЇ СЕРВЕРА =====
client.on("join", () => {
  console.log("✅ Бот успішно підключився до сервера!");
});

client.on("disconnect", (packet) => {
  console.log("❌ Бот відключився:", packet.reason);
});

client.on("error", (err) => {
  console.error("⚠️ Помилка протоколу:", err.message);
});

// ===== ОБРОБКА ЧАТУ =====
client.on("text", async (packet) => {
  // Логуємо структуру пакета для налагодження
  console.log(`[DEBUG] Отримано пакет типу: ${packet.type}`);

  // Отримуємо ім'я відправника
  const sender = packet.source_name || packet.parameters?.[0] || "Unknown";
  
  // Ігноруємо повідомлення від самого бота
  if (sender === client.username) return;

  // Отримуємо текст повідомлення (виправлена логіка без помилок синтаксису)
  let message = "";
  if (packet.message) {
    message = packet.message;
  } else if (packet.parameters && packet.parameters[1]) {
    message = packet.parameters[1];
  } else if (packet.parameters && packet.parameters[0]) {
    message = packet.parameters[0];
  }

  message = message.trim();
  if (!message) return;

  console.log(`💬 [ЧАТ] ${sender}: ${message}`);

  // Перевірка команди !ai
  if (!message.toLowerCase().startsWith("!ai")) return;

  const prompt = message.slice(3).trim();
  if (!prompt) {
    sendToChat("Привіт! Напиши щось після !ai, наприклад: !ai як справи?");
    return;
  }

  console.log(`🤖 Запит до Gemini: ${prompt}`);
  
  const aiResponse = await queryGemini(prompt);
  sendToChat(aiResponse);
});

// Функція відправки повідомлення в чат
function sendToChat(text) {
  if (!text) return;
  
  // Обрізаємо довжину (Minecraft ліміт ~256 символів)
  const safeText = text.toString().slice(0, 250).replace(/\n/g, " ");

  client.queue("text", {
    type: "chat",
    needs_translation: false,
    source_name: client.username,
    xuid: "0",
    platform_chat_id: "",
    filtered_message: "",
    message: safeText
  });
}

// ===== РОБОТА З GEMINI API =====
async function queryGemini(prompt) {
  const API_KEY = process.env.GOOGLE_API_KEY;
  if (!API_KEY) return "❌ Помилка: Немає API ключа в змінних середовища.";

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }]
      },
      { timeout: 10000 }
    );

    const result = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return result || "🤖 Gemini не надіслав відповіді.";
  } catch (error) {
    console.error("💥 Помилка API:", error.response?.data || error.message);
    return "❌ Помилка при зверненні до ШІ.";
  }
}

