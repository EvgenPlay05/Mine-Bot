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
client.on("disconnect", (packet) => console.log("❌ ВІДКЛЮЧЕНО:", packet.reason || "Невідома причина"));
client.on("error", (err) => { if (!err.message?.includes('timeout')) console.error("⚠️", err.message); });

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
  
  // Затримка 3 секунди (щоб сервер не кікнув за спам)
  setTimeout(() => sendChat(response), 3000);
});

// ===== ПРОСТА ФУНКЦІЯ ВІДПРАВКИ (TEXT ПАКЕТ) =====
function sendChat(text) {
  if (!text) return;

  let safeText = String(text)
    .replace(/[^\p{L}\p{N}\p{P}\p{Z}]/gu, "") // Видаляємо емоджі
    .replace(/["\\]/g, "") 
    .replace(/\n/g, " ")
    .trim()
    .substring(0, 150);

  console.log(`📤 Відправляю в чат: ${safeText}`);

  try {
    // Простий text пакет (без command_request)
    client.write('text', {
      type: 'chat',
      needs_translation: false,
      source_name: client.username,
      xuid: '',
      platform_chat_id: '',
      message: safeText
    });
    console.log("✅ Пакет надіслано успішно");
  } catch (e) {
    console.error("❌ Помилка відправки:", e.message);
  }
}

// ===== GEMINI API (з детальним логуванням) =====
async function queryGemini(prompt, username) {
  const API_KEY = process.env.GOOGLE_API_KEY;
  
  if (!API_KEY) {
    console.error("❌ GOOGLE_API_KEY не знайдено!");
    return "Немає ключа API";
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.aiModel}:generateContent?key=${API_KEY}`;

  try {
    console.log(`🔄 Запит до Gemini...`);
    
    const res = await axios.post(url, {
      contents: [{ 
        parts: [{ 
          text: `Ти гравець Minecraft. Українська мова. Без емоджі. Коротко (1 речення). Питання від ${username}: ${prompt}` 
        }] 
      }]
    }, { 
      headers: { "Content-Type": "application/json" }, 
      timeout: 15000 // Збільшив таймаут до 15 сек
    });

    const answer = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log(`✅ Відповідь AI: ${answer}`);
    return answer || "Не знаю що сказати";
    
  } catch (e) {
    // Детальне логування помилки
    if (e.response) {
      console.error(`❌ API Error ${e.response.status}:`, JSON.stringify(e.response.data));
    } else if (e.code === 'ECONNABORTED') {
      console.error("❌ Таймаут запиту до AI");
    } else {
      console.error("❌ Помилка:", e.message);
    }
    return "Щось пішло не так";
  }
}
