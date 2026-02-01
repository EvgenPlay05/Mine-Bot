const bedrock = require("bedrock-protocol");
const axios = require("axios");

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
client.on("spawn", () => console.log("🌍 Бот з'явився у світі"));

client.on("disconnect", (packet) => {
  console.log("❌ ВІДКЛЮЧЕНО СЕРВЕРОМ:", packet.reason || "Невідома причина");
});

client.on("error", (err) => {
  if (err.message && err.message.includes('timeout')) return;
  console.error("⚠️ Помилка клієнта:", err.message);
});

// ===== ОБРОБНИК ЧАТУ =====
client.on("text", async (packet) => {
  // Фільтрація сміття
  if (packet.type === 'json' || packet.type === 'system' || packet.type === 'popup') return;

  let sender = packet.source_name;
  let message = packet.message;

  // Обробка для Aternos (Translation packet)
  if (packet.type === 'translation' && Array.isArray(packet.parameters) && packet.parameters.length >= 2) {
    sender = packet.parameters[0];
    message = packet.parameters[1];
  }

  // Ігноруємо самого бота та пусті повідомлення
  if (!sender || sender === client.username || !message) return;

  // Очистка повідомлення
  const cleanMessage = String(message).replace(/§./g, '').trim();

  // Логування вхідного повідомлення
  console.log(`💬 [${sender}]: ${cleanMessage}`);

  // Перевірка команди
  if (!cleanMessage.toLowerCase().startsWith("!ai")) return;

  const prompt = cleanMessage.slice(3).trim();
  if (!prompt) return; // Ігноруємо пусті !ai

  console.log(`⏳ Обробляю запит від ${sender}...`);

  // Запит до AI
  const aiResponse = await queryGemini(prompt, sender);
  
  // Затримка перед відповіддю (імітація друку + захист від спаму)
  setTimeout(() => {
    sendChatMessage(aiResponse);
  }, 1500); 
});

// ===== ВИПРАВЛЕНА ФУНКЦІЯ ВІДПРАВКИ =====
function sendChatMessage(text) {
  if (!text) return;

  let safeText = String(text)
    .replace(/\*\*/g, "") 
    .replace(/\*/g, "")   
    .replace(/`/g, "")    
    .replace(/\n/g, " ")  
    .trim();

  if (safeText.length > 250) safeText = safeText.substring(0, 245) + "...";

  console.log(`📤 Відправляю: ${safeText}`);

  try {
    // 🔥 ГОЛОВНЕ ВИПРАВЛЕННЯ ТУТ 🔥
    // source_name має бути ПУСТИМ, щоб сервер не сварився на "bad_packet"
    client.queue("text", {
      type: "chat", 
      needs_translation: false,
      source_name: "", // <--- ЗАЛИШАЄМО ПУСТИМ!
      xuid: "",
      platform_chat_id: "",
      message: safeText
    });
  } catch (e) {
    console.error("❌ Помилка відправки:", e.message);
  }
}

// ===== GEMINI API =====
async function queryGemini(prompt, username) {
  const API_KEY = process.env.GOOGLE_API_KEY;
  if (!API_KEY) return "❌ Немає ключа API";

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.aiModel}:generateContent?key=${API_KEY}`;

  try {
    const res = await axios.post(url, {
      contents: [{ 
        parts: [{ 
          text: `Ти гравець Minecraft. Відповідай українською, весело, дуже коротко (макс 10-15 слів). Питання від ${username}: ${prompt}` 
        }] 
      }]
    }, { headers: { "Content-Type": "application/json" }, timeout: 10000 });

    return res.data?.candidates?.[0]?.content?.parts?.[0]?.text || "🤖 Хм...";
  } catch (e) {
    console.error("💥 AI Error:", e.response?.status);
    return "❌ Щось пішло не так.";
  }
}
