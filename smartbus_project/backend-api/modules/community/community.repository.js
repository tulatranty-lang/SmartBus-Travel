const { query } = require('../../config/db');
const { normalizePlainText } = require('../../common/utils/sanitize.util');

function mapPost(row) {
  return {
    id: row.id,
    userId: row.userId,
    userName: row.userName || 'SmartBus User',
    title: row.title,
    content: row.content,
    topic: row.topic,
    routeId: row.routeId,
    placeId: row.placeId,
    status: row.status,
    votes: Number(row.votes || 0),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function list(filters = {}) {
  const rs = await query(`
    SELECT p.id, p.user_id AS userId, COALESCE(u.full_name, N'SmartBus User') AS userName,
           p.title, p.content, p.topic, p.route_code AS routeId, p.place_id AS placeId,
           p.status, p.votes, p.created_at AS createdAt, p.updated_at AS updatedAt
    FROM community_posts p
    LEFT JOIN users u ON u.id = p.user_id
    WHERE p.status='approved'
      AND (@routeId IS NULL OR p.route_code=@routeId)
      AND (@placeId IS NULL OR p.place_id=@placeId)
      AND (@q IS NULL OR p.title LIKE '%' + @q + '%' OR p.content LIKE '%' + @q + '%')
    ORDER BY p.created_at DESC
  `, {
    routeId: filters.routeId ? String(filters.routeId).padStart(2, '0') : null,
    placeId: filters.placeId ? Number(filters.placeId) : null,
    q: filters.q || null,
  });
  return rs.recordset.map(mapPost);
}

async function findById(id) {
  const rs = await query(`
    SELECT TOP 1 p.id, p.user_id AS userId, COALESCE(u.full_name, N'SmartBus User') AS userName,
           p.title, p.content, p.topic, p.route_code AS routeId, p.place_id AS placeId,
           p.status, p.votes, p.created_at AS createdAt, p.updated_at AS updatedAt
    FROM community_posts p
    LEFT JOIN users u ON u.id = p.user_id
    WHERE p.id=@id AND p.status <> 'hidden'
  `, { id: Number(id) });
  const post = rs.recordset[0] ? mapPost(rs.recordset[0]) : null;
  if (!post) return null;
  const comments = await query(`
    SELECT c.id, c.post_id AS postId, c.user_id AS userId, COALESCE(u.full_name, N'SmartBus User') AS userName,
           c.content, c.status, c.created_at AS createdAt
    FROM post_comments c
    LEFT JOIN users u ON u.id = c.user_id
    WHERE c.post_id=@id AND c.status='approved'
    ORDER BY c.created_at ASC
  `, { id: Number(id) });
  return { ...post, comments: comments.recordset };
}

async function create(user, body) {
  const status = ['admin', 'moderator'].includes(user?.role) ? 'approved' : 'pending';
  const rs = await query(`
    INSERT INTO community_posts(user_id, title, content, topic, route_code, place_id, status, votes)
    OUTPUT INSERTED.id, INSERTED.user_id AS userId, INSERTED.title, INSERTED.content, INSERTED.topic,
           INSERTED.route_code AS routeId, INSERTED.place_id AS placeId, INSERTED.status,
           INSERTED.votes, INSERTED.created_at AS createdAt
    VALUES(@userId, @title, @content, @topic, @routeId, @placeId, @status, 0)
  `, {
    userId: Number(user?.id || 0) || null,
    title: normalizePlainText(body.title, 150),
    content: normalizePlainText(body.content, 3000),
    topic: body.topic || 'experience',
    routeId: body.routeId ? String(body.routeId).padStart(2, '0') : null,
    placeId: body.placeId ? Number(body.placeId) : null,
    status,
  });
  return mapPost({ ...rs.recordset[0], userName: user?.fullName || user?.email || 'SmartBus User' });
}

async function update(id, user, body) {
  const current = await query('SELECT TOP 1 * FROM community_posts WHERE id=@id', { id: Number(id) });
  const item = current.recordset[0];
  if (!item) return null;
  if (Number(item.user_id) !== Number(user.id) && !['admin', 'moderator'].includes(user.role)) {
    const err = new Error('Bạn không có quyền sửa bài viết này');
    err.status = 403;
    throw err;
  }
  const rs = await query(`
    UPDATE community_posts
    SET title=COALESCE(@title, title),
        content=COALESCE(@content, content),
        topic=COALESCE(@topic, topic),
        route_code=COALESCE(@routeId, route_code),
        place_id=COALESCE(@placeId, place_id),
        status=CASE WHEN status='approved' AND @keepStatus=0 THEN 'pending' ELSE status END,
        updated_at=SYSDATETIME()
    OUTPUT INSERTED.id, INSERTED.user_id AS userId, INSERTED.title, INSERTED.content, INSERTED.topic,
           INSERTED.route_code AS routeId, INSERTED.place_id AS placeId, INSERTED.status,
           INSERTED.votes, INSERTED.created_at AS createdAt, INSERTED.updated_at AS updatedAt
    WHERE id=@id
  `, {
    id: Number(id),
    title: body.title ? normalizePlainText(body.title, 150) : null,
    content: body.content ? normalizePlainText(body.content, 3000) : null,
    topic: body.topic || null,
    routeId: body.routeId ? String(body.routeId).padStart(2, '0') : null,
    placeId: body.placeId ? Number(body.placeId) : null,
    keepStatus: ['admin', 'moderator'].includes(user.role) ? 1 : 0,
  });
  return rs.recordset[0] ? mapPost({ ...rs.recordset[0], userName: user?.fullName || user?.email || 'SmartBus User' }) : null;
}

async function remove(id, user) {
  const current = await query('SELECT TOP 1 * FROM community_posts WHERE id=@id', { id: Number(id) });
  const item = current.recordset[0];
  if (!item) return null;
  if (Number(item.user_id) !== Number(user.id) && !['admin', 'moderator'].includes(user.role)) {
    const err = new Error('Bạn không có quyền xóa bài viết này');
    err.status = 403;
    throw err;
  }
  await query("UPDATE community_posts SET status='hidden', updated_at=SYSDATETIME() WHERE id=@id", { id: Number(id) });
  return { id: Number(id), deleted: true };
}

async function comment(id, user, body) {
  const rs = await query(`
    INSERT INTO post_comments(post_id, user_id, content, status)
    OUTPUT INSERTED.id, INSERTED.post_id AS postId, INSERTED.user_id AS userId, INSERTED.content, INSERTED.status, INSERTED.created_at AS createdAt
    VALUES(@postId, @userId, @content, 'approved')
  `, { postId: Number(id), userId: Number(user?.id || 0) || null, content: normalizePlainText(body.content, 1000) });
  return { ...rs.recordset[0], userName: user?.fullName || user?.email || 'SmartBus User' };
}

async function vote(id, userId) {
  const uid = Number(userId);
  if (!Number.isFinite(uid)) { const err = new Error('Bạn cần đăng nhập để vote'); err.status = 401; throw err; }
  await query(`
    IF NOT EXISTS (SELECT 1 FROM post_votes WHERE post_id=@id AND user_id=@userId)
    BEGIN
      INSERT INTO post_votes(post_id, user_id) VALUES(@id, @userId);
      UPDATE community_posts SET votes = votes + 1 WHERE id=@id;
    END
  `, { id: Number(id), userId: uid });
  const rs = await query('SELECT id AS postId, votes FROM community_posts WHERE id=@id', { id: Number(id) });
  return rs.recordset[0] || null;
}

async function pending() {
  const rs = await query(`
    SELECT p.id, p.user_id AS userId, COALESCE(u.full_name, N'SmartBus User') AS userName,
           p.title, p.content, p.topic, p.route_code AS routeId, p.place_id AS placeId,
           p.status, p.votes, p.created_at AS createdAt, p.updated_at AS updatedAt
    FROM community_posts p
    LEFT JOIN users u ON u.id = p.user_id
    WHERE p.status='pending'
    ORDER BY p.created_at DESC
  `);
  return rs.recordset.map(mapPost);
}

async function setStatus(id, status, moderator) {
  const rs = await query(`
    UPDATE community_posts
    SET status=@status, moderated_by=@moderatorId, moderated_at=SYSDATETIME(), updated_at=SYSDATETIME()
    OUTPUT INSERTED.id, INSERTED.user_id AS userId, INSERTED.title, INSERTED.content, INSERTED.topic,
           INSERTED.route_code AS routeId, INSERTED.place_id AS placeId, INSERTED.status,
           INSERTED.votes, INSERTED.created_at AS createdAt, INSERTED.updated_at AS updatedAt
    WHERE id=@id
  `, { id: Number(id), status, moderatorId: moderator?.id || null });
  return rs.recordset[0] ? mapPost(rs.recordset[0]) : null;
}

module.exports = { list, findById, create, update, remove, comment, vote, pending, setStatus };
