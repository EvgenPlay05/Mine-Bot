const bedrock = require("bedrock-protocol");
const axios = require("axios");

const client = bedrock.createClient({
  host: process.env.MC_HOST,
  port: Number(process.env.MC_PORT),
  username: process.env.MC_NAME,
  offline: true
});

// ===== EVENTS =====
client.on("join", () => console.log("✅ Bot joined the server"));
client.on("disconnect", (reason) => console.log("❌ Disconnected:", reason));
client.on("error", (err) => console.error("⚠️ Bedrock error:", err.message || err));

// ===== CHAT HANDLER =====
client.on("text", async (packet) => {
  if (packet.type !== "chat") return;
  if (packet.source_name === client.username) return;

  const message = (packet.message ?? packet.parameters?.[1] ?? packet.parameters?.[0] || "").trim();
  if (!message) return;

  console.log(`💬 ${packet.source_name}: ${message}`);

  // Перевіряємо чи починається з !ai (регістронезалежно)
  if (!message.toLowerCase().startsWith("!ai")) return;

  // Витягуємо текст після !ai
  // Це прибере "!ai" і будь-яку кількість пробілів після нього
  const prompt = message.slice(3).trim(); 
  
  if (!prompt) {
    // Якщо написали просто "!ai" без тексту
    sendMessage("Привіт! Напиши щось після команди, наприклад: !ai як справи?");
    return;
  }

  const reply = await queryGemini(prompt);
  sendMessage(reply);
});

// Допоміжна функція для відправки, щоб не дублювати об'єкт
function sendMessage(text) {
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

// ===== GEMINI =====
async function queryGemini(prompt) {
  const API_KEY = process.env.GOOGLE_API_KEY;
  if (!API_KEY) return "❌ GOOGLE_API_KEY not set";

  try {
    const res = await axios.post(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
      {
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      },
      {
        headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY },
        timeout: 15000
      }
    );

    const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text || typeof text !== "string") return "🤖 (no response)";
    return text.slice(0, 250); // безпечний для Minecraft чату
  } catch (e) {
    console.error("💥 Gemini failed:", e.response?.data || e.message);
    return "❌ Gemini error";
  }
}

