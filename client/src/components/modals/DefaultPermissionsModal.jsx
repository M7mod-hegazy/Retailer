import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Save, AlertCircle } from "lucide-react";
import api from "../../services/api";
import TitleBar from "../ui/TitleBar";
import { useDetach } from "../../hooks/useDetach";
import toast from "react-hot-toast";
import {
  PAGE_PERMISSIONS,
  DEFAULT_USER_PERMISSIONS,
  ALL_ACTIONS,
  ACTION_LABELS,
  ACTION_DESCRIPTIONS,
} from "../../constants/pagePermissions";
import SmartTooltip from "../ui/SmartTooltip";
import { REPORT_SOURCES, REPORT_SOURCE_KEYS } from "../../constants/reportPermissions";

function buildEmptyPermissions() {
  const base = Object.keys(PAGE_PERMISSIONS).reduce((acc, key) => {
    acc[key] = [];
    return acc;
  }, {});
  REPORT_SOURCE_KEYS.forEach((key) => { base[key] = []; });
  return base;
}

function applyTemplate(template) {
  const base = buildEmptyPermissions();
  Object.entries(template || {}).forEach(([page, actions]) => {
    if (base[page]) base[page] = [...actions];
  });
  return base;
}

export default function DefaultPermissionsModal({ open, onClose }) {
  const [permissions, setPermissions] = useState(buildEmptyPermissions());
  const [permTemplate, setPermTemplate] = useState("user");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const applyingRef = useRef(false);
  const prevStatesRef = useRef({});
  const { handleDetach } = useDetach("default-permissions", { onClose, getState: () => ({}), actions: {} });

  // Sync dropdown label when permissions change from manual edits
  useEffect(() => {
    if (!applyingRef.current) {
      setPermTemplate(detectTemplate(permissions));
    }
    applyingRef.current = false;
  }, [permissions]);

  // Load default permissions on mount
  useEffect(() => {
    if (open) {
      loadDefaultPermissions();
    }
  }, [open]);

  async function loadDefaultPermissions() {
    setLoading(true);
    try {
      const res = await api.get("/api/settings/default-user-permissions");
      const loaded = res.data?.data || {};
      const merged = buildEmptyPermissions();
      Object.entries(loaded).forEach(([k, v]) => {
        if (merged[k] !== undefined && Array.isArray(v)) merged[k] = v;
      });
      setPermissions(merged);
    } catch {
      setPermissions(buildEmptyPermissions());
      toast.error("تعذر تحميل الصلاحيات الافتراضية");
    } finally {
      setLoading(false);
    }
  }

  function toggleAction(pageKey, action) {
    setPermissions((prev) => {
      const current = prev[pageKey] || [];
      const has = current.includes(action);
      const next = has
        ? current.filter((a) => a !== action)
        : [...current, action];
      return { ...prev, [pageKey]: next };
    });
  }

  function detectTemplate(perms) {
    const allPages = Object.keys(buildEmptyPermissions());
    const hasAny = allPages.some((k) => (perms[k] || []).length > 0);
    if (!hasAny) return "none";
    const allHaveAll = allPages.every((k) => (perms[k] || []).length === ALL_ACTIONS.length);
    if (allHaveAll) return "admin";
    return "user";
  }

  async function handleSave() {
    setSaving(true);
    try {
      const compact = {};
      Object.entries(permissions).forEach(([k, v]) => {
        if (Array.isArray(v) && v.length) compact[k] = v;
      });
      await api.put("/api/settings/default-user-permissions", {
        permissions: compact,
      });
      toast.success("تم حفظ الصلاحيات الافتراضية");
      onClose();
    } catch {
      toast.error("فشل حفظ الصلاحيات");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-[200]"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-2 md:p-4"
          >
            <div className="bg-white rounded-3xl shadow-2xl max-h-[85vh] overflow-hidden flex flex-col w-full max-w-5xl" dir="rtl">
              {/* Header */}
              <TitleBar title="إعدادات الصلاحيات الافتراضية" subtitle="تطبق على جميع المستخدمين الجدد فقط" onClose={onClose} onDetach={handleDetach} />

              {/* Content */}
              <div data-modal-content className="flex-1 overflow-y-auto">
                <div className="p-6 flex flex-col gap-5">
                  {/* Warning note */}
                  <div className="flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-200 p-4">
                    <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                    <div className="flex flex-col gap-1">
                      <div className="text-2sm font-black uppercase tracking-widest text-blue-900">
                        تنبيه مهم
                      </div>
                      <div className="text-[11px] font-bold text-blue-800">
                        يؤثر على المستخدمين الجدد فقط. لن يتأثر المستخدمون الحاليون بهذه التغييرات.
                      </div>
                    </div>
                  </div>

                  {/* Template selector */}
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-white border border-slate-200">
                    <label className="text-[11px] font-black uppercase tracking-widest text-slate-600 whitespace-nowrap">
                      قالب مسبق
                    </label>
                    <select
                      value={permTemplate}
                      onChange={(e) => {
                        const key = e.target.value;
                        const prevKey = permTemplate;
                        prevStatesRef.current[prevKey] = permissions;
                        setPermTemplate(key);
                        applyingRef.current = true;
                        if (prevStatesRef.current[key]) {
                          setPermissions(prevStatesRef.current[key]);
                        } else if (key === "user") {
                          setPermissions(applyTemplate(DEFAULT_USER_PERMISSIONS));
                        } else if (key === "admin") {
                          const full = buildEmptyPermissions();
                          Object.keys(full).forEach((k) => { full[k] = [...ALL_ACTIONS]; });
                          setPermissions(full);
                        } else if (key === "none") {
                          setPermissions(buildEmptyPermissions());
                        }
                      }}
                      className="flex-1 h-9 bg-white rounded-lg px-2 text-xs font-bold text-zinc-900 outline-none border border-slate-200 focus:border-zinc-400"
                    >
                      <option value="user">مستخدم (افتراضي)</option>
                      <option value="admin">مدير (الكل)</option>
                      <option value="none">بدون صلاحيات</option>
                    </select>
                  </div>

                  {/* Matrix */}
                  {loading ? (
                    <div className="text-center py-16 text-sm font-bold text-slate-400">
                      جاري التحميل...
                    </div>
                  ) : (
                    <div className="rounded-xl bg-white border border-slate-200 overflow-x-auto overflow-y-auto max-h-[55vh]">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 sticky top-0 z-10">
                          <tr>
                            <th className="text-right p-2 text-[11px] font-black uppercase tracking-widest text-slate-600">
                              الصفحة
                            </th>
                            {ALL_ACTIONS.map((a) => (
                              <th
                                key={a}
                                className="text-center p-2 text-[11px] font-black uppercase tracking-widest text-slate-600 w-14"
                              >
                                <SmartTooltip side="bottom" fill content={ACTION_DESCRIPTIONS[a] || ""}>
                                  <div className="w-full text-center cursor-help">{ACTION_LABELS[a]}</div>
                                </SmartTooltip>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(PAGE_PERMISSIONS).map(
                            ([pageKey, meta]) => (
                              <tr
                                key={pageKey}
                                className="border-t border-slate-100 hover:bg-slate-50/60"
                              >
                                <td className="text-right p-2 text-2sm font-bold text-slate-800">
                                  {meta.label}
                                </td>
                                {ALL_ACTIONS.map((a) => {
                                  const enabled = meta.actions.includes(a);
                                  const checked =
                                    (permissions[pageKey] || []).includes(a);
                                  return (
                                    <td
                                      key={a}
                                      className="text-center p-2"
                                    >
                                      {enabled ? (
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() =>
                                            toggleAction(pageKey, a)
                                          }
                                          className="h-4 w-4 accent-zinc-900 cursor-pointer"
                                        />
                                      ) : (
                                        <span className="text-slate-200">—</span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            )
                          )}
                          {/* Report source permission rows */}
                          {REPORT_SOURCES.map(source => {
                            const sourceKey = "report_" + source.id;
                            const enabled = (permissions[sourceKey] || []).includes("view");
                            return (
                              <tr key={sourceKey} className="border-t border-slate-100 hover:bg-slate-50/60">
                                <td className="text-right p-2 text-2sm font-bold text-slate-600">
                                  تقرير: {source.label}
                                </td>
                                {ALL_ACTIONS.map((a) => {
                                  if (a === "view") {
                                    return (
                                      <td key={a} className="text-center p-2">
                                        <input
                                          type="checkbox"
                                          checked={enabled}
                                          onChange={() => toggleAction(sourceKey, "view")}
                                          className="h-4 w-4 accent-zinc-900 cursor-pointer"
                                        />
                                      </td>
                                    );
                                  }
                                  return <td key={a} className="text-center p-2"><span className="text-slate-200">—</span></td>;
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-slate-100 bg-slate-50 px-6 py-3 flex items-center justify-end gap-3">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="h-10 px-6 rounded-xl border border-slate-300 text-2sm font-black text-slate-700 hover:bg-slate-100 transition-all disabled:opacity-50"
                >
                  إلغاء
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={handleSave}
                  disabled={saving || loading}
                  className="h-10 px-6 rounded-xl bg-primary text-white text-2sm font-black flex items-center gap-2 hover:bg-primary-600 transition-all disabled:opacity-50 shadow-lg"
                >
                  <Save className="h-4 w-4" />
                  {saving ? "جاري الحفظ..." : "حفظ الصلاحيات"}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
