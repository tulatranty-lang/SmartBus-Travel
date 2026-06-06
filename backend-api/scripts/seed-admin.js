require('dotenv').config();

const bcrypt = require('bcryptjs');
const { query, closePool } = require('../config/db');

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@smartbus.vn';
  const password = process.env.ADMIN_PASSWORD || 'Admin123456';
  const fullName = process.env.ADMIN_FULL_NAME || 'Quản trị viên SmartBus';
  const passwordHash = await bcrypt.hash(password, 10);

  const existed = await query('SELECT TOP 1 id FROM users WHERE LOWER(email)=LOWER(@email)', { email });
  if (existed.recordset[0]) {
    await query(`
      UPDATE users
      SET full_name=@fullName,
          password_hash=@passwordHash,
          role='admin',
          is_active=1,
          updated_at=SYSDATETIME()
      WHERE LOWER(email)=LOWER(@email)
    `, { email, fullName, passwordHash });
    console.log('✅ Admin account updated');
  } else {
    await query(`
      INSERT INTO users(full_name, email, password_hash, role, is_active)
      VALUES(@fullName, @email, @passwordHash, 'admin', 1)
    `, { email, fullName, passwordHash });
    console.log('✅ Admin account created');
  }

  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
}

main()
  .catch((err) => {
    console.error('❌ Seed admin failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool().catch(() => {});
  });
