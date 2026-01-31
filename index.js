const bedrock = require("bedrock-protocol");
const axios = require("axios");

const client = bedrock.createClient({
  host: process.env.MC_HOST,
  port: Number(process.env.MC_PORT),
  username: process.env.MC_NAME,
  offline: true
  // Версію не чіпаю, як ти і просив
});

// ===== ПОДІЇ =====
client.on("join", () => console.log("✅ Бот зайшов у гру"));
client.on("disconnect", (reason) => console.log("❌ Відключено:", reason));
client.on("error", (err) => {
  if (err.message.includes('timeout')) return;
  console.error("⚠️ Помилка:", err.message);
});

// ===== ОБРОБНИК ЧАТУ =====
client.on("text", async (packet) => {
  // Визначаємо відправника (враховуємо особливості Bedrock)
  const sender = packet.source_name || (packet.parameters ? packet.parameters[0] : "");
  if (!sender || sender === client.username) return;

  // Витягуємо текст повідомлення
  let rawMsg = "";
  if (packet.message) {
    rawMsg = packet.message;
  } else if (packet.parameters && packet.parameters[1]) {
    rawMsg = packet.parameters[1];
  } else if (packet.parameters && packet.parameters[0]) {
    rawMsg = packet.parameters[0];
  }

  const message = rawMsg.trim();
  if (!message) return;

  // Логування для тебе
  console.log(`💬 ${sender}: ${message}`);

  // Перевірка команди !ai
  if (!message.toLowerCase().startsWith("!ai")) return;

  const prompt = message.slice(3).trim();
  if (!prompt) {
    sendChatMessage("Привіт! Напиши щось після !ai");
    return;
  }

  // Виклик Gemini
  const aiResponse = await queryGemini(prompt);
  sendChatMessage(aiResponse);
});

// Функція відправки в Minecraft
function sendChatMessage(text) {
  if (!text) return;
  
  // Обрізаємо для чату та прибираємо переноси рядків
  const safeText = String(text).replace(/\n/g, " ").slice(0, 250);

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

// ===== РОБОТА З ТВОЇМ API (Gemini Flash Latest) =====
async function queryGemini(prompt) {
  const API_KEY = process.env.GOOGLE_API_KEY;
  if (!API_KEY) return "❌ Помилка: Не вказано GOOGLE_API_KEY";

  try {
    // Використовуємо модель, яка у тебе позначена як ✅ Працює
    const model = "gemini-flash-latest"; 
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
    
    const res = await axios.post(url, {
      contents: [{ parts: [{ text: prompt }] }]
    }, {
      headers: { "Content-Type": "application/json" },
      timeout: 10000
    });

    const result = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return result || "🤖 ШІ не надав відповіді";
  } catch (e) {
    console.error("💥 Gemini Error:", e.response?.data || e.message);
    return "❌ Помилка API (можливо, ліміт запитів)";
  }
}
