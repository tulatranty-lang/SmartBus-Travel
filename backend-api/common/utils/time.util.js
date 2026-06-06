function nowIso() { return new Date().toISOString(); }
function parseIntervalMinutes(intervalText, fallback = 15) {
  const nums = String(intervalText || '').match(/\d+/g)?.map(Number) || [];
  if (!nums.length) return fallback;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}
module.exports = { nowIso, parseIntervalMinutes };
