const axios = require('axios');
const env = require('../../config/env');
async function askRasa(message, sender = 'smartbus-user') {
  if (!env.rasaUrl) return null;
  try {
    const res = await axios.post(env.rasaUrl, { sender, message }, { timeout: 1800 });
    if (!Array.isArray(res.data) || !res.data.length) return null;
    return res.data.map((m) => m.text).filter(Boolean).join('\n');
  } catch (_err) { return null; }
}
module.exports = { askRasa };
