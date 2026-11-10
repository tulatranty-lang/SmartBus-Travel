const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const db = require("../../config/db");
const migration = require("../../scripts/migrate");
async function main() {
  assert.equal(process.env.SQL_TEST_DISPOSABLE, "1");
  assert.equal(db.config.database, process.env.SMARTBUS_TEST_DATABASE);
  assert.match(db.config.database, /upgrade.*test/i);
  const newest = migration.schemaFiles.pop();
  await migration.migrate({ seed: true });
  const email = `upgrade-${randomUUID()}@example.test`;
  const passwordHash = "sentinel-hash-preserved-without-reset";
  const user = (
    await db.query(
      "INSERT users(full_name,email,password_hash,role,is_active) OUTPUT INSERTED.id VALUES(N'Upgrade sentinel',@email,@passwordHash,'user',1)",
      { email, passwordHash },
    )
  ).recordset[0];
  await db.query(
    "INSERT activity_logs(user_id,action_type,description) VALUES(@id,N'upgrade_sentinel',N'History survives migration')",
    { id: user.id },
  );
  migration.schemaFiles.push(newest);
  assert.equal(await migration.migrate({ seed: true }), 1);
  const preserved = (
    await db.query(
      "SELECT password_hash hash,session_version version FROM users WHERE id=@id",
      { id: user.id },
    )
  ).recordset[0];
  assert.equal(preserved.hash, passwordHash);
  assert.equal(preserved.version, 0);
  assert.equal(
    (
      await db.query(
        "SELECT COUNT(*) n FROM activity_logs WHERE user_id=@id AND action_type='upgrade_sentinel'",
        { id: user.id },
      )
    ).recordset[0].n,
    1,
  );
  assert.equal(await migration.migrate({ seed: true }), 0);
  // Corrupt only this disposable journal, never an applied source SQL file.
  const old = (
    await db.query(
      "SELECT checksum FROM smartbus_migrations WHERE name=@name",
      { name: newest },
    )
  ).recordset[0].checksum;
  await db.query(
    "UPDATE smartbus_migrations SET checksum=REPLICATE('0',64) WHERE name=@name",
    { name: newest },
  );
  await assert.rejects(
    () => migration.migrate({ seed: true }),
    /checksum changed/,
  );
  await db.query(
    "UPDATE smartbus_migrations SET checksum=@checksum WHERE name=@name",
    { name: newest, checksum: old },
  );
  const source = require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../../../database', newest), 'utf8');
  const windowsHash = migration.fingerprints(source)[1];
  await db.query('UPDATE smartbus_migrations SET checksum=@checksum WHERE name=@name', { name:newest, checksum:windowsHash });
  assert.equal(await migration.migrate({seed:true}),0);
  await db.query('UPDATE smartbus_migrations SET checksum=@checksum WHERE name=@name', { name:newest, checksum:old });
  const report = {
    at: new Date().toISOString(),
    passed: 5,
    total: 5,
    cases: [
      "upgrade adds exactly one migration",
      "preserves account password hash and activity history",
      "second run applies zero files",
      "checksum mismatch rejects altered migration journal",
      "legacy Windows CRLF checksum accepted without rewriting SQL or journal",
    ],
  };
  console.log(JSON.stringify(report, null, 2));
  if (process.env.TEST_REPORT_PATH)
    require("node:fs").writeFileSync(
      process.env.TEST_REPORT_PATH,
      JSON.stringify(report, null, 2) + "\n",
    );
}
main()
  .catch((e) => {
    console.error("FAIL", e.message);
    process.exitCode = 1;
  })
  .finally(db.closePool);
