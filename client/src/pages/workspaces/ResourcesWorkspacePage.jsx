import React from "react";
import { useSearchParams } from "react-router-dom";
import { Warehouse, Wallet, Landmark } from "lucide-react";
import PageWrapper from "../../components/ui/PageWrapper";
import { Tabs } from "../../components/ui/Tabs";
import WarehousesPage from "../definitions/WarehousesPage";
import TreasuriesPage from "../definitions/TreasuriesPage";
import BanksPage from "../definitions/BanksPage";

const tabs = [
  { value: "warehouses", label: "المخازن", icon: Warehouse },
  { value: "treasuries", label: "الخزائن", icon: Wallet },
  { value: "banks", label: "البنوك", icon: Landmark },
];

export default function ResourcesWorkspacePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = tabs.some((tab) => tab.value === searchParams.get("tab"))
    ? searchParams.get("tab")
    : "warehouses";

  const handleTabChange = (value) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  return (
    <PageWrapper className="mx-auto max-w-[1440px] px-4 py-4">
      <section className="space-y-5">
        <div className="rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              <Warehouse className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">البنية التشغيلية</h1>
              <p className="mt-1 text-sm text-slate-500">
                تعريف موارد العمل الأساسية مثل المخازن والخزائن والبنوك داخل مساحة تنظيمية واحدة.
              </p>
            </div>
          </div>
          <div className="mt-5">
            <Tabs
              tabs={tabs.map((tab) => ({ value: tab.value, label: tab.label }))}
              active={activeTab}
              onChange={handleTabChange}
            />
          </div>
        </div>

        <div key={activeTab}>
          {activeTab === "warehouses" ? <WarehousesPage /> : null}
          {activeTab === "treasuries" ? <TreasuriesPage /> : null}
          {activeTab === "banks" ? <BanksPage /> : null}
        </div>
      </section>
    </PageWrapper>
  );
}
