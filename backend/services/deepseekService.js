const axios = require('axios');

async function chat(messages) {
  const response = await axios.post(
    'https://api.deepseek.com/chat/completions',
    {
      model: process.env.DEEPSEEK_MODEL,
      messages
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return response.data.choices[0].message.content;
}

module.exports = {
  chat
};
