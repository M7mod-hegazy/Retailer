module.exports = {
  name: '054_return_lifecycle_user_tracking',
  up(db) {
    // sales_returns: lifecycle + user tracking
    const srCols = db.prepare("PRAGMA table_info(sales_returns)").all().map(c => c.name);
    if (!srCols.includes('status'))
      db.prepare("ALTER TABLE sales_returns ADD COLUMN status TEXT DEFAULT 'active'").run();
    if (!srCols.includes('cancelled_at'))
      db.prepare("ALTER TABLE sales_returns ADD COLUMN cancelled_at TEXT").run();
    if (!srCols.includes('cancelled_by'))
      db.prepare("ALTER TABLE sales_returns ADD COLUMN cancelled_by INTEGER").run();
    if (!srCols.includes('cancel_reason'))
      db.prepare("ALTER TABLE sales_returns ADD COLUMN cancel_reason TEXT").run();
    if (!srCols.includes('amendment_of'))
      db.prepare("ALTER TABLE sales_returns ADD COLUMN amendment_of INTEGER").run();
    if (!srCols.includes('amended_by'))
      db.prepare("ALTER TABLE sales_returns ADD COLUMN amended_by INTEGER").run();
    if (!srCols.includes('created_by'))
      db.prepare("ALTER TABLE sales_returns ADD COLUMN created_by INTEGER").run();

    // purchase_returns: lifecycle + user tracking
    const prCols = db.prepare("PRAGMA table_info(purchase_returns)").all().map(c => c.name);
    if (!prCols.includes('status'))
      db.prepare("ALTER TABLE purchase_returns ADD COLUMN status TEXT DEFAULT 'active'").run();
    if (!prCols.includes('cancelled_at'))
      db.prepare("ALTER TABLE purchase_returns ADD COLUMN cancelled_at TEXT").run();
    if (!prCols.includes('cancelled_by'))
      db.prepare("ALTER TABLE purchase_returns ADD COLUMN cancelled_by INTEGER").run();
    if (!prCols.includes('cancel_reason'))
      db.prepare("ALTER TABLE purchase_returns ADD COLUMN cancel_reason TEXT").run();
    if (!prCols.includes('amendment_of'))
      db.prepare("ALTER TABLE purchase_returns ADD COLUMN amendment_of INTEGER").run();
    if (!prCols.includes('amended_by'))
      db.prepare("ALTER TABLE purchase_returns ADD COLUMN amended_by INTEGER").run();
    if (!prCols.includes('created_by'))
      db.prepare("ALTER TABLE purchase_returns ADD COLUMN created_by INTEGER").run();

    // purchases: created_by + amendment lifecycle + cancel tracking
    const pCols = db.prepare("PRAGMA table_info(purchases)").all().map(c => c.name);
    if (!pCols.includes('created_by'))
      db.prepare("ALTER TABLE purchases ADD COLUMN created_by INTEGER").run();
    if (!pCols.includes('amendment_of'))
      db.prepare("ALTER TABLE purchases ADD COLUMN amendment_of INTEGER").run();
    if (!pCols.includes('amended_by'))
      db.prepare("ALTER TABLE purchases ADD COLUMN amended_by INTEGER").run();
    if (!pCols.includes('cancelled_at'))
      db.prepare("ALTER TABLE purchases ADD COLUMN cancelled_at TEXT").run();
    if (!pCols.includes('cancelled_by'))
      db.prepare("ALTER TABLE purchases ADD COLUMN cancelled_by INTEGER").run();
    if (!pCols.includes('cancel_reason'))
      db.prepare("ALTER TABLE purchases ADD COLUMN cancel_reason TEXT").run();

    // backfill status = 'active' for existing rows
    db.prepare("UPDATE sales_returns SET status = 'active' WHERE status IS NULL").run();
    db.prepare("UPDATE purchase_returns SET status = 'active' WHERE status IS NULL").run();
  },
};
