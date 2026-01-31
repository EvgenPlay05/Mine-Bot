const bedrock = require('bedrock-protocol')
const axios = require('axios')

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

client.on('text', async (packet) => {
  const message =
    packet.message ||
    packet.parameters?.[0]

  const sender = packet.source_name

  if (!message || !sender) return

  console.log(`💬 ${sender}: ${message}`)

  if (message.startsWith('!ai ')) {
    const prompt = message.slice(4)

    try {
      const reply = await queryHF(prompt)

      client.write('text', {
        type: 'chat',
        needs_translation: false,
        source_name: client.username,
        message: `${sender}: ${reply}`
      })

    } catch (err) {
      console.error(err)

      client.write('text', {
        type: 'chat',
        needs_translation: false,
        source_name: client.username,
        message: '❌ AI error'
      })
    }
  }
})

// Hugging Face
async function queryHF(prompt) {
  const HF_TOKEN = process.env.HF_TOKEN

  const res = await axios.post(
    'https://api-inference.huggingface.co/models/mosaicml/mpt-7b-instruct',
    { inputs: prompt },
    {
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`
      }
    }
  )

  return res.data?.[0]?.generated_text || '🤖 No response'
}
