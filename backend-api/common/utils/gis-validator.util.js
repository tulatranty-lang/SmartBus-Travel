function isValidLatLng(lat, lng, vietnamOnly = false) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (latitude === 0 && longitude === 0) return false;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return false;
  if (vietnamOnly && (latitude < 8 || latitude > 24 || longitude < 102 || longitude > 110)) return false;
  return true;
}

function normalizeCoordinate(row, latKeys = ['latitude', 'lat'], lngKeys = ['longitude', 'lng']) {
  const latKey = latKeys.find((k) => row[k] !== undefined && row[k] !== null);
  const lngKey = lngKeys.find((k) => row[k] !== undefined && row[k] !== null);
  const latitude = Number(row[latKey]);
  const longitude = Number(row[lngKey]);
  return { latitude, longitude, valid: isValidLatLng(latitude, longitude, true) };
}

module.exports = { isValidLatLng, normalizeCoordinate };
