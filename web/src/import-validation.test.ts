import { describe, expect, it } from "vitest";
import { parseImport } from "./import-validation";
const valid = {
  name: "Địa điểm kiểm thử",
  provinceCode: "DN",
  latitude: 16.05,
  longitude: 108.2,
};
describe("Import preview protects deliberate database writes", () => {
  it("accepts an array and wraps it for the API", () =>
    expect(parseImport(JSON.stringify([valid]), "tourism-data")).toEqual({
      items: [valid],
    }));
  it("accepts explicit items and a bus route code", () =>
    expect(
      parseImport(
        JSON.stringify({
          items: [
            {
              name: "Tuyến kiểm thử",
              provinceCode: "DN",
              routeCode: "DN-QA_01",
            },
          ],
        }),
        "bus-data",
      ).items,
    ).toHaveLength(1));
  it.each([
    "",
    "{broken",
    "null",
    "[]",
    '{"items":[]}',
    '{"items":[null]}',
    '{"items":[{}]}',
  ])("rejects malformed or empty input: %s", (s) =>
    expect(() => parseImport(s, "tourism-data")).toThrow(),
  );
  it("rejects more than 200 records", () =>
    expect(() =>
      parseImport(JSON.stringify(Array(201).fill(valid)), "tourism-data"),
    ).toThrow("200"));
  it("rejects server-side file paths instead of JSON rows", () =>
    expect(() =>
      parseImport(
        JSON.stringify({ items: [valid], filePath: "secret.env" }),
        "tourism-data",
      ),
    ).toThrow());
  it.each([
    { latitude: null },
    { latitude: "" },
    { longitude: 181 },
    { latitude: 0 },
    { provinceCode: "UNKNOWN" },
    { description: 123 },
    { name: "a" },
  ])("rejects an invalid row: %j", (change) =>
    expect(() =>
      parseImport(JSON.stringify([{ ...valid, ...change }]), "tourism-data"),
    ).toThrow(),
  );
  it("rejects route duplicates regardless of case", () =>
    expect(() =>
      parseImport(
        JSON.stringify([
          { name: "Một tuyến", routeCode: "DN-QA", provinceCode: "DN" },
          { name: "Tuyến khác", routeCode: "dn-qa", provinceCode: "DN" },
        ]),
        "bus-data",
      ),
    ).toThrow("trùng"));
  it("rejects normalized duplicate place names", () =>
    expect(() =>
      parseImport(
        JSON.stringify([valid, { ...valid, name: "Dia diem kiem thu" }]),
        "tourism-data",
      ),
    ).toThrow("trùng"));
  it("rejects excessively large input before parsing", () =>
    expect(() =>
      parseImport(" ".repeat(2 * 1024 * 1024 + 1), "tourism-data"),
    ).toThrow("2 MB"));
});
