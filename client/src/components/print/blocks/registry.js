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
  divider:             { component: DividerBlock,           label: "فاصل",           group: "inserted", families: ALL },
  spacer:              { component: SpacerBlock,            label: "مسافة",          group: "inserted", families: ALL },
  watermark:           { component: WatermarkBlock,         label: "علامة مائية",    group: "foot",     families: ["page"] },
  signature_lines:     { component: SignatureLinesBlock,    label: "التوقيعات",      group: "foot",     families: ["page"] },
  barcode:             { component: BarcodeBlock,           label: "باركود",         group: "foot",     families: ALL },
  order_number:        { component: OrderNumberBlock,       label: "رقم الطلب",      group: "head",     families: ALL },
  image:               { component: ImageBlock,             label: "صورة/بانر",      group: "brand",    families: ALL },
};
