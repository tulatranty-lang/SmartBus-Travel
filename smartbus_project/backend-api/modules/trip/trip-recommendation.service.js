function inferInterests(interests = []) {
  const values = Array.isArray(interests) ? interests : String(interests || '').split(',');
  return values.map((x) => String(x).trim().toLowerCase()).filter(Boolean);
}
function chooseLimit(timeAvailable) {
  const t = String(timeAvailable || '').toLowerCase();
  if (/cuối tuần|weekend/.test(t)) return 5;
  if (/1 ngày|một ngày|day/.test(t)) return 4;
  return 2;
}
module.exports = { inferInterests, chooseLimit };
