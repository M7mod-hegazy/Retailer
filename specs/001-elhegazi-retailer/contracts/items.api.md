# API Contract: Items & Inventory

**Base**: `/api/items`

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | /items | ✅ | items_view | List items with pagination, search, category filter |
| POST | /items | ✅ | items_create | Create new item |
| GET | /items/:id | ✅ | items_view | Item detail + stock levels + price history |
| PUT | /items/:id | ✅ | items_edit | Update item |
| DELETE | /items/:id | ✅ | items_delete | Soft delete |
| POST | /items/import | ✅ | items_create | Excel bulk import |
| GET | /items/export | ✅ | items_view | Excel export |
| GET | /items/barcode/:barcode | ✅ | items_view | Lookup by barcode (POS scanner) |
| POST | /items/bulk-price-update | ✅ | items_edit | Bulk price change by category/percentage |

## Barcode Lookup Response

```json
{
  "success": true,
  "data": {
    "id": 42,
    "item_code": "ITM-042",
    "name": "حليب طازج 1 لتر",
    "barcode": "6281000000001",
    "price1": 850,
    "price2": 750,
    "cost_price": 600,
    "unit_name": "قطعة",
    "category_name": "ألبان",
    "stock_qty": 150,
    "track_stock": true,
    "allow_negative_stock": false,
    "image_path": "/uploads/items/42.jpg",
    "tax_rate": 1500,
    "tax_type": "exclusive"
  }
}
```

**Response time target**: < 10ms for barcode lookup (indexed query).
