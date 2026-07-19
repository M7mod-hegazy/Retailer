import React from "react";
import { Wallet, TrendingDown, TrendingUp, CreditCard } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import PageWrapper from "../../components/ui/PageWrapper";
import { Tabs } from "../../components/ui/Tabs";
import PaymentsListPage from "../payments/PaymentsListPage";
import ExpensesListPage from "../expenses/ExpensesListPage";
import RevenuesListPage from "../expenses/RevenuesListPage";
import PaymentMethodsPage from "../definitions/PaymentMethodsPage";
import { usePageTour } from "../../hooks/usePageTour";

const tabs = [
  { value: "payments", label: "المدفوعات والتحصيل", icon: Wallet },
  { value: "expenses", label: "المصروفات", icon: TrendingDown },
  { value: "revenues", label: "الإيرادات", icon: TrendingUp },
  { value: "methods", label: "طرق الدفع", icon: CreditCard },
];

export default function FinanceWorkspacePage() {
  usePageTour('finance_workspace');
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = tabs.some((tab) => tab.value === searchParams.get("tab"))
    ? searchParams.get("tab")
    : "payments";

  const handleTabChange = (value) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  return (
    <PageWrapper className="mx-auto max-w-[1440px] px-4 py-4" data-help-root="finance_workspace">
      <section className="space-y-5">
        <div className="rounded-[28px] border border-border-normal bg-bg-surface px-5 py-5 shadow-sm">
          <div className="flex items-center gap-3" data-help="workspace-header">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-text-primary">مركز المالية</h1>
              <p className="mt-1 text-sm text-text-secondary">سداد وتحصيل ومصروفات وإيرادات داخل مساحة عمل واحدة.</p>
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
          {activeTab === "payments" ? <PaymentsListPage /> : null}
          {activeTab === "expenses" ? <ExpensesListPage /> : null}
          {activeTab === "revenues" ? <RevenuesListPage /> : null}
          {activeTab === "methods" ? <PaymentMethodsPage /> : null}
        </div>
      </section>
    </PageWrapper>
  );
}
