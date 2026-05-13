# API Contract: Shifts, Stock, Payments, Promotions, Reports, Backup

## Shifts — `/api/shifts`

| Method | Path | Description |
|--------|------|-------------|
| POST | /shifts/open | Open new shift (body: `{ opening_cash }`) |
| GET | /shifts/current | Get current open shift for logged-in cashier |
| GET | /shifts/:id/x-report | X-report snapshot (no reset) |
| POST | /shifts/:id/pay-in | Add cash to drawer `{ amount, reason }` |
| POST | /shifts/:id/pay-out | Remove cash from drawer `{ amount, reason }` |
| POST | /shifts/:id/close | Close shift `{ declared_cash, notes }` |
| GET | /shifts | Shift history (manager/admin) |

## Stock — `/api/stock`

| Method | Path | Description |
|--------|------|-------------|
| GET | /stock/levels | Stock levels (filterable by warehouse, category, below-min) |
| GET | /stock/movements | Movement history (filterable by item, type, date range) |
| POST | /stock/transfer | Transfer between warehouses `{ items[], from_warehouse, to_warehouse }` |
| POST | /stock/adjustment | Adjust stock `{ item_id, warehouse_id, new_qty, reason }` |
| POST | /stock/physical-count | Submit physical count results `{ items[{ item_id, counted_qty }] }` |

## Customers — `/api/customers`

| Method | Path | Description |
|--------|------|-------------|
| GET | /customers | List with search, pagination |
| POST | /customers | Create customer |
| PUT | /customers/:id | Update customer |
| DELETE | /customers/:id | Soft delete |
| GET | /customers/:id/statement | Account statement (date range) |
| GET | /customers/:id/loyalty | Loyalty points balance + history |

## Suppliers — `/api/suppliers`

| Method | Path | Description |
|--------|------|-------------|
| GET | /suppliers | List with search, pagination |
| POST | /suppliers | Create |
| PUT | /suppliers/:id | Update |
| DELETE | /suppliers/:id | Soft delete |
| GET | /suppliers/:id/statement | Account statement |

## Payments — `/api/payments`

| Method | Path | Description |
|--------|------|-------------|
| GET | /payments | List payments |
| POST | /payments | Create payment (customer_receipt or supplier_payment) |
| GET | /payments/:id | Payment detail |
| DELETE | /payments/:id | Soft delete |

## Purchases — `/api/purchases`

| Method | Path | Description |
|--------|------|-------------|
| GET | /purchases | List purchase invoices |
| POST | /purchases | Create purchase invoice |
| PUT | /purchases/:id | Edit draft |
| POST | /purchases/:id/return | Create purchase return |

## Expenses — `/api/expenses`

| Method | Path | Description |
|--------|------|-------------|
| GET | /expenses | List expenses |
| POST | /expenses | Create expense |
| PUT | /expenses/:id | Edit expense |
| DELETE | /expenses/:id | Soft delete |

## Promotions — `/api/promotions`

| Method | Path | Description |
|--------|------|-------------|
| POST | /promotions/evaluate | Evaluate cart against active promotions |
| GET | /promotions | List all (admin) |
| POST | /promotions | Create promotion |
| PUT | /promotions/:id | Update |
| PATCH | /promotions/:id/toggle | Activate/deactivate |

## Loyalty — `/api/loyalty`

| Method | Path | Description |
|--------|------|-------------|
| POST | /loyalty/redeem | Redeem points on invoice |
| POST | /loyalty/adjust | Manual admin adjustment |
| GET | /loyalty/report | Program summary report |

## Reports — `/api/reports`

| Method | Path | Description |
|--------|------|-------------|
| GET | /reports/sales | Sales report (date range, grouping) |
| GET | /reports/purchases | Purchases report |
| GET | /reports/returns | Returns report |
| GET | /reports/customers | Customer report |
| GET | /reports/suppliers | Supplier report |
| GET | /reports/stock | Stock report |
| GET | /reports/treasury | Treasury report |
| GET | /reports/expenses | Expenses report |
| GET | /reports/profit-loss | Profit & loss |
| GET | /reports/daily-close | Daily closing report |
| GET | /reports/tax | Tax report |
| GET | /reports/audit | Audit log report |
| GET | /reports/:type/export | Export as Excel or PDF (`?format=excel|pdf`) |

## Backup — `/api/backup`

| Method | Path | Description |
|--------|------|-------------|
| POST | /backup/create | Create backup `{ target_path }` (uses db.backup() API) |
| POST | /backup/restore | Restore from backup `{ backup_path }` (requires restart) |
| GET | /backup/list | List available backup files |
| GET | /backup/settings | Get auto-backup configuration |
| PUT | /backup/settings | Update auto-backup settings |

## Settings — `/api/settings`

| Method | Path | Description |
|--------|------|-------------|
| GET | /settings | Get all settings |
| PUT | /settings | Update settings (partial update) |
| GET | /settings/setup-status | Check if setup wizard is complete |

## Notifications — `/api/notifications`

| Method | Path | Description |
|--------|------|-------------|
| GET | /notifications | List (unread first) |
| PATCH | /notifications/:id/read | Mark as read |
| PATCH | /notifications/read-all | Mark all as read |
| GET | /notifications/count | Unread count |
