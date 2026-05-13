function up(db) {
  // Fix physical_count_sessions: make warehouse_id nullable for category/custom scopes
  // SQLite doesn't support ALTER COLUMN, so we recreate the table
  
  db.exec(`
    -- Create new sessions table with nullable warehouse_id
    CREATE TABLE IF NOT EXISTS physical_count_sessions_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      warehouse_id INTEGER REFERENCES warehouses(id),
      category_id INTEGER REFERENCES item_categories(id),
      scope TEXT DEFAULT 'warehouse',
      name TEXT,
      status TEXT NOT NULL DEFAULT 'in_progress',
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Copy data from old table
    INSERT INTO physical_count_sessions_new (id, warehouse_id, category_id, scope, name, status, notes, created_at, updated_at)
    SELECT id, warehouse_id, category_id, scope, name, status, notes, created_at, updated_at
    FROM physical_count_sessions;
    
    -- Drop old table
    DROP TABLE physical_count_sessions;
    
    -- Rename new table
    ALTER TABLE physical_count_sessions_new RENAME TO physical_count_sessions;
  `);
  
  // Fix physical_count_lines: remove old UNIQUE(session_id, item_id) constraint
  // and keep only the new unique index from migration 029
  db.exec(`
    -- Create new lines table without the old unique constraint
    CREATE TABLE IF NOT EXISTS physical_count_lines_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      warehouse_id INTEGER REFERENCES warehouses(id),
      system_quantity INTEGER NOT NULL DEFAULT 0,
      counted_quantity INTEGER NOT NULL DEFAULT 0,
      variance INTEGER NOT NULL DEFAULT 0,
      touched INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(session_id) REFERENCES physical_count_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY(item_id) REFERENCES items(id)
    );
    
    -- Copy data from old table
    INSERT INTO physical_count_lines_new (id, session_id, item_id, warehouse_id, system_quantity, counted_quantity, variance, touched, created_at, updated_at)
    SELECT id, session_id, item_id, warehouse_id, system_quantity, counted_quantity, variance, touched, created_at, updated_at
    FROM physical_count_lines;
    
    -- Drop old table (this also drops the old unique constraint)
    DROP TABLE physical_count_lines;
    
    -- Rename new table
    ALTER TABLE physical_count_lines_new RENAME TO physical_count_lines;
    
    -- Recreate the unique index from migration 029
    CREATE UNIQUE INDEX IF NOT EXISTS uq_pcl_session_item_wh ON physical_count_lines(session_id, item_id, COALESCE(warehouse_id, 0));
  `);
}

module.exports = { up };
