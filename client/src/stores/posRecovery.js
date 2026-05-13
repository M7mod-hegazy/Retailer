import { openDB } from "idb";

const DB_NAME = "retailer-pos";
const STORE = "cart";

async function db() {
  return openDB(DB_NAME, 1, {
    upgrade(upgradeDb) {
      if (!upgradeDb.objectStoreNames.contains(STORE)) {
        upgradeDb.createObjectStore(STORE);
      }
    },
  });
}

export async function saveCart(cart) {
  const conn = await db();
  await conn.put(STORE, cart, "current");
}

export async function loadCart() {
  const conn = await db();
  return conn.get(STORE, "current");
}
