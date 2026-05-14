const fs = require("fs");
const os = require("os");
const path = require("path");
const { initDb, getDb, setDb } = require("../src/config/database");
const { transferTreasury } = require("../src/services/treasuryService");

describe("treasury service", () => {
  beforeEach(() => {
    setDb(null);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-treasury-transfer-"));
    initDb(path.join(dir, "treasury.db"));
    const db = getDb();
    db.prepare("INSERT INTO treasuries (name, code, balance) VALUES ('A', 'A', 1000)").run();
    db.prepare("INSERT INTO treasuries (name, code, balance) VALUES ('B', 'B', 300)").run();
  });

  test("moves balance between treasuries transactionally", () => {
    const result = transferTreasury({ source_id: 1, destination_id: 2, amount: 250, user_id: 1 });
    expect(result.success).toBe(true);

    const db = getDb();
    const source = db.prepare("SELECT balance FROM treasuries WHERE id = 1").get();
    const destination = db.prepare("SELECT balance FROM treasuries WHERE id = 2").get();
    expect(source.balance).toBe(750);
    expect(destination.balance).toBe(550);
  });

  test("rejects transfer when source treasury has insufficient funds", () => {
    expect(() => transferTreasury({ source_id: 1, destination_id: 2, amount: 5000 })).toThrow(/Insufficient funds/i);
  });

  test("rejects transfer when source equals destination", () => {
    expect(() => transferTreasury({ source_id: 1, destination_id: 1, amount: 10 })).toThrow(/must differ/i);
  });
});
