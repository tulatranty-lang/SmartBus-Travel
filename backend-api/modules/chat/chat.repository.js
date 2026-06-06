const data = require('../../services/data.service');
async function addLog(log) { return data.addChatLog(log); }
async function history(userId) { return data.getChatHistory(userId); }
module.exports = { addLog, history };
