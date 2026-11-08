const bcrypt = require("bcryptjs");
const { sql, getPool, closePool } = require("../config/db");
async function role(email, grant = true) {
  if (typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email))
    throw Error("Provide the email of an existing registered account.");
  const tx = new sql.Transaction(await getPool());
  await tx.begin();
  try {
    const q = () => new sql.Request(tx);
    await q().batch(
      "EXEC sp_getapplock @Resource=N'SmartBus.admin.roles',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;",
    );
    const found = await q()
      .input("email", sql.NVarChar(255), email.toLowerCase())
      .query(
        "SELECT id,role,is_active FROM users WITH(UPDLOCK,HOLDLOCK) WHERE LOWER(email)=@email",
      );
    const user = found.recordset[0];
    if (!user) throw Error("Account not found. Register on the website first.");
    if (!grant && user.role === "admin" && user.is_active) {
      const r = await q().query(
        "SELECT COUNT(*) count FROM users WITH(UPDLOCK,HOLDLOCK) WHERE role='admin' AND is_active=1",
      );
      if (r.recordset[0].count <= 1)
        throw Error("Cannot remove the last active administrator.");
    }
    if (grant && !user.is_active)
      throw Error("Cannot promote a suspended account.");
    await q()
      .input("id", sql.Int, user.id)
      .input("role", sql.NVarChar(30), grant ? "admin" : "user")
      .query(
        "UPDATE users SET role=@role,session_version=session_version+1,updated_at=SYSUTCDATETIME() WHERE id=@id; UPDATE refresh_tokens SET revoked_at=COALESCE(revoked_at,SYSUTCDATETIME()) WHERE user_id=@id;",
      );
    await tx.commit();
    console.log(
      `Updated ${email} -> ${grant ? "admin" : "user"}. Password preserved. Sign in again.`,
    );
  } catch (e) {
    await tx.rollback().catch(() => {});
    throw e;
  }
}
async function createAdmin() {
  const {
    ADMIN_EMAIL: email,
    ADMIN_PASSWORD: password,
    ADMIN_FULL_NAME: fullName = "Quản trị viên",
  } = process.env;
  if (
    !email ||
    !password ||
    password.length < 12 ||
    Buffer.byteLength(password) > 72
  )
    throw Error(
      "Set ADMIN_EMAIL and a unique ADMIN_PASSWORD of 12–72 bytes. No default password is provided.",
    );
  const pool = await getPool();
  const old = await pool
    .request()
    .input("email", email)
    .query("SELECT id FROM users WHERE LOWER(email)=LOWER(@email)");
  if (old.recordset.length)
    throw Error(
      "Account exists. Use admin.js grant EMAIL; existing passwords are never reset by setup.",
    );
  const passwordHash = await bcrypt.hash(password, 12);
  await pool
    .request()
    .input("email", email.toLowerCase())
    .input("name", fullName)
    .input("hash", passwordHash)
    .query(
      "INSERT users(full_name,email,password_hash,role,is_active)VALUES(@name,@email,@hash,'user',1)",
    );
  return role(email, true);
}
if (require.main === module) {
  const [action, email] = process.argv.slice(2);
  Promise.resolve()
    .then(() => {
      if (action === "create") return createAdmin();
      if (!["grant", "revoke"].includes(action))
        throw Error(
          "Usage: node scripts/admin.js grant|revoke EMAIL (or create with explicit environment variables)",
        );
      return role(email, action === "grant");
    })
    .catch((e) => {
      console.error(e.message);
      process.exitCode = 1;
    })
    .finally(closePool);
}
module.exports = { role, createAdmin };
