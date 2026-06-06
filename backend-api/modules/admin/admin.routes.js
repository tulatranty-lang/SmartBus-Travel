const router = require('express').Router();
const c = require('./admin.controller');
const v = require('./admin.validator');
const validate = require('../../common/middleware/validate.middleware');
const { requireAuth } = require('../../common/middleware/auth.middleware');
const { requireRole } = require('../../common/middleware/role.middleware');
const asyncHandler = require('../../common/utils/async-handler');

// Khu vực quản trị nội dung chỉ dành cho Admin. Không cho moderator/user/driver.
router.use(requireAuth, requireRole('admin'));

// Review cộng đồng trong bảng community_reviews.
router.get('/reviews', asyncHandler(c.reviews));
router.get('/reviews/pending', asyncHandler(c.pendingReviews));
router.put('/reviews/:id/approve', v.id, validate, asyncHandler(c.approveReview));
router.put('/reviews/:id/hide', v.id, validate, asyncHandler(c.hideReview));
router.delete('/reviews/:id', v.id, validate, asyncHandler(c.deleteReview));

// Bài cộng đồng trong bảng community_posts.
router.get('/community/pending', asyncHandler(c.pendingCommunity));
router.put('/community/:id/approve', v.id, validate, asyncHandler(c.approveCommunity));
router.put('/community/:id/hide', v.id, validate, asyncHandler(c.hideCommunity));
router.delete('/community/:id', v.id, validate, asyncHandler(c.deleteCommunity));

// Địa điểm du lịch.
router.get('/places', asyncHandler(c.places));
router.post('/places', v.place, validate, asyncHandler(c.createPlace));
router.put('/places/:id', v.id, v.placeUpdate, validate, asyncHandler(c.updatePlace));
router.delete('/places/:id', v.id, validate, asyncHandler(c.deletePlace));

module.exports = router;
