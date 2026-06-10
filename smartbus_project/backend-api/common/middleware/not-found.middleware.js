module.exports = function notFound(req, res) {
  res.status(404).json({ success: false, message: `Không tìm thấy API ${req.method} ${req.originalUrl}`, errorCode: 'NOT_FOUND', errors: [] });
};
