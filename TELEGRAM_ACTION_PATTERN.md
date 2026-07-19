# Telegram Action Pattern — How to Add a New Notification Event

This document is the single reference for adding a new Telegram notification event to the ElHegazi Retailer system. Every new event requires touching **exactly 10 locations** across server, client, and database layers.

## The 10-Point Checklist

### Server Layer (`server/src/`)

#### 1. `services/telegramService.js` — EVENT_TYPES enum
Add the event type constant to the `EVENT_TYPES` object (line ~15).
```js
MY_NEW_EVENT: "my_new_event",
```

#### 2. `services/telegramService.js` — EVENT_CATEGORY map
Map the event type to its template category string (line ~565). This must match the `kind` column in `message_templates` and the CATEGORY_CHANNEL entry.
```js
[EVENT_TYPES.MY_NEW_EVENT]: "telegram_my_new_event",
```

#### 3. `services/telegramService.js` — EVENT_PRESET_FIELD map
Map the event type to the per-recipient toggle field name the UI stores the variant label under (line ~664).
```js
[EVENT_TYPES.MY_NEW_EVENT]: "notifyMyNewEvent",
```

#### 4. `services/telegramService.js` — isEventEnabledForRecipient switch
Add a case to the switch statement (line ~346) returning the recipient's toggle field.
```js
case EVENT_TYPES.MY_NEW_EVENT: return recipient.notifyMyNewEvent;
```

#### 5. `services/telegramService.js` — buildTemplateVars switch
Add a case to the switch statement (line ~996) returning an object of `{token: value}` pairs matching the template's `{tokens}`.
```js
case EVENT_TYPES.MY_NEW_EVENT:
  return {
    some_field: data.someField || "default",
    amount: formatMoney(data.amount || 0, currency),
    user_name: data.userName || "غير محدد",
    time: formatDateTime(data.createdAt),
  };
```

#### 6. `services/telegramService.js` — getTelegramRecipients
Add the new toggle field to the recipient mapping object (line ~174).
```js
notifyMyNewEvent: Boolean(r.notify_my_new_event),
```

#### 7. `services/telegramSampleData.js` — SAMPLE_EVENT_DATA
Add a sample event payload that mirrors exactly what the real firing site passes to `notifyOwner()`. This data is used by the server-side preview endpoint to render previews.
```js
my_new_event: { someField: "value", amount: 1000, userName: "المدير", createdAt: SAMPLE_TIME },
```

#### 8. `routes/telegram.routes.js` — RECIPIENT_WRITE_COLUMNS + recipientFromBody
Add the column name to `RECIPIENT_WRITE_COLUMNS` array AND add the field mapping in `recipientFromBody()`.
```js
// In RECIPIENT_WRITE_COLUMNS:
"notify_my_new_event",

// In recipientFromBody():
notify_my_new_event: asBool(body?.notify_my_new_event),
```

### Client Layer (`client/src/`)

#### 9. `hooks/useTelegramConnect.js` — 3 locations
Add the field in all three mapping functions:

```js
// In RECIPIENT_FIELD_DEFAULTS:
notifyMyNewEvent: true,

// In recipientToApi():
notify_my_new_event: Boolean(pickField(r, "notifyMyNewEvent")),

// In recipientFromApi():
notifyMyNewEvent: readBool(r, "notify_my_new_event", "notifyMyNewEvent", true),
```

#### 10. `pages/whatsapp/WhatsAppCrmPage.jsx` — 5 locations

```js
// In TG_EVENT_TEMPLATE_MAP:
notifyMyNewEvent: "telegram_my_new_event",

// In TG_SAMPLE_DATA:
telegram_my_new_event: { some_field: "قيمة", amount: "1,000.00 ج", user_name: "المدير", time: TG_SAMPLE_TIME },

// In buildTelegramEventCategories — add to the appropriate category's events array:
{ field: "notifyMyNewEvent", label: "وصف الحدث", hint: "متى يُرسل هذا التنبيه" },

// In CATEGORY_META:
telegram_my_new_event: {
  label: "وصف الحدث", hint: "وصف مختصر", vars: [
    { token: "{some_field}", label: "الحقل" },
    { token: "{user_name}", label: "بواسطة" },
    { token: "{time}", label: "التوقيت" },
  ]
},

// In TELEGRAM_CATEGORIES array:
"telegram_my_new_event",
```

### Database Layer (`electron/migrations/`)

#### Migration File
Create a new migration `NNN_description.js` that:

1. Adds the `notify_my_new_event` column to `telegram_recipients` (DEFAULT 1)
2. Seeds `message_templates` with the detailed + short template bodies
3. Seeds `message_template_variants` rows

```js
function up(db) {
  const cols = db.prepare("PRAGMA table_info(telegram_recipients)").all().map((c) => c.name);
  if (!cols.includes("notify_my_new_event")) {
    db.exec("ALTER TABLE telegram_recipients ADD COLUMN notify_my_new_event INTEGER NOT NULL DEFAULT 1");
  }
  // Seed templates using the standard seed() helper pattern
}
```

### Route Layer (optional, event-specific)

#### Firing Site
Add `notifyOwner(TG.MY_NEW_EVENT, { ... }, db)` in the route handler where the event occurs. The data object MUST match the shape expected by `buildTemplateVars`.

```js
try {
  notifyOwner(TG.MY_NEW_EVENT, {
    someField: value,
    userName: req.user?.full_name || req.user?.username,
    createdAt: new Date().toISOString(),
  }, db);
} catch (_) { /* non-critical */ }
```

### Template Channel Registration (`routes/whatsappCrm.routes.js`)

Add the template category to `CATEGORY_CHANNEL`:
```js
telegram_my_new_event: "telegram",
```

---

## Example Walkthrough: Adding `PRODUCT_IMPORTED`

**Scenario:** When a user imports products via CSV, fire a Telegram notification.

### Step 1: EVENT_TYPES
```js
PRODUCT_IMPORTED: "product_imported",
```

### Step 2: EVENT_CATEGORY
```js
[EVENT_TYPES.PRODUCT_IMPORTED]: "telegram_product_imported",
```

### Step 3: EVENT_PRESET_FIELD
```js
[EVENT_TYPES.PRODUCT_IMPORTED]: "notifyProductImported",
```

### Step 4: isEventEnabledForRecipient
```js
case EVENT_TYPES.PRODUCT_IMPORTED: return recipient.notifyProductImported;
```

### Step 5: buildTemplateVars
```js
case EVENT_TYPES.PRODUCT_IMPORTED:
  return {
    products_count: data.productsCount || 0,
    file_name: data.fileName || "—",
    user_name: data.userName || "غير محدد",
    time: formatDateTime(data.createdAt),
  };
```

### Step 6: getTelegramRecipients
```js
notifyProductImported: Boolean(r.notify_product_imported),
```

### Step 7: telegramSampleData.js
```js
product_imported: { productsCount: 24, fileName: "products.csv", userName: "المدير", createdAt: SAMPLE_TIME },
```

### Step 8: telegram.routes.js
```js
// RECIPIENT_WRITE_COLUMNS:
"notify_product_imported",

// recipientFromBody():
notify_product_imported: asBool(body?.notify_product_imported),
```

### Step 9: useTelegramConnect.js
```js
// RECIPIENT_FIELD_DEFAULTS:
notifyProductImported: true,

// recipientToApi():
notify_product_imported: Boolean(pickField(r, "notifyProductImported")),

// recipientFromApi():
notifyProductImported: readBool(r, "notify_product_imported", "notifyProductImported", true),
```

### Step 10: WhatsAppCrmPage.jsx
```js
// TG_EVENT_TEMPLATE_MAP:
notifyProductImported: "telegram_product_imported",

// TG_SAMPLE_DATA:
telegram_product_imported: { products_count: 24, file_name: "products.csv", user_name: "المدير", time: TG_SAMPLE_TIME },

// buildTelegramEventCategories (inventory category):
{ field: "notifyProductImported", label: "استيراد منتجات", hint: "عند استيراد أصناف من ملف CSV" },

// CATEGORY_META:
telegram_product_imported: {
  label: "استيراد منتجات", hint: "تنبيه عند استيراد أصناف", vars: [
    { token: "{products_count}", label: "عدد المنتجات" },
    { token: "{file_name}", label: "اسم الملف" },
    { token: "{user_name}", label: "بواسطة" },
    { token: "{time}", label: "التوقيت" },
  ]
},

// TELEGRAM_CATEGORIES:
"telegram_product_imported",
```

### Step 11: whatsappCrm.routes.js
```js
telegram_product_imported: "telegram",
```

### Step 12: Migration
```js
// electron/migrations/NNN_telegram_product_imported.js
function up(db) {
  const cols = db.prepare("PRAGMA table_info(telegram_recipients)").all().map((c) => c.name);
  if (!cols.includes("notify_product_imported")) {
    db.exec("ALTER TABLE telegram_recipients ADD COLUMN notify_product_imported INTEGER NOT NULL DEFAULT 1");
  }
  // Seed templates...
}
```

### Step 13: Firing site (e.g., `routes/products.routes.js`)
```js
try {
  notifyOwner(TG.PRODUCT_IMPORTED, {
    productsCount: importedRows.length,
    fileName: req.file?.originalname,
    userName: req.user?.full_name || req.user?.username,
    createdAt: new Date().toISOString(),
  }, db);
} catch (_) { /* non-critical */ }
```

---

## Common Pitfalls

1. **Missing EVENT_CATEGORY**: If you add an EVENT_TYPE but forget the CATEGORY map, the event will fire but produce an empty message (no template resolution).

2. **Missing sample data**: The server-side preview endpoint (`/api/telegram/previews`) uses `SAMPLE_EVENT_DATA` to render previews. Without sample data, the preview returns null and the client shows a blank card.

3. **Column name mismatch**: The `notify_*` column in `telegram_recipients` must exactly match the key in `RECIPIENT_WRITE_COLUMNS` and the `recipientFromBody()` mapping.

4. **Template token mismatch**: The `{tokens}` in the template body must exactly match the keys returned by `buildTemplateVars`. Mismatches produce literal `{token}` text in the delivered message.

5. **Migration order**: New migrations must have a higher number than existing ones. Check `electron/migrations/` for the highest number.

6. **CATEGORY_CHANNEL**: If you forget to add the category to `CATEGORY_CHANNEL` in `whatsappCrm.routes.js`, creating a custom variant for that category will fail with "فئة غير صالحة".

7. **Default value**: Always use `DEFAULT 1` (ON) for new toggle columns so existing recipients automatically receive the new alert.

8. **Non-critical wrapping**: Always wrap `notifyOwner()` calls in `try/catch` with a comment `/* non-critical */` — a Telegram failure must never block the actual operation.
