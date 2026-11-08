const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const ExcelJS = require("exceljs");
const { loadFile, parseCsv } = require("../../scripts/import-smartbus-data");
let dir;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "smartbus-import-"));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));
test("reads Unicode XLSX headers and handles empty cells", async () => {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Tuyến");
  sheet.addRow(["mã_tuyến", "tên_tuyến", "số_xe"]);
  sheet.addRow(["DN-01", "Tuyến Đà Nẵng", 4]);
  sheet.addRow(["DN-02", "Tuyến Hội An"]);
  const file = path.join(dir, "routes.xlsx");
  await book.xlsx.writeFile(file);
  const result = await loadFile(file);
  expect(result.rawSheets["Tuyến"]).toEqual([
    { mã_tuyến: "DN-01", tên_tuyến: "Tuyến Đà Nẵng", số_xe: "4" },
    { mã_tuyến: "DN-02", tên_tuyến: "Tuyến Hội An", số_xe: "" },
  ]);
});
test("CSV parser retains quoted commas and newlines", () => {
  const file = path.join(dir, "rows.csv");
  fs.writeFileSync(file, 'name,note\r\n"Hội An, Quảng Nam","hai\ndòng"\r\n');
  expect(parseCsv(file)).toEqual([
    { name: "Hội An, Quảng Nam", note: "hai\ndòng" },
  ]);
});
test("legacy binary XLS is rejected with supported-format instruction", async () => {
  await expect(loadFile(path.join(dir, "old.xls"))).rejects.toThrow(
    "Chỉ hỗ trợ .json, .csv, .xlsx",
  );
});
