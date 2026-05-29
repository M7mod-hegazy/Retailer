import LogoBlock from "./LogoBlock";
import CompanyNameBlock from "./CompanyNameBlock";
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
import TaxBlock from "./TaxBlock";
import GrandTotalBlock from "./GrandTotalBlock";
import PaymentsBlock from "./PaymentsBlock";
import FooterTextBlock from "./FooterTextBlock";
import QrBlock from "./QrBlock";
import CustomTextBlock from "./CustomTextBlock";
import DividerBlock from "./DividerBlock";
import SpacerBlock from "./SpacerBlock";

const ALL = ["roll", "page"];

export const BLOCK_REGISTRY = {
  logo:                { component: LogoBlock,              label: "الشعار",         group: "brand",    families: ALL },
  company_name:        { component: CompanyNameBlock,       label: "اسم الشركة",     group: "brand",    families: ALL },
  branch:              { component: BranchBlock,            label: "الفرع",          group: "brand",    families: ALL },
  address:             { component: AddressBlock,           label: "العنوان",        group: "brand",    families: ALL },
  tax_id:              { component: TaxIdBlock,             label: "الرقم الضريبي",  group: "brand",    families: ALL },
  receipt_header_text: { component: ReceiptHeaderTextBlock, label: "نص ترويسة",      group: "foot",     families: ALL },
  doc_number:          { component: DocNumberBlock,         label: "رقم المستند",    group: "dochead",  families: ALL },
  doc_date:            { component: DocDateBlock,           label: "التاريخ",        group: "dochead",  families: ALL },
  customer:            { component: CustomerBlock,          label: "العميل",         group: "dochead",  families: ALL },
  cashier:             { component: CashierBlock,           label: "الكاشير",        group: "dochead",  families: ALL },
  items_table:         { component: ItemsTableBlock,        label: "جدول الأصناف",   group: "body",     families: ALL },
  subtotal:            { component: SubtotalBlock,          label: "الإجمالي الفرعي", group: "money",    families: ALL },
  discount:            { component: DiscountBlock,          label: "الخصم",          group: "money",    families: ALL },
  tax:                 { component: TaxBlock,               label: "الضريبة",        group: "money",    families: ALL },
  grand_total:         { component: GrandTotalBlock,        label: "المستحق",        group: "money",    families: ALL },
  payments:            { component: PaymentsBlock,          label: "تفاصيل الدفع",   group: "money",    families: ALL },
  footer_text:         { component: FooterTextBlock,        label: "نص التذييل",     group: "foot",     families: ALL },
  qr:                  { component: QrBlock,                label: "رمز QR",         group: "foot",     families: ALL },
  custom_text:         { component: CustomTextBlock,        label: "نص مخصص",        group: "inserted", families: ALL },
  divider:             { component: DividerBlock,           label: "فاصل",           group: "inserted", families: ALL },
  spacer:              { component: SpacerBlock,            label: "مسافة",          group: "inserted", families: ALL },
};
