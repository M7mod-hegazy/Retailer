module.exports = {
  up: (db) => {
    db.exec(`
      -- Saved queries / pinboard
      CREATE TABLE IF NOT EXISTS assistant_saved_queries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        label TEXT NOT NULL,
        query_text TEXT NOT NULL,
        query_type TEXT DEFAULT 'text',
        pinned INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Scheduled briefings
      CREATE TABLE IF NOT EXISTS assistant_scheduled_briefings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        query_text TEXT NOT NULL,
        schedule TEXT NOT NULL DEFAULT 'daily',
        active INTEGER DEFAULT 1,
        last_sent_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Natural-language dashboards (composite views)
      CREATE TABLE IF NOT EXISTS assistant_dashboards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        queries_json TEXT NOT NULL DEFAULT '[]',
        layout_json TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Training progress per user per module
      CREATE TABLE IF NOT EXISTS training_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        track TEXT NOT NULL,
        module_key TEXT NOT NULL,
        completed INTEGER DEFAULT 0,
        score INTEGER DEFAULT NULL,
        quiz_answers_json TEXT,
        started_at TEXT DEFAULT (datetime('now')),
        completed_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_training_progress_user_module
        ON training_progress(user_id, track, module_key);

      -- Manager-assigned training modules
      CREATE TABLE IF NOT EXISTS training_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assigned_by INTEGER NOT NULL,
        assigned_to INTEGER NOT NULL,
        track TEXT NOT NULL,
        deadline TEXT,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (assigned_by) REFERENCES users(id),
        FOREIGN KEY (assigned_to) REFERENCES users(id)
      );

      -- Daily tips tracking
      CREATE TABLE IF NOT EXISTS assistant_daily_tips (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tip_key TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        page_route TEXT,
        role_filter TEXT,
        active INTEGER DEFAULT 1
      );

      -- Weakness analytics: track failed quiz answers per user
      CREATE TABLE IF NOT EXISTS training_weaknesses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        module_key TEXT NOT NULL,
        question TEXT NOT NULL,
        wrong_answer TEXT,
        correct_answer TEXT,
        failed_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Query history (for scheduling and anomaly detection)
      CREATE TABLE IF NOT EXISTS assistant_query_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        query_text TEXT NOT NULL,
        result_summary TEXT,
        executed_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // Seed daily tips
    const tips = [
      { tip_key: 'tip_pos_shortcuts', title: 'اختصارات البيع', body: 'استخدم F2 للبحث عن صنف بسرعة، وF4 للدفع، وEsc لإلغاء الصنف الأخير.', page_route: '/pos', role_filter: null },
      { tip_key: 'tip_search_items', title: 'بحث ذكي عن الأصناف', body: 'في شاشة البيع، اكتب أول 3 حروف من اسم الصنف وهيتظهر تلقائي — مش لازم تكتب الاسم كامل.', page_route: '/pos', role_filter: null },
      { tip_key: 'tip_discount_types', title: 'أنواع الخصم', body: 'فيه خصم على السطر (صنف معين) وخصم على الإجمالي. الاتنين ممكن يتجمعوا لو الصلاحية مضبوطة.', page_route: '/pos', role_filter: 'cashier' },
      { tip_key: 'tip_returns', title: 'المرتجعات الذكية', body: 'لما تعمل مرتجع، دايماً اربطه بالفاتورة الأصلية — عشان الأرصدة والأسعار تضبط تلقائي.', page_route: '/sales/returns', role_filter: null },
      { tip_key: 'tip_shortcuts_global', title: 'اختصار المساعد', body: 'اضغط Ctrl+/ من أي شاشة عشان تفتح المساعد الذكي.', page_route: null, role_filter: null },
      { tip_key: 'tip_warehouse_transfer', title: 'التحويل بين المخازن', body: 'التحويل المخزني مش بيغير التكلفة — ده الفرق بينه وبين النقل بين الفروع.', page_route: '/stock/transfer', role_filter: null },
      { tip_key: 'tip_daily_treasury', title: 'تسوية الخزنة اليومية', body: 'في نهاية اليوم، اعمل تسوية خزنة عشان تتأكد إن الفلوس في الدرج مطابقة للنظام.', page_route: '/daily-treasury', role_filter: null },
      { tip_key: 'tip_backup', title: 'النسخة الاحتياطية', body: 'خذ نسخة احتياطية قبل أي تحديث — هتحفظلك كل البيانات وتقدر ترجعها لو حصلت مشكلة.', page_route: '/settings', role_filter: null },
      { tip_key: 'tip_reports', title: 'تقارير مخصصة', body: 'في مركز التقارير، تقدر تفلتر بأي تاريخ وتصدر PDF أو Excel.', page_route: '/reports/center', role_filter: 'manager' },
      { tip_key: 'tip_purchase_order', title: 'أمر التوريد المعلق', body: 'لما البضاعة توصل، ارجع لأمر التوريد واختار "استلام" — هيتحول لفاتورة شراء بضغطة وحدة.', page_route: '/purchases/orders', role_filter: null },
    ];
    const insert = db.prepare(`INSERT OR IGNORE INTO assistant_daily_tips (tip_key, title, body, page_route, role_filter) VALUES (?, ?, ?, ?, ?)`);
    for (const t of tips) insert.run(t.tip_key, t.title, t.body, t.page_route, t.role_filter);
  },
};
