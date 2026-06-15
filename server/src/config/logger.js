const path = require("path");
const { createLogger, format, transports } = require("winston");
const { firstWritableDir } = require("./paths");

// LOG_DIR is set for packaged installs (writable per-user root); in dev we use
// the project folder. firstWritableDir guarantees we never crash on EPERM when
// the app is installed under a read-only Program Files directory.
const logsDir = firstWritableDir(
  [process.env.LOG_DIR, path.join(process.cwd(), "logs")],
  "logs",
);

const logger = createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: format.combine(format.timestamp(), format.errors({ stack: true }), format.json()),
  defaultMeta: { service: "retailer-server" },
  transports: [
    new transports.Console(),
    new transports.File({ filename: path.join(logsDir, "server.log") }),
  ],
});

module.exports = logger;
