jest.mock("../../modules/tourism/tourism.service", () => ({
  search: jest.fn(),
}));
const { detect } = require("../../modules/chat/chat-intent.service");
const { targetPlaces } = require("../../modules/chat/chat.service");
const tourism = require("../../modules/tourism/tourism.service");
test.each([
  ["Tuyến DN-03 giá vé bao nhiêu?", "ask_fare"],
  ["Tuyến DN-03 giờ chạy thế nào?", "ask_schedule"],
  ["Gợi ý lịch trình Hội An 1 ngày", "ask_trip_plan"],
  ["Có bao nhiêu tuyến xe?", "ask_stats"],
  ["Tuyến DN-03 khi nào đến?", "ask_bus_eta"],
  ["Bến xe buýt gần tôi nhất ở đâu?", "ask_nearest_stop"],
])("correctly separates intent: %s", (message, intent) =>
  expect(detect(message).intent).toBe(intent),
);
test("explicit province disambiguates the same beach name", () => {
  const e = detect("Đi Mỹ Khê Quảng Ngãi").entities;
  expect(e.provinceCode).toBe("QNG");
  expect(e.routeId).toBe("QNG-03");
});
test("a named destination does not match a casual mention in unrelated metadata", async () => {
  tourism.search.mockResolvedValue([
    { id: 1, name: "Bảo tàng Chăm", description: "Có thể đi Hội An sau đó" },
    { id: 2, name: "Phố cổ Hội An" },
  ]);
  const result = await targetPlaces("Đi Hội An", detect("Đi Hội An").entities);
  expect(result.map((x) => x.id)).toEqual([2]);
  expect(tourism.search).toHaveBeenCalledWith(
    expect.objectContaining({ q: "Hội An", provinceCode: "QN_CU" }),
  );
});
