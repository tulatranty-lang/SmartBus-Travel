jest.mock("../../modules/tourism/tourism.service", () => ({
  search: jest.fn(),
}));
jest.mock("../../modules/trip/trip.repository", () => ({
  savePlan: jest.fn(),
}));
const trip = require("../../modules/trip/trip.service");
const tourism = require("../../modules/tourism/tourism.service");
const cache = require("../../common/utils/cache.util");
const { normalize } = require("../../modules/import/import.service");
const { batches } = require("../../scripts/migrate");
const { haversineMeters } = require("../../common/utils/distance.util");
const base = {
  provinceCode: "DN",
  latitude: 16.047,
  longitude: 108.206,
  averageRating: 0,
};

beforeEach(() => cache.clear());
test("same point remains zero distance and antipodal result is finite", () => {
  expect(trip.distanceBetween(base, base)).toBe(0);
  expect(
    Number.isFinite(haversineMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 180 })),
  ).toBe(true);
});
test("exact province anchor does not select another province", () => {
  expect(trip.inferProvinceFromInput({ lat: 16.0544, lng: 108.2022 })).toBe(
    "DN",
  );
});
test("explicit province never falls back to unrelated destinations", () => {
  expect(
    trip.buildSmartItinerary(
      [{ ...base, id: 1, name: "Other", provinceCode: "HUE" }],
      {},
      [],
      "DN",
    ),
  ).toEqual([]);
});
test("itinerary deduplicates names and IDs and limits half-day stops", () => {
  const places = [
    { ...base, id: 1, name: "A" },
    { ...base, id: 1, name: "B" },
    { ...base, id: 2, name: "A" },
    { ...base, id: 3, name: "C" },
  ];
  const r = trip.buildSmartItinerary(
    places,
    { timeAvailable: "nửa ngày" },
    [],
    "DN",
  );
  expect(r).toHaveLength(2);
  expect(new Set(r.map((x) => x.id)).size).toBe(2);
  expect(new Set(r.map((x) => x.name)).size).toBe(2);
});
test("empty candidate set yields an honest unsaved empty result", async () => {
  tourism.search.mockResolvedValue([]);
  const plan = await trip.generate({ provinceCode: "DN" }, null, false);
  expect(plan.items).toEqual([]);
  expect(plan.itineraryId).toBeNull();
});
test("database failure is not substituted with static destinations", async () => {
  tourism.search.mockRejectedValue(new Error("offline"));
  await expect(
    trip.generate({ provinceCode: "DN" }, null, false),
  ).rejects.toMatchObject({ status: 503, errorCode: "TRIP_DATA_UNAVAILABLE" });
});
test.each([
  null,
  {},
  { filePath: "/etc/passwd" },
  { items: [] },
  { items: new Array(201).fill({}) },
])("import rejects unsafe or invalid request %j", (body) => {
  expect(() => normalize(body, "tourism-data")).toThrow();
});
test("import rejects duplicate identifiers before writing any row", () => {
  expect(() =>
    normalize(
      {
        items: [
          { name: "Same", provinceCode: "DN", latitude: 16, longitude: 108 },
          { name: "Same", provinceCode: "DN", latitude: 16, longitude: 108 },
        ],
      },
      "tourism-data",
    ),
  ).toThrow();
});
test.each([null, "", true, "NaN", 91])(
  "import rejects missing, nonnumeric or out-of-region latitude %j",
  (latitude) => {
    expect(() =>
      normalize(
        {
          items: [
            { name: "Place", provinceCode: "DN", latitude, longitude: 108 },
          ],
        },
        "tourism-data",
      ),
    ).toThrow();
  },
);
test("migration batch separator respects literals and rejects unsafe database name", () => {
  expect(
    batches("SELECT 'GO'\nGO\nSELECT 2\nGO -- separator", "SmartBusTest"),
  ).toHaveLength(2);
  expect(() => batches("SELECT 1", "DB]; DROP TABLE users;--")).toThrow();
});
test('route import treats case variants as one SQL identifier',()=>{
 expect(()=>normalize({items:[{name:'First',provinceCode:'DN',routeCode:'QA-01'},{name:'Second',provinceCode:'DN',routeCode:'qa-01'}]},'bus-data')).toThrow();
});
test('malformed scalar fields produce validation errors before coercion',()=>{
 for(const patch of [{name:{toString:null}},{provinceCode:[]},{description:{toString:null}}])expect(()=>normalize({items:[{name:'Valid place',provinceCode:'DN',latitude:16,longitude:108,...patch}]},'tourism-data')).toThrow(expect.objectContaining({status:422}));
});
test('long valid tourism names are not limited by bus route code length',()=>{
 const rows=normalize({items:[{name:'Địa điểm tham quan văn hóa lịch sử tại thành phố Đà Nẵng miền Trung',provinceCode:'DN',latitude:16,longitude:108}]},'tourism-data');expect(rows[0].code.length).toBeGreaterThan(50);
});
test('migration checksums survive Windows line endings while rejecting changed SQL',()=>{
 const {fingerprints}=require('../../scripts/migrate');
 expect(fingerprints('SELECT 1\nGO\n')).toEqual(fingerprints('SELECT 1\r\nGO\r\n'));
 expect(fingerprints('SELECT 2\nGO\n').some(hash=>fingerprints('SELECT 1\nGO\n').includes(hash))).toBe(false);
});
