const bedrock = require("bedrock-protocol");

const CONFIG = {
  host: process.env.MC_HOST,
  port: Number(process.env.MC_PORT),
  username: process.env.MC_NAME,
  offline: true
};

console.log(`🔌 Підключаюсь до ${CONFIG.host}:${CONFIG.port}...`);

const client = bedrock.createClient(CONFIG);

let afkInterval = null;
let isSpawned = false;

// ===== ПОДІЇ =====
client.on("join", () => {
  console.log(`✅ Бот ${CONFIG.username} зайшов на сервер!`);
});

client.on("spawn", () => {
  console.log("🌍 Бот заспавнився");
  isSpawned = true;
  startAntiAFK();
});

client.on("disconnect", (packet) => {
  console.log("❌ Відключено:", packet.reason || "Невідома причина");
  stopAntiAFK();
  
  // Спроба перепідключитися через 30 секунд
  console.log("🔄 Перепідключення через 30 секунд...");
  setTimeout(() => {
    process.exit(1); // Railway автоматично перезапустить
  }, 30000);
});

client.on("error", (err) => {
  if (err.message && err.message.includes('timeout')) {
    console.log("⚠️ Таймаут підключення");
    return;
  }
  console.error("⚠️ Помилка:", err.message);
});

client.on("kick", (packet) => {
  console.log("🦶 Кікнуто:", packet.message || "Невідома причина");
  stopAntiAFK();
});

// ===== АНТИ-AFK =====
function startAntiAFK() {
  if (afkInterval) return;
  
  console.log("🏃 Анти-AFK запущено (рух кожні 30 секунд)");
  
  afkInterval = setInterval(() => {
    if (!isSpawned) return;
    
    try {
      // Рух голови (дивимось вліво-вправо)
      const yaw = Math.random() * 360 - 180;  // -180 до 180
      const pitch = Math.random() * 40 - 20;   // -20 до 20 (не дивимось надто вгору/вниз)
      
      client.queue('move_player', {
        runtime_id: client.entityId || 1n,
        position: {
          x: client.position?.x || 0,
          y: client.position?.y || 64,
          z: client.position?.z || 0
        },
        pitch: pitch,
        yaw: yaw,
        head_yaw: yaw,
        mode: 'normal',
        on_ground: true,
        ridden_runtime_id: 0n,
        tick: 0n
      });
      
      console.log(`🔄 Анти-AFK: поворот голови (yaw: ${yaw.toFixed(1)}°)`);
    } catch (e) {
      // Ігноруємо помилки руху
    }
  }, 30000); // Кожні 30 секунд
}

function stopAntiAFK() {
  if (afkInterval) {
    clearInterval(afkInterval);
    afkInterval = null;
    console.log("⏹️ Анти-AFK зупинено");
  }
}

// ===== ЗБЕРЕЖЕННЯ ПОЗИЦІЇ =====
client.on("move_player", (packet) => {
  // Оновлюємо позицію бота
  if (packet.runtime_id === client.entityId) {
    client.position = packet.position;
  }
});

client.on("start_game", (packet) => {
  client.entityId = packet.runtime_entity_id;
  client.position = packet.player_position;
  console.log(`📍 Позиція: X:${packet.player_position.x.toFixed(1)} Y:${packet.player_position.y.toFixed(1)} Z:${packet.player_position.z.toFixed(1)}`);
});

// ===== HEARTBEAT (Тримаємо з'єднання живим) =====
setInterval(() => {
  if (isSpawned) {
    try {
      client.queue('tick_sync', {
        request_time: BigInt(Date.now()),
        response_time: 0n
      });
    } catch (e) {
      // Ігноруємо
    }
  }
}, 10000); // Кожні 10 секунд

console.log("🤖 Бот запущено!");
