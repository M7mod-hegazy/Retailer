import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, User, DollarSign, Percent, Gift, Wallet, MapPin, Phone, Briefcase } from "lucide-react";
import api from "../../../services/api";
import BasicInfoTab from "./BasicInfoTab";
import AdvancesTab from "./AdvancesTab";
import DeductionsTab from "./DeductionsTab";
import BonusesTab from "./BonusesTab";
import PayrollTab from "./PayrollTab";

const TABS = [
  { id: "info", label: "البيانات الأساسية", icon: User, color: "blue" },
  { id: "advances", label: "السلفيات", icon: DollarSign, color: "amber" },
  { id: "deductions", label: "الخصومات", icon: Percent, color: "rose" },
  { id: "bonuses", label: "المكافئات", icon: Gift, color: "emerald" },
  { id: "payroll", label: "الرواتب", icon: Wallet, color: "indigo" },
];

export default function EmployeeDetail({ employee, onClose, onUpdate }) {
  const [activeTab, setActiveTab] = useState("info");
  const [counts, setCounts] = useState({});

  useEffect(() => {
    if (!employee) return;
    setActiveTab("info");
    Promise.all([
      api.get(`/api/employees/${employee.id}/advances`),
      api.get(`/api/employees/${employee.id}/deductions`),
      api.get(`/api/employees/${employee.id}/bonuses`),
      api.get(`/api/employees/${employee.id}/settlements`),
    ]).then(([adv, ded, bon, set]) => {
      setCounts({
        advances: (adv.data?.data || []).filter(a => a.status === 'active').length,
        deductions: (ded.data?.data || []).filter(d => d.status === 'active').length,
        bonuses: (bon.data?.data || []).filter(b => b.status === 'active').length,
        payroll: (set.data?.data || []).length,
      });
    }).catch(() => {});
  }, [employee]);

  if (!employee) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <User className="h-16 w-16 text-slate-200 mx-auto mb-4" />
          <p className="text-lg font-bold text-slate-400">اختر موظفاً لعرض التفاصيل</p>
        </div>
      </div>
    );
  }

  const ActiveComponent = {
    info: BasicInfoTab,
    advances: AdvancesTab,
    deductions: DeductionsTab,
    bonuses: BonusesTab,
    payroll: PayrollTab,
  }[activeTab];

  const tabColors = {
    blue: "border-blue-500 text-blue-700 bg-blue-50",
    amber: "border-amber-500 text-amber-700 bg-amber-50",
    rose: "border-rose-500 text-rose-700 bg-rose-50",
    emerald: "border-emerald-500 text-emerald-700 bg-emerald-50",
    indigo: "border-indigo-500 text-indigo-700 bg-indigo-50",
  };

  const tabInactive = "border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50";

  const badgeStyles = {
    advances: "bg-amber-100 text-amber-700",
    deductions: "bg-rose-100 text-rose-700",
    bonuses: "bg-emerald-100 text-emerald-700",
    payroll: "bg-indigo-100 text-indigo-700",
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
    >
      {/* Employee Header */}
      <div className="p-6 pb-0 flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-lg">
            {employee.name?.charAt(0) || "?"}
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800">{employee.name}</h2>
            <div className="flex items-center gap-3 mt-1">
              {employee.role && (
                <span className="flex items-center gap-1 text-xs font-bold text-slate-500">
                  <Briefcase className="h-3 w-3" /> {employee.role}
                </span>
              )}
              {employee.address && (
                <span className="flex items-center gap-1 text-xs font-bold text-slate-500">
                  <MapPin className="h-3 w-3" /> {employee.address}
                </span>
              )}
              {(() => {
                const phones = employee.phones ? JSON.parse(employee.phones) : (employee.phone ? [employee.phone] : []);
                return phones.length > 0 && (
                  <span className="flex items-center gap-1 text-xs font-bold text-slate-500">
                    <Phone className="h-3 w-3" /> {phones.join(" - ")}
                  </span>
                );
              })()}
              {employee.salary > 0 && (
                <span className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                  <DollarSign className="h-3 w-3" /> {Number(employee.salary).toLocaleString()} ج.م
                  <span className="text-slate-400 mr-1">
                    / {employee.salary_period === 'monthly' ? 'شهر' : employee.salary_period === 'weekly' ? 'أسبوع' : 'يوم'}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="h-9 w-9 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="px-6 mt-6 border-b border-slate-100">
        <div className="flex gap-1 overflow-x-auto scrollbar-none">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const count = counts[tab.id];
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-black rounded-t-xl border-b-2 transition-all whitespace-nowrap ${
                  isActive ? tabColors[tab.color] : tabInactive
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {count > 0 && (
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${badgeStyles[tab.id] || "bg-slate-100 text-slate-700"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {ActiveComponent && (
          <ActiveComponent employee={employee} onUpdate={onUpdate} />
        )}
      </div>
    </motion.div>
  );
}
