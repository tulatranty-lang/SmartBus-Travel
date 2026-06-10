const data = require('../../services/data.service');
const activity = require('../activity/activity.repository');

async function addLog(log) {
  const result = await data.addChatLog(log);
  // FIX: Ghi activity_log khi user đã đăng nhập để đồng bộ lịch sử
  if (log.userId) {
    await activity.logActivity({
      userId: log.userId,
      actionType: 'chat_ask',
      targetType: 'chatbot',
      targetId: null,
      description: `Hỏi chatbot: ${String(log.message || '').slice(0, 100)}`,
    }).catch(() => {}); // không làm chết chat nếu log lỗi
  }
  return result;
}

async function history(userId) {
  return data.getChatHistory(userId);
}

module.exports = { addLog, history };
