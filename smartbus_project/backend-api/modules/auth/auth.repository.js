const userRepo = require('../user/user.repository');
const { query } = require('../../config/db');

async function findUserByEmail(email) {
  return userRepo.findByEmail(email);
}

async function findUserById(id) {
  return userRepo.findById(id);
}

async function createUser(input) {
  return userRepo.createUser(input);
}

async function saveRefreshToken({ userId, tokenHash, expiresAt }) {
  const rs = await query(`
    INSERT INTO refresh_tokens(user_id, token_hash, expires_at)
    OUTPUT INSERTED.id, INSERTED.user_id AS userId, INSERTED.token_hash AS tokenHash,
           INSERTED.expires_at AS expiresAt, INSERTED.revoked_at AS revokedAt, INSERTED.created_at AS createdAt
    VALUES(@userId, @tokenHash, @expiresAt)
  `, { userId, tokenHash, expiresAt });
  return rs.recordset[0];
}

async function findActiveRefreshToken(tokenHash) {
  const rs = await query(`
    SELECT TOP 1 id, user_id AS userId, token_hash AS tokenHash, expires_at AS expiresAt, revoked_at AS revokedAt
    FROM refresh_tokens
    WHERE token_hash = @tokenHash
      AND revoked_at IS NULL
      AND expires_at > SYSDATETIME()
  `, { tokenHash });
  return rs.recordset[0] || null;
}

async function revokeRefreshToken(tokenHash) {
  const rs = await query(`
    UPDATE refresh_tokens
    SET revoked_at = SYSDATETIME()
    OUTPUT INSERTED.id, INSERTED.user_id AS userId, INSERTED.revoked_at AS revokedAt
    WHERE token_hash = @tokenHash AND revoked_at IS NULL
  `, { tokenHash });
  return rs.recordset[0] || null;
}

module.exports = {
  findUserByEmail,
  findUserById,
  createUser,
  saveRefreshToken,
  findActiveRefreshToken,
  revokeRefreshToken,
};
