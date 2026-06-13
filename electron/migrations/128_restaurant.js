function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

module.exports = {
  name: "128_restaurant",
  up(db) {
    // Dining tables
    db.prepare(`
      CREATE TABLE IF NOT EXISTS dining_tables (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        section TEXT,
        capacity INTEGER DEFAULT 4,
        status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','occupied','reserved','cleaning')),
        current_order_id INTEGER,
        branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();

    // Modifiers (e.g. "Extra cheese", "No onion", "Large size")
    db.prepare(`
      CREATE TABLE IF NOT EXISTS modifiers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        name_en TEXT,
        price_adjustment REAL NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();

    // Modifier groups (e.g. "Size", "Extras")
    db.prepare(`
      CREATE TABLE IF NOT EXISTS modifier_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        selection_type TEXT NOT NULL DEFAULT 'single' CHECK(selection_type IN ('single','multi')),
        required INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();

    // Link groups to modifiers
    db.prepare(`
      CREATE TABLE IF NOT EXISTS modifier_group_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
        modifier_id INTEGER NOT NULL REFERENCES modifiers(id) ON DELETE CASCADE,
        sort_order INTEGER DEFAULT 0
      )
    `).run();

    // Items can belong to modifier groups
    db.prepare(`
      CREATE TABLE IF NOT EXISTS item_modifier_groups (
        item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        group_id INTEGER NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
        PRIMARY KEY (item_id, group_id)
      )
    `).run();

    // Recipes: ingredients for a menu item (links to stock items)
    db.prepare(`
      CREATE TABLE IF NOT EXISTS item_recipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        menu_item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        ingredient_item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        quantity REAL NOT NULL DEFAULT 1,
        unit_name TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(menu_item_id, ingredient_item_id)
      )
    `).run();

    // Selected modifiers stored per invoice line
    db.prepare(`
      CREATE TABLE IF NOT EXISTS invoice_line_modifiers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_line_id INTEGER NOT NULL REFERENCES invoice_lines(id) ON DELETE CASCADE,
        modifier_id INTEGER NOT NULL REFERENCES modifiers(id) ON DELETE SET NULL,
        modifier_name TEXT NOT NULL,
        price_adjustment REAL NOT NULL DEFAULT 0
      )
    `).run();

    // Add columns to items for restaurant behavior
    addColumnIfMissing(db, "items", "is_menu_item",   "INTEGER NOT NULL DEFAULT 0");
    addColumnIfMissing(db, "items", "has_recipe",      "INTEGER NOT NULL DEFAULT 0");
    addColumnIfMissing(db, "items", "prep_time_mins",  "INTEGER DEFAULT 0");

    // Add table_id to invoices for restaurant table tracking
    addColumnIfMissing(db, "invoices", "dining_table_id", "INTEGER REFERENCES dining_tables(id) ON DELETE SET NULL");
    addColumnIfMissing(db, "invoices", "covers",          "INTEGER DEFAULT 1");

    db.prepare("CREATE INDEX IF NOT EXISTS idx_dining_tables_status ON dining_tables(status)").run();
    db.prepare("CREATE INDEX IF NOT EXISTS idx_item_recipes_menu ON item_recipes(menu_item_id)").run();
  },
};
