const bedrock = require("bedrock-protocol");

const client = bedrock.createClient({
  host: process.env.MC_HOST,
  port: Number(process.env.MC_PORT),
  username: process.env.MC_NAME,
  offline: true
});

client.on("join", () => {
  console.log("✅ Bot joined the server");

  // тестове повідомлення
  client.queue("text", {
    type: "chat",
    needs_translation: false,
    source_name: client.username,
    message: "💬 Test message from bot!",
    xuid: "",
    platform_chat_id: "",
    filtered_message: ""
  });
});

client.on("text", (packet) => {
  console.log(`💬 Received: ${packet.source_name}: ${packet.message}`);
});
