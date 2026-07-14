// Fix variant labels for telegram extended events that were inserted with
// incorrect labels ("تفصيلي"/"مختصر") by an earlier version of migration 194.
// This migration deletes all variants + base templates for the 25 extended
// telegram categories and re-inserts them with the correct labels
// ("قياسي — مفصل" / "مختصر — سريع").

const EXTENDED_CATEGORIES = [
  "telegram_stock_transfer",
  "telegram_inventory_adjustment",
  "telegram_new_product",
  "telegram_price_change",
  "telegram_batch_expiry",
  "telegram_physical_count",
  "telegram_supplier_payment",
  "telegram_debt_payment",
  "telegram_installment_paid",
  "telegram_purchase_voided",
  "telegram_purchase_return",
  "telegram_branch_transfer",
  "telegram_password_changed",
  "telegram_permission_changed",
  "telegram_supervisor_override",
  "telegram_repair_created",
  "telegram_repair_ready",
  "telegram_repair_delivered",
  "telegram_revenue_created",
  "telegram_withdrawal_created",
  "telegram_employee_created",
  "telegram_salary_settled",
  "telegram_advance_created",
  "telegram_deduction_created",
  "telegram_bonus_created",
];

const LABELS = {
  telegram_stock_transfer: "نقل مخزون",
  telegram_inventory_adjustment: "تعديل مخزون",
  telegram_new_product: "منتج جديد",
  telegram_price_change: "تغيير سعر",
  telegram_batch_expiry: "انتهاء صلاحية",
  telegram_physical_count: "جرد فعلي",
  telegram_supplier_payment: "دفعة مورد",
  telegram_debt_payment: "دفعة دين",
  telegram_installment_paid: "دفعة قسط",
  telegram_purchase_voided: "شراء ملغي",
  telegram_purchase_return: "مرتجع مشتريات",
  telegram_branch_transfer: "تحويل فرع",
  telegram_password_changed: "تغيير كلمة مرور",
  telegram_permission_changed: "تغيير صلاحيات",
  telegram_supervisor_override: "تجاوز صلاحيات",
  telegram_repair_created: "طلب صيانة جديد",
  telegram_repair_ready: "جاهز للاستلام",
  telegram_repair_delivered: "تم التسليم",
  telegram_revenue_created: "إيراد جديد",
  telegram_withdrawal_created: "سحب نقدي",
  telegram_employee_created: "موظف جديد",
  telegram_salary_settled: "تسويات راتب",
  telegram_advance_created: "سلفة موظف",
  telegram_deduction_created: "خصم موظف",
  telegram_bonus_created: "مكافأة موظف",
};

const TEMPLATES = {
  telegram_stock_transfer: {
    detailed: "📦 *نقل مخزون*\n\n📤 من: *{from_warehouse}*\n📥 إلى: *{to_warehouse}*\n🕐 {time}\n\n{items_table}\n\n📊 عدد الأصناف: *{items_count}* | إجمالي الوحدات: *{total_units}*",
    short: "📦 نقل مخزون | {from_warehouse} → {to_warehouse} | {items_count} أصناف | ⏰ {time}",
  },
  telegram_inventory_adjustment: {
    detailed: "📋 *تعديل مخزون يدوي*\n\n🏷️ المنتج: *{product_name}*\n🏢 المستودع: {warehouse}\n📦 الكمية: {old_quantity} → {new_quantity} (فرق: {difference})\n📝 السبب: {reason}\n👤 بواسطة: {user_name}\n⏰ {time}",
    short: "📋 تعديل مخزون | {product_name} | {old_quantity}→{new_quantity} ({difference}) | {reason}",
  },
  telegram_new_product: {
    detailed: "🆕 *إضافة منتج جديد*\n\n🏷️ المنتج: *{product_name}*\n🔖 الكود: {sku}\n💰 السعر: {price}\n🏢 المستودع: {warehouse}\n👤 بواسطة: {user_name}\n⏰ {time}",
    short: "🆕 منتج جديد | {product_name} ({sku}) | {price}",
  },
  telegram_price_change: {
    detailed: "💲 *تغيير سعر منتج*\n\n🏷️ المنتج: *{product_name}*\n📉 السعر القديم: {old_price}\n📈 السعر الجديد: *{new_price}*\n📊 نسبة التغيير: {change_percent}\n👤 بواسطة: {user_name}\n⏰ {time}",
    short: "💲 تغيير سعر | {product_name} | {old_price} → {new_price} ({change_percent})",
  },
  telegram_batch_expiry: {
    detailed: "⚠️ *انتهاء صلاحية دفعة قادم*\n\n🏷️ المنتج: *{product_name}*\n🔢 رقم الدفعة: {batch_no}\n📅 تاريخ الانتهاء: *{expiry_date}*\n📦 الكمية المتبقية: {remaining_quantity}\n🏢 المستودع: {warehouse}",
    short: "⚠️ انتهاء صلاحية | {product_name} | دفعة {batch_no} | تنتهي {expiry_date}",
  },
  telegram_physical_count: {
    detailed: "📊 *تأكيد جرد فعلي*\n\n🏢 المستودع: {warehouse}\n✅ أصناف مطابقة: *{matched_count}*\n❌ أصناف غير مطابقة: *{mismatched_count}*\n📦 إجمالي الأصناف: {total_items}\n👤 بواسطة: {user_name}\n⏰ {time}",
    short: "📊 جرد {warehouse}: {matched_count} مطابق | {mismatched_count} غير مطابق",
  },
  telegram_supplier_payment: {
    detailed: "💸 *دفعة مورد*\n\n🏢 المورد: *{supplier_name}*\n💰 المبلغ: *{amount}*\n💳 الطريقة: {method}\n🔖 المرجع: {reference}\n👤 بواسطة: {user_name}\n⏰ {time}",
    short: "💸 دفعة مورد | {supplier_name} | {amount} | {method}",
  },
  telegram_debt_payment: {
    detailed: "💰 *تحصيل دفعة دين*\n\n👤 العميل: *{customer_name}*\n💵 المبلغ: *{amount}*\n💳 الطريقة: {method}\n📊 الدين المتبقي: {remaining_debt}\n👤 بواسطة: {user_name}\n⏰ {time}",
    short: "💰 تحصيل دين | {customer_name} | {amount} | متبقي {remaining_debt}",
  },
  telegram_installment_paid: {
    detailed: "📋 *تسديد قسط*\n\n👤 العميل: *{customer_name}*\n🔢 القسط رقم: {installment_no} / {total_installments}\n💵 المبلغ: *{amount}*\n📊 المتبقي: {remaining}",
    short: "📋 قسط مسدّد | {customer_name} | قسط {installment_no}/{total_installments} | {amount}",
  },
  telegram_purchase_voided: {
    detailed: "🚫 *إلغاء فاتورة شراء*\n\n🔖 المرجع: {reference_no}\n🏢 المورد: *{supplier_name}*\n💰 الإجمالي: {total}\n📝 السبب: {reason}\n👤 بواسطة: {user_name}\n⏰ {time}",
    short: "🚫 شراء ملغي | {reference_no} | {supplier_name} | {total}",
  },
  telegram_purchase_return: {
    detailed: "↩️ *مرتجع مشتريات*\n\n🔖 المرجع: {reference_no}\n🏢 المورد: *{supplier_name}*\n💰 الإجمالي: *{total}*\n\n{items_table}\n\n📊 عدد الأصناف: {items_count}\n👤 بواسطة: {user_name}\n⏰ {time}",
    short: "↩️ مرتجع شراء | {reference_no} | {supplier_name} | {total} | {items_count} أصناف",
  },
  telegram_branch_transfer: {
    detailed: "🔄 *تحويل بين الفروع*\n\n🔖 المرجع: {reference_no}\n📤 من: {from_branch}\n📥 إلى: {to_warehouse}\n🔀 النوع: {transfer_type}\n⏰ {time}\n\n{items_table}\n\n📊 عدد الأصناف: {items_count} | إجمالي الوحدات: {total_units}\n💰 إجمالي التكلفة: *{total_cost}*",
    short: "🔄 تحويل فرع | {reference_no} | {from_branch}→{to_warehouse} | {items_count} أصناف | {total_cost}",
  },
  telegram_password_changed: {
    detailed: "🔐 *تغيير كلمة المرور*\n\n👤 المستخدم: *{user_name}*\n⏰ التوقيت: {time}\n🌐 عنوان IP: {ip_address}",
    short: "🔐 تغيير كلمة مرور | {user_name} | {time}",
  },
  telegram_permission_changed: {
    detailed: "🛡️ *تغيير صلاحيات*\n\n👤 المستخدم: *{user_name}*\n📝 الإجراء: {action}\n📋 التفاصيل: {details}\n👤 بواسطة: {changed_by}\n⏰ {time}",
    short: "🛡️ تغيير صلاحيات | {user_name} | {action}",
  },
  telegram_supervisor_override: {
    detailed: "⚠️ *تجاوز صلاحيات*\n\n👤 المستخدم: *{user_name}*\n📝 الإجراء: {action}\n📋 التفاصيل: {details}\n👨‍💼 المشرف: {supervisor}\n⏰ {time}",
    short: "⚠️ تجاوز صلاحيات | {user_name} | {action} | مشرف: {supervisor}",
  },
  telegram_repair_created: {
    detailed: "🔧 *طلب صيانة جديد*\n\n🔖 رقم الطلب: *{order_no}*\n👤 العميل: *{customer_name}*\n📱 الجهاز: {device_type}\n📝 المشكلة: {problem}\n💰 التكلفة التقديرية: {estimated_cost}\n⏰ {time}",
    short: "🔧 صيانة جديدة | {order_no} | {customer_name} | {estimated_cost}",
  },
  telegram_repair_ready: {
    detailed: "✅ *جهاز جاهز للاستلام*\n\n📋 رقم الطلب: *{order_no}*\n👤 العميل: *{customer_name}*\n📱 الجهاز: *{device_type}*\n💰 التكلفة النهائية: *{final_cost}*\n⏰ الوقت: *{time}*\n\n📞 يرجى إبلاغ العميل",
    short: "✅ جاهز للاستلام | {order_no} | {customer_name}",
  },
  telegram_repair_delivered: {
    detailed: "📦 *تم تسليم جهاز الصيانة*\n\n📋 رقم الطلب: *{order_no}*\n👤 العميل: *{customer_name}*\n📱 الجهاز: *{device_type}*\n💰 المبلغ المحصّل: *{amount_paid}*\n👤 تم بواسطة: *{user_name}*\n⏰ {time}",
    short: "📦 تم التسليم | {order_no} | {customer_name}",
  },
  telegram_revenue_created: {
    detailed: "💵 *تسجيل إيراد*\n\n🔖 المستند: *{doc_no}*\n💰 المبلغ: *{amount}*\n📂 الفئة: {category}\n📝 الوصف: {description}\n💳 الطريقة: {method}\n👤 بواسطة: {user_name}\n⏰ {time}",
    short: "💵 إيراد جديد | {doc_no} | {amount} | {category}",
  },
  telegram_withdrawal_created: {
    detailed: "🏦 *تسجيل سحب نقدي*\n\n🔖 المستند: *{doc_no}*\n💰 المبلغ: *{amount}*\n📂 الفئة: {category}\n📝 الملاحظة: {note}\n💳 الطريقة: {method}\n👤 بواسطة: {user_name}\n⏰ {time}",
    short: "🏦 سحب نقدي | {doc_no} | {amount} | {category}",
  },
  telegram_employee_created: {
    detailed: "👤 *إضافة موظف جديد*\n\n🏷️ اسم الموظف: *{employee_name}*\n💼 المسمى: {job_title}\n💰 الراتب: {salary}\n📞 الهاتف: {phone}\n👤 بواسطة: {user_name}\n⏰ {time}",
    short: "👤 موظف جديد | {employee_name} | {job_title} | {salary}",
  },
  telegram_salary_settled: {
    detailed: "💰 *تسويات راتب*\n\n👤 الموظف: *{employee_name}*\n📅 الفترة: {period}\n💵 الراتب الأساسي: {base_salary}\n🏆 المكافآت: {bonuses}\n📉 الخصومات: {deductions}\n💳 خصم السلف: {advance_deductions}\n━━━━━━━━━━━━━━━\n✅ الصافي: *{net_salary}*\n💰 المدفوع: *{paid_amount}*\n👤 بواسطة: {user_name}\n⏰ {time}",
    short: "💰 تسويات راتب | {employee_name} | صافي {net_salary} | مدفوع {paid_amount}",
  },
  telegram_advance_created: {
    detailed: "💳 *منح سلفة*\n\n👤 الموظف: *{employee_name}*\n💰 المبلغ: *{amount}*\n🔢 عدد الأقساط: {installment_count}\n📊 قيمة القسط: {installment_amount}\n📝 ملاحظات: {notes}\n👤 بواسطة: {user_name}\n⏰ {time}",
    short: "💳 سلفة جديدة | {employee_name} | {amount} | {installment_count} أقساط × {installment_amount}",
  },
  telegram_deduction_created: {
    detailed: "📉 *تسجيل خصم*\n\n👤 الموظف: *{employee_name}*\n💰 المبلغ: *{amount}*\n📋 نوع الخصم: {deduction_type}\n🔄 دوري: {is_recurring}\n📝 ملاحظات: {notes}\n👤 بواسطة: {user_name}\n⏰ {time}",
    short: "📉 خصم جديد | {employee_name} | {amount} | {deduction_type}",
  },
  telegram_bonus_created: {
    detailed: "🏆 *منح مكافأة*\n\n👤 الموظف: *{employee_name}*\n💰 المبلغ: *{amount}*\n📋 نوع المكافأة: {bonus_type}\n🔄 دوري: {is_recurring}\n📝 ملاحظات: {notes}\n👤 بواسطة: {user_name}\n⏰ {time}",
    short: "🏆 مكافأة جديدة | {employee_name} | {amount} | {bonus_type}",
  },
};

module.exports = {
  name: "195_fix_telegram_variant_labels",
  up(db) {
    const placeholders = EXTENDED_CATEGORIES.map(() => "?").join(",");

    // 1. Delete all variants for these categories (wrong labels or missing)
    db.prepare(`DELETE FROM message_template_variants WHERE category IN (${placeholders})`).run(...EXTENDED_CATEGORIES);

    // 2. Delete base templates so we can re-insert cleanly
    db.prepare(`DELETE FROM message_templates WHERE kind IN (${placeholders})`).run(...EXTENDED_CATEGORIES);

    // 3. Re-insert base templates + 2 variants each with correct labels
    const insertTemplate = db.prepare(
      "INSERT OR IGNORE INTO message_templates (kind, label, body, channel) VALUES (?, ?, ?, 'telegram')"
    );
    const insertVariant = db.prepare(`
      INSERT INTO message_template_variants (category, label, body, channel, is_active, updated_at)
      VALUES (?, ?, ?, 'telegram', ?, datetime('now'))
    `);

    for (const category of EXTENDED_CATEGORIES) {
      const label = LABELS[category];
      const { detailed, short } = TEMPLATES[category];

      insertTemplate.run(category, label, detailed);
      insertVariant.run(category, "قياسي — مفصل", detailed, 1);
      insertVariant.run(category, "مختصر — سريع", short, 0);
    }
  },
};
