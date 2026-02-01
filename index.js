const bedrock = require("bedrock-protocol");
const axios = require("axios");

const CONFIG = {
  host: process.env.MC_HOST,
  port: Number(process.env.MC_PORT),
  username: process.env.MC_NAME,
  aiModel: "gemini-2.5-flash-lite",
  offline: true
};

const client = bedrock.createClient(CONFIG);

client.on("join", () => {
  console.log(`✅ Бот на сервері!`);
  
  // 🔥 ДЕБАГ: Виведемо схему пакету command_request
  try {
    const proto = client.serializer.proto;
    const cmdReq = proto.types['command_request'];
    console.log("📋 Схема command_request:");
    console.log(JSON.stringify(cmdReq, null, 2));
  } catch (e) {
    console.log("Не вдалося отримати схему:", e.message);
  }
});

client.on("spawn", () => console.log("🌍 Заспавнився"));
client.on("disconnect", (p) => console.log("❌ Відключено:", p.reason));
client.on("error", (e) => console.error("⚠️", e.message));

// ===== ЧАТ =====
client.on("text", async (packet) => {
  if (['json', 'system', 'popup'].includes(packet.type)) return;

  let sender = packet.source_name;
  let message = packet.message;

  if (packet.type === 'translation' && Array.isArray(packet.parameters) && packet.parameters.length >= 2) {
    sender = packet.parameters[0];
    message = packet.parameters[1];
  }

  if (!sender || sender === client.username || !message) return;

  const cleanMsg = String(message).replace(/§./g, '').trim();
  console.log(`💬 [${sender}]: ${cleanMsg}`);

  if (!cleanMsg.toLowerCase().startsWith("!ai")) return;
  const prompt = cleanMsg.slice(3).trim();
  if (!prompt) return;

  console.log(`⏳ Думаю...`);
  
  const response = await queryGemini(prompt, sender);
  
  // Не відправляємо поки що, просто виводимо
  console.log(`🤖 Відповідь: ${response}`);
  console.log("⚠️ Поки не відправляю (дебаг режим)");
});

async function queryGemini(prompt, username) {
  const API_KEY = process.env.GOOGLE_API_KEY;
  if (!API_KEY) return "Немає ключа";

  try {
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.aiModel}:generateContent?key=${API_KEY}`,
      { contents: [{ parts: [{ text: `Коротко українською без емоджі. ${username}: ${prompt}` }] }] },
      { headers: { "Content-Type": "application/json" }, timeout: 10000 }
    );
    return res.data?.candidates?.[0]?.content?.parts?.[0]?.text || "Не знаю";
  } catch (e) {
    return "Помилка";
  }
}
