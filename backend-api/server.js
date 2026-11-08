const app = require("./app");
const env = require("./config/env");
const { closePool } = require("./config/db");

// Preview hosts pass a port on the command line; normal startup uses PORT.
const portArg = process.argv.indexOf("--port");
const port = Number(portArg >= 0 ? process.argv[portArg + 1] : env.port);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("Invalid HTTP port");
const server = app.listen(port, "0.0.0.0", () =>
  console.log(`SmartBus: http://localhost:${port}`),
);
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => closePool().finally(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10000).unref();
  });
}
