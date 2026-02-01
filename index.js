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
  console.log(`✅ Бот ${CONFIG.username} (OP) на сервері!`);
});

client.on("spawn", () => {
  console.log("🌍 Бот заспавнився");
  
  // 🔥 ДЕБАГ: Виводимо схему пакету command_request
  setTimeout(() => {
    try {
      console.log("=== ДЕБАГ СХЕМИ ===");
      
      // Спробуємо знайти схему через serializer
      const serializer = client.serializer;
      if (serializer && serializer.proto) {
        const types = serializer.proto.types;
        if (types.command_request) {
          console.log("command_request:", JSON.stringify(types.command_request, null, 2));
        }
        if (types.CommandOrigin) {
          console.log("CommandOrigin:", JSON.stringify(types.CommandOrigin, null, 2));
        }
        if (types.CommandOriginData) {
          console.log("CommandOriginData:", JSON.stringify(types.CommandOriginData, null, 2));
        }
      }
      
      // Альтернативний спосіб
      console.log("Client keys:", Object.keys(client).join(", "));
      
    } catch (e) {
      console.log("Помилка дебагу:", e.message);
    }
  }, 2000);
});

client.on("disconnect", (p) => console.log("❌ ВІДКЛЮЧЕНО:", p.reason || "Невідома причина"));
client.on("error", (e) => { if (!e.message?.includes('timeout')) console.error("⚠️", e.message); });

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
  console.log(`🤖 Відповідь: ${response}`);
  
  // Поки не відправляємо - чекаємо на дебаг
  console.log("⚠️ Дебаг режим - не відправляю");
});

// ===== GEMINI API =====
async function queryGemini(prompt, username) {
  const API_KEY = process.env.GOOGLE_API_KEY;
  if (!API_KEY) return "Немає ключа";

  try {
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.aiModel}:generateContent?key=${API_KEY}`,
      { contents: [{ parts: [{ text: `Ти гравець Minecraft. Українська. Без емоджі. Коротко. Питання від ${username}: ${prompt}` }] }] },
      { headers: { "Content-Type": "application/json" }, timeout: 10000 }
    );
    return res.data?.candidates?.[0]?.content?.parts?.[0]?.text || "Не знаю";
  } catch (e) {
    return "Помилка";
  }
}
