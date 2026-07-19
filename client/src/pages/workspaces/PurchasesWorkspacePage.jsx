import React from "react";
import { PackageSearch, FileSpreadsheet, ArrowLeftRight } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import PageWrapper from "../../components/ui/PageWrapper";
import { Tabs } from "../../components/ui/Tabs";
import PurchaseFormPage from "../purchases/PurchaseFormPage";
import PurchaseOrdersPage from "../purchases/PurchaseOrdersPage";
import PurchaseReturnFormPage from "../purchases/PurchaseReturnFormPage";
import { usePageTour } from "../../hooks/usePageTour";

const tabs = [
  { value: "purchases", label: "المشتريات", icon: PackageSearch },
  { value: "orders", label: "طلبات التوريد", icon: FileSpreadsheet },
  { value: "returns", label: "مرتجع المشتريات", icon: ArrowLeftRight },
];

export default function PurchasesWorkspacePage() {
  usePageTour('purchases_workspace');
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = tabs.some((tab) => tab.value === searchParams.get("tab"))
    ? searchParams.get("tab")
    : "purchases";

  const handleTabChange = (value) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  return (
    <PageWrapper className="mx-auto max-w-[1440px] px-4 py-4" data-help-root="purchases_workspace">
      <section className="space-y-5">
        <div className="rounded-[28px] border border-border-normal bg-bg-surface px-5 py-5 shadow-sm">
          <div className="flex items-center gap-3" data-help="workspace-header">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
              <PackageSearch className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-text-primary">مركز المشتريات</h1>
              <p className="mt-1 text-sm text-text-secondary">إدخال الفواتير ومتابعة الأوامر والمرتجعات من شاشة واحدة.</p>
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
          {activeTab === "purchases" ? <PurchaseFormPage /> : null}
          {activeTab === "orders" ? <PurchaseOrdersPage /> : null}
          {activeTab === "returns" ? <PurchaseReturnFormPage /> : null}
        </div>
      </section>
    </PageWrapper>
  );
}
