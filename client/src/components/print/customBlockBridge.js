import { getCustomBlocks } from "../../pages/settings/CustomTextBlocks";

// Map legacy insertion position -> the block type it should follow in the order.
const POSITION_AFTER = {
  after_header: "receipt_header_text",
  before_meta: "doc_number",
  after_meta: "cashier",
  before_items: "items_table",
  after_totals: "grand_total",
  before_footer: "footer_text",
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
      props: { text: b.text, align: b.align, fontSize: b.fontSize, color: b.color },
    }));
}
