module.exports = {
  up(db) {
    const cols = db.prepare("PRAGMA table_info(settings)").all().map(c => c.name);

    const addIfMissing = (col, def) => {
      if (!cols.includes(col)) {
        db.exec(`ALTER TABLE settings ADD COLUMN ${col} ${def}`);
      }
    };

    // Toggle fields (show/hide)
    addIfMissing("show_phone",         "INTEGER DEFAULT 1");
    addIfMissing("show_address",       "INTEGER DEFAULT 1");
    addIfMissing("show_tax_id",        "INTEGER DEFAULT 1");
    addIfMissing("show_qr",            "INTEGER DEFAULT 1");
    addIfMissing("show_logo",          "INTEGER DEFAULT 1");
    addIfMissing("show_subtotal",      "INTEGER DEFAULT 1");
    addIfMissing("show_discount_line", "INTEGER DEFAULT 1");
    addIfMissing("show_payment_details", "INTEGER DEFAULT 1");
    addIfMissing("show_branch",        "INTEGER DEFAULT 1");
    addIfMissing("show_invoice_date",  "INTEGER DEFAULT 1");
    addIfMissing("show_barcode_line",  "INTEGER DEFAULT 0");
    addIfMissing("show_item_code",     "INTEGER DEFAULT 1");

    // Size / spacing fields
    addIfMissing("header_font_size", "INTEGER DEFAULT 16");
    addIfMissing("body_font_size",   "INTEGER DEFAULT 11");
    addIfMissing("footer_font_size", "INTEGER DEFAULT 10");
    addIfMissing("item_font_size",   "INTEGER DEFAULT 11");
    addIfMissing("logo_max_height",  "INTEGER DEFAULT 48");
    addIfMissing("margin_top",       "INTEGER DEFAULT 4");
    addIfMissing("margin_side",      "INTEGER DEFAULT 4");
    addIfMissing("qr_size",          "INTEGER DEFAULT 44");

    // Text / style fields
    addIfMissing("print_font",      "TEXT DEFAULT 'monospace'");
    addIfMissing("logo_alignment",  "TEXT DEFAULT 'center'");
    addIfMissing("accent_color",    "TEXT DEFAULT '#0f172a'");
    addIfMissing("receipt_header",  "TEXT DEFAULT ''");

    // Doc prefix fields
    addIfMissing("return_prefix",      "TEXT DEFAULT 'RET-'");
    addIfMissing("work_order_prefix",  "TEXT DEFAULT 'WO-'");
    addIfMissing("receipt_prefix",     "TEXT DEFAULT 'REC-'");

    // Address / phone / tax-id formatting
    addIfMissing("address_font_size", "INTEGER DEFAULT 9");
    addIfMissing("address_alignment", "TEXT DEFAULT 'right'");
    addIfMissing("tax_id_font_size",  "INTEGER DEFAULT 9");
    addIfMissing("tax_id_alignment",  "TEXT DEFAULT 'right'");
  },

  down(db) {
    // SQLite ALTER TABLE DROP COLUMN requires >= 3.35.0
  },
};
