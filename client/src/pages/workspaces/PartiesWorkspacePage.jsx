import React from "react";
import { useSearchParams } from "react-router-dom";
import { Users, Building2 } from "lucide-react";
import PageWrapper from "../../components/ui/PageWrapper";
import { Tabs } from "../../components/ui/Tabs";
import CustomersListPage from "../customers/CustomersListPage";
import SuppliersListPage from "../suppliers/SuppliersListPage";

const tabs = [
  { value: "customers", label: "العملاء", icon: Users },
  { value: "suppliers", label: "الموردون", icon: Building2 },
];

export default function PartiesWorkspacePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = tabs.some((tab) => tab.value === searchParams.get("tab"))
    ? searchParams.get("tab")
    : "customers";

  const handleTabChange = (value) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  return (
    <PageWrapper className="mx-auto max-w-[1440px] px-4 py-4">
      <section className="space-y-5">
        <div className="rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">الأطراف التجارية</h1>
              <p className="mt-1 text-sm text-slate-500">
                إدارة العملاء والموردين من مساحة واحدة مع بقاء كل شاشة منطقية ومباشرة عند الاستخدام.
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
          {activeTab === "customers" ? <CustomersListPage /> : null}
          {activeTab === "suppliers" ? <SuppliersListPage /> : null}
        </div>
      </section>
    </PageWrapper>
  );
}
