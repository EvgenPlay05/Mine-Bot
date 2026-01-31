const bedrock = require('bedrock-protocol')

const client = bedrock.createClient({
  host: process.env.MC_HOST,
  port: Number(process.env.MC_PORT),
  username: process.env.MC_NAME,
  offline: true
})

client.on('join', () => {
  console.log('✅ Bot joined the server')
})

client.on('disconnect', reason => {
  console.log('❌ Disconnected:', reason)
})