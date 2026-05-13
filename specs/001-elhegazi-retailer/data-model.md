# Data Model: ElHegazi Retailer V1

**Phase 1 Output** | **Date**: 2026-04-19
**Database**: SQLite (better-sqlite3) | **Journal**: WAL | **Currency**: Integer (halala/piastre)

---

## Entity Relationship Overview

```
settings (1) ─────────────────────────────────────────────────────────────
users (N) ──── role_permissions (5 system roles)
employees (N) ──── users (optional 1:1 link)
item_categories (N, hierarchical via parent_id)
units (N)
items (N) ──── item_categories (N:1) ──── units (N:1)
price_groups (N)
customer_groups (N) ──── price_groups (N:1)
customers (N) ──── customer_groups (N:1) ──── price_groups (N:1)
suppliers (N)
warehouses (N)
treasuries (N)
banks (N)
invoices (N) ──── customers (N:1) ──── warehouses (N:1) ──── shifts (N:1)
invoice_lines (N) ──── invoices (N:1) ──── items (N:1)
purchases (N) ──── suppliers (N:1) ──── warehouses (N:1)
purchase_orders (N) ──── suppliers (N:1)
payments (N) ──── customers/suppliers (N:1) ──── treasuries/banks (N:1)
expenses (N) ──── expense_categories (N:1) ──── treasuries/banks (N:1)
revenues (N) ──── revenue_categories (N:1)
stock_levels (N) ──── items (N:1) ──── warehouses (N:1) [unique compound]
stock_movements (N) ──── items (N:1) [append-only audit trail]
cheques (N) ──── customers/suppliers (N:1)
installments (N) ──── invoices (N:1) ──── customers (N:1)
shifts (N) ──── users (N:1) ──── treasuries (N:1)
audit_logs (N) ──── users (N:1) [immutable]
notifications (N)
promotions (N)
loyalty_transactions (N) ──── customers (N:1)
user_help_state (N) ──── users (1:1)
```

---

## Tables

### 1. settings (singleton)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | INTEGER | PK, DEFAULT 1, CHECK(id=1) | Singleton enforcement |
| company_name | TEXT | NOT NULL | اسم الشركة |
| company_name_en | TEXT | | |
| branch_name | TEXT | NOT NULL | |
| branch_code | TEXT | NOT NULL | 2-5 chars, prefix for invoice numbers |
| logo_path | TEXT | | Local file path |
| address | TEXT | | |
| phone | TEXT | | |
| phone2 | TEXT | | |
| email | TEXT | | |
| website | TEXT | | |
| tax_id | TEXT | | الرقم الضريبي |
| commercial_register | TEXT | | السجل التجاري |
| currency | TEXT | DEFAULT 'SAR' | |
| currency_symbol | TEXT | DEFAULT 'ر.س' | |
| decimal_places | INTEGER | DEFAULT 2 | 0, 2, or 3 |
| tax_rate | INTEGER | DEFAULT 0 | Percentage × 100 (e.g. 1500 = 15%) |
| tax_type | TEXT | DEFAULT 'none' | 'inclusive'/'exclusive'/'none' |
| fiscal_year_start | TEXT | DEFAULT '01-01' | MM-DD |
| invoice_prefix | TEXT | DEFAULT 'INV-' | |
| invoice_counter | INTEGER | DEFAULT 0 | Atomic increment |
| purchase_prefix | TEXT | DEFAULT 'PUR-' | |
| purchase_counter | INTEGER | DEFAULT 0 | |
| return_sale_prefix | TEXT | DEFAULT 'RET-' | |
| return_sale_counter | INTEGER | DEFAULT 0 | |
| return_purchase_prefix | TEXT | DEFAULT 'RPUR-' | |
| return_purchase_counter | INTEGER | DEFAULT 0 | |
| payment_prefix | TEXT | DEFAULT 'PAY-' | |
| payment_counter | INTEGER | DEFAULT 0 | |
| expense_prefix | TEXT | DEFAULT 'EXP-' | |
| expense_counter | INTEGER | DEFAULT 0 | |
| pos_require_customer | INTEGER | DEFAULT 0 | Boolean |
| pos_allow_negative_stock | INTEGER | DEFAULT 0 | |
| pos_auto_open_cash_drawer | INTEGER | DEFAULT 1 | |
| pos_print_on_save | INTEGER | DEFAULT 1 | |
| pos_show_item_images | INTEGER | DEFAULT 1 | |
| pos_items_per_page | INTEGER | DEFAULT 20 | |
| pos_default_warehouse_id | INTEGER | FK → warehouses | |
| pos_default_treasury_id | INTEGER | FK → treasuries | |
| default_customer_id | INTEGER | FK → customers | Walk-in customer |
| receipt_width | TEXT | DEFAULT '80mm' | '58mm'/'80mm'/'A4' |
| receipt_show_logo | INTEGER | DEFAULT 1 | |
| receipt_show_tax | INTEGER | DEFAULT 1 | |
| receipt_show_barcode | INTEGER | DEFAULT 0 | |
| receipt_header | TEXT | | Custom header (AR) |
| receipt_footer | TEXT | | Custom footer (AR) |
| receipt_copies | INTEGER | DEFAULT 1 | |
| language | TEXT | DEFAULT 'ar' | 'ar'/'en' |
| date_format | TEXT | DEFAULT 'YYYY/MM/DD' | |
| theme | TEXT | DEFAULT 'light' | 'light'/'dark' |
| show_item_cost | INTEGER | DEFAULT 0 | |
| auto_backup | INTEGER | DEFAULT 1 | |
| auto_backup_frequency | TEXT | DEFAULT 'daily' | |
| auto_backup_time | TEXT | DEFAULT '02:00' | HH:mm |
| backup_path | TEXT | | |
| backup_keep_last | INTEGER | DEFAULT 30 | |
| session_timeout_minutes | INTEGER | DEFAULT 15 | 0 = disabled |
| cashier_pin_lock | INTEGER | DEFAULT 1 | |
| is_setup_complete | INTEGER | DEFAULT 0 | |
| setup_completed_at | TEXT | | ISO 8601 |
| db_version | INTEGER | DEFAULT 1 | Migration tracking |
| created_at | TEXT | DEFAULT CURRENT_TIMESTAMP | |
| updated_at | TEXT | DEFAULT CURRENT_TIMESTAMP | |

### 2. users

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | INTEGER | PK AUTOINCREMENT | |
| name | TEXT | NOT NULL | |
| username | TEXT | NOT NULL, UNIQUE | |
| password | TEXT | NOT NULL | bcrypt hash |
| role | TEXT | NOT NULL | 'admin'/'branch_manager'/'accountant'/'cashier'/'viewer' |
| permissions | TEXT | DEFAULT '{}' | JSON: granular overrides on role defaults |
| supervisor_pin | TEXT | | bcrypt hash, 4-6 digit |
| pin_code | TEXT | | bcrypt hash, 4-digit screen unlock |
| mfa_enabled | INTEGER | DEFAULT 0 | |
| mfa_secret | TEXT | | AES-256-GCM encrypted |
| mfa_backup_codes | TEXT | | JSON array of bcrypt hashes |
| is_active | INTEGER | DEFAULT 1 | |
| force_password_change | INTEGER | DEFAULT 0 | |
| last_login | TEXT | | ISO 8601 |
| last_login_ip | TEXT | | |
| failed_login_attempts | INTEGER | DEFAULT 0 | |
| locked_until | TEXT | | ISO 8601 |
| active_session_token | TEXT | | JWT jti for concurrent session control |
| created_by | INTEGER | FK → users | |
| created_at | TEXT | DEFAULT CURRENT_TIMESTAMP | |
| updated_at | TEXT | DEFAULT CURRENT_TIMESTAMP | |
| deleted_at | TEXT | | Soft delete |
| deleted_by | INTEGER | FK → users | |

### 3. employees

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | INTEGER | PK AUTOINCREMENT | |
| employee_code | TEXT | UNIQUE | Auto: EMP-001 |
| name | TEXT | NOT NULL | |
| name_en | TEXT | | |
| photo_path | TEXT | | |
| phone | TEXT | | |
| phone2 | TEXT | | |
| email | TEXT | | |
| national_id | TEXT | | |
| job_title | TEXT | | |
| department | TEXT | | |
| salary | INTEGER | | Integer (halala) |
| salary_type | TEXT | | 'monthly'/'daily'/'hourly' |
| hire_date | TEXT | | |
| end_date | TEXT | | |
| is_active | INTEGER | DEFAULT 1 | |
| notes | TEXT | | |
| user_id | INTEGER | FK → users | Optional linked account |
| created_by | INTEGER | FK → users | |
| created_at | TEXT | DEFAULT CURRENT_TIMESTAMP | |
| updated_at | TEXT | DEFAULT CURRENT_TIMESTAMP | |
| deleted_at | TEXT | | |

### 4. item_categories

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | INTEGER | PK AUTOINCREMENT | |
| name | TEXT | NOT NULL | |
| name_en | TEXT | | |
| code | TEXT | | |
| parent_id | INTEGER | FK → item_categories | NULL = root |
| image_path | TEXT | | |
| color | TEXT | | Hex for POS grid |
| sort_order | INTEGER | DEFAULT 0 | |
| is_active | INTEGER | DEFAULT 1 | |
| created_by | INTEGER | FK → users | |
| created_at | TEXT | DEFAULT CURRENT_TIMESTAMP | |
| updated_at | TEXT | DEFAULT CURRENT_TIMESTAMP | |

### 5. units

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | INTEGER | PK AUTOINCREMENT | |
| name | TEXT | NOT NULL | كيلوغرام |
| name_en | TEXT | | Kilogram |
| abbreviation | TEXT | NOT NULL | كغ |
| abbreviation_en | TEXT | | kg |
| is_active | INTEGER | DEFAULT 1 | |
| created_at | TEXT | DEFAULT CURRENT_TIMESTAMP | |
| updated_at | TEXT | DEFAULT CURRENT_TIMESTAMP | |

### 6. items

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | INTEGER | PK AUTOINCREMENT | |
| item_code | TEXT | UNIQUE | |
| name | TEXT | NOT NULL | |
| name_en | TEXT | | |
| barcode | TEXT | | Main barcode |
| barcodes | TEXT | DEFAULT '[]' | JSON array of additional barcodes |
| category_id | INTEGER | FK → item_categories | |
| unit_id | INTEGER | FK → units | |
| purchase_unit_id | INTEGER | FK → units | |
| purchase_unit_factor | REAL | | 1 box = 12 pcs |
| cost_price | INTEGER | DEFAULT 0 | Integer (halala) |
| price1 | INTEGER | DEFAULT 0 | Primary sell |
| price2 | INTEGER | DEFAULT 0 | Wholesale |
| price3 | INTEGER | DEFAULT 0 | Special |
| price4 | INTEGER | DEFAULT 0 | Reserved |
| min_price | INTEGER | | Cannot sell below |
| max_discount_pct | INTEGER | | Item-level max discount (0-10000 = 0-100.00%) |
| tax_rate | INTEGER | | Override global (× 100) |
| tax_type | TEXT | | 'inclusive'/'exclusive'/'none' |
| track_stock | INTEGER | DEFAULT 1 | |
| allow_negative_stock | INTEGER | DEFAULT 0 | |
| min_stock_qty | INTEGER | | Alert threshold |
| max_stock_qty | INTEGER | | Overstock alert |
| track_serial | INTEGER | DEFAULT 0 | |
| item_type | TEXT | DEFAULT 'product' | 'product'/'service'/'composite' |
| components | TEXT | DEFAULT '[]' | JSON: [{item_id, quantity}] for composites |
| track_expiry | INTEGER | DEFAULT 0 | |
| image_path | TEXT | | |
| description | TEXT | | |
| notes | TEXT | | |
| tags | TEXT | DEFAULT '[]' | JSON array for search |
| is_active | INTEGER | DEFAULT 1 | |
| is_featured | INTEGER | DEFAULT 0 | POS home grid |
| sort_order | INTEGER | DEFAULT 0 | |
| created_by | INTEGER | FK → users | |
| created_at | TEXT | DEFAULT CURRENT_TIMESTAMP | |
| updated_at | TEXT | DEFAULT CURRENT_TIMESTAMP | |
| deleted_at | TEXT | | |

**Indexes**: `barcode`, `category_id`, `item_code`, `is_active + is_featured`

### 7–28. Remaining Tables

The remaining tables follow the same pattern. Key tables include:

- **price_groups** (id, name, price_column, discount_pct, is_default, is_active)
- **customer_groups** (id, name, discount_pct, price_group_id, is_active)
- **customers** (id, customer_code UNIQUE, name, phone, customer_type, price_group_id, credit_limit INTEGER, current_balance INTEGER, loyalty_points INTEGER, loyalty_tier, total_spent INTEGER, ...)
- **suppliers** (id, supplier_code UNIQUE, name, contact_person, current_balance INTEGER, ...)
- **warehouses** (id, name, code, address, manager_id, is_default, is_active)
- **treasuries** (id, name, code, opening_balance INTEGER, current_balance INTEGER, is_default, assigned_cashier_id)
- **banks** (id, bank_name, account_number, iban, current_balance INTEGER, ...)
- **invoices** (id, invoice_number UNIQUE, invoice_type, date, customer_id, warehouse_id, subtotal INTEGER, discount_amount INTEGER, tax_amount INTEGER, total INTEGER, payment_type, paid_amount INTEGER, change_amount INTEGER, remaining_amount INTEGER, treasury_id, bank_id, status, shift_id, ...)
- **invoice_lines** (id, invoice_id FK, item_id FK, quantity INTEGER, unit_price INTEGER, cost_price INTEGER, discount_amount INTEGER, tax_amount INTEGER, line_total INTEGER, ...)
- **purchases** (mirrors invoices for supplier purchases)
- **purchase_orders** (id, po_number, supplier_id, status, lines JSON, ...)
- **payments** (id, payment_number UNIQUE, payment_type, customer_id/supplier_id, amount INTEGER, payment_method, treasury_id/bank_id, allocations JSON, ...)
- **expenses** (id, expense_number, date, category_id, amount INTEGER, payment_method, treasury_id/bank_id, ...)
- **revenues** (id, revenue_number, date, category_id, amount INTEGER, ...)
- **expense_categories** / **revenue_categories** (id, name, parent_id, is_active)
- **stock_levels** (id, item_id FK, warehouse_id FK, quantity INTEGER) — UNIQUE(item_id, warehouse_id)
- **stock_movements** (id, item_id, warehouse_id, movement_type, quantity_before INTEGER, quantity_change INTEGER, quantity_after INTEGER, unit_cost INTEGER, ...) — append-only
- **cheques** (id, cheque_number, cheque_type, customer_id/supplier_id, amount INTEGER, due_date, status, ...)
- **installments** (id, plan_number, invoice_id, customer_id, total_amount INTEGER, schedule JSON, ...)
- **shifts** (id, shift_number, cashier_id, opened_at, closed_at, opening_cash INTEGER, expected_cash INTEGER, declared_cash INTEGER, discrepancy INTEGER, ...)
- **audit_logs** (id, user_id, action, resource, resource_id, changes JSON, created_at) — IMMUTABLE
- **notifications** (id, type, title, message, severity, is_read, reference_id, ...)
- **role_permissions** (id, role UNIQUE, permissions JSON, label_ar, label_en, is_system_role)
- **promotions** (id, name_ar, name_en, type, is_active, priority, condition JSON, reward JSON, ...)
- **loyalty_transactions** (id, customer_id, invoice_id, type, points INTEGER, balance_after INTEGER, ...)
- **user_help_state** (id, user_id UNIQUE, toured_pages JSON, tours_disabled_globally INTEGER, tooltips_disabled_globally INTEGER)

---

## Key Validation Rules

| Rule | Enforcement |
|------|-------------|
| All money fields stored as INTEGER (halala) | Schema constraint + currencyMath.js |
| invoice_number is globally unique | UNIQUE constraint + atomic counter |
| stock_levels (item_id, warehouse_id) unique | UNIQUE compound constraint |
| Soft-delete: deleted_at must be NULL for active queries | WHERE deleted_at IS NULL in all active queries |
| Audit logs never updated or deleted | No UPDATE/DELETE statements on audit_logs table |
| Foreign keys enforced | `PRAGMA foreign_keys = ON` |
| Settings is singleton | `CHECK(id = 1)` constraint |

## State Transitions

### Invoice Status
```
draft → confirmed → [partially_returned | returned | cancelled]
```

### Shift Status
```
open → closed (irreversible)
```

### Cheque Status
```
pending → deposited → cleared
pending → deposited → bounced
pending → cancelled
```

### Installment Status
```
active → completed
active → defaulted
active → cancelled
```

### License Status
```
trial → active (on activation)
trial → trial_expired (after 30 days)
active → expired (past expiry date)
active → suspended (by admin on VPS)
```
