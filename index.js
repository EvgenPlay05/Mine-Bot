const bedrock = require('bedrock-protocol');

const client = bedrock.createClient({
  host: process.env.MC_HOST,
  port: Number(process.env.MC_PORT),
  username: process.env.MC_NAME,
  offline: true // true, якщо це офлайн сервер або Aternos без Xbox
});

client.on('join', () => {
  console.log('✅ Bot joined the server');

  // Відправляємо тестове повідомлення через 2 секунди після входу
  setTimeout(() => {
    client.write('text', {
      type: 'chat',
      needs_translation: false,
      source_name: client.username,
      message: "Привіт! Це тестове повідомлення від бота."
    });
    console.log('💬 Повідомлення надіслано!');
  }, 2000);
});

client.on('text', (packet) => {
  const message = packet.message || packet.parameters?.[0];
  const sender = packet.source_name;
  console.log(`💬 ${sender}: ${message}`);
});

client.on('disconnect', reason => {
  console.log('❌ Disconnected:', reason);
});

client.on('error', err => {
  console.error('💥 Bot error:', err);
});
