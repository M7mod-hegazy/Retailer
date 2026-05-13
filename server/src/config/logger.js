const fs = require("fs");
const path = require("path");
const { createLogger, format, transports } = require("winston");

const logsDir = path.join(process.cwd(), "logs");
fs.mkdirSync(logsDir, { recursive: true });

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
