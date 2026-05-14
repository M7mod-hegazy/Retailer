process.env.JWT_SECRET = "test-secret";

const { initDb } = require("../src/config/database");

beforeAll(() => {
  initDb();
});
