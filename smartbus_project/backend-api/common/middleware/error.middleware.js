const env = require('../../config/env');

function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;

  if (status >= 500) {
    console.error(`[${new Date().toISOString()}] ${req?.id || '-'} ERROR ${err.message}`, env.nodeEnv !== 'production' ? err.stack : '');
  }
  const payload = {
    success: false,
    message: status >= 500 ? 'Lỗi hệ thống. Vui lòng thử lại sau.' : err.message,
    errorCode: err.errorCode || (status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR'),
    requestId: req?.id,
    errors: err.errors || [],
  };
  if (env.nodeEnv !== 'production') payload.stack = err.stack;
  return res.status(status).json(payload);
}

module.exports = { errorHandler };
