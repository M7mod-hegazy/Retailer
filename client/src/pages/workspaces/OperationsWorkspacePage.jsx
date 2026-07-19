import React from "react";
import { Landmark, Receipt, CalendarRange, ArrowRightLeft } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import PageWrapper from "../../components/ui/PageWrapper";
import { Tabs } from "../../components/ui/Tabs";
import ChequesPage from "../operations/ChequesPage";
import InstallmentsPage from "../operations/InstallmentsPage";
import TreasuryTransferPage from "../operations/TreasuryTransfer";
import { useFeatureEnabled } from "../../hooks/useFeature";
import { usePageTour } from "../../hooks/usePageTour";

const CHEQUES_TAB = { value: "cheques", label: "الشيكات", icon: Receipt };
const BASE_TABS = [
  { value: "installments", label: "الأقساط", icon: CalendarRange },
  { value: "transfers", label: "تحويل بين الخزائن", icon: ArrowRightLeft },
];

export default function OperationsWorkspacePage() {
  usePageTour('operations_workspace');
  const [searchParams, setSearchParams] = useSearchParams();
  const chequesEnabled = useFeatureEnabled("feature_cheques");
  const tabs = chequesEnabled ? [CHEQUES_TAB, ...BASE_TABS] : BASE_TABS;
  const activeTab = tabs.some((tab) => tab.value === searchParams.get("tab"))
    ? searchParams.get("tab")
    : tabs[0].value;

  const handleTabChange = (value) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  return (
    <PageWrapper className="mx-auto max-w-[1440px] px-4 py-4" data-help-root="operations_workspace">
      <section className="space-y-5">
        <div className="rounded-[28px] border border-border-normal bg-bg-surface px-5 py-5 shadow-sm">
          <div className="flex items-center gap-3" data-help="workspace-header">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-text-primary">مركز العمليات المالية</h1>
              <p className="mt-1 text-sm text-text-secondary">
                كل الحركات المساندة مثل الشيكات والأقساط والتحويلات مجمعة في مكان واحد بدل التنقل بين صفحات متقاربة.
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
          {activeTab === "cheques" ? <ChequesPage /> : null}
          {activeTab === "installments" ? <InstallmentsPage /> : null}
          {activeTab === "transfers" ? <TreasuryTransferPage /> : null}
        </div>
      </section>
    </PageWrapper>
  );
}
