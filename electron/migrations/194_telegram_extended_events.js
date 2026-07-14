// Extended Telegram notification events:
// Inventory: stock_transfer, inventory_adjustment, new_product, price_change, batch_expiry, physical_count
// Financial: supplier_payment, debt_payment, installment_paid, revenue_created, withdrawal_created
// Purchases: purchase_voided, purchase_return, branch_transfer
// Security: password_changed, permission_changed, supervisor_override
// Repair: repair_order_created, repair_order_ready, repair_order_delivered
// Employees: employee_created, salary_settled, advance_created, deduction_created, bonus_created
function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

module.exports = {
  name: "194_telegram_extended_events",
  up(db) {
    // Add new columns to telegram_recipients
    addColumnIfMissing(db, "telegram_recipients", "notify_stock_transfer", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "telegram_recipients", "notify_inventory_adjustment", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "telegram_recipients", "notify_new_product", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "telegram_recipients", "notify_price_change", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "telegram_recipients", "notify_batch_expiry", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "telegram_recipients", "notify_physical_count", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "telegram_recipients", "notify_supplier_payment", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "telegram_recipients", "notify_debt_payment", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "telegram_recipients", "notify_installment_paid", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "telegram_recipients", "notify_purchase_voided", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "telegram_recipients", "notify_purchase_return", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "telegram_recipients", "notify_branch_transfer", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "telegram_recipients", "notify_password_changed", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "telegram_recipients", "notify_permission_changed", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "telegram_recipients", "notify_supervisor_override", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "telegram_recipients", "notify_repair_created", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "telegram_recipients", "notify_repair_ready", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "telegram_recipients", "notify_repair_delivered", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "telegram_recipients", "notify_revenue_created", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "telegram_recipients", "notify_withdrawal_created", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "telegram_recipients", "notify_employee_created", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "telegram_recipients", "notify_salary_settled", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "telegram_recipients", "notify_advance_created", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "telegram_recipients", "notify_deduction_created", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "telegram_recipients", "notify_bonus_created", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "telegram_recipients", "event_presets", "TEXT NOT NULL DEFAULT '{}'");

    // Add legacy columns to settings table for backward compatibility
    addColumnIfMissing(db, "settings", "telegram_notify_stock_transfer", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "settings", "telegram_notify_inventory_adjustment", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "settings", "telegram_notify_new_product", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "settings", "telegram_notify_price_change", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "settings", "telegram_notify_batch_expiry", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "settings", "telegram_notify_physical_count", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "settings", "telegram_notify_supplier_payment", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "settings", "telegram_notify_debt_payment", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "settings", "telegram_notify_installment_paid", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "settings", "telegram_notify_purchase_voided", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "settings", "telegram_notify_purchase_return", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "settings", "telegram_notify_branch_transfer", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "settings", "telegram_notify_password_changed", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "settings", "telegram_notify_permission_changed", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "settings", "telegram_notify_supervisor_override", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "settings", "telegram_notify_repair_created", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "settings", "telegram_notify_repair_ready", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "settings", "telegram_notify_repair_delivered", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "settings", "telegram_notify_revenue_created", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "settings", "telegram_notify_withdrawal_created", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "settings", "telegram_notify_employee_created", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "settings", "telegram_notify_salary_settled", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "settings", "telegram_notify_advance_created", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "settings", "telegram_notify_deduction_created", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "settings", "telegram_notify_bonus_created", "INTEGER NOT NULL DEFAULT 1");

    // Add new template categories with 2 presets each (detailed + short)
    const insertTemplate = db.prepare(
      "INSERT OR IGNORE INTO message_templates (kind, label, body, channel) VALUES (?, ?, ?, 'telegram')"
    );
    const insertVariant = db.prepare(`
      INSERT INTO message_template_variants (category, label, body, channel, is_active, updated_at)
      VALUES (?, ?, ?, 'telegram', ?, datetime('now'))
    `);

    const templates = {
      // === INVENTORY EVENTS ===
      telegram_stock_transfer: {
        label: "نقل مخزون",
        detailed: "📦 *نقل مخزون*\n\n📤 من: *{from_warehouse}*\n📥 إلى: *{to_warehouse}*\n🕐 {time}\n\n{items_table}\n\n📊 عدد الأصناف: *{items_count}* | إجمالي الوحدات: *{total_units}*",
        short: "📦 نقل مخزون | {from_warehouse} → {to_warehouse} | {items_count} أصناف | ⏰ {time}"
      },
      telegram_inventory_adjustment: {
        label: "تعديل مخزون",
        detailed: "📋 *تعديل مخزون يدوي*\n\n🏷️ المنتج: *{product_name}*\n🏢 المستودع: {warehouse}\n📦 الكمية: {old_quantity} → {new_quantity} (فرق: {difference})\n📝 السبب: {reason}\n👤 بواسطة: {user_name}\n⏰ {time}",
        short: "📋 تعديل مخزون | {product_name} | {old_quantity}→{new_quantity} ({difference}) | {reason}"
      },
      telegram_new_product: {
        label: "منتج جديد",
        detailed: "🆕 *إضافة منتج جديد*\n\n🏷️ المنتج: *{product_name}*\n🔖 الكود: {sku}\n💰 السعر: {price}\n🏢 المستودع: {warehouse}\n👤 بواسطة: {user_name}\n⏰ {time}",
        short: "🆕 منتج جديد | {product_name} ({sku}) | {price}"
      },
      telegram_price_change: {
        label: "تغيير سعر",
        detailed: "💲 *تغيير سعر منتج*\n\n🏷️ المنتج: *{product_name}*\n📉 السعر القديم: {old_price}\n📈 السعر الجديد: *{new_price}*\n📊 نسبة التغيير: {change_percent}\n👤 بواسطة: {user_name}\n⏰ {time}",
        short: "💲 تغيير سعر | {product_name} | {old_price} → {new_price} ({change_percent})"
      },
      telegram_batch_expiry: {
        label: "انتهاء صلاحية",
        detailed: "⚠️ *انتهاء صلاحية دفعة قادم*\n\n🏷️ المنتج: *{product_name}*\n🔢 رقم الدفعة: {batch_no}\n📅 تاريخ الانتهاء: *{expiry_date}*\n📦 الكمية المتبقية: {remaining_quantity}\n🏢 المستودع: {warehouse}",
        short: "⚠️ انتهاء صلاحية | {product_name} | دفعة {batch_no} | تنتهي {expiry_date}"
      },
      telegram_physical_count: {
        label: "جرد فعلي",
        detailed: "📊 *تأكيد جرد فعلي*\n\n🏢 المستودع: {warehouse}\n✅ أصناف مطابقة: *{matched_count}*\n❌ أصناف غير مطابقة: *{mismatched_count}*\n📦 إجمالي الأصناف: {total_items}\n👤 بواسطة: {user_name}\n⏰ {time}",
        short: "📊 جرد {warehouse}: {matched_count} مطابق | {mismatched_count} غير مطابق"
      },

      // === FINANCIAL EVENTS ===
      telegram_supplier_payment: {
        label: "دفعة مورد",
        detailed: "💸 *دفعة مورد*\n\n🏢 المورد: *{supplier_name}*\n💰 المبلغ: *{amount}*\n💳 الطريقة: {method}\n🔖 المرجع: {reference}\n👤 بواسطة: {user_name}\n⏰ {time}",
        short: "💸 دفعة مورد | {supplier_name} | {amount} | {method}"
      },
      telegram_debt_payment: {
        label: "دفعة دين",
        detailed: "💰 *تحصيل دفعة دين*\n\n👤 العميل: *{customer_name}*\n💵 المبلغ: *{amount}*\n💳 الطريقة: {method}\n📊 الدين المتبقي: {remaining_debt}\n👤 بواسطة: {user_name}\n⏰ {time}",
        short: "💰 تحصيل دين | {customer_name} | {amount} | متبقي {remaining_debt}"
      },
      telegram_installment_paid: {
        label: "دفعة قسط",
        detailed: "📋 *تسديد قسط*\n\n👤 العميل: *{customer_name}*\n🔢 القسط رقم: {installment_no} / {total_installments}\n💵 المبلغ: *{amount}*\n📊 المتبقي: {remaining}",
        short: "📋 قسط مسدّد | {customer_name} | قسط {installment_no}/{total_installments} | {amount}"
      },

      // === PURCHASES EVENTS ===
      telegram_purchase_voided: {
        label: "شراء ملغي",
        detailed: "🚫 *إلغاء فاتورة شراء*\n\n🔖 المرجع: {reference_no}\n🏢 المورد: *{supplier_name}*\n💰 الإجمالي: {total}\n📝 السبب: {reason}\n👤 بواسطة: {user_name}\n⏰ {time}",
        short: "🚫 شراء ملغي | {reference_no} | {supplier_name} | {total}"
      },
      telegram_purchase_return: {
        label: "مرتجع مشتريات",
        detailed: "↩️ *مرتجع مشتريات*\n\n🔖 المرجع: {reference_no}\n🏢 المورد: *{supplier_name}*\n💰 الإجمالي: *{total}*\n\n{items_table}\n\n📊 عدد الأصناف: {items_count}\n👤 بواسطة: {user_name}\n⏰ {time}",
        short: "↩️ مرتجع شراء | {reference_no} | {supplier_name} | {total} | {items_count} أصناف"
      },
      telegram_branch_transfer: {
        label: "تحويل فرع",
        detailed: "🔄 *تحويل بين الفروع*\n\n🔖 المرجع: {reference_no}\n📤 من: {from_branch}\n📥 إلى: {to_warehouse}\n🔀 النوع: {transfer_type}\n⏰ {time}\n\n{items_table}\n\n📊 عدد الأصناف: {items_count} | إجمالي الوحدات: {total_units}\n💰 إجمالي التكلفة: *{total_cost}*",
        short: "🔄 تحويل فرع | {reference_no} | {from_branch}→{to_warehouse} | {items_count} أصناف | {total_cost}"
      },

      // === SECURITY EVENTS ===
      telegram_password_changed: {
        label: "تغيير كلمة مرور",
        detailed: "🔐 *تغيير كلمة المرور*\n\n👤 المستخدم: *{user_name}*\n⏰ التوقيت: {time}\n🌐 عنوان IP: {ip_address}",
        short: "🔐 تغيير كلمة مرور | {user_name} | {time}"
      },
      telegram_permission_changed: {
        label: "تغيير صلاحيات",
        detailed: "🛡️ *تغيير صلاحيات*\n\n👤 المستخدم: *{user_name}*\n📝 الإجراء: {action}\n📋 التفاصيل: {details}\n👤 بواسطة: {changed_by}\n⏰ {time}",
        short: "🛡️ تغيير صلاحيات | {user_name} | {action}"
      },
      telegram_supervisor_override: {
        label: "تجاوز صلاحيات",
        detailed: "⚠️ *تجاوز صلاحيات*\n\n👤 المستخدم: *{user_name}*\n📝 الإجراء: {action}\n📋 التفاصيل: {details}\n👨‍💼 المشرف: {supervisor}\n⏰ {time}",
        short: "⚠️ تجاوز صلاحيات | {user_name} | {action} | مشرف: {supervisor}"
      },

      // === REPAIR ORDER EVENTS ===
      telegram_repair_created: {
        label: "طلب صيانة جديد",
        detailed: "🔧 *طلب صيانة جديد*\n\n🔖 رقم الطلب: *{order_no}*\n👤 العميل: *{customer_name}*\n📱 الجهاز: {device_type}\n📝 المشكلة: {problem}\n💰 التكلفة التقديرية: {estimated_cost}\n⏰ {time}",
        short: "🔧 صيانة جديدة | {order_no} | {customer_name} | {estimated_cost}"
      },
      telegram_repair_ready: {
        label: "جاهز للاستلام",
        detailed: "✅ *جهاز جاهز للاستلام*\n\n📋 رقم الطلب: *{order_no}*\n👤 العميل: *{customer_name}*\n📱 الجهاز: *{device_type}*\n💰 التكلفة النهائية: *{final_cost}*\n⏰ الوقت: *{time}*\n\n📞 يرجى إبلاغ العميل",
        short: "✅ جاهز للاستلام | {order_no} | {customer_name}"
      },
      telegram_repair_delivered: {
        label: "تم التسليم",
        detailed: "📦 *تم تسليم جهاز الصيانة*\n\n📋 رقم الطلب: *{order_no}*\n👤 العميل: *{customer_name}*\n📱 الجهاز: *{device_type}*\n💰 المبلغ المحصّل: *{amount_paid}*\n👤 تم بواسطة: *{user_name}*\n⏰ {time}",
        short: "📦 تم التسليم | {order_no} | {customer_name}"
      },

      // === REVENUE & WITHDRAWAL EVENTS ===
      telegram_revenue_created: {
        label: "إيراد جديد",
        detailed: "💵 *تسجيل إيراد*\n\n🔖 المستند: *{doc_no}*\n💰 المبلغ: *{amount}*\n📂 الفئة: {category}\n📝 الوصف: {description}\n💳 الطريقة: {method}\n👤 بواسطة: {user_name}\n⏰ {time}",
        short: "💵 إيراد جديد | {doc_no} | {amount} | {category}"
      },
      telegram_withdrawal_created: {
        label: "سحب نقدي",
        detailed: "🏦 *تسجيل سحب نقدي*\n\n🔖 المستند: *{doc_no}*\n💰 المبلغ: *{amount}*\n📂 الفئة: {category}\n📝 الملاحظة: {note}\n💳 الطريقة: {method}\n👤 بواسطة: {user_name}\n⏰ {time}",
        short: "🏦 سحب نقدي | {doc_no} | {amount} | {category}"
      },

      // === EMPLOYEE EVENTS ===
      telegram_employee_created: {
        label: "موظف جديد",
        detailed: "👤 *إضافة موظف جديد*\n\n🏷️ اسم الموظف: *{employee_name}*\n💼 المسمى: {job_title}\n💰 الراتب: {salary}\n📞 الهاتف: {phone}\n👤 بواسطة: {user_name}\n⏰ {time}",
        short: "👤 موظف جديد | {employee_name} | {job_title} | {salary}"
      },
      telegram_salary_settled: {
        label: "تسويات راتب",
        detailed: "💰 *تسويات راتب*\n\n👤 الموظف: *{employee_name}*\n📅 الفترة: {period}\n💵 الراتب الأساسي: {base_salary}\n🏆 المكافآت: {bonuses}\n📉 الخصومات: {deductions}\n💳 خصم السلف: {advance_deductions}\n━━━━━━━━━━━━━━━\n✅ الصافي: *{net_salary}*\n💰 المدفوع: *{paid_amount}*\n👤 بواسطة: {user_name}\n⏰ {time}",
        short: "💰 تسويات راتب | {employee_name} | صافي {net_salary} | مدفوع {paid_amount}"
      },
      telegram_advance_created: {
        label: "سلفة موظف",
        detailed: "💳 *منح سلفة*\n\n👤 الموظف: *{employee_name}*\n💰 المبلغ: *{amount}*\n🔢 عدد الأقساط: {installment_count}\n📊 قيمة القسط: {installment_amount}\n📝 ملاحظات: {notes}\n👤 بواسطة: {user_name}\n⏰ {time}",
        short: "💳 سلفة جديدة | {employee_name} | {amount} | {installment_count} أقساط × {installment_amount}"
      },
      telegram_deduction_created: {
        label: "خصم موظف",
        detailed: "📉 *تسجيل خصم*\n\n👤 الموظف: *{employee_name}*\n💰 المبلغ: *{amount}*\n📋 نوع الخصم: {deduction_type}\n🔄 دوري: {is_recurring}\n📝 ملاحظات: {notes}\n👤 بواسطة: {user_name}\n⏰ {time}",
        short: "📉 خصم جديد | {employee_name} | {amount} | {deduction_type}"
      },
      telegram_bonus_created: {
        label: "مكافأة موظف",
        detailed: "🏆 *منح مكافأة*\n\n👤 الموظف: *{employee_name}*\n💰 المبلغ: *{amount}*\n📋 نوع المكافأة: {bonus_type}\n🔄 دوري: {is_recurring}\n📝 ملاحظات: {notes}\n👤 بواسطة: {user_name}\n⏰ {time}",
        short: "🏆 مكافأة جديدة | {employee_name} | {amount} | {bonus_type}"
      }
    };

    for (const [category, { label, detailed, short }] of Object.entries(templates)) {
      // Delete any existing variants for this category (handles re-run on existing DBs)
      db.prepare("DELETE FROM message_template_variants WHERE category = ?").run(category);
      
      // Insert base template if not exists, or update body if it does
      const existing = db.prepare("SELECT 1 FROM message_templates WHERE kind = ?").get(category);
      if (existing) {
        db.prepare("UPDATE message_templates SET body = ?, label = ? WHERE kind = ?").run(detailed, label, category);
      } else {
        insertTemplate.run(category, label, detailed);
      }
      
      // Insert detailed preset (active by default)
      insertVariant.run(category, "قياسي — مفصل", detailed, 1);
      // Insert short preset
      insertVariant.run(category, "مختصر — سريع", short, 0);
    }
  },
};
