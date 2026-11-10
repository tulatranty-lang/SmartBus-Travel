const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { sql, config, closePool } = require("../config/db");
const env = require("../config/env");
const directory = path.resolve(__dirname, "../../database");
const schemaFiles = [
  "01_SCHEMA_SMARTBUS_CORE.sql",
  "99_ARCHITECT_UPGRADE_FIXES.sql",
  "06_UPDATE_SMARTBUS_DEMO_LINKED_FEATURES.sql",
  "07_ADMIN_CONTENT_MANAGEMENT.sql",
  "08_ACTIVITY_HISTORY_TOURISM_ADMIN_FIXES.sql",
  "09_FIX_BACKEND_LINKING_PERFORMANCE_REVIEW_MODERATION.sql",
  "10_FIX_CORE_LINKING_PERFORMANCE.sql",
  "11_FIX_STATS_ACTIVITY_PERFORMANCE.sql",
  "12_SESSION_INTEGRITY.sql",
];
const seedFiles = [
  "02_IMPORT_4_TINH_HIEN_CO.sql",
  "03_IMPORT_QUANG_NAM_CU.sql",
  "04_SEED_BUS_VEHICLES.sql",
  "05_SEED_CHATBOT_KNOWLEDGE.sql",
];
function fingerprints(source) {
  // Git for Windows may check out CRLF. Accept the legacy raw checksum for
  // either line ending, while continuing to reject actual SQL content edits.
  const lf = source.replace(/\r\n/g, "\n");
  return [
    ...new Set(
      [lf, lf.replace(/\n/g, "\r\n")].map((text) =>
        crypto.createHash("sha256").update(text).digest("hex"),
      ),
    ),
  ];
}
function batches(source, name) {
  if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(name))
    throw Error("DB_NAME must contain only letters, digits and underscores.");
  return source
    .replace(/SmartBusDB/g, name)
    .split(/^\s*GO\s*(?:--[^\r\n]*)?$/gim)
    .map((s) => s.trim())
    .filter(Boolean);
}
async function migrate({ seed = false } = {}) {
  const name = env.db.name;
  batches("", name);
  // Historical seed files contain hundreds of MERGEs in one batch. A cold
  // Windows SQL instance can need longer than the API's 15-second timeout.
  const requestedTimeout = Number(
    process.env.DB_MIGRATION_TIMEOUT_MS || 120000,
  );
  const migrationConfig = {
    ...config,
    requestTimeout:
      Number.isFinite(requestedTimeout) && requestedTimeout >= 1000
        ? requestedTimeout
        : 120000,
  };
  const master = await new sql.ConnectionPool({
    ...migrationConfig,
    database: "master",
  }).connect();
  try {
    await master
      .request()
      .batch(`IF DB_ID(N'${name}') IS NULL CREATE DATABASE [${name}];`);
  } finally {
    await master.close();
  }
  const pool = await new sql.ConnectionPool(migrationConfig).connect(),
    tx = new sql.Transaction(pool);
  await tx.begin();
  const request = () => new sql.Request(tx);
  let count = 0;
  try {
    const lock = await request().batch(
      "DECLARE @r int; EXEC @r=sp_getapplock @Resource=N'SmartBus.schema',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000; SELECT @r AS result;",
    );
    if (lock.recordset[0].result < 0)
      throw Error("Another database upgrade is running.");
    await request().batch(
      "IF OBJECT_ID(N'dbo.smartbus_migrations',N'U') IS NULL CREATE TABLE dbo.smartbus_migrations(name nvarchar(180) NOT NULL PRIMARY KEY,checksum char(64) NOT NULL,applied_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME());",
    );
    for (const file of [...schemaFiles, ...(seed ? seedFiles : [])]) {
      const text = fs.readFileSync(path.join(directory, file), "utf8"),
        hashes = fingerprints(text),
        hash = hashes[0];
      const old = await request()
        .input("name", sql.NVarChar(180), file)
        .query("SELECT checksum FROM dbo.smartbus_migrations WHERE name=@name");
      if (old.recordset.length) {
        if (!hashes.includes(old.recordset[0].checksum))
          throw Error(
            `Migration checksum changed: ${file}; restore the applied source and add a new migration.`,
          );
        continue;
      }
      let index = 0;
      for (const batch of batches(text, name)) {
        index++;
        // The historical 06 view uses duplicate/obsolete columns. Migration 12 replaces it.
        if (
          file.startsWith("06_") &&
          /CREATE OR ALTER VIEW dbo\.vw_demo_bus_vehicle_locations/i.test(batch)
        )
          continue;
        if (/^\s*(?:\/\*[\s\S]*?\*\/\s*)?IF DB_ID\(/i.test(batch)) continue;
        const clean = batch
          .replace(/^\s*USE\s+\[?\w+\]?\s*;?\s*$/gim, "")
          .trim();
        if (clean)
          try {
            await request().batch(clean);
          } catch (e) {
            e.message = `${file}, batch ${index}: ${e.message}`;
            throw e;
          }
      }
      await request()
        .input("name", sql.NVarChar(180), file)
        .input("hash", sql.Char(64), hash)
        .query(
          "INSERT dbo.smartbus_migrations(name,checksum) VALUES(@name,@hash)",
        );
      count++;
      console.log(`Applied ${file}`);
    }
    await tx.commit();
    console.log(
      `Database ready: ${count} file(s) applied. Existing accounts/history preserved.`,
    );
    return count;
  } catch (e) {
    await tx.rollback().catch(() => {});
    throw e;
  } finally {
    await pool.close();
  }
}
if (require.main === module)
  migrate({ seed: process.argv.includes("--seed") })
    .catch((e) => {
      console.error("Database setup failed:", e.message);
      process.exitCode = 1;
    })
    .finally(closePool);
module.exports = { migrate, batches, schemaFiles, seedFiles, fingerprints };
