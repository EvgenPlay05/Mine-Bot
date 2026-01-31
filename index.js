const bedrock = require("bedrock-protocol");
const axios = require("axios");

const client = bedrock.createClient({
  host: process.env.MC_HOST,
  port: Number(process.env.MC_PORT),
  username: process.env.MC_NAME,
  offline: true,
  version: '1.21.0' // Можна спробувати змінити, якщо будуть помилки версії
});

// ===== EVENTS =====
client.on("join", () => console.log("✅ Бот успішно зайшов на сервер"));
client.on("disconnect", (reason) => console.log("❌ Відключено:", JSON.stringify(reason)));
client.on("error", (err) => console.error("⚠️ Помилка:", err.message || err));

// ===== CHAT HANDLER =====
client.on("text", async (packet) => {
  // Виводимо тип повідомлення для діагностики
  console.log(`[${packet.type}] Отримано повідомлення від ${packet.source_name}`);

  // Ігноруємо повідомлення від самого себе
  if (packet.source_name === client.username) return;

  // Отримуємо текст (виправлена логіка вибору полів)
  const message = (packet.message || packet.parameters?.[1] || packet.parameters?.[0] || "").trim();
  
  if (!message) return;
  console.log(`💬 Чат: ${message}`);

  // Перевірка команди !ai (без врахування регістру)
  if (!message.toLowerCase().startsWith("!ai")) return;

  // Вирізаємо все, що після !ai
  const prompt = message.slice(3).trim();
  
  if (!prompt) {
    sendMessage("Напишіть щось після !ai, наприклад: !ai привіт!");
    return;
  }

  // Отримуємо відповідь
  const reply = await queryGemini(prompt);
  sendMessage(reply);
});

// Функція відправки повідомлення
function sendMessage(text) {
  if (!text) return;
  client.queue("text", {
    type: "chat",
    needs_translation: false,
    source_name: client.username,
    xuid: "0",
    platform_chat_id: "",
    filtered_message: "",
    message: String(text)
  });
}

// ===== GEMINI API =====
async function queryGemini(prompt) {
  const API_KEY = process.env.GOOGLE_API_KEY;
  if (!API_KEY) return "❌ Помилка: GOOGLE_API_KEY не вказано в налаштуваннях";

  try {
    const res = await axios.post(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
      {
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      },
      {
        headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY },
        timeout: 15000
      }
    );

    const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return "🤖 Gemini не зміг згенерувати відповідь.";
    
    // Обрізаємо для чату Minecraft
    return text.slice(0, 250).replace(/\n/g, " "); 
  } catch (e) {
    console.error("💥 Помилка Gemini API:", e.response?.data || e.message);
    return "❌ Помилка зв'язку з Gemini";
  }
}
