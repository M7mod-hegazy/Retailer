const { freshWorld } = require("./helpers");

describe("edge helpers", () => {
  test("freshWorld boots an app with seeded base data and a usable token", async () => {
    const world = freshWorld();
    expect(world.token).toEqual(expect.any(String));

    // base seed exists: one default warehouse + one item with stock
    const wh = world.db.prepare("SELECT COUNT(*) AS n FROM warehouses").get();
    expect(wh.n).toBeGreaterThanOrEqual(1);
    const item = world.db.prepare("SELECT COUNT(*) AS n FROM items").get();
    expect(item.n).toBeGreaterThanOrEqual(1);

    // app responds
    const request = require("supertest");
    const res = await request(world.app)
      .get("/api/customers")
      .set("Authorization", `Bearer ${world.token}`);
    expect(res.status).toBe(200);
  });
});
