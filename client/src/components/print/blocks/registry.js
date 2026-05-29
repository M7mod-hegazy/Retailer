import CompanyNameBlock from "./CompanyNameBlock";
import GrandTotalBlock from "./GrandTotalBlock";
// Further blocks are added in Task 5.
export const BLOCK_REGISTRY = {
  company_name: { component: CompanyNameBlock, label: "اسم الشركة", group: "brand", families: ["roll", "page"] },
  grand_total:  { component: GrandTotalBlock,  label: "المستحق",    group: "money", families: ["roll", "page"] },
};
