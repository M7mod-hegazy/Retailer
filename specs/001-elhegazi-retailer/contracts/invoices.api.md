# API Contract: Invoices (Sales & Returns)

**Base**: `/api/invoices`

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | /invoices | ✅ | sales_view | List invoices with filters |
| POST | /invoices | ✅ | sales_create | Create new sale invoice (atomic: lines + stock + balance + audit) |
| GET | /invoices/:id | ✅ | sales_view | Single invoice with lines |
| PUT | /invoices/:id | ✅ | sales_edit | Edit draft invoice |
| DELETE | /invoices/:id | ✅ | sales_delete | Soft delete (requires confirmation + reason) |
| POST | /invoices/:id/return | ✅ | sales_return | Create return against this invoice |
| GET | /invoices/:id/print | ✅ | sales_view | Get print-ready data |

## Create Invoice Body

```json
{
  "customer_id": 5,
  "warehouse_id": 1,
  "treasury_id": 1,
  "payment_type": "cash",
  "paid_amount": 15000,
  "discount_type": "percent",
  "discount_value": 500,
  "additions": 0,
  "notes": "",
  "lines": [
    {
      "item_id": 42,
      "quantity": 3,
      "unit_price": 5000,
      "discount_type": "amount",
      "discount_value": 0,
      "unit_id": 1,
      "warehouse_id": 1
    }
  ],
  "loyalty_points_used": 0,
  "promotion_ids": [12]
}
```

**All monetary values are integers (halala). `5000` = 50.00 SAR.**

## Transaction Atomicity

Invoice creation MUST execute as a single SQLite transaction:
1. Increment invoice_counter → generate invoice_number
2. INSERT invoice
3. INSERT invoice_lines
4. UPDATE stock_levels (deduct quantity per line)
5. INSERT stock_movements (one per line)
6. UPDATE customer.current_balance (if credit)
7. UPDATE treasury.current_balance (if cash)
8. UPDATE shift totals (if shift open)
9. INSERT audit_log
10. Evaluate promotions → apply discounts
11. Process loyalty points (earn/redeem)

If any step fails → entire transaction rolls back.

## Query Filters

`GET /invoices?page=1&limit=20&date_from=2026-01-01&date_to=2026-12-31&customer_id=5&status=confirmed&payment_type=cash&search=INV-`
