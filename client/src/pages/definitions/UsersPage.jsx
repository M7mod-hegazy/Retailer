import React, { useState, useEffect, useMemo, useRef } from "react";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import { motion, AnimatePresence } from "framer-motion";
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
  ShoppingCart,
  ShoppingBag,
  Package,
  DollarSign,
  Users as UsersIcon,
  UserCheck,
  ChevronDown,
  ChevronUp,
  Check,
  Lock,
  AlertTriangle,
  Power,
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
  ACTION_LABELS,
  ACTION_DESCRIPTIONS,
} from "../../constants/pagePermissions";
import PermissionGate from "../../components/ui/PermissionGate";
import { usePageTour } from "../../hooks/usePageTour";

const CATEGORY_ICONS = {
  sales: ShoppingCart,
  purchases: ShoppingBag,
  stock: Package,
  finance: DollarSign,
  contacts: UsersIcon,
  hr: UserCheck,
  system: Settings,
};

const CATEGORIES = [
  {
    id: "sales",
    label: "المبيعات ونقاط البيع",
    pages: ["pos", "sales_returns", "quotations", "promotions", "analytics"]
  },
  {
    id: "purchases",
    label: "المشتريات والعمليات",
    pages: ["purchases", "purchase_orders", "purchase_returns"]
  },
  {
    id: "stock",
    label: "المخزون والمستودعات",
    pages: ["stock", "items", "categories", "bulk_price_update", "stock_transfer", "physical_count", "branch_transfer", "warehouses", "units"]
  },
  {
    id: "finance",
    label: "المالية والحسابات",
    pages: ["daily_treasury", "customer_accounts", "supplier_accounts", "revenues", "expenses", "withdrawals", "payment_methods", "bank_operations", "cheques", "payments", "banks", "financial_categories"]
  },
  {
    id: "contacts",
    label: "العملاء والموردين",
    pages: ["customers", "suppliers"]
  },
  {
    id: "hr",
    label: "الموظفين والصلاحيات",
    pages: ["employees", "users", "employee_adjustments"]
  },
  {
    id: "system",
    label: "النظام والإعدادات",
    pages: ["settings", "branches", "reports", "owner_statement", "dashboard", "backup", "notifications", "updates", "history"]
  }
];

const EMPTY_FORM = { full_name: "", username: "", password: "", role: "user", is_active: true, can_view_updates: false };
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
  usePageTour('users');
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "dev";

  const handleKeyDown = useFieldNavigation();
  const fullNameRef = useRef(null);
  const usernameRef = useRef(null);
  const passwordRef = useRef(null);
  const templateRef = useRef(null);
  const roleRef = useRef(null);
  const submitBtnRef = useRef(null);

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
  const [permSearch, setPermSearch] = useState("");
  const [expandedCats, setExpandedCats] = useState({});

  const [permSaved, setPermSaved] = useState(false);
  const [infoSaved, setInfoSaved] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // For new-user creation template — starts empty so the admin must choose.
  const [createTemplate, setCreateTemplate] = useState("");
  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteRefs, setDeleteRefs] = useState(null);
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
    setCreateTemplate("");
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
      can_view_updates: row.can_view_updates === 1 || row.can_view_updates === true,
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
        if (row.role === "admin" || row.role === "dev") {
          // Admin/dev have full access — show all checked
          const full = buildEmptyPermissions();
          Object.keys(full).forEach((k) => { full[k] = [...ALL_ACTIONS]; });
          setPermissions(full);
        } else {
          const res = await api.get(`/api/users/${row.id}/permissions`);
          const loaded = res.data?.data || {};
          const merged = buildEmptyPermissions();
          Object.entries(loaded).forEach(([k, v]) => {
            if (merged[k] !== undefined && Array.isArray(v)) merged[k] = v;
          });
          setPermissions(merged);
        }
      } catch {
        setPermissions(buildEmptyPermissions());
      } finally {
        setPermLoading(false);
      }
    }
  }

  function requestDelete(row) {
    setDeleteTarget(row);
    setDeleteRefs(null);
  }

  function closeDeleteModal() {
    if (deleting) return;
    setDeleteTarget(null);
    setDeleteRefs(null);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/users/${deleteTarget.id}`);
      toast.success("تم حذف المستخدم بنجاح");
      const deletedId = deleteTarget.id;
      setDeleteTarget(null);
      setDeleteRefs(null);
      loadRows();
      if (editingRow?.id === deletedId) startCreate();
    } catch (err) {
      const data = err?.response?.data;
      if (data?.code === "has_references" && Array.isArray(data.references)) {
        // Cannot hard-delete — surface the linked records and offer deactivate.
        setDeleteRefs(data.references);
      } else if (data?.code === "cannot_delete_self") {
        toast.error("لا يمكنك حذف حسابك الحالي");
        setDeleteTarget(null);
      } else if (data?.code === "last_admin") {
        toast.error("لا يمكن حذف آخر مدير في النظام");
        setDeleteTarget(null);
      } else {
        toast.error(data?.message || "فشل حذف المستخدم");
      }
    } finally {
      setDeleting(false);
    }
  }

  async function deactivateUser() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.put(`/api/users/${deleteTarget.id}`, { is_active: false });
      toast.success("تم تعطيل المستخدم");
      const id = deleteTarget.id;
      setDeleteTarget(null);
      setDeleteRefs(null);
      loadRows();
      if (editingRow?.id === id) {
        setEditingRow((p) => (p ? { ...p, is_active: 0 } : p));
        setForm((p) => ({ ...p, is_active: false }));
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "فشل تعطيل المستخدم");
    } finally {
      setDeleting(false);
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
        setInfoSaved(true);
        setTimeout(() => setInfoSaved(false), 2000);
      } else {
        if (!createTemplate) {
          toast.error("يرجى اختيار نمط الصلاحيات");
          setIsSubmitting(false);
          return;
        }
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
      // Re-fetch to stay in sync with server
      const res = await api.get(`/api/users/${editingRow.id}/permissions`);
      const loaded = res.data?.data || {};
      const merged = buildEmptyPermissions();
      Object.entries(loaded).forEach(([k, v]) => {
        if (merged[k] !== undefined && Array.isArray(v)) merged[k] = v;
      });
      setPermissions(merged);
      setPermSaved(true);
      setTimeout(() => setPermSaved(false), 2000);
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

  const filteredCategories = useMemo(() => {
    if (!permSearch) return CATEGORIES;
    return CATEGORIES.map((cat) => {
      const matchingPages = cat.pages.filter((pageKey) => {
        const meta = PAGE_PERMISSIONS[pageKey];
        return meta && meta.label.includes(permSearch);
      });
      if (matchingPages.length > 0) {
        return { ...cat, pages: matchingPages };
      }
      return null;
    }).filter(Boolean);
  }, [permSearch]);

  const handleToggleCategoryAll = (catPages, type) => {
    setPermissions((prev) => {
      const next = { ...prev };
      catPages.forEach((pageKey) => {
        const meta = PAGE_PERMISSIONS[pageKey];
        if (!meta) return;
        if (type === "all") {
          next[pageKey] = [...meta.actions];
        } else if (type === "none") {
          next[pageKey] = [];
        }
      });
      return next;
    });
    toast.success(type === "all" ? "تم تمكين القسم بالكامل" : "تم تعطيل القسم بالكامل");
  };

  const getPageStatus = (pageKey, actions) => {
    const active = permissions[pageKey] || [];
    if (active.length === 0) return "blocked";
    if (actions.every((act) => active.includes(act))) return "full";
    return "custom";
  };

  const columns = useMemo(
    () => [
      {
        id: "index",
        header: "#",
        accessorFn: (_, i) => String(i + 1).padStart(2, "0"),
        cell: (info) => (
          <span className="text-[11px] number-fmt text-slate-300">
            {info.getValue()}
          </span>
        ),
        size: 50,
      },
      {
        accessorKey: "full_name",
        header: "الاسم",
        cell: (info) => (
          <span className="text-sm font-bold text-slate-800">
            {info.getValue() ?? "-"}
          </span>
        ),
      },
      {
        accessorKey: "username",
        header: "اسم المستخدم",
        cell: (info) => (
          <span className="text-sm font-bold text-slate-800 font-mono">
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
          <span className="text-sm font-bold text-slate-800">
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
              <PermissionGate page="users" action="edit">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    startEdit(info.row.original);
                  }}
                  className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
                    editingRow?.id === info.row.original.id
                      ? "bg-primary text-white shadow-md"
                      : "text-slate-400 hover:bg-slate-100 hover:text-zinc-900"
                  }`}
                >
                  <Edit3 className="h-4 w-4" />
                </motion.button>
              </PermissionGate>
            </SmartTooltip>
            <SmartTooltip content="حذف">
              <PermissionGate page="users" action="delete">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    requestDelete(info.row.original);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-300 hover:bg-rose-50 hover:text-rose-600 transition-all"
                >
                  <Trash2 className="h-4 w-4" />
                </motion.button>
              </PermissionGate>
            </SmartTooltip>
          </div>
        ),
      },
    ],
    [editingRow]
  );

  const showPermissionsTab = isAdmin && editingRow;
  const isEditingAdmin = editingRow?.role === "admin" || editingRow?.role === "dev";

  return (
    <div
      className="min-h-[100dvh] bg-[var(--bg-base)] flex flex-col font-sans overflow-x-hidden w-full max-w-full relative"
      dir="rtl"
    >
      <div className="absolute inset-0 z-0 pointer-events-none select-none overflow-hidden">
        <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(to_right,var(--border-subtle) 1px,transparent 1px),linear-gradient(to_bottom,var(--border-subtle) 1px,transparent 1px)", backgroundSize: "32px 32px" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 70% 70% at 50% 40%,transparent 0%,var(--bg-base) 100%)" }} />
      </div>

      <header className="relative z-10 w-full pt-24 pb-12 px-4 md:px-8">
        <div className="max-w-[1400px] mx-auto flex flex-col items-start">
          <div className="flex items-center gap-3 mb-6" style={{ color: "var(--text-muted)" }}>
            <div className="h-px w-8" style={{ backgroundColor: "var(--text-muted)" }} />
            <Database className="h-3 w-3" />
            <span className="text-[11px] font-black uppercase tracking-[0.2em] font-mono">
              نظام الإدارة الأساسي
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter leading-[1.1]" style={{ color: "var(--text-primary)" }}>
            المستخدمون والصلاحيات
          </h1>
        </div>
      </header>

      <main className="relative z-10 flex-1 w-full max-w-[1400px] mx-auto px-4 md:px-8 pb-32">
        <div className="flex items-center justify-between gap-6 mb-8">
          <div data-help="search-bar" className="relative group w-full md:w-96">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5" style={{ color: "var(--text-muted)" }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="البحث..."
              className="w-full h-12 rounded-xl pr-12 pl-6 text-sm font-bold outline-none shadow-sm border transition-all"
              style={{ backgroundColor: "var(--bg-surface)", color: "var(--text-primary)", borderColor: "var(--border-normal)" }}
              onFocus={(e) => { e.target.style.borderColor = "var(--border-accent)"; e.target.style.boxShadow = "0 0 0 2px var(--border-accent)"; }}
              onBlur={(e) => { e.target.style.borderColor = "var(--border-normal)"; e.target.style.boxShadow = "none"; }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-start">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            data-help="main-table"
          className="lg:col-span-6 rounded-3xl p-4 md:p-6 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border overflow-x-auto"
          style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-normal)" }}
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
            data-help="user-form"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className={`lg:col-span-6 sticky top-10 flex flex-col rounded-3xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border overflow-hidden transition-all ${
              editingRow
                ? "ring-4 ring-amber-500/10"
                : ""
            }`}
            style={{
              backgroundColor: editingRow ? "var(--bg-surface)" : "var(--bg-surface)",
              borderColor: editingRow ? "var(--border-accent)" : "var(--border-normal)"
            }}
          >
            <div
              className="p-6 flex items-center justify-between border-b"
              style={{ borderColor: editingRow ? "var(--border-accent)" : "var(--border-subtle)" }}
            >
              <div>
                <h2
                  className="text-xl font-black tracking-tight"
                  style={{ color: editingRow ? "var(--text-primary)" : "var(--text-primary)" }}
                >
                  {editingRow ? "وضع التعديل" : "إضافة جديد"}
                </h2>
                <p
                  className="text-[11px] font-bold uppercase tracking-widest mt-1"
                  style={{ color: "var(--text-muted)" }}
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
                  className="flex h-10 w-10 items-center justify-center rounded-xl transition-colors"
                  style={{ backgroundColor: "var(--accent-soft)", color: "var(--text-primary)" }}
                >
                  <X className="h-5 w-5" />
                </motion.button>
              )}
            </div>

            {/* Tabs */}
            {editingRow && (
              <div className="flex border-b" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-overlay)" }}>
                <button
                  type="button"
                  onClick={() => setActiveTab("info")}
                  className="flex-1 flex items-center justify-center gap-2 h-12 text-[11px] font-black uppercase tracking-widest transition-colors"
                  style={{
                    backgroundColor: activeTab === "info" ? "var(--bg-surface)" : "transparent",
                    color: activeTab === "info" ? "var(--text-primary)" : "var(--text-muted)",
                    borderBottom: activeTab === "info" ? "2px solid var(--text-primary)" : "2px solid transparent"
                  }}
                >
                  <UserIcon className="h-3.5 w-3.5" />
                  البيانات
                </button>
                {showPermissionsTab && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("permissions")}
                    className="flex-1 flex items-center justify-center gap-2 h-12 text-[11px] font-black uppercase tracking-widest transition-colors"
                    style={{
                      backgroundColor: activeTab === "permissions" ? "var(--bg-surface)" : "transparent",
                      color: activeTab === "permissions" ? "var(--text-primary)" : "var(--text-muted)",
                      borderBottom: activeTab === "permissions" ? "2px solid var(--text-primary)" : "2px solid transparent"
                    }}
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
                className="p-6 flex flex-col gap-5 overflow-y-auto max-h-[70vh]"
                style={{ backgroundColor: editingRow ? "var(--bg-overlay)" : "var(--bg-overlay)" }}
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
                      className="text-[11px] font-black uppercase tracking-widest flex items-center justify-between"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {field.label}
                      {field.required && (
                        <span className="text-[9px] font-bold" style={{ color: "var(--text-muted)" }}>
                          مطلوب
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        ref={field.name === "full_name" ? fullNameRef : field.name === "username" ? usernameRef : field.name === "password" ? passwordRef : undefined}
                        type={field.name === "password" ? (showPassword ? "text" : "password") : "text"}
                        autoComplete={field.name === "password" ? (editingRow ? "new-password" : "new-password") : field.name === "username" ? "username" : "off"}
                        required={field.required}
                        value={form[field.name] ?? ""}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, [field.name]: e.target.value }))
                        }
                        onKeyDown={e => {
                          const nextMap = { full_name: usernameRef, username: passwordRef, password: !editingRow ? templateRef : roleRef };
                          const prevMap = { username: fullNameRef, password: usernameRef };
                          handleKeyDown(e, { nextRef: nextMap[field.name], prevRef: prevMap[field.name] });
                        }}
                        className={`w-full h-12 rounded-xl px-4 text-sm font-bold outline-none transition-all shadow-sm border ${
                          field.name === "password" ? "pl-11" : ""
                        }`}
                        style={{
                          backgroundColor: "var(--bg-input)",
                          color: "var(--text-primary)",
                          borderColor: editingRow ? "var(--border-accent)" : "var(--border-normal)"
                        }}
                        placeholder={`إدخال ${field.label}...`}
                      />
                      {field.name === "password" && (
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute left-3 top-1/2 -translate-y-1/2 transition-colors"
                          style={{ color: "var(--text-muted)" }}
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
                    <label className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                      نمط الصلاحيات
                    </label>
                    <select
                      ref={templateRef}
                      value={createTemplate}
                      required
                      onChange={(e) => {
                        const t = e.target.value;
                        setCreateTemplate(t);
                        setForm((p) => ({ ...p, role: CREATE_TEMPLATE_ROLE[t] || "user" }));
                      }}
                      onKeyDown={e => handleKeyDown(e, { nextRef: submitBtnRef, prevRef: passwordRef })}
                      className="w-full h-12 rounded-xl px-4 text-sm font-bold outline-none transition-all shadow-sm border"
                      style={{ backgroundColor: "var(--bg-input)", color: createTemplate ? "var(--text-primary)" : "var(--text-muted)", borderColor: "var(--border-normal)" }}
                    >
                      <option value="" disabled>اختر نمط الصلاحيات...</option>
                      <option value="user">مستخدم — صلاحيات افتراضية</option>
                      <option value="admin">مدير — كامل الصلاحيات</option>
                      <option value="none">بدون صلاحيات</option>
                    </select>
                  </div>
                )}

                {/* Edit-only: editable role selector. Saving the form applies it. */}
                {editingRow && (
                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-black uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
                      الدور
                    </label>
                    <select
                      ref={roleRef}
                      value={permTemplate === "admin" ? "admin" : "user"}
                      onChange={(e) => {
                        const role = e.target.value;
                        setPermTemplate(role);
                        setForm((p) => ({ ...p, role }));
                        if (role === "admin") {
                          const full = buildEmptyPermissions();
                          Object.keys(full).forEach((k) => { full[k] = [...ALL_ACTIONS]; });
                          setPermissions(full);
                        }
                      }}
                      onKeyDown={e => handleKeyDown(e, { nextRef: submitBtnRef, prevRef: passwordRef })}
                      className="w-full h-12 rounded-xl px-4 text-sm font-bold outline-none transition-all shadow-sm border"
                      style={{ backgroundColor: "var(--bg-input)", color: "var(--text-primary)", borderColor: "var(--border-accent)" }}
                    >
                      <option value="user">مستخدم — صلاحيات مخصصة</option>
                      <option value="admin">مدير — كامل الصلاحيات</option>
                    </select>
                    <p className="text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>
                      المدير يملك كل الصلاحيات تلقائياً. غيّر الدور ثم اضغط حفظ التعديلات.
                    </p>
                  </div>
                )}


                <motion.button
                  ref={submitBtnRef}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isSubmitting}
                  animate={infoSaved ? { scale: [1, 1.02, 1] } : {}}
                  className="w-full h-12 mt-2 flex items-center justify-center gap-2 rounded-xl text-sm font-black text-white transition-all shadow-xl disabled:opacity-50"
                  style={{ backgroundColor: infoSaved ? "var(--primary)" : editingRow ? "var(--primary)" : "var(--primary)" }}>
                  {isSubmitting ? (
                    "جاري المعالجة..."
                  ) : infoSaved ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      تم الحفظ
                    </>
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
              <div data-help="permissions-section" className="p-6 flex flex-col gap-4" style={{ backgroundColor: "var(--bg-overlay)" }}>
                {/* Template selector */}
                <div className="flex items-center gap-2 p-3 rounded-xl" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-accent)" }}>
                  <label className="text-[11px] font-black uppercase tracking-widest whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                    قالب الدور
                  </label>
                  <select
                    value={permTemplate}
                    onChange={(e) => setPermTemplate(e.target.value)}
                    className="flex-1 h-9 rounded-lg px-2 text-xs font-bold outline-none border"
                    style={{ backgroundColor: "var(--bg-input)", color: "var(--text-primary)", borderColor: "var(--border-normal)" }}
                  >
                    <option value="user">user (افتراضي)</option>
                    <option value="admin">admin (الكل)</option>
                    <option value="none">بدون صلاحيات</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleApplyTemplate}
                    className="h-9 px-3 rounded-lg text-white text-[11px] font-black transition"
                    style={{ backgroundColor: "var(--primary)" }}
                  >
                    تطبيق القالب
                  </button>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: "var(--text-muted)" }} />
                  <input
                    value={permSearch}
                    onChange={(e) => setPermSearch(e.target.value)}
                    placeholder="بحث في الصفحات..."
                    className="w-full h-9 rounded-lg pr-9 pl-3 text-2sm font-bold outline-none border transition-all"
                    style={{ backgroundColor: "var(--bg-input)", color: "var(--text-primary)", borderColor: "var(--border-normal)" }}
                  />
                </div>

                {/* Horizontal Navigation Pill Track */}
                {!permSearch && !permLoading && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none dir-rtl select-none">
                    {CATEGORIES.map((cat) => {
                      const IconComponent = CATEGORY_ICONS[cat.id] || Shield;
                      const isOpen = !!expandedCats[cat.id];
                      const activeCount = cat.pages.filter(pageKey => (permissions[pageKey] || []).includes('view')).length;
                      
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            if (!isOpen) {
                              setExpandedCats(p => ({ ...p, [cat.id]: true }));
                            }
                            setTimeout(() => {
                              const el = document.getElementById(`cat-panel-${cat.id}`);
                              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                            }, 50);
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap transition-all shadow-sm shrink-0 ${
                            isOpen 
                              ? "bg-amber-600 text-white border-amber-600 font-black scale-105" 
                              : activeCount > 0
                                ? "bg-amber-50 text-amber-900 border-amber-200"
                                : "bg-white text-slate-500 border-slate-200/60 hover:bg-slate-50"
                          }`}
                        >
                          <IconComponent className="h-3 w-3" />
                          <span>{cat.label.split(" ")[0]}</span>
                          <span className={`text-[8px] px-1.5 py-0.5 rounded font-black ${
                            isOpen ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                          }`}>
                            {activeCount}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {permLoading ? (
                  <div className="text-center py-8 text-sm font-bold" style={{ color: "var(--text-muted)" }}>
                    جاري التحميل...
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 max-h-[52vh] overflow-y-auto pr-1">
                    <AnimatePresence>
                      {filteredCategories.map((cat) => {
                        const IconComponent = CATEGORY_ICONS[cat.id] || Shield;
                        const isOpen = permSearch || !!expandedCats[cat.id];
                        
                        const activeCount = cat.pages.filter(pageKey => (permissions[pageKey] || []).includes('view')).length;
                        const totalCount = cat.pages.length;

                        return (
                          <motion.div
                            key={cat.id}
                            id={`cat-panel-${cat.id}`}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -12 }}
                            transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                            className="border rounded-2xl p-1.5 transition-all duration-300"
                            style={{ backgroundColor: "var(--bg-surface)", borderColor: isOpen ? "var(--border-accent)" : "var(--border-normal)" }}
                          >
                            <div 
                              onClick={() => {
                                if (permSearch) return;
                                setExpandedCats(p => ({ ...p, [cat.id]: !p[cat.id] }));
                              }}
                              className="flex items-center justify-between p-3 rounded-xl cursor-pointer select-none transition-all"
                              style={{
                                backgroundColor: isOpen ? "var(--bg-overlay)" : "transparent",
                                borderBottom: isOpen ? "1px solid var(--border-subtle)" : "none",
                                paddingTop: isOpen ? "14px" : undefined,
                                paddingBottom: isOpen ? "14px" : undefined,
                                marginBottom: isOpen ? "6px" : undefined
                              }}
                            >
                              <div className="flex items-center gap-2.5">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors" style={{ backgroundColor: activeCount > 0 ? "var(--accent-soft)" : "var(--bg-overlay)", color: activeCount > 0 ? "var(--text-primary)" : "var(--text-muted)" }}>
                                  <IconComponent className="h-4.5 w-4.5" />
                                </div>
                                <div className="flex flex-col items-start gap-0.5">
                                  <span className="text-xs font-black" style={{ color: "var(--text-primary)" }}>{cat.label}</span>
                                  <span className="text-[11px] number-fmt" style={{ color: "var(--text-muted)" }}>
                                    {activeCount} / {totalCount} نشط
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1 p-0.5 rounded-lg shadow-sm" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
                                  <SmartTooltip content="تمكين الكل للقسم">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleCategoryAll(cat.pages, "all")}
                                      className="flex h-6 px-1.5 items-center justify-center rounded-md text-[9px] font-bold transition"
                                      style={{ color: "var(--text-muted)" }}
                                    >
                                      تمكين الكل
                                    </button>
                                  </SmartTooltip>
                                  <div className="h-3 w-px" style={{ backgroundColor: "var(--border-subtle)" }} />
                                  <SmartTooltip content="حظر الكل للقسم">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleCategoryAll(cat.pages, "none")}
                                      className="flex h-6 px-1.5 items-center justify-center rounded-md text-[9px] font-bold transition"
                                      style={{ color: "var(--text-muted)" }}
                                    >
                                      تعطيل الكل
                                    </button>
                                  </SmartTooltip>
                                </div>

                                {!permSearch && (
                                  <div style={{ color: "var(--text-muted)" }}>
                                    {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                  </div>
                                )}
                              </div>
                            </div>

                            {isOpen && (
                              <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mr-5 pr-4 rounded-xl flex flex-col gap-2.5 mt-2 py-2.5 pl-2.5"
                                style={{ borderRight: "2px dashed var(--border-subtle)", backgroundColor: "var(--bg-overlay)" }}
                              >
                                {cat.pages.map((pageKey) => {
                                  const meta = PAGE_PERMISSIONS[pageKey];
                                  if (!meta) return null;
                                  
                                  const currentActions = permissions[pageKey] || [];
                                  const hasView = currentActions.includes("view");
                                  const status = getPageStatus(pageKey, meta.actions);
                                  
                                  return (
                                    <div 
                                      key={pageKey}
                                      className="border transition-all duration-300 rounded-xl p-3 relative"
                                      style={{ backgroundColor: "var(--bg-surface)", borderColor: hasView ? "var(--border-accent)" : "var(--border-normal)", opacity: hasView ? 1 : 0.7 }}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                          <div className="flex flex-col items-start gap-0.5">
                                            <span className="text-[9px] font-black tracking-wide uppercase" style={{ color: "var(--text-muted)" }}>
                                              {cat.label}
                                            </span>
                                            <span className="text-2sm font-black" style={{ color: "var(--text-primary)" }}>{meta.label}</span>
                                          </div>
                                          
                                          {status === "full" && (
                                            <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-0.5 border" style={{ backgroundColor: "color-mix(in srgb, var(--primary) 15%, transparent)", color: "var(--primary)", borderColor: "color-mix(in srgb, var(--primary) 30%, transparent)" }}>
                                              <span className="h-1 w-1 rounded-full animate-pulse" style={{ backgroundColor: "var(--primary)" }} />
                                              كاملة
                                            </span>
                                          )}
                                          {status === "custom" && (
                                            <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-0.5 border" style={{ backgroundColor: "var(--accent-soft)", color: "var(--text-primary)", borderColor: "var(--border-accent)" }}>
                                              <span className="h-1 w-1 rounded-full animate-pulse" style={{ backgroundColor: "var(--text-primary)" }} />
                                              مخصصة
                                            </span>
                                          )}
                                          {status === "blocked" && (
                                            <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full border" style={{ backgroundColor: "var(--bg-overlay)", color: "var(--text-muted)", borderColor: "var(--border-subtle)" }}>
                                              محظورة
                                            </span>
                                          )}
                                        </div>

                                        <div className="flex p-0.5 rounded-lg border shadow-inner select-none shrink-0" style={{ backgroundColor: "var(--bg-overlay)", borderColor: "var(--border-subtle)" }}>
                                          <SmartTooltip content="حظر الوصول — لا توجد صلاحيات">
                                            <button
                                              type="button"
                                              onClick={() => setPermissions(prev => ({ ...prev, [pageKey]: [] }))}
                                              className="flex items-center gap-1 text-[9px] font-black px-2 py-1 rounded-md transition-all"
                                              style={{ backgroundColor: status === "blocked" ? "var(--primary)" : "transparent", color: status === "blocked" ? "white" : "var(--text-muted)" }}
                                            >
                                              <Lock className="h-2.5 w-2.5" />
                                              حظر
                                            </button>
                                          </SmartTooltip>
                                          <SmartTooltip content="قراءة فقط — عرض البيانات دون تعديل">
                                            <button
                                              type="button"
                                              onClick={() => setPermissions(prev => ({ ...prev, [pageKey]: ["view"] }))}
                                              className="flex items-center gap-1 text-[9px] font-black px-2 py-1 rounded-md transition-all"
                                              style={{ backgroundColor: status === "custom" && currentActions.length === 1 && currentActions.includes("view") ? "var(--primary)" : "transparent", color: status === "custom" && currentActions.length === 1 && currentActions.includes("view") ? "white" : "var(--text-muted)" }}
                                            >
                                              <Eye className="h-2.5 w-2.5" />
                                              عرض
                                            </button>
                                          </SmartTooltip>
                                          {meta.actions.length > 2 && (
                                            <SmartTooltip content="كامل الصلاحيات — تمكين كل الإجراءات المتاحة">
                                              <button
                                                type="button"
                                                onClick={() => setPermissions(prev => ({ ...prev, [pageKey]: [...meta.actions] }))}
                                                className="flex items-center gap-1 text-[9px] font-black px-2 py-1 rounded-md transition-all"
                                                style={{ backgroundColor: status === "full" ? "var(--primary)" : "transparent", color: status === "full" ? "white" : "var(--text-muted)" }}
                                              >
                                                <Check className="h-2.5 w-2.5" />
                                                كامل
                                              </button>
                                            </SmartTooltip>
                                          )}
                                        </div>
                                      </div>

                                      {hasView && meta.actions.length > 1 && (
                                        <div className="flex flex-wrap gap-1.5 mt-3 pt-2.5" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                                          {meta.actions
                                            .filter((act) => act !== "view")
                                            .map((act) => {
                                              const checked = currentActions.includes(act);
                                              return (
                                                <SmartTooltip key={act} content={ACTION_DESCRIPTIONS[act] || ""}>
                                                  <button
                                                    type="button"
                                                    onClick={() => toggleAction(pageKey, act)}
                                                    className="h-7 px-2.5 rounded-lg text-[11px] font-bold border transition flex items-center gap-1 select-none"
                                                    style={{ backgroundColor: checked ? "var(--primary)" : "var(--bg-overlay)", color: checked ? "white" : "var(--text-secondary)", borderColor: checked ? "var(--primary)" : "var(--border-subtle)" }}
                                                  >
                                                    {checked && <Check className="h-3 w-3" />}
                                                    {ACTION_LABELS[act]}
                                                  </button>
                                                </SmartTooltip>
                                              );
                                            })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </motion.div>
                            )}
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                    
                    {filteredCategories.length === 0 && (
                      <div className="text-center py-12 text-xs font-bold rounded-2xl border" style={{ backgroundColor: "var(--bg-surface)", color: "var(--text-muted)", borderColor: "var(--border-normal)" }}>
                        لم يتم العثور على صفحات مطابقة للبحث
                      </div>
                    )}
                  </div>
                )}

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={handleSavePermissions}
                  disabled={permSaving || permLoading}
                  className="w-full h-12 mt-2 flex items-center justify-center gap-2 rounded-xl text-sm font-black text-white transition-all shadow-xl disabled:opacity-50"
                  style={{ backgroundColor: "var(--primary)" }}
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

      {/* Delete confirmation / reference-block modal */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={closeDeleteModal}
            dir="rtl"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl shadow-2xl border overflow-hidden"
              style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-normal)" }}
            >
              <div className="p-6 flex items-start gap-4 border-b" style={{ backgroundColor: deleteRefs ? "var(--bg-overlay)" : "var(--bg-overlay)", borderColor: "var(--border-subtle)" }}>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ backgroundColor: "var(--accent-soft)" }}>
                  <AlertTriangle className="h-6 w-6" style={{ color: "var(--text-primary)" }} />
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-black" style={{ color: "var(--text-primary)" }}>
                    {deleteRefs ? "تعذّر حذف المستخدم" : "تأكيد حذف المستخدم"}
                  </h3>
                  <p className="text-sm font-bold" style={{ color: "var(--text-secondary)" }}>
                    {deleteTarget.full_name || deleteTarget.username}
                    <span className="font-mono" style={{ color: "var(--text-muted)" }}> @{deleteTarget.username}</span>
                  </p>
                </div>
              </div>

              <div className="p-6 flex flex-col gap-4">
                {deleteRefs ? (
                  <>
                    <p className="text-sm font-bold leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      لا يمكن حذف هذا المستخدم لأنه مرتبط بسجلات في النظام. يمكنك
                      <span style={{ color: "var(--primary)" }}> تعطيله </span>
                      بدلاً من ذلك للحفاظ على سلامة البيانات والسجل التاريخي.
                    </p>
                    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border-normal)", backgroundColor: "var(--bg-overlay)" }}>
                      {deleteRefs.map((ref) => (
                        <div key={ref.label} className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                          <span className="text-sm font-bold" style={{ color: "var(--text-secondary)" }}>{ref.label}</span>
                          <span className="text-[11px] number-fmt px-2 py-0.5 rounded-md border" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-normal)", color: "var(--text-secondary)" }}>
                            {ref.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm font-bold leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    سيتم حذف المستخدم نهائياً. لا يمكن التراجع عن هذا الإجراء.
                    سجلّات النشاط القديمة ستبقى محفوظة دون نسبتها لهذا المستخدم.
                  </p>
                )}

                <div className="flex items-center gap-3 mt-2">
                  <button
                    type="button"
                    onClick={closeDeleteModal}
                    disabled={deleting}
                    className="flex-1 h-11 rounded-xl text-sm font-black transition disabled:opacity-50"
                    style={{ backgroundColor: "var(--bg-overlay)", color: "var(--text-secondary)" }}
                  >
                    إلغاء
                  </button>
                  {deleteRefs ? (
                    <button
                      type="button"
                      onClick={deactivateUser}
                      disabled={deleting}
                      className="flex-1 h-11 flex items-center justify-center gap-2 rounded-xl text-white text-sm font-black transition disabled:opacity-50"
                      style={{ backgroundColor: "var(--primary)" }}
                    >
                      <Power className="h-4 w-4" />
                      {deleting ? "جاري التعطيل..." : "تعطيل المستخدم"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={confirmDelete}
                      disabled={deleting}
                      className="flex-1 h-11 flex items-center justify-center gap-2 rounded-xl text-white text-sm font-black transition disabled:opacity-50"
                      style={{ backgroundColor: "var(--primary)" }}
                    >
                      <Trash2 className="h-4 w-4" />
                      {deleting ? "جاري الحذف..." : "حذف نهائي"}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
