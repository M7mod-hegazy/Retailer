import React from "react";
import { useSearchParams } from "react-router-dom";
import { ShieldCheck, Users2 } from "lucide-react";
import PageWrapper from "../../components/ui/PageWrapper";
import { Tabs } from "../../components/ui/Tabs";
import UsersPage from "../definitions/UsersPage";
import EmployeesPage from "../definitions/EmployeesPage";

const tabs = [
  { value: "users", label: "المستخدمون والصلاحيات", icon: ShieldCheck },
  { value: "employees", label: "الموظفون", icon: Users2 },
];

export default function TeamWorkspacePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = tabs.some((tab) => tab.value === searchParams.get("tab"))
    ? searchParams.get("tab")
    : "users";

  const handleTabChange = (value) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  return (
    <PageWrapper className="mx-auto max-w-[1440px] px-4 py-4" data-help-root="team_workspace">
      <section className="space-y-5">
        <div className="rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-sm">
          <div className="flex items-center gap-3" data-help="workspace-header">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">الفريق والصلاحيات</h1>
              <p className="mt-1 text-sm text-slate-500">
                إدارة هيكل الفريق وحسابات الدخول من مركز واحد، مع فصل واضح بين الموظفين والمستخدمين.
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
          {activeTab === "users" ? <UsersPage /> : null}
          {activeTab === "employees" ? <EmployeesPage /> : null}
        </div>
      </section>
    </PageWrapper>
  );
}
