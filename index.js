const axios = require('axios');

const API_KEY = process.env.GOOGLE_API_KEY;

async function listModels() {
  const url = `https://generativelanguage.googleapis.com/v1beta2/models?key=${API_KEY}`;
  try {
    const res = await axios.get(url);
    console.log("Доступні моделі Gemini:", res.data.models.map(m => m.name));
  } catch (err) {
    console.error("Помилка при отриманні моделей:", err.response?.data || err.message);
  }
}

listModels();
