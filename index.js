const bedrock = require("bedrock-protocol");

// === Налаштування бота ===
const client = bedrock.createClient({
  host: process.env.MC_HOST,        // ваш сервер
  port: Number(process.env.MC_PORT),// порт
  username: process.env.MC_NAME,    // ім'я бота
  offline: true                      // offline-mode
});

// === Події ===
client.on("join", () => {
  console.log("✅ Bot joined the server");

  // Надсилаємо тестове повідомлення через 2 секунди
  setTimeout(() => {
    const message = "Привіт! Це тестове повідомлення від бота.";
    client.write("text", {
      type: "chat",
      needs_translation: false,
      source_name: client.username,
      message: message
    });
    console.log(`💬 Sent test message: ${message}`);
  }, 2000);
});

client.on("text", (packet) => {
  if (packet.type === "chat" && packet.source_name !== client.username) {
    console.log(`💬 ${packet.source_name}: ${packet.message}`);
  }
});

client.on("disconnect", (reason) => {
  console.log("❌ Disconnected:", reason);
});

client.on("error", (err) => {
  console.error("⚠️ Bedrock error:", err.message || err);
});
