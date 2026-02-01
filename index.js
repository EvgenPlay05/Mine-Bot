const bedrock = require("bedrock-protocol");
const axios = require("axios");

// ===== НАЛАШТУВАННЯ =====
const CONFIG = {
  host: process.env.MC_HOST,
  port: Number(process.env.MC_PORT),
  username: process.env.MC_NAME,
  aiModel: "gemini-2.5-flash", // Твоя робоча модель
  offline: true
};

const client = bedrock.createClient(CONFIG);

// ===== ПОДІЇ =====
client.on("join", () => console.log(`✅ Бот ${CONFIG.username} успішно зайшов на сервер!`));
client.on("spawn", () => console.log("🌍 Бот з'явився у світі"));

// Детальний вивід причини відключення
client.on("disconnect", (packet) => {
  console.log("❌ ВІДКЛЮЧЕНО СЕРВЕРОМ:", packet.reason || "bad_packet (невірний пакет)");
  if (packet.reason === "bad_packet") {
    console.log("💡 Порада: Можливо бот пише занадто швидко або сервер має анти-спам.");
  }
});

client.on("error", (err) => {
  if (err.message && err.message.includes('timeout')) return;
  console.error("⚠️ Помилка клієнта:", err.message);
});

// ===== ОБРОБНИК ЧАТУ =====
client.on("text", async (packet) => {
  // 1. Фільтрація системних повідомлень
  if (packet.type === 'json' || packet.type === 'system' || packet.type === 'popup') return;

  let sender = packet.source_name;
  let message = packet.message;

  // 2. Обробка перекладених повідомлень (стандарт для Aternos/Bedrock)
  if (packet.type === 'translation' && Array.isArray(packet.parameters) && packet.parameters.length >= 2) {
    sender = packet.parameters[0];
    message = packet.parameters[1];
  }

  // Якщо відправника немає або це сам бот
  if (!sender || sender === client.username) return;

  // Очистка повідомлення від кольорів (§a, §l тощо)
  const cleanMessage = String(message).replace(/§./g, '').trim();

  // Логування
  console.log(`💬 [${sender}]: ${cleanMessage}`);

  // 3. Перевірка команди !ai
  if (!cleanMessage.toLowerCase().startsWith("!ai")) return;

  const prompt = cleanMessage.slice(3).trim();
  if (!prompt) {
    // Не відповідаємо одразу, щоб не отримати кік
    setTimeout(() => sendChatMessage(`Привіт, ${sender}! Напиши питання.`), 1000);
    return;
  }

  console.log(`⏳ Думаю над запитанням від ${sender}...`);

  // 4. Запит до AI (це займає час, тому затримка вже природна)
  const aiResponse = await queryGemini(prompt, sender);
  
  // 5. ВАЖЛИВО: Штучна затримка перед відправкою відповіді
  // Aternos кікає за миттєві відповіді (bad_packet)
  setTimeout(() => {
    sendChatMessage(aiResponse);
  }, 2000); // Затримка 2 секунди
});

// ===== ВІДПРАВКА ПОВІДОМЛЕНЬ =====
function sendChatMessage(text) {
  if (!text) return;

  // Очистка від символів, які можуть зламати пакет або чат
  let safeText = String(text)
    .replace(/\*\*/g, "") // Markdown жирний
    .replace(/\*/g, "")   // Markdown курсив
    .replace(/`/g, "")    // Код
    .replace(/\n/g, " ")  // Переноси рядків
    .trim();

  // Обрізаємо
  if (safeText.length > 250) safeText = safeText.substring(0, 245) + "...";

  console.log(`📤 Відправляю: ${safeText}`);

  try {
    // Стандартний пакет чату для Bedrock
    client.queue("text", {
      type: "chat", 
      needs_translation: false,
      source_name: client.username, // Сервер має знати, від кого це
      xuid: "",
      platform_chat_id: "",
      message: safeText
    });
  } catch (e) {
    console.error("❌ Помилка при відправці пакету:", e.message);
  }
}

// ===== GEMINI API =====
async function queryGemini(prompt, username) {
  const API_KEY = process.env.GOOGLE_API_KEY;
  if (!API_KEY) return "❌ Немає ключа API";

  // Використовуємо модель, яка працює у тебе
  const model = CONFIG.aiModel;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

  try {
    const res = await axios.post(url, {
      contents: [{ 
        parts: [{ 
          text: `Ти гравець у Minecraft. Твій нік ${CONFIG.username}. Відповідай українською, коротко (макс 1 речення), весело. Питання від ${username}: ${prompt}` 
        }] 
      }]
    }, {
      headers: { "Content-Type": "application/json" },
      timeout: 10000
    });

    return res.data?.candidates?.[0]?.content?.parts?.[0]?.text || "🤖 Хм, не знаю...";
  } catch (e) {
    console.error("💥 AI Error:", e.response?.status || e.message);
    return "❌ Мозок перегрівся (помилка API).";
  }
}
