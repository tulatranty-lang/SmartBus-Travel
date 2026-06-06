const { getPagination, paginateArray } = require('../../common/utils/pagination.util');

describe('pagination util', () => {
  test('limits page and limit safely', () => {
    expect(getPagination({ page: '-2', limit: '999' })).toEqual({ page: 1, limit: 100, offset: 0 });
  });
  test('returns data and pagination', () => {
    const result = paginateArray([1, 2, 3, 4, 5], { page: 2, limit: 2 });
    expect(result.items).toEqual([3, 4]);
    expect(result.pagination).toEqual({ page: 2, limit: 2, total: 5, totalPages: 3 });
  });
});
