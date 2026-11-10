const slugify = require("slugify"),
  { sql, getPool } = require("../../config/db"),
  repo = require("./import.repository"),
  cache = require("../../common/utils/cache.util");
function invalid(message) {
  return Object.assign(new Error(message), {
    status: 422,
    errorCode: "INVALID_IMPORT",
  });
}
function normalize(body, type) {
  if (
    !body ||
    Object.keys(body).some((k) => k !== "items") ||
    !Array.isArray(body.items) ||
    body.items.length < 1 ||
    body.items.length > 200
  )
    throw invalid(
      "Gửi JSON {items:[...]} gồm 1–200 bản ghi, không gửi đường dẫn tệp.",
    );
  const keys = new Set();
  return body.items.map((v, i) => {
    if (!v || typeof v !== "object" || Array.isArray(v))
      throw invalid(`Bản ghi ${i + 1} không hợp lệ.`);
    if (typeof v.name !== 'string' || typeof v.provinceCode !== 'string' ||
        (v.description !== undefined && typeof v.description !== 'string') ||
        (type === 'bus-data' && typeof v.routeCode !== 'string'))
      throw invalid(`Bản ghi ${i + 1}: tên, khu vực và mã phải là chuỗi.`);
    const name = String(v.name || "")
        .replace(/<[^>]*>/g, "")
        .trim(),
      province = String(v.provinceCode || "").toUpperCase();
    if (
      name.length < 2 ||
      name.length > 200 ||
      !["DN", "QN_CU", "HUE", "QT", "QNG"].includes(province)
    )
      throw invalid(`Bản ghi ${i + 1}: tên/provinceCode không hợp lệ.`);
    const code =
      type === "bus-data"
        ? String(v.routeCode || "").trim()
        : slugify(name, { lower: true, strict: true, locale: "vi" });
    const validCode = type === 'bus-data' ? /^[A-Za-z0-9_-]{1,50}$/ : /^[A-Za-z0-9_-]{1,180}$/;
    const identity = code.toLowerCase();
    if (!validCode.test(code) || keys.has(identity))
      throw invalid(`Bản ghi ${i + 1}: mã trùng hoặc không hợp lệ.`);
    keys.add(identity);
    const latitude = Number(v.latitude),
      longitude = Number(v.longitude);
    if (
      type === "tourism-data" &&
      (v.latitude == null ||
        v.longitude == null ||
        v.latitude === "" ||
        v.longitude === "" ||
        !Number.isFinite(latitude) ||
        latitude < 8 ||
        latitude > 24 ||
        !Number.isFinite(longitude) ||
        longitude < 102 ||
        longitude > 110)
    )
      throw invalid(`Bản ghi ${i + 1}: tọa độ Việt Nam không hợp lệ.`);
    return {
      name,
      province,
      code,
      latitude,
      longitude,
      description: String(v.description || "")
        .replace(/<[^>]*>/g, "")
        .slice(0, 3000),
    };
  });
}
async function importRows(type, body, user) {
  const items = normalize(body, type),
    tx = new sql.Transaction(await getPool());
  await tx.begin();
  try {
    for (const row of items) {
      const req = new sql.Request(tx)
        .input("code", sql.NVarChar(200), row.code)
        .input("name", sql.NVarChar(200), row.name)
        .input("province", sql.NVarChar(30), row.province)
        .input("description", sql.NVarChar(3000), row.description);
      if (type === "bus-data")
        await req.query(
          `IF EXISTS(SELECT 1 FROM bus_routes WITH(UPDLOCK,HOLDLOCK) WHERE route_code=@code) UPDATE bus_routes SET name=@name,province_code=@province,description=@description WHERE route_code=@code; ELSE INSERT bus_routes(route_code,name,province_code,description,is_active)VALUES(@code,@name,@province,@description,1);`,
        );
      else
        await req
          .input("lat", sql.Float, row.latitude)
          .input("lng", sql.Float, row.longitude)
          .query(
            `IF EXISTS(SELECT 1 FROM tourist_places WITH(UPDLOCK,HOLDLOCK) WHERE slug=@code) UPDATE tourist_places SET name=@name,province_code=@province,latitude=@lat,longitude=@lng,description=@description,updated_at=SYSUTCDATETIME() WHERE slug=@code; ELSE INSERT tourist_places(name,slug,province_code,latitude,longitude,description,is_active)VALUES(@name,@code,@province,@lat,@lng,@description,1);`,
          );
    }
    const record = await new sql.Request(tx)
      .input("type", type)
      .input("count", sql.Int, items.length)
      .input("note", `JSON import by account ${user.id}`)
      .query(
        "INSERT import_history(source_type,source_file,status,rows_total,rows_success,rows_failed,message) OUTPUT INSERTED.id VALUES(@type,N'API JSON',N'completed',@count,@count,0,@note)",
      );
    await tx.commit();
    cache.clear();
    return {
      id: record.recordset[0].id,
      importType: type,
      status: "completed",
      totalRows: items.length,
      processedRows: items.length,
    };
  } catch (e) {
    await tx.rollback().catch(() => {});
    throw e;
  }
}
module.exports = { history: repo.history, importRows, normalize };
