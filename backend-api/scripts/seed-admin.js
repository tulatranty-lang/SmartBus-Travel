const { createAdmin } = require("./admin"),
  { closePool } = require("../config/db");
createAdmin()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(closePool);
