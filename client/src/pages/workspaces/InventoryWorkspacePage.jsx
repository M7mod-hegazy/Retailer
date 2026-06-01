import React from "react";
import { Boxes, ArrowRightLeft, ClipboardList, Package2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Tabs } from "../../components/ui/Tabs";
import StockLevelsPage from "../stock/StockLevelsPage";
import StockMovementsPage from "../stock/StockMovementsPage";
import StockTransferPage from "../stock/StockTransferPage";
import PhysicalCountPage from "../stock/PhysicalCountPage";

const tabs = [
  { value: "levels", label: "أرصدة المخزون", icon: Package2 },
  { value: "movements", label: "حركة الأصناف", icon: Boxes },
  { value: "transfer", label: "تحويل المخزون", icon: ArrowRightLeft },
  { value: "count", label: "الجرد", icon: ClipboardList },
];

export default function InventoryWorkspacePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = tabs.some((tab) => tab.value === searchParams.get("tab"))
    ? searchParams.get("tab")
    : "levels";

  const handleTabChange = (value) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  return (
    <div className="h-full flex flex-col p-4" data-help-root="inventory_workspace">
      <section className="space-y-4 h-full flex flex-col">
        <div className="rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-sm shrink-0">
          <div className="flex items-center gap-3" data-help="workspace-header">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              <Boxes className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">مركز المخزون</h1>
              <p className="mt-1 text-sm text-slate-500">
                متابعة الرصيد والحركة والتحويل والجرد من مساحة واحدة أسرع وأسهل للمراجعة اليومية.
              </p>
            </div>
          </div>
          <div className="mt-5" data-help="workspace-tabs">
            <Tabs
              tabs={tabs.map((tab) => ({ value: tab.value, label: tab.label }))}
              active={activeTab}
              onChange={handleTabChange}
            />
          </div>
        </div>

        <div key={activeTab} className="flex-1 min-h-0" data-help="workspace-content">
          {activeTab === "levels" ? <StockLevelsPage /> : null}
          {activeTab === "movements" ? <StockMovementsPage /> : null}
          {activeTab === "transfer" ? <StockTransferPage /> : null}
          {activeTab === "count" ? <PhysicalCountPage /> : null}
        </div>
      </section>
    </div>
  );
}
