import React from "react";
import { useSearchParams } from "react-router-dom";
import { Package2, Shapes, Ruler, Tags } from "lucide-react";
import PageWrapper from "../../components/ui/PageWrapper";
import { Tabs } from "../../components/ui/Tabs";
import ItemsListPage from "../items/ItemsListPage";
import CategoriesPage from "../definitions/CategoriesPage";
import UnitsPage from "../definitions/UnitsPage";
import PromotionsPage from "../definitions/PromotionsPage";

const tabs = [
  { value: "items", label: "الأصناف", icon: Package2 },
  { value: "categories", label: "الفئات", icon: Shapes },
  { value: "units", label: "الوحدات", icon: Ruler },
  { value: "promotions", label: "العروض", icon: Tags },
];

export default function CatalogWorkspacePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = tabs.some((tab) => tab.value === searchParams.get("tab"))
    ? searchParams.get("tab")
    : "items";

  const handleTabChange = (value) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  return (
    <PageWrapper className="mx-auto max-w-[1440px] px-4 py-4" data-help-root="catalog_workspace">
      <section className="space-y-5">
        <div className="rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-sm">
          <div className="flex items-center gap-3" data-help="workspace-header">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
              <Package2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">دليل الأصناف</h1>
              <p className="mt-1 text-sm text-slate-500">
                مركز موحد لكل ما يخص تعريف الأصناف، من الفئات والوحدات حتى العروض المرتبطة بالبيع.
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

        <div key={activeTab} data-help="workspace-content">
          {activeTab === "items" ? <ItemsListPage /> : null}
          {activeTab === "categories" ? <CategoriesPage /> : null}
          {activeTab === "units" ? <UnitsPage /> : null}
          {activeTab === "promotions" ? <PromotionsPage /> : null}
        </div>
      </section>
    </PageWrapper>
  );
}
