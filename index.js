const bedrock = require("bedrock-protocol");
const axios = require("axios");

// Налаштування
const CONFIG = {
  host: process.env.MC_HOST || 'localhost',
  port: Number(process.env.MC_PORT) || 19132,
  username: process.env.MC_NAME || 'BotAI',
  // Вибираємо модель зі списку "✅ Працює". 2.5-flash - ідеальний баланс швидкості і розуму
  aiModel: "gemini-2.5-flash" 
};

// Перевірка ключа
if (!process.env.GOOGLE_API_KEY) {
  console.error("❌ ПОМИЛКА: Не вказано GOOGLE_API_KEY");
  process.exit(1);
}

const client = bedrock.createClient({
  host: CONFIG.host,
  port: CONFIG.port,
  username: CONFIG.username,
  offline: true, // Важливо для піратських серверів або тестів
  // skipPing: true // Розкоментуй, якщо бот не може знайти сервер, але IP правильний
});

// ===== ПОДІЇ ПІДКЛЮЧЕННЯ =====
client.on("join", () => console.log(`✅ Бот ${CONFIG.username} зайшов на сервер!`));
client.on("spawn", () => console.log("🌍 Бот з'явився у світі."));

client.on("disconnect", (packet) => {
  console.log("❌ Відключено:", packet.reason || "Невідома причина");
});

client.on("error", (err) => {
  if (err.message && err.message.includes('timeout')) return; // Ігноруємо таймаути
  console.error("⚠️ Помилка клієнта:", err.message);
});

// ===== ГОЛОВНИЙ ОБРОБНИК ЧАТУ =====
client.on("text", async (packet) => {
  // 1. Ігноруємо системні повідомлення (Jukebox, System, Tip, Whisper самому собі)
  if (packet.type === 'json' || packet.type === 'system' || packet.type === 'popup') return;

  let sender = packet.source_name;
  let message = packet.message;

  // 2. СПЕЦИФІКА BEDROCK: 
  // Більшість чатів - це тип 'translation', де текст розбитий на параметри
  // Приклад: message: "chat.type.text", parameters: ["PlayerName", "Hello World"]
  if (packet.type === 'translation' && Array.isArray(packet.parameters) && packet.parameters.length >= 2) {
    sender = packet.parameters[0];
    message = packet.parameters[1];
  }

  // 3. Відсіюємо самого бота, щоб він не говорив сам із собою
  if (sender === client.username || !message) return;

  // 4. Очищення тексту від кольорових кодів (наприклад §a, §l)
  const cleanMessage = message.replace(/§./g, '').trim();
  
  // Логування в консоль
  console.log(`💬 [${sender}]: ${cleanMessage}`);

  // 5. Перевірка команди !ai
  if (!cleanMessage.toLowerCase().startsWith("!ai")) return;

  const prompt = cleanMessage.slice(3).trim();

  if (!prompt) {
    queueMessage(`Привіт, ${sender}! Напиши запитання після !ai`);
    return;
  }

  // 6. Запит до AI
  const response = await askGemini(prompt, sender);
  queueMessage(response);
});

// ===== ФУНКЦІЯ ВІДПРАВКИ В ЧАТ =====
function queueMessage(text) {
  if (!text) return;

  // Чистимо текст для Minecraft (прибираємо Markdown, який AI любить використовувати)
  let safeText = String(text)
    .replace(/\*\*/g, "") // Жирний
    .replace(/\*/g, "")   // Курсив
    .replace(/`/g, "")    // Код
    .replace(/\n/g, " ")  // Переноси рядків
    .trim();

  // Обрізаємо, бо Minecraft має ліміт символів
  if (safeText.length > 255) {
    safeText = safeText.substring(0, 250) + "...";
  }

  try {
    client.queue("text", {
      type: "chat", 
      needs_translation: false,
      source_name: client.username,
      xuid: "",
      platform_chat_id: "",
      message: safeText
    });
  } catch (err) {
    console.error("Помилка відправки:", err.message);
  }
}

// ===== ЗАПИТ ДО GEMINI =====
async function askGemini(prompt, username) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.aiModel}:generateContent?key=${process.env.GOOGLE_API_KEY}`;

  try {
    const res = await axios.post(url, {
      contents: [{
        parts: [{
          // Системна інструкція всередині промпта
          text: `Ти гравець у Minecraft. Твій нік ${CONFIG.username}. Відповідай коротко (1 речення), весело, без форматування markdown. Питання від ${username}: ${prompt}`
        }]
      }]
    }, {
      headers: { "Content-Type": "application/json" },
      timeout: 10000 // 10 сек
    });

    const answer = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return answer || "🤖 Щось я затупив...";
  } catch (error) {
    if (error.response) {
      // Якщо помилка від Google (наприклад 429 або 404)
      console.error(`API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      if (error.response.status === 429) return "🔥 Охолонь, забагато запитів!";
    } else {
      console.error("Network Error:", error.message);
    }
    return "❌ Помилка з'єднання.";
  }
}
