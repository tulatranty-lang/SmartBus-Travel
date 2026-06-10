const data = require('../../services/data.service');
const { query } = require('../../config/db');
const activity = require('../activity/activity.repository');

async function findByEmail(email) {
  return data.findUserByEmail(email);
}

async function createUser(input) {
  return data.createUser(input);
}

async function findById(id) {
  const rs = await query(`
    SELECT TOP 1
      id,
      full_name AS fullName,
      email,
      role,
      is_active AS isActive,
      phone,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM users
    WHERE id = @id
  `, { id: Number(id) });
  return rs.recordset[0] || null;
}

async function updateProfile(id, patch) {
  const rs = await query(`
    UPDATE users
    SET full_name = COALESCE(@fullName, full_name),
        phone = COALESCE(@phone, phone),
        updated_at = SYSDATETIME()
    OUTPUT INSERTED.id, INSERTED.full_name AS fullName, INSERTED.email, INSERTED.role,
           INSERTED.is_active AS isActive, INSERTED.phone, INSERTED.updated_at AS updatedAt
    WHERE id = @id
  `, {
    id: Number(id),
    fullName: patch.fullName || null,
    phone: patch.phone || null,
  });
  return rs.recordset[0] || null;
}

async function chatHistory(userId, filters = {}) {
  const limit = Math.max(1, Math.min(100, Number(filters.limit || 50) || 50));
  const rows = await data.getChatHistory(userId);
  return rows.slice(0, limit);
}

// FIX: communityHistory lấy từ community_reviews của chính user, đồng bộ với admin
async function communityHistory(userId, filters = {}) {
  const limit = Math.max(1, Math.min(100, Number(filters.limit || 50) || 50));
  try {
    // FIX: Lấy từ community_reviews (bảng duyệt review cộng đồng, đúng với admin)
    const rs = await query(`
      SELECT TOP (@limit)
        id,
        user_id AS userId,
        title,
        place_name AS placeName,
        province,
        category,
        rating,
        LEFT(COALESCE(content, short_caption, N''), 240) AS content,
        status,
        created_at AS createdAt,
        updated_at AS updatedAt,
        N'community_review' AS type
      FROM community_reviews
      WHERE user_id = @userId
      ORDER BY created_at DESC, id DESC
    `, { userId: Number(userId), limit });
    return rs.recordset.map((r) => ({
      ...r,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    }));
  } catch (_err) {
    return [];
  }
}

async function activityHistory(userId, filters = {}) {
  return activity.recentActivities({ userId, limit: filters.limit || 50 });
}

module.exports = { findByEmail, createUser, findById, updateProfile, chatHistory, communityHistory, activityHistory };
