require("dotenv").config();
const { initDb } = require("./db");
const { createVendorApp } = require("./app");

function startVendorServer() {
  initDb();
  const app = createVendorApp();
  const host = process.env.HOST || "127.0.0.1";
  const port = Number(process.env.PORT || 5050);
  return app.listen(port, host, () => {
    // eslint-disable-next-line no-console
    console.log(`[vendor-license-service] running on http://${host}:${port}`);
  });
}

if (require.main === module) {
  startVendorServer();
}

module.exports = { startVendorServer };
