const { query } = require('../../config/db');
const { normalizePlainText } = require('../../common/utils/sanitize.util');

async function refreshPlaceRating(placeId) {
  await query(`
    UPDATE p
    SET average_rating = COALESCE(x.avg_rating, 0),
        review_count = COALESCE(x.review_count, 0),
        updated_at = SYSDATETIME()
    FROM tourist_places p
    OUTER APPLY (
      SELECT CAST(AVG(CAST(rating AS FLOAT)) AS DECIMAL(3,2)) AS avg_rating, COUNT(*) AS review_count
      FROM reviews
      WHERE place_id=@placeId AND status='approved'
    ) x
    WHERE p.id=@placeId
  `, { placeId: Number(placeId) });
}

async function listByPlace(placeId, includePending = false) {
  const rs = await query(`
    SELECT r.id, r.place_id AS placeId, r.user_id AS userId, COALESCE(u.full_name, N'Người dùng SmartBus') AS userName,
           r.rating, COALESCE(r.content, r.comment) AS content, r.route_code AS routeId,
           CAST(r.stop_id AS NVARCHAR(30)) AS stopId, r.visit_date AS visitDate, r.tags, r.status,
           r.helpful_count AS helpfulCount, r.created_at AS createdAt, r.updated_at AS updatedAt
    FROM reviews r
    LEFT JOIN users u ON u.id = r.user_id
    WHERE r.place_id=@placeId AND (@includePending=1 OR r.status='approved')
    ORDER BY r.created_at DESC
  `, { placeId: Number(placeId), includePending: includePending ? 1 : 0 });
  return rs.recordset;
}

async function create(placeId, user, input) {
  const status = ['admin', 'moderator'].includes(user?.role) ? 'approved' : 'pending';
  const content = normalizePlainText(input.content || input.comment || '', 1000);
  const rs = await query(`
    INSERT INTO reviews(place_id, user_id, rating, comment, content, route_code, stop_id, visit_date, tags, status)
    OUTPUT INSERTED.id, INSERTED.place_id AS placeId, INSERTED.user_id AS userId, INSERTED.rating,
           COALESCE(INSERTED.content, INSERTED.comment) AS content, INSERTED.route_code AS routeId,
           CAST(INSERTED.stop_id AS NVARCHAR(30)) AS stopId, INSERTED.visit_date AS visitDate, INSERTED.tags,
           INSERTED.status, INSERTED.helpful_count AS helpfulCount, INSERTED.created_at AS createdAt
    VALUES(@placeId, @userId, @rating, @content, @content, @routeId, @stopId, @visitDate, @tags, @status)
  `, {
    placeId: Number(placeId),
    userId: Number(user?.id || 0) || null,
    rating: Number(input.rating),
    content,
    routeId: input.routeId || null,
    stopId: input.stopId ? Number(input.stopId) : null,
    visitDate: input.visitDate || null,
    tags: Array.isArray(input.tags) ? input.tags.join(',') : input.tags || null,
    status,
  });
  if (status === 'approved') await refreshPlaceRating(placeId);
  return { ...rs.recordset[0], userName: user?.fullName || user?.email || 'SmartBus User' };
}

async function update(id, user, patch) {
  const currentRs = await query('SELECT TOP 1 * FROM reviews WHERE id=@id', { id: Number(id) });
  const current = currentRs.recordset[0];
  if (!current) return null;
  if (Number(current.user_id) !== Number(user.id) && !['admin', 'moderator'].includes(user.role)) {
    const err = new Error('Bạn không có quyền sửa review này');
    err.status = 403;
    throw err;
  }
  const rs = await query(`
    UPDATE reviews
    SET rating = COALESCE(@rating, rating),
        comment = COALESCE(@content, comment),
        content = COALESCE(@content, content),
        tags = COALESCE(@tags, tags),
        status = CASE WHEN status='approved' AND @keepStatus=0 THEN 'pending' ELSE status END,
        updated_at = SYSDATETIME()
    OUTPUT INSERTED.id, INSERTED.place_id AS placeId, INSERTED.user_id AS userId, INSERTED.rating,
           COALESCE(INSERTED.content, INSERTED.comment) AS content, INSERTED.status, INSERTED.updated_at AS updatedAt
    WHERE id=@id
  `, {
    id: Number(id),
    rating: patch.rating ? Number(patch.rating) : null,
    content: (patch.content || patch.comment) ? normalizePlainText(patch.content || patch.comment, 1000) : null,
    tags: Array.isArray(patch.tags) ? patch.tags.join(',') : patch.tags || null,
    keepStatus: ['admin', 'moderator'].includes(user.role) ? 1 : 0,
  });
  await refreshPlaceRating(current.place_id);
  return rs.recordset[0] || null;
}

async function remove(id, user) {
  const currentRs = await query('SELECT TOP 1 * FROM reviews WHERE id=@id', { id: Number(id) });
  const current = currentRs.recordset[0];
  if (!current) return null;
  if (Number(current.user_id) !== Number(user.id) && !['admin', 'moderator'].includes(user.role)) {
    const err = new Error('Bạn không có quyền xóa review này');
    err.status = 403;
    throw err;
  }
  await query("UPDATE reviews SET status='hidden', updated_at=SYSDATETIME() WHERE id=@id", { id: Number(id) });
  await refreshPlaceRating(current.place_id);
  return { id: Number(id), deleted: true };
}

async function vote(id, userId) {
  const uid = Number(userId);
  if (!Number.isFinite(uid)) { const err = new Error('Bạn cần đăng nhập để vote'); err.status = 401; throw err; }
  await query(`
    IF NOT EXISTS (SELECT 1 FROM review_votes WHERE review_id=@id AND user_id=@userId)
    BEGIN
      INSERT INTO review_votes(review_id, user_id) VALUES(@id, @userId);
      UPDATE reviews SET helpful_count = helpful_count + 1 WHERE id=@id;
    END
  `, { id: Number(id), userId: uid });
  const rs = await query('SELECT id AS reviewId, helpful_count AS helpfulCount FROM reviews WHERE id=@id', { id: Number(id) });
  return rs.recordset[0] || null;
}

async function report(id, userId, reason) {
  const rs = await query(`
    INSERT INTO review_reports(review_id, user_id, reason, status)
    OUTPUT INSERTED.id, INSERTED.review_id AS reviewId, INSERTED.user_id AS userId, INSERTED.reason, INSERTED.status, INSERTED.created_at AS createdAt
    VALUES(@id, @userId, @reason, 'new')
  `, { id: Number(id), userId: Number(userId || 0) || null, reason: normalizePlainText(reason || 'spam', 500) });
  return rs.recordset[0];
}

async function pending() {
  const rs = await query(`
    SELECT r.id, r.place_id AS placeId, r.user_id AS userId, COALESCE(u.full_name, N'Người dùng SmartBus') AS userName,
           r.rating, COALESCE(r.content, r.comment) AS content, r.status, r.created_at AS createdAt
    FROM reviews r LEFT JOIN users u ON u.id = r.user_id
    WHERE r.status='pending'
    ORDER BY r.created_at DESC
  `);
  return rs.recordset;
}



function mapCommunityReview(row) {
  return {
    id: row.id,
    reviewId: row.reviewId,
    slug: row.slug,
    userId: row.userId,
    authorName: row.authorName || 'SmartBus User',
    province: row.province,
    placeName: row.placeName,
    category: row.category,
    rating: Number(row.rating || 0),
    title: row.title,
    shortCaption: row.shortCaption,
    content: row.content,
    tips: row.tips,
    tags: row.tags,
    sourceRef: row.sourceRef,
    imageUrl: row.imageUrl,
    status: row.status,
    isSeed: Boolean(row.isSeed),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function listCommunity(filters = {}) {
  const rs = await query(`
    SELECT id, review_id AS reviewId, slug, user_id AS userId, author_name AS authorName,
           province, place_name AS placeName, category, rating, title, short_caption AS shortCaption,
           content, tips, tags, source_ref AS sourceRef, image_url AS imageUrl,
           status, is_seed AS isSeed, created_at AS createdAt, updated_at AS updatedAt
    FROM community_reviews
    WHERE status IN ('approved','approved_seed')
      AND (@q IS NULL OR title LIKE '%' + @q + '%' OR content LIKE '%' + @q + '%' OR place_name LIKE '%' + @q + '%' OR province LIKE '%' + @q + '%' OR tags LIKE '%' + @q + '%')
      AND (@province IS NULL OR province LIKE '%' + @province + '%')
      AND (@category IS NULL OR category LIKE '%' + @category + '%')
      AND (@minRating IS NULL OR rating >= @minRating)
    ORDER BY is_seed ASC, created_at DESC, rating DESC
  `, {
    q: filters.q || null,
    province: filters.province || null,
    category: filters.category || null,
    minRating: filters.minRating ? Number(filters.minRating) : null,
  });
  return rs.recordset.map(mapCommunityReview);
}

async function findCommunityById(id) {
  const rs = await query(`
    SELECT TOP 1 id, review_id AS reviewId, slug, user_id AS userId, author_name AS authorName,
           province, place_name AS placeName, category, rating, title, short_caption AS shortCaption,
           content, tips, tags, source_ref AS sourceRef, image_url AS imageUrl,
           status, is_seed AS isSeed, created_at AS createdAt, updated_at AS updatedAt
    FROM community_reviews
    WHERE id=@id AND status <> 'hidden'
  `, { id: Number(id) });
  return rs.recordset[0] ? mapCommunityReview(rs.recordset[0]) : null;
}

async function createCommunity(user, input) {
  const content = normalizePlainText(input.content || '', 5000);
  const title = normalizePlainText(input.title || '', 200);
  const placeName = normalizePlainText(input.placeName || input.place_name || '', 200);
  const rating = Number(input.rating);
  if (!title || !placeName || content.length < 30 || !Number.isFinite(rating) || rating < 1 || rating > 5) {
    const err = new Error('Tiêu đề, địa điểm, nội dung tối thiểu 30 ký tự và rating 1-5 là bắt buộc');
    err.status = 400;
    throw err;
  }
  const status = user?.role === 'admin' ? 'approved' : 'pending';
  const rs = await query(`
    INSERT INTO community_reviews(user_id, author_name, province, place_name, category, rating, title, short_caption, content, tips, tags, source_ref, image_url, status, is_seed)
    OUTPUT INSERTED.id, INSERTED.review_id AS reviewId, INSERTED.slug, INSERTED.user_id AS userId, INSERTED.author_name AS authorName,
           INSERTED.province, INSERTED.place_name AS placeName, INSERTED.category, INSERTED.rating, INSERTED.title,
           INSERTED.short_caption AS shortCaption, INSERTED.content, INSERTED.tips, INSERTED.tags,
           INSERTED.source_ref AS sourceRef, INSERTED.image_url AS imageUrl, INSERTED.status, INSERTED.is_seed AS isSeed,
           INSERTED.created_at AS createdAt, INSERTED.updated_at AS updatedAt
    VALUES(@userId, @authorName, @province, @placeName, @category, @rating, @title, @shortCaption, @content, @tips, @tags, @sourceRef, @imageUrl, @status, 0)
  `, {
    userId: Number(user?.id || 0) || null,
    authorName: normalizePlainText(user?.fullName || user?.email || input.authorName || 'SmartBus User', 150),
    province: normalizePlainText(input.province || 'Đà Nẵng', 120),
    placeName,
    category: normalizePlainText(input.category || 'Du lịch', 120),
    rating,
    title,
    shortCaption: normalizePlainText(input.shortCaption || input.short_caption || title, 500),
    content,
    tips: normalizePlainText(input.tips || '', 1000),
    tags: Array.isArray(input.tags) ? input.tags.join(' ') : normalizePlainText(input.tags || '', 500),
    sourceRef: input.sourceRef || null,
    imageUrl: input.imageUrl || input.image_url || null,
    status,
  });
  return mapCommunityReview(rs.recordset[0]);
}

async function setStatus(id, status, moderator) {
  const rs = await query(`
    UPDATE reviews
    SET status=@status, moderated_by=@moderatorId, moderated_at=SYSDATETIME(), updated_at=SYSDATETIME()
    OUTPUT INSERTED.id, INSERTED.place_id AS placeId, INSERTED.user_id AS userId, INSERTED.rating,
           COALESCE(INSERTED.content, INSERTED.comment) AS content, INSERTED.status, INSERTED.moderated_at AS moderatedAt
    WHERE id=@id
  `, { id: Number(id), status, moderatorId: moderator?.id || null });
  if (rs.recordset[0]) await refreshPlaceRating(rs.recordset[0].placeId);
  return rs.recordset[0] || null;
}


async function adminListCommunity(filters = {}) {
  const allowedStatuses = ['pending', 'approved', 'approved_seed', 'hidden', 'all'];
  const status = allowedStatuses.includes(String(filters.status || '').toLowerCase()) ? String(filters.status || '').toLowerCase() : 'all';
  const sort = ['newest', 'oldest', 'rating_desc'].includes(String(filters.sort || '').toLowerCase()) ? String(filters.sort || '').toLowerCase() : 'newest';
  const rs = await query(`
    SELECT id, review_id AS reviewId, slug, user_id AS userId, author_name AS authorName,
           province, place_name AS placeName, category, rating, title, short_caption AS shortCaption,
           content, tips, tags, source_ref AS sourceRef, image_url AS imageUrl,
           status, is_seed AS isSeed, created_at AS createdAt, updated_at AS updatedAt
    FROM community_reviews
    WHERE (@status = 'all' OR status = @status)
      AND (@q IS NULL OR title LIKE '%' + @q + '%' OR content LIKE '%' + @q + '%' OR place_name LIKE '%' + @q + '%' OR author_name LIKE '%' + @q + '%' OR province LIKE '%' + @q + '%' OR tags LIKE '%' + @q + '%')
      AND (@province IS NULL OR province LIKE '%' + @province + '%')
      AND (@category IS NULL OR category LIKE '%' + @category + '%')
    ORDER BY
      CASE WHEN @sort = 'oldest' THEN created_at END ASC,
      CASE WHEN @sort = 'rating_desc' THEN rating END DESC,
      created_at DESC
  `, {
    status,
    sort,
    q: filters.q || filters.search || null,
    province: filters.province || null,
    category: filters.category || null,
  });
  return rs.recordset.map(mapCommunityReview);
}

async function adminSetCommunityStatus(id, status, admin) {
  const nowStatus = status === 'approved_seed' ? 'approved' : status;
  const rs = await query(`
    UPDATE community_reviews
    SET status=@status, updated_at=SYSDATETIME()
    OUTPUT INSERTED.id, INSERTED.review_id AS reviewId, INSERTED.slug, INSERTED.user_id AS userId,
           INSERTED.author_name AS authorName, INSERTED.province, INSERTED.place_name AS placeName,
           INSERTED.category, INSERTED.rating, INSERTED.title, INSERTED.short_caption AS shortCaption,
           INSERTED.content, INSERTED.tips, INSERTED.tags, INSERTED.source_ref AS sourceRef,
           INSERTED.image_url AS imageUrl, INSERTED.status, INSERTED.is_seed AS isSeed,
           INSERTED.created_at AS createdAt, INSERTED.updated_at AS updatedAt
    WHERE id=@id
  `, { id: Number(id), status: nowStatus, adminId: Number(admin?.id || 0) || null });
  return rs.recordset[0] ? mapCommunityReview(rs.recordset[0]) : null;
}

async function adminRemoveCommunity(id, admin) {
  return adminSetCommunityStatus(id, 'hidden', admin);
}


async function adminListPlaceReviews(filters = {}) {
  const allowedStatuses = ['pending', 'approved', 'hidden', 'all'];
  const status = allowedStatuses.includes(String(filters.status || '').toLowerCase()) ? String(filters.status || '').toLowerCase() : 'pending';
  const sort = ['newest', 'oldest', 'rating_desc'].includes(String(filters.sort || '').toLowerCase()) ? String(filters.sort || '').toLowerCase() : 'newest';
  const rs = await query(`
    SELECT
      r.id,
      r.place_id AS placeId,
      r.user_id AS userId,
      COALESCE(u.full_name, u.email, N'Người dùng SmartBus') AS authorName,
      COALESCE(p.name, N'Địa điểm chưa rõ') AS placeName,
      COALESCE(pr.name, p.province_code, N'') AS province,
      COALESCE(c.name, c.code, N'Review địa điểm') AS category,
      r.rating,
      COALESCE(r.content, r.comment) AS content,
      LEFT(COALESCE(r.content, r.comment, N''), 130) AS shortCaption,
      CONCAT(N'Review địa điểm #', r.id) AS title,
      r.tags,
      r.status,
      CAST(0 AS BIT) AS isSeed,
      r.created_at AS createdAt,
      r.updated_at AS updatedAt
    FROM reviews r
    LEFT JOIN users u ON u.id = r.user_id
    LEFT JOIN tourist_places p ON p.id = r.place_id
    LEFT JOIN provinces pr ON pr.code = p.province_code
    LEFT JOIN tourist_categories c ON c.id = p.category_id
    WHERE (@status = 'all' OR r.status = @status)
      AND (@q IS NULL OR COALESCE(r.content, r.comment, N'') LIKE '%' + @q + '%' OR p.name LIKE '%' + @q + '%' OR u.full_name LIKE '%' + @q + '%')
      AND (@province IS NULL OR pr.name LIKE '%' + @province + '%' OR p.province_code LIKE '%' + @province + '%')
      AND (@category IS NULL OR c.name LIKE '%' + @category + '%' OR c.code = @category)
    ORDER BY
      CASE WHEN @sort = 'oldest' THEN r.created_at END ASC,
      CASE WHEN @sort = 'rating_desc' THEN r.rating END DESC,
      r.created_at DESC
  `, {
    status,
    sort,
    q: filters.q || filters.search || null,
    province: filters.province || null,
    category: filters.category || null,
  });
  return rs.recordset.map(mapCommunityReview);
}

module.exports = { listByPlace, create, update, remove, vote, report, pending, setStatus, listCommunity, findCommunityById, createCommunity, adminListCommunity, adminListPlaceReviews, adminSetCommunityStatus, adminRemoveCommunity };

