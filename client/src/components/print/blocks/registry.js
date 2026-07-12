import LogoBlock from "./LogoBlock";
import CompanyNameBlock from "./CompanyNameBlock";
import DocTitleBlock from "./DocTitleBlock";
import BranchBlock from "./BranchBlock";
import AddressBlock from "./AddressBlock";
import TaxIdBlock from "./TaxIdBlock";
import ReceiptHeaderTextBlock from "./ReceiptHeaderTextBlock";
import DocNumberBlock from "./DocNumberBlock";
import DocDateBlock from "./DocDateBlock";
import CustomerBlock from "./CustomerBlock";
import CashierBlock from "./CashierBlock";
import ItemsTableBlock from "./ItemsTableBlock";
import SubtotalBlock from "./SubtotalBlock";
import DiscountBlock from "./DiscountBlock";
import IncreaseBlock from "./IncreaseBlock";
import TaxBlock from "./TaxBlock";
import GrandTotalBlock from "./GrandTotalBlock";
import PaymentsBlock from "./PaymentsBlock";
import FooterTextBlock from "./FooterTextBlock";
import QrBlock from "./QrBlock";
import CustomTextBlock from "./CustomTextBlock";
import DividerBlock from "./DividerBlock";
import SpacerBlock from "./SpacerBlock";
import NotesBlock from "./NotesBlock";
import WatermarkBlock from "./WatermarkBlock";
import SignatureLinesBlock from "./SignatureLinesBlock";
import BarcodeBlock from "./BarcodeBlock";
import OrderNumberBlock from "./OrderNumberBlock";
import ImageBlock from "./ImageBlock";
import CustomFieldBlock from "./CustomFieldBlock";
import DocGridBlock from "./DocGridBlock";
import BankDetailsBlock from "./BankDetailsBlock";
import PatternDividerBlock from "./PatternDividerBlock";
import ReceiverSignatureBlock from "./ReceiverSignatureBlock";
import {
  BankStatementMetricsBlock, AjalStatementMetricsBlock, AjalScheduleMetricsBlock,
  DailyTreasuryMetricsBlock, DailyTreasurySummariesBlock, AjalFullStatementMetricsBlock,
  ChequeRegisterMetricsBlock, PaymentMethodsReportMetricsBlock, PaymentMethodsByMethodBlock,
  ReportTableBlock, AjalPartyBlock
} from "./ReportBlocks";
import {
  AccountStatementPartyBlock, AccountStatementLedgerBlock, AccountStatementSummaryBlock
} from "./AccountStatementBlocks";
import {
  KitchenOrderHeaderBlock, KitchenOrderMetaBlock, KitchenItemsBlock, KitchenNotesBlock, KitchenOrderFooterBlock
} from "./KitchenBlocks";
import {
  OwnerDashboardMetricsBlock, OwnerRevenueBreakdownBlock, OwnerExpenseCategoriesBlock, OwnerNetProfitBlock, OwnerPeriodComparisonBlock,
  OwnerAssetsLiabilitiesBlock, OwnerPaymentFlowBlock
} from "./OwnerStatementBlocks";

const ALL = ["roll", "page"];

export const BLOCK_REGISTRY = {
  logo:                { component: LogoBlock,              label: "الشعار",         group: "brand",    families: ALL },
  company_name:        { component: CompanyNameBlock,       label: "اسم الشركة",     group: "brand",    families: ALL },
  branch:              { component: BranchBlock,            label: "الفرع",          group: "brand",    families: ALL },
  address:             { component: AddressBlock,           label: "العنوان",        group: "brand",    families: ALL },
  tax_id:              { component: TaxIdBlock,             label: "الرقم الضريبي",  group: "brand",    families: ALL },
  receipt_header_text: { component: ReceiptHeaderTextBlock, label: "نص ترويسة",      group: "foot",     families: ALL },
  doc_title:           { component: DocTitleBlock,          label: "عنوان المستند",  group: "dochead",  families: ["page"] },
  doc_number:          { component: DocNumberBlock,         label: "رقم المستند",    group: "dochead",  families: ALL },
  doc_date:            { component: DocDateBlock,           label: "التاريخ",        group: "dochead",  families: ALL },
  customer:            { component: CustomerBlock,          label: "العميل",         group: "dochead",  families: ALL },
  cashier:             { component: CashierBlock,           label: "الكاشير",        group: "dochead",  families: ALL },
  items_table:         { component: ItemsTableBlock,        label: "جدول الأصناف",   group: "body",     families: ALL },
  subtotal:            { component: SubtotalBlock,          label: "الإجمالي الفرعي", group: "money",    families: ALL },
  discount:            { component: DiscountBlock,          label: "الخصم",          group: "money",    families: ALL },
  increase:            { component: IncreaseBlock,          label: "رسوم إضافية",    group: "money",    families: ALL },
  tax:                 { component: TaxBlock,               label: "الضريبة",        group: "money",    families: ALL },
  grand_total:         { component: GrandTotalBlock,        label: "المستحق",        group: "money",    families: ALL },
  payments:            { component: PaymentsBlock,          label: "تفاصيل الدفع",   group: "money",    families: ALL },
  notes:               { component: NotesBlock,             label: "ملاحظات الفاتورة", group: "foot",   families: ALL },
  footer_text:         { component: FooterTextBlock,        label: "نص التذييل",     group: "foot",     families: ALL },
  qr:                  { component: QrBlock,                label: "رمز QR",         group: "foot",     families: ALL },
  custom_text:         { component: CustomTextBlock,        label: "نص مخصص",        group: "inserted", families: ALL },
  custom_field:        { component: CustomFieldBlock,       label: "حقل مخصص",       group: "inserted", families: ALL },
  divider:             { component: DividerBlock,           label: "فاصل",           group: "inserted", families: ALL },
  spacer:              { component: SpacerBlock,            label: "مسافة",          group: "inserted", families: ALL },
  watermark:           { component: WatermarkBlock,         label: "علامة مائية",    group: "foot",     families: ["page"] },
  signature_lines:     { component: SignatureLinesBlock,    label: "التوقيعات",      group: "foot",     families: ["page"] },
  barcode:             { component: BarcodeBlock,           label: "باركود",         group: "foot",     families: ALL },
  order_number:        { component: OrderNumberBlock,       label: "رقم الطلب",      group: "head",     families: ALL },
  image:               { component: ImageBlock,             label: "صورة/بانر",      group: "brand",    families: ALL },
  doc_grid:            { component: DocGridBlock,              label: "شبكة البيانات",       group: "dochead",  families: ALL },
  bank_details:        { component: BankDetailsBlock,          label: "الحساب البنكي",       group: "foot",     families: ALL },
  pattern_divider:     { component: PatternDividerBlock,       label: "فاصل زخرفي",          group: "inserted", families: ALL },
  receiver_signature:  { component: ReceiverSignatureBlock,    label: "توقيع المستلم",       group: "foot",     families: ALL },

  // Report specific blocks
  bank_statement_metrics:         { component: BankStatementMetricsBlock,         label: "ملخص البنك (KPIs)",   group: "body", families: ["page"] },
  ajal_statement_metrics:         { component: AjalStatementMetricsBlock,         label: "ملخص الآجل (KPIs)",   group: "body", families: ["page"] },
  ajal_schedule_metrics:          { component: AjalScheduleMetricsBlock,          label: "ملخص الأقساط (KPIs)", group: "body", families: ["page"] },
  daily_treasury_metrics:         { component: DailyTreasuryMetricsBlock,         label: "ملخص الخزينة (KPIs)", group: "body", families: ["page"] },
  daily_treasury_summaries:       { component: DailyTreasurySummariesBlock,       label: "أرصدة الخزائن الكلية", group: "body", families: ["page"] },
  ajal_full_statement_metrics:    { component: AjalFullStatementMetricsBlock,    label: "ملخص الأرصدة (KPIs)", group: "body", families: ["page"] },
  cheque_register_metrics:        { component: ChequeRegisterMetricsBlock,        label: "ملخص الشيكات (KPIs)", group: "body", families: ["page"] },
  payment_methods_report_metrics: { component: PaymentMethodsReportMetricsBlock, label: "ملخص الدفع (KPIs)",   group: "body", families: ["page"] },
  payment_methods_by_method:      { component: PaymentMethodsByMethodBlock,      label: "ملخص وسائل الدفع الكلي", group: "body", families: ["page"] },
  report_table:                   { component: ReportTableBlock,                   label: "جدول بيانات التقرير",  group: "body", families: ["page"] },
  ajal_party:                     { component: AjalPartyBlock,                     label: "بيانات العميل الآجل",  group: "dochead", families: ["page"] },

  // Account statement blocks
  account_statement_party:         { component: AccountStatementPartyBlock,         label: "بيانات الطرف (كشف حساب)", group: "dochead", families: ["page"] },
  account_statement_ledger:        { component: AccountStatementLedgerBlock,        label: "جدول حركات كشف الحساب",   group: "body",   families: ["page"] },
  account_statement_summary:       { component: AccountStatementSummaryBlock,       label: "ملخص كشف الحساب (الإجمالي)", group: "totals", families: ["page"] },

  // Kitchen ticket blocks
  kitchen_order_header:   { component: KitchenOrderHeaderBlock,   label: "ترويسة تيكت المطبخ",  group: "dochead", families: ["roll", "page"] },
  kitchen_order_meta:     { component: KitchenOrderMetaBlock,     label: "بيانات الطلب",         group: "dochead", families: ["roll", "page"] },
  kitchen_items:          { component: KitchenItemsBlock,          label: "أصناف المطبخ",         group: "body",    families: ["roll", "page"] },
  kitchen_notes:          { component: KitchenNotesBlock,          label: "ملاحظات المطبخ",       group: "foot",    families: ["roll", "page"] },
  kitchen_order_footer:   { component: KitchenOrderFooterBlock,   label: "تذييل تيكت المطبخ",   group: "foot",    families: ["roll", "page"] },

  // Owner statement blocks
  owner_dashboard_metrics:   { component: OwnerDashboardMetricsBlock,   label: "KPIs لوحة المالك",       group: "body",   families: ["page"] },
  owner_assets_liabilities:  { component: OwnerAssetsLiabilitiesBlock,  label: "الأصول والخصوم للمالك",   group: "body",   families: ["page"] },
  owner_revenue_breakdown:   { component: OwnerRevenueBreakdownBlock,   label: "تفصيل الإيرادات",         group: "body",   families: ["page"] },
  owner_expense_categories:  { component: OwnerExpenseCategoriesBlock,  label: "تصنيفات المصروفات",      group: "body",   families: ["page"] },
  owner_payment_flow:        { component: OwnerPaymentFlowBlock,        label: "تدفقات وسائل الدفع للمالك", group: "body",   families: ["page"] },
  owner_net_profit:          { component: OwnerNetProfitBlock,          label: "صافي الربح",             group: "totals", families: ["page"] },
  owner_period_comparison:   { component: OwnerPeriodComparisonBlock,   label: "مقارنة الفترات",         group: "body",   families: ["page"] },
};

