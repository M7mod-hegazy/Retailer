const { initDb } = require("../src/config/database");

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret";
  initDb(); // Will use :memory: if we configure it, but let's just initialize the default for now
});
