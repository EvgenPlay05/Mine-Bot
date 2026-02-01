const bedrock = require("bedrock-protocol");

const CONFIG = {
  host: process.env.MC_HOST,
  port: Number(process.env.MC_PORT),
  username: process.env.MC_NAME,
  offline: true
};

console.log(`🔌 Підключаюсь до ${CONFIG.host}:${CONFIG.port}...`);

const client = bedrock.createClient(CONFIG);

// ===== ПОДІЇ =====
client.on("join", () => {
  console.log(`✅ Бот ${CONFIG.username} зайшов на сервер!`);
});

client.on("spawn", () => {
  console.log("🌍 Бот заспавнився і готовий!");
  console.log("💤 Бот просто стоїть і тримає сервер онлайн");
});

client.on("start_game", (packet) => {
  console.log(`📍 Позиція: X:${packet.player_position.x.toFixed(1)} Y:${packet.player_position.y.toFixed(1)} Z:${packet.player_position.z.toFixed(1)}`);
});

client.on("disconnect", (packet) => {
  console.log("❌ Відключено:", packet.reason || "Невідома причина");
  
  // Перезапуск через 30 секунд
  console.log("🔄 Перезапуск через 30 секунд...");
  setTimeout(() => process.exit(1), 30000);
});

client.on("error", (err) => {
  if (err.message && err.message.includes('timeout')) {
    console.log("⚠️ Таймаут");
    return;
  }
  console.error("⚠️ Помилка:", err.message);
});

client.on("kick", (packet) => {
  console.log("🦶 Кікнуто:", packet.message || "Невідома причина");
});

// ===== ЛОГУВАННЯ ЧАТУ (без відповідей) =====
client.on("text", (packet) => {
  if (['json', 'system', 'popup'].includes(packet.type)) return;
  
  let sender = packet.source_name;
  let message = packet.message;
  
  if (packet.type === 'translation' && Array.isArray(packet.parameters) && packet.parameters.length >= 2) {
    sender = packet.parameters[0];
    message = packet.parameters[1];
  }
  
  if (sender && message) {
    console.log(`💬 [${sender}]: ${message}`);
  }
});

console.log("🤖 Бот запущено!");
