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


async function activityHistory(userId, filters = {}) {
  return activity.recentActivities({ userId, limit: filters.limit || 50 });
}

module.exports = { findByEmail, createUser, findById, updateProfile, activityHistory };
