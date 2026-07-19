import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, User, DollarSign, Percent, Gift, Wallet, MapPin, Phone, Briefcase, Users, ChevronDown, HelpCircle } from "lucide-react";
import api from "../../../services/api";
import { useHelpStore } from "../../../stores/helpStore";
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

export default function EmployeeDetail({ employee, employees, onStartCreate, onClose, onUpdate }) {
  const [activeTab, setActiveTab] = useState("info");
  const [counts, setCounts] = useState({});
  const { togglePageTour } = useHelpStore();

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
    const totalEmployees = employees?.length || 0;
    const totalSalary = employees?.reduce((sum, emp) => sum + (Number(emp.salary) || 0), 0) || 0;
    const avgSalary = totalEmployees > 0 ? Math.round(totalSalary / totalEmployees) : 0;
    const uniqueRoles = new Set(employees?.map(emp => emp.role).filter(Boolean) || []).size;

    return (
      <div className="flex-1 flex flex-col p-8 overflow-y-auto scrollbar-thin text-right gap-6 justify-center h-full">
        {/* Top Row: Hero and Quick Actions */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Premium Glassmorphic Security Overview Card (col-span-2) */}
          <div className="xl:col-span-2 flex flex-col md:flex-row items-center gap-6 p-6 rounded-3xl border relative overflow-hidden backdrop-blur-md transition-all duration-300 hover:shadow-lg" 
               style={{ 
                 background: "linear-gradient(135deg, var(--accent-soft) 0%, var(--bg-surface) 100%)", 
                 borderColor: "var(--border-accent)",
                 boxShadow: "var(--shadow-elevated), var(--card-top-highlight)"
               }}>
            
            {/* Static Shield Icon badge */}
            <div className="relative shrink-0 flex items-center justify-center h-16 w-16 rounded-2xl bg-[var(--primary)] text-white shadow-md overflow-hidden">
              <Users className="h-8 w-8 relative z-10" />
            </div>

            <div className="flex-1 text-right">
              <span className="text-[9px] font-black tracking-widest text-[var(--primary)] uppercase mb-1 block">
                شؤون الموظفين والموارد البشرية
              </span>
              <h2 className="text-base font-black mb-1.5" style={{ color: "var(--text-primary)" }}>
                منصة إدارة الكادر والرواتب
              </h2>
              <p className="text-[11px] font-bold leading-relaxed text-[var(--text-secondary)]">
                تابع مستحقات الموظفين المالية، وأدر السلفيات النشطة، بالإضافة لتسجيل الخصومات والتسويات ومكافآت الأداء لكل فرد في نظامك الإداري بكفاءة تامة.
              </p>
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div className="p-6 rounded-3xl border text-right flex flex-col justify-between gap-4"
               style={{ 
                 backgroundColor: "var(--bg-surface)", 
                 borderColor: "var(--border-normal)",
                 boxShadow: "var(--shadow-card), var(--card-top-highlight)"
               }}>
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                إجراءات سريعة
              </h3>
              <p className="text-[10px] font-bold text-[var(--text-secondary)] mt-1">
                قم بتسجيل موظف جديد لتهيئة سجل المستحقات والرواتب الخاص به فوراً.
              </p>
            </div>
            
            {onStartCreate && (
              <motion.button
                whileHover={{ scale: 1.01, y: -1 }}
                whileTap={{ scale: 0.99 }}
                type="button"
                onClick={onStartCreate}
                className="p-3.5 rounded-2xl border text-right flex items-center justify-between transition-all cursor-pointer group outline-none hover:bg-[var(--accent-soft)] hover:border-[var(--primary)] w-full"
                style={{ backgroundColor: "var(--bg-overlay)", borderColor: "var(--border-normal)" }}
              >
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[var(--accent-soft)] text-[var(--primary)] group-hover:bg-[var(--primary)] group-hover:text-white transition-colors">
                    <User className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-black text-[var(--text-primary)]">إضافة موظف جديد</span>
                </div>
                <ChevronDown className="h-3.5 w-3.5 -rotate-90 text-[var(--text-muted)] group-hover:text-[var(--primary)] transition-all transform group-hover:translate-x-[-3px]" />
              </motion.button>
            )}
          </div>
        </div>

        {/* Bottom Row: Summary Stats Bento Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { 
              title: "إجمالي الكادر الوظيفي", 
              value: totalEmployees, 
              desc: "موظف مسجل بالنظام", 
              icon: Users, 
              color: "var(--primary)" 
            },
            { 
              title: "متوسط الرواتب", 
              value: avgSalary.toLocaleString() + " ج.م", 
              desc: "للدورة الوظيفية الواحدة", 
              icon: DollarSign, 
              color: "var(--info-text)" 
            },
            { 
              title: "تنوع الأدوار الوظيفية", 
              value: uniqueRoles, 
              desc: "مسميات وظيفية مسجلة", 
              icon: Briefcase, 
              color: "var(--warning-text)" 
            }
          ].map((metric, idx) => {
            const Icon = metric.icon;
            return (
              <motion.div 
                   key={idx} 
                   whileHover={{ y: -3, scale: 1.01 }}
                   className="p-6 rounded-3xl border text-right transition-all duration-300 flex flex-col gap-3 relative overflow-hidden"
                   style={{ 
                     background: "linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-overlay) 100%)", 
                     borderColor: "var(--border-normal)",
                     boxShadow: "var(--shadow-card), var(--card-top-highlight)"
                   }}>
                <div className="flex items-center justify-between w-full">
                  <span className="text-[10px] font-black" style={{ color: "var(--text-secondary)" }}>{metric.title}</span>
                  <div className="p-1.5 rounded-xl border border-border-normal/5" style={{ backgroundColor: "var(--bg-input)", color: metric.color }}>
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-black font-mono tracking-tight number-fmt" style={{ color: "var(--text-primary)" }}>{metric.value}</span>
                </div>
                <span className="text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>{metric.desc}</span>
                {/* Accent bottom border simulating a timeline path */}
                <div className="absolute bottom-0 inset-x-0 h-1 bg-gradient-to-l opacity-20" style={{ from: "transparent", to: metric.color }} />
              </motion.div>
            );
          })}
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

  const tabInactive = "border-transparent text-text-muted hover:text-text-secondary hover:bg-bg-overlay";

  const badgeStyles = {
    advances: "bg-amber-100 text-amber-700",
    deductions: "bg-rose-100 text-rose-700",
    bonuses: "bg-emerald-100 text-emerald-700",
    payroll: "bg-indigo-100 text-indigo-700",
  };

  return (
    <motion.div
      className="flex flex-col h-full min-h-0"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
    >
      {/* Employee Header */}
      <div className="p-6 pb-0 flex items-start justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-lg shrink-0">
            {employee.name?.charAt(0) || "?"}
          </div>
          <div>
            <h2 className="text-xl font-black text-text-primary">{employee.name}</h2>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {(employee.job_title || employee.role) && (
                <span className="flex items-center gap-1 text-xs font-bold text-text-secondary">
                  <Briefcase className="h-3 w-3" /> {employee.job_title || employee.role}
                </span>
              )}
              {employee.address && (
                <span className="flex items-center gap-1 text-xs font-bold text-text-secondary">
                  <MapPin className="h-3 w-3" /> {employee.address}
                </span>
              )}
              {(() => {
                const phones = employee.phones ? JSON.parse(employee.phones) : (employee.phone ? [employee.phone] : []);
                return phones.length > 0 && (
                  <span className="flex items-center gap-1 text-xs font-bold text-text-secondary">
                    <Phone className="h-3 w-3" /> {phones.join(" - ")}
                  </span>
                );
              })()}
              {employee.salary > 0 && (
                <span className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                  <DollarSign className="h-3 w-3" /> {Number(employee.salary).toLocaleString()} ج.م
                  <span className="text-text-muted mr-1">
                    / {employee.salary_period === 'monthly' ? 'شهر' : employee.salary_period === 'weekly' ? 'أسبوع' : 'يوم'}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => togglePageTour("employees")}
            title="شرح الصفحة"
            className="h-9 w-9 flex items-center justify-center rounded-xl text-text-muted hover:bg-blue-50 hover:text-blue-600 transition-all shrink-0"
          >
            <HelpCircle className="h-5 w-5" />
          </button>
          <button
            onClick={onClose}
            className="h-9 w-9 flex items-center justify-center rounded-xl text-text-muted hover:bg-bg-overlay hover:text-text-primary transition-all shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 mt-6 border-b border-border-subtle shrink-0">
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
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${badgeStyles[tab.id] || "bg-bg-overlay text-text-primary"}`}>
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
