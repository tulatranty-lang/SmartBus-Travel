function getPagination(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page || 1, 10) || 1);
  const rawLimit = Number.parseInt(query.limit || 20, 10) || 20;
  const limit = Math.min(100, Math.max(1, rawLimit));
  return { page, limit, offset: (page - 1) * limit };
}

function buildPagination({ page, limit, total }) {
  const safeTotal = Number(total || 0);
  return { page, limit, total: safeTotal, totalPages: Math.max(1, Math.ceil(safeTotal / limit)) };
}

function paginateArray(items = [], query = {}) {
  const { page, limit, offset } = getPagination(query || {});
  const total = Array.isArray(items) ? items.length : 0;
  return {
    items: (items || []).slice(offset, offset + limit),
    pagination: buildPagination({ page, limit, total }),
  };
}

module.exports = { getPagination, buildPagination, paginateArray };
