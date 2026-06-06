const baseUrl = (process.env.SMOKE_BASE_URL || `http://localhost:${process.env.PORT || 5000}/api/v1`).replace(/\/$/, '');
const tests = [
  ['GET', '/health'],
  ['GET', '/health/db', { allowFail: true }],
  ['GET', '/routes?page=1&limit=5'],
  ['GET', '/tourism/places?page=1&limit=5'],
];

async function run() {
  let failed = 0;
  for (const [method, path, opts = {}] of tests) {
    try {
      const res = await fetch(`${baseUrl}${path}`, { method });
      const ok = res.ok || opts.allowFail;
      console.log(`${ok ? 'PASS' : 'FAIL'} ${method} ${path} -> ${res.status}`);
      if (!ok) failed += 1;
    } catch (err) {
      console.log(`${opts.allowFail ? 'WARN' : 'FAIL'} ${method} ${path} -> ${err.message}`);
      if (!opts.allowFail) failed += 1;
    }
  }
  process.exit(failed ? 1 : 0);
}
run();
