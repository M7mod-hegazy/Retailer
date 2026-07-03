import { getCustomBlocks } from "../../pages/settings/CustomTextBlocks";

// Map legacy insertion position -> the block the custom text should follow in
// the render order (LayoutRenderer places inserts AFTER their anchor block).
// "before X" positions therefore anchor to the block that precedes X in the
// default order — anchoring to X itself would render after it, which is what
// used to make "قبل جدول الأصناف" print below the table and made
// "أسفل جدول الأصناف"/"قبل الإجماليات" (unmapped) fall to the footer.
const POSITION_AFTER = {
  after_header: "receipt_header_text",
  before_meta: "receipt_header_text",
  after_meta: "cashier",
  before_items: "cashier",
  after_items: "items_table",
  before_totals: "items_table",
  after_totals: "grand_total",
  before_footer: "notes",
};

const inFamily = (paperSizes, family) =>
  !paperSizes || paperSizes.length === 0 ||
  paperSizes.some((sz) => (family === "roll" ? sz === "58mm" || sz === "80mm" : sz === "A4" || sz === "A5"));

export function customInserts(settings, family) {
  const blocks = getCustomBlocks(settings) || [];
  return blocks
    .filter((b) => inFamily(b.paperSizes, family))
    .map((b) => ({
      after: POSITION_AFTER[b.position] || "footer_text",
      type: "custom_text",
      // Forward the FULL formatting the settings UI offers — bold/italic used
      // to be silently dropped here, so print never matched the preview.
      props: { text: b.text, align: b.align, fontSize: b.fontSize, color: b.color, bold: b.bold, italic: b.italic },
    }));
}
