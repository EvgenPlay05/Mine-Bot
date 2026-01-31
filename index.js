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
  // Лише чат повідомлення
  if (packet.type !== "chat") return;
  if (!packet.source_name) return;
  if (packet.source_name === client.username) return;

  const message = packet.message ?? packet.parameters?.[1] ?? packet.parameters?.[0];
  if (!message || typeof message !== "string") return;

  console.log(`💬 ${packet.source_name}: ${message}`);

  // Якщо починається з !ai
  if (!message.startsWith("!ai ")) return;
  const prompt = message.slice(4).trim();
  if (!prompt) return;

  // Отримуємо відповідь від Gemini
  const reply = await queryGemini(prompt);

  // ===== Надсилаємо назад у чат =====
  client.queue("text", {
    type: "chat",
    needs_translation: false,
    source_name: client.username,
    xuid: "",
    platform_chat_id: "0",
    filtered_message: "",
    message: reply
  });
});

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
