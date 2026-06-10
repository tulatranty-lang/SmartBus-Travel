const { isValidLatLng } = require('../../common/utils/gis-validator.util');

describe('GIS coordinate validator', () => {
  test('accepts coordinates inside Vietnam', () => {
    expect(isValidLatLng(16.047, 108.206, true)).toBe(true);
  });
  test('rejects 0,0 and coordinates outside Vietnam', () => {
    expect(isValidLatLng(0, 0, true)).toBe(false);
    expect(isValidLatLng(48.8566, 2.3522, true)).toBe(false);
  });
});
