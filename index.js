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

client.on("join", () => console.log(`✅ Бот ${CONFIG.username} (OP) на сервері!`));
client.on("spawn", () => console.log("🌍 Бот заспавнився"));
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
  
  await sleep(2000);
  
  sendCommand(response);
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== ВІДПРАВКА КОМАНДИ (Повна структура для 1.21+) =====
function sendCommand(text) {
  if (!text) return;

  let safeText = String(text)
    .replace(/[^\p{L}\p{N}\p{P}\p{Z}]/gu, "")
    .replace(/["\\]/g, "")
    .trim()
    .substring(0, 150);

  console.log(`📤 Команда /me: ${safeText}`);

  try {
    client.write('command_request', {
      command: `/me ${safeText}`,
      origin: {
        type: 'player',
        uuid: '00000000-0000-0000-0000-000000000000',
        request_id: 'req-001',
        player_entity_id: '1'  // 🔥 ЦЕ ПОЛЕ БУЛО ВІДСУТНЄ
      },
      internal: false,
      version: '1'  // 🔥 Спробуємо як рядок
    });
    console.log("✅ Варіант 1 спрацював");
  } catch (e) {
    console.error("❌ Варіант 1:", e.message);
    
    try {
      // Варіант 2: Інші значення
      client.write('command_request', {
        command: `/me ${safeText}`,
        origin: {
          type: 0,  // Число замість рядка
          uuid: '00000000-0000-0000-0000-000000000000',
          request_id: 'req',
          player_entity_id: 0  // Число
        },
        internal: false,
        version: 1
      });
      console.log("✅ Варіант 2 спрацював");
    } catch (e2) {
      console.error("❌ Варіант 2:", e2.message);
      
      try {
        // Варіант 3: Всі рядки
        client.write('command_request', {
          command: `/me ${safeText}`,
          origin: {
            type: 'player',
            uuid: '',
            request_id: '',
            player_entity_id: ''
          },
          internal: false,
          version: ''
        });
        console.log("✅ Варіант 3 спрацював");
      } catch (e3) {
        console.error("❌ Варіант 3:", e3.message);
      }
    }
  }
}

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
