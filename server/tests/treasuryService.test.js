const fs = require("fs");
const os = require("os");
const path = require("path");
const { initDb, getDb, setDb } = require("../src/config/database");
const { transferTreasury } = require("../src/services/treasuryService");

describe("treasury service", () => {
  let sourceId, destId;

  beforeEach(() => {
    setDb(null);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-treasury-transfer-"));
    initDb(path.join(dir, "treasury.db"));
    const db = getDb();
    // Use lastInsertRowid to get correct IDs (migration 039 seeds id=1)
    const a = db.prepare("INSERT INTO treasuries (name, code, balance) VALUES ('A', 'A', 1000)").run();
    const b = db.prepare("INSERT INTO treasuries (name, code, balance) VALUES ('B', 'B', 300)").run();
    sourceId = Number(a.lastInsertRowid);
    destId = Number(b.lastInsertRowid);
  });

  test("moves balance between treasuries transactionally", () => {
    const result = transferTreasury({ source_id: sourceId, destination_id: destId, amount: 250, user_id: 1 });
    expect(result.success).toBe(true);

    const db = getDb();
    const source = db.prepare("SELECT balance FROM treasuries WHERE id = ?").get(sourceId);
    const destination = db.prepare("SELECT balance FROM treasuries WHERE id = ?").get(destId);
    expect(source.balance).toBe(750);
    expect(destination.balance).toBe(550);
  });

  test("rejects transfer when source treasury has insufficient funds", () => {
    expect(() => transferTreasury({ source_id: sourceId, destination_id: destId, amount: 5000 })).toThrow(/Insufficient funds/i);
  });

  test("rejects transfer when source equals destination", () => {
    expect(() => transferTreasury({ source_id: sourceId, destination_id: sourceId, amount: 10 })).toThrow(/must differ/i);
  });
});
