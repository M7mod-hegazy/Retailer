import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Edit3,
  Trash2,
  CheckCircle2,
  Database,
  Search,
  X,
  Shield,
  User as UserIcon,
  Save,
  Settings,
  Eye,
  EyeOff,
} from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";
import DataTable from "../../components/ui/DataTable";
import SmartTooltip from "../../components/ui/SmartTooltip";
import DefaultPermissionsModal from "../../components/modals/DefaultPermissionsModal";
import { useAuthStore } from "../../stores/authStore";
import {
  PAGE_PERMISSIONS,
  DEFAULT_USER_PERMISSIONS,
  ALL_ACTIONS,
} from "../../constants/pagePermissions";

const ACTION_LABELS = {
  view: "رؤية",
  add: "إضافة",
  edit: "تعديل",
  delete: "حذف",
  print: "طباعة",
};

const EMPTY_FORM = { full_name: "", username: "", password: "", role: "user", is_active: true };
const CREATE_TEMPLATE_ROLE = { user: "user", admin: "admin", none: "user" };

function buildEmptyPermissions() {
  return Object.keys(PAGE_PERMISSIONS).reduce((acc, key) => {
    acc[key] = [];
    return acc;
  }, {});
}

function applyTemplate(template) {
  const base = buildEmptyPermissions();
  Object.entries(template || {}).forEach(([page, actions]) => {
    if (base[page]) base[page] = [...actions];
  });
  return base;
}

export default function UsersPage() {
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "dev";

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [editingRow, setEditingRow] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("info");
  const [defaultPermissionsModalOpen, setDefaultPermissionsModalOpen] = useState(false);

  // Permissions state
  const [permissions, setPermissions] = useState(buildEmptyPermissions());
  const [permTemplate, setPermTemplate] = useState("user");
  const [permLoading, setPermLoading] = useState(false);
  const [permSaving, setPermSaving] = useState(false);

  const [showPassword, setShowPassword] = useState(false);

  // For new-user creation template
  const [createTemplate, setCreateTemplate] = useState("user");
  // Server-saved default permissions (used by تطبيق القالب)
  const [serverDefaultPermissions, setServerDefaultPermissions] = useState(null);

  async function loadRows() {
    setLoading(true);
    try {
      const res = await api.get("/api/users");
      setRows(res.data.data || []);
    } catch {
      toast.error("تعذر تحميل البيانات");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRows();
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    api.get("/api/settings/default-user-permissions")
      .then((res) => setServerDefaultPermissions(res.data?.data || DEFAULT_USER_PERMISSIONS))
      .catch(() => setServerDefaultPermissions(DEFAULT_USER_PERMISSIONS));
  }, [isAdmin]);

  function startCreate() {
    setEditingRow(null);
    setForm(EMPTY_FORM);
    setActiveTab("info");
    setPermissions(buildEmptyPermissions());
    setCreateTemplate("user");
    setShowPassword(false);
  }

  async function startEdit(row) {
    setEditingRow(row);
    setForm({
      full_name: row.full_name || "",
      username: row.username || "",
      password: "",
      role: row.role || "user",
      is_active: row.is_active !== 0,
    });
    setPermTemplate(row.role === "admin" ? "admin" : "user");
    setShowPassword(false);
    setActiveTab("info");
    // Load actual password for display
    try {
      const res = await api.get(`/api/users/${row.id}`);
      const pw = res.data?.data?.password || "";
      // Only show plaintext passwords (skip bcrypt hashes)
      if (pw && !pw.startsWith("$2")) {
        setForm((p) => ({ ...p, password: pw }));
      }
    } catch { /* non-critical */ }
    // Load permissions
    if (isAdmin) {
      setPermLoading(true);
      try {
        const res = await api.get(`/api/users/${row.id}/permissions`);
        const loaded = res.data?.data || {};
        const merged = buildEmptyPermissions();
        Object.entries(loaded).forEach(([k, v]) => {
          if (merged[k] !== undefined && Array.isArray(v)) merged[k] = v;
        });
        setPermissions(merged);
      } catch {
        setPermissions(buildEmptyPermissions());
      } finally {
        setPermLoading(false);
      }
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("تأكيد الحذف؟")) return;
    try {
      await api.delete(`/api/users/${id}`);
      toast.success("تم الحذف بنجاح");
      loadRows();
      if (editingRow?.id === id) startCreate();
    } catch {
      toast.error("فشل الحذف");
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingRow) {
        const payload = { ...form, role: permTemplate === "admin" ? "admin" : "user" };
        if (!payload.password) delete payload.password;
        const res = await api.put(`/api/users/${editingRow.id}`, payload);
        toast.success("✓ تم حفظ التعديلات بنجاح");
        // Stay on the same user — refresh its data in the form
        const updated = res.data?.data;
        if (updated) {
          setEditingRow(updated);
          setForm((p) => ({
            ...p,
            full_name: updated.full_name || "",
            username: updated.username || "",
            role: updated.role || "user",
            is_active: updated.is_active !== 0,
            password: updated.password || p.password,
          }));
        }
        loadRows();
      } else {
        const role = CREATE_TEMPLATE_ROLE[createTemplate] || "user";
        const payload = { ...form, role };
        const res = await api.post("/api/users", payload);
        // Apply template permissions (non-critical, non-admin only)
        const newId = res.data?.data?.id || res.data?.id;
        if (newId && isAdmin && createTemplate !== "admin") {
          try {
            const templatePerms = createTemplate === "user"
              ? applyTemplate(serverDefaultPermissions || DEFAULT_USER_PERMISSIONS)
              : buildEmptyPermissions();
            const compact = {};
            Object.entries(templatePerms).forEach(([k, v]) => {
              if (Array.isArray(v) && v.length) compact[k] = v;
            });
            await api.put(`/api/users/${newId}/permissions`, { permissions: compact });
          } catch {
            // non-critical — user created, permissions can be set later
          }
        }
        toast.success("✓ تمت إضافة المستخدم بنجاح");
        loadRows();
        startCreate();
      }
    } catch (err) {
      const serverError = err?.response?.data?.error || err?.response?.data?.message;
      const ERROR_MESSAGES = {
        "Username already taken": "اسم المستخدم مستخدم بالفعل",
        "System owner username is reserved": "اسم المستخدم هذا محجوز",
        "User not found": "المستخدم غير موجود",
        "System owner account cannot be edited": "لا يمكن تعديل حساب مالك النظام",
      };
      const msg = ERROR_MESSAGES[serverError] || serverError || "حدث خطأ، يرجى المحاولة مجدداً";
      toast.error(msg);
      // Form stays open — user can correct and retry
    } finally {
      setIsSubmitting(false);
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

  function handleApplyTemplate() {
    if (permTemplate === "user") {
      setPermissions(applyTemplate(serverDefaultPermissions || DEFAULT_USER_PERMISSIONS));
      toast.success("تم تطبيق القالب");
    } else if (permTemplate === "admin") {
      const full = buildEmptyPermissions();
      Object.keys(full).forEach((k) => {
        full[k] = [...ALL_ACTIONS];
      });
      setPermissions(full);
      toast.success("تم تطبيق القالب");
    } else if (permTemplate === "none") {
      setPermissions(buildEmptyPermissions());
      toast.success("تم مسح الصلاحيات");
    }
  }

  async function handleSavePermissions() {
    if (!editingRow) return;
    setPermSaving(true);
    try {
      // Strip pages with no actions to keep payload compact
      const compact = {};
      Object.entries(permissions).forEach(([k, v]) => {
        if (Array.isArray(v) && v.length) compact[k] = v;
      });
      await api.put(`/api/users/${editingRow.id}/permissions`, {
        permissions: compact,
      });
      toast.success("✓ تم حفظ الصلاحيات بنجاح");
    } catch (err) {
      const code = err?.response?.data?.error;
      if (code === "cannot_modify_admin_permissions") {
        toast.error("المدير يملك صلاحيات كاملة تلقائياً — لا يمكن تقييدها");
      } else {
        toast.error("فشل حفظ الصلاحيات، يرجى المحاولة مجدداً");
      }
    } finally {
      setPermSaving(false);
    }
  }

  const columns = useMemo(
    () => [
      {
        id: "index",
        header: "#",
        accessorFn: (_, i) => String(i + 1).padStart(2, "0"),
        cell: (info) => (
          <span className="text-[10px] font-black text-slate-300 font-mono">
            {info.getValue()}
          </span>
        ),
        size: 50,
      },
      {
        accessorKey: "full_name",
        header: "الاسم",
        cell: (info) => (
          <span className="text-[13px] font-bold text-slate-800">
            {info.getValue() ?? "-"}
          </span>
        ),
      },
      {
        accessorKey: "username",
        header: "اسم المستخدم",
        cell: (info) => (
          <span className="text-[13px] font-bold text-slate-800 font-mono">
            {info.getValue() ?? "-"}
          </span>
        ),
      },
      {
        accessorKey: "role",
        header: "الدور",
        cell: (info) => (
          <span className="text-[11px] font-black uppercase tracking-wider px-2 py-1 rounded-md bg-slate-100 text-slate-700">
            {info.getValue() ?? "-"}
          </span>
        ),
      },
      {
        accessorKey: "is_active",
        header: "نشط",
        cell: (info) => (
          <span className="text-[13px] font-bold text-slate-800">
            {info.getValue() ? "نعم" : "لا"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "إجراءات",
        size: 100,
        cell: (info) => (
          <div className="flex items-center justify-center gap-1">
            <SmartTooltip content="تعديل">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={(e) => {
                  e.stopPropagation();
                  startEdit(info.row.original);
                }}
                className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
                  editingRow?.id === info.row.original.id
                    ? "bg-zinc-950 text-white shadow-md"
                    : "text-slate-400 hover:bg-slate-100 hover:text-zinc-900"
                }`}
              >
                <Edit3 className="h-4 w-4" />
              </motion.button>
            </SmartTooltip>
            <SmartTooltip content="حذف">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(info.row.original.id);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-300 hover:bg-rose-50 hover:text-rose-600 transition-all"
              >
                <Trash2 className="h-4 w-4" />
              </motion.button>
            </SmartTooltip>
          </div>
        ),
      },
    ],
    [editingRow]
  );

  const showPermissionsTab = isAdmin && editingRow;

  return (
    <div
      className="min-h-[100dvh] bg-[#fafafa] flex flex-col font-sans overflow-x-hidden w-full max-w-full relative"
      dir="rtl"
    >
      <div className="absolute inset-0 z-0 pointer-events-none select-none overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_70%_at_50%_40%,transparent_0%,rgba(250,250,250,0.95)_100%)]" />
      </div>

      <header className="relative z-10 w-full pt-24 pb-12 px-8">
        <div className="max-w-[1400px] mx-auto flex flex-col items-start">
          <div className="flex items-center gap-3 text-slate-400 mb-6">
            <div className="h-px w-8 bg-zinc-400" />
            <Database className="h-3 w-3" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] font-mono">
              نظام الإدارة الأساسي
            </span>
          </div>
          <h1 className="text-5xl md:text-6xl font-black text-zinc-950 tracking-tighter leading-[1.1]">
            المستخدمون والصلاحيات
          </h1>
        </div>
      </header>

      <main className="relative z-10 flex-1 w-full max-w-[1400px] mx-auto px-8 pb-32">
        <div className="flex items-center justify-between gap-6 mb-8">
          <div className="relative group w-96">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="البحث..."
              className="w-full h-12 bg-white/80 rounded-xl pr-12 pl-6 text-sm font-bold text-zinc-800 outline-none focus:bg-white focus:ring-2 focus:ring-zinc-900/10 shadow-sm border border-white"
            />
          </div>
          {isAdmin && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setDefaultPermissionsModalOpen(true)}
              className="flex items-center gap-2 h-12 px-4 rounded-xl bg-white border border-slate-200 text-[12px] font-black text-zinc-900 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
            >
              <Settings className="h-4 w-4" />
              إعدادات افتراضية
            </motion.button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-7 bg-white/95 rounded-3xl p-4 md:p-6 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border border-slate-100"
          >
            <DataTable
              columns={columns}
              data={rows}
              globalFilter={query}
              setGlobalFilter={setQuery}
              loading={loading}
              onRowClick={startEdit}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className={`lg:col-span-5 sticky top-10 flex flex-col rounded-3xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border overflow-hidden transition-all ${
              editingRow
                ? "bg-amber-50/95 border-amber-300 ring-4 ring-amber-500/10"
                : "bg-white/95 border-slate-100"
            }`}
          >
            <div
              className={`p-6 flex items-center justify-between border-b ${
                editingRow ? "border-amber-200/50" : "border-slate-50"
              }`}
            >
              <div>
                <h2
                  className={`text-xl font-black tracking-tight ${
                    editingRow ? "text-amber-900" : "text-zinc-900"
                  }`}
                >
                  {editingRow ? "وضع التعديل" : "إضافة جديد"}
                </h2>
                <p
                  className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${
                    editingRow ? "text-amber-700/70" : "text-slate-400"
                  }`}
                >
                  {editingRow
                    ? `ID: ${editingRow.id}`
                    : "إنشاء سجل جديد"}
                </p>
              </div>
              {editingRow && (
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={startCreate}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-900 hover:bg-amber-200 transition-colors"
                >
                  <X className="h-5 w-5" />
                </motion.button>
              )}
            </div>

            {/* Tabs */}
            {editingRow && (
              <div className="flex border-b border-slate-200/60 bg-white/40">
                <button
                  type="button"
                  onClick={() => setActiveTab("info")}
                  className={`flex-1 flex items-center justify-center gap-2 h-12 text-[11px] font-black uppercase tracking-widest transition-colors ${
                    activeTab === "info"
                      ? "bg-white text-zinc-900 border-b-2 border-zinc-900"
                      : "text-slate-500 hover:text-zinc-700"
                  }`}
                >
                  <UserIcon className="h-3.5 w-3.5" />
                  البيانات
                </button>
                {showPermissionsTab && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("permissions")}
                    className={`flex-1 flex items-center justify-center gap-2 h-12 text-[11px] font-black uppercase tracking-widest transition-colors ${
                      activeTab === "permissions"
                        ? "bg-white text-zinc-900 border-b-2 border-zinc-900"
                        : "text-slate-500 hover:text-zinc-700"
                    }`}
                  >
                    <Shield className="h-3.5 w-3.5" />
                    الصلاحيات
                  </button>
                )}
              </div>
            )}

            {/* Info tab */}
            {activeTab === "info" && (
              <form
                onSubmit={handleSubmit}
                className={`p-6 flex flex-col gap-5 ${
                  editingRow ? "bg-amber-100/20" : "bg-slate-50/30"
                }`}
              >
                {[
                  { name: "full_name", label: "الاسم الكامل", required: true },
                  { name: "username", label: "اسم المستخدم", required: true },
                  {
                    name: "password",
                    label: "كلمة المرور",
                    type: "password",
                    required: !editingRow,
                  },
                ].map((field) => (
                  <div key={field.name} className="flex flex-col gap-2">
                    <label
                      className={`text-[10px] font-black uppercase tracking-widest flex items-center justify-between ${
                        editingRow ? "text-amber-900/70" : "text-slate-500"
                      }`}
                    >
                      {field.label}
                      {field.required && (
                        <span className="text-[9px] font-bold text-zinc-400">
                          مطلوب
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type={field.name === "password" ? (showPassword ? "text" : "password") : "text"}
                        autoComplete={field.name === "password" ? (editingRow ? "new-password" : "new-password") : field.name === "username" ? "username" : "off"}
                        required={field.required}
                        value={form[field.name] ?? ""}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, [field.name]: e.target.value }))
                        }
                        className={`w-full h-12 bg-white rounded-xl px-4 text-sm font-bold outline-none transition-all shadow-sm border ${
                          field.name === "password" ? "pl-11" : ""
                        } ${
                          editingRow
                            ? "text-amber-950 border-amber-200 focus:border-amber-500"
                            : "text-zinc-900 border-slate-200 focus:border-zinc-400"
                        }`}
                        placeholder={`إدخال ${field.label}...`}
                      />
                      {field.name === "password" && (
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-zinc-700 transition-colors"
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Create-only: privilege template (auto-sets role) */}
                {!editingRow && (
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      نمط الصلاحيات
                    </label>
                    <select
                      value={createTemplate}
                      onChange={(e) => {
                        const t = e.target.value;
                        setCreateTemplate(t);
                        setForm((p) => ({ ...p, role: CREATE_TEMPLATE_ROLE[t] || "user" }));
                      }}
                      className="w-full h-12 bg-white rounded-xl px-4 text-sm font-bold outline-none transition-all shadow-sm border text-zinc-900 border-slate-200 focus:border-zinc-400"
                    >
                      <option value="user">مستخدم — صلاحيات افتراضية</option>
                      <option value="admin">مدير — كامل الصلاحيات</option>
                      <option value="none">بدون صلاحيات</option>
                    </select>
                  </div>
                )}

                {/* Edit-only: show auto-derived role badge + is_active toggle */}
                {editingRow && (
                  <>
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-amber-900/70">
                        الدور (مشتق من الصلاحيات)
                      </label>
                      <div className="h-12 bg-white/60 rounded-xl px-4 flex items-center border border-amber-200">
                        <span className="text-[11px] font-black uppercase tracking-wider px-2 py-1 rounded-md bg-amber-100 text-amber-800">
                          {permTemplate === "admin" ? "admin" : "user"}
                        </span>
                      </div>
                    </div>
                  </>
                )}

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full h-12 mt-2 flex items-center justify-center gap-2 rounded-xl text-[13px] font-black text-white transition-all shadow-xl disabled:opacity-50 ${
                    editingRow
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-zinc-950 hover:bg-zinc-800"
                  }`}
                >
                  {isSubmitting ? (
                    "جاري المعالجة..."
                  ) : (
                    <>
                      {editingRow ? (
                        <Edit3 className="h-4 w-4" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      {editingRow ? "حفظ التعديلات" : "تأكيد الإضافة"}
                    </>
                  )}
                </motion.button>
              </form>
            )}

            {/* Permissions tab */}
            {activeTab === "permissions" && showPermissionsTab && (
              <div className="p-6 flex flex-col gap-4 bg-amber-100/20">
                {/* Template selector */}
                <div className="flex items-center gap-2 p-3 rounded-xl bg-white border border-amber-200">
                  <label className="text-[10px] font-black uppercase tracking-widest text-amber-900/70 whitespace-nowrap">
                    قالب الدور
                  </label>
                  <select
                    value={permTemplate}
                    onChange={(e) => setPermTemplate(e.target.value)}
                    className="flex-1 h-9 bg-white rounded-lg px-2 text-xs font-bold text-zinc-900 outline-none border border-slate-200 focus:border-zinc-400"
                  >
                    <option value="user">user (افتراضي)</option>
                    <option value="admin">admin (الكل)</option>
                    <option value="none">بدون صلاحيات</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleApplyTemplate}
                    className="h-9 px-3 rounded-lg bg-zinc-950 text-white text-[11px] font-black hover:bg-zinc-800 transition"
                  >
                    تطبيق القالب
                  </button>
                </div>

                {/* Matrix */}
                {permLoading ? (
                  <div className="text-center py-8 text-sm font-bold text-amber-900/70">
                    جاري التحميل...
                  </div>
                ) : (
                  <div className="rounded-xl bg-white border border-slate-200 overflow-hidden max-h-[50vh] overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 sticky top-0 z-10">
                        <tr>
                          <th className="text-right p-2 text-[10px] font-black uppercase tracking-widest text-slate-600">
                            الصفحة
                          </th>
                          {ALL_ACTIONS.map((a) => (
                            <th
                              key={a}
                              className="text-center p-2 text-[10px] font-black uppercase tracking-widest text-slate-600 w-14"
                            >
                              {ACTION_LABELS[a]}
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
                              <td className="text-right p-2 text-[12px] font-bold text-slate-800">
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
                      </tbody>
                    </table>
                  </div>
                )}

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={handleSavePermissions}
                  disabled={permSaving || permLoading}
                  className="w-full h-12 mt-2 flex items-center justify-center gap-2 rounded-xl text-[13px] font-black text-white bg-amber-600 hover:bg-amber-700 transition-all shadow-xl disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {permSaving ? "جاري الحفظ..." : "حفظ الصلاحيات"}
                </motion.button>
              </div>
            )}
          </motion.div>
        </div>
      </main>

      {/* Default Permissions Modal */}
      <DefaultPermissionsModal
        open={defaultPermissionsModalOpen}
        onClose={() => setDefaultPermissionsModalOpen(false)}
      />
    </div>
  );
}
