function ok(res, data = {}, message = 'OK', pagination = undefined) {
  const payload = { success: true, data, message };
  if (pagination) payload.pagination = pagination;
  return res.json(payload);
}

function created(res, data = {}, message = 'Created', pagination = undefined) {
  const payload = { success: true, data, message };
  if (pagination) payload.pagination = pagination;
  return res.status(201).json(payload);
}

function fail(res, status = 400, message = 'Bad request', errors = [], errorCode = 'BAD_REQUEST') {
  return res.status(status).json({ success: false, message, errorCode, errors });
}

function chat(res, data = {}, message = 'OK') {
  // Giữ tương thích frontend cũ: reply/intent ở root, đồng thời vẫn có data chuẩn.
  return res.json({ success: true, message, ...data, data });
}

module.exports = { ok, created, fail, chat };
