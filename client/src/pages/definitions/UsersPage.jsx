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
  Clock,
  BarChart3,
  Sparkles,
} from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";
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
import { REPORT_SOURCES, REPORT_SOURCE_KEYS } from "../../constants/reportPermissions";
import PermissionGate from "../../components/ui/PermissionGate";
import { usePageTour } from "../../hooks/usePageTour";
import { useAppSettingsStore } from "../../stores/appSettingsStore";
import { useUnsavedChangesGuard } from "../../hooks/useUnsavedChangesGuard";

const CATEGORY_ICONS = {
  sales: ShoppingCart,
  purchases: ShoppingBag,
  stock: Package,
  finance: DollarSign,
  contacts: UsersIcon,
  hr: UserCheck,
  system: Settings,
  reports_sources: BarChart3,
  features: Sparkles,
};

const AVATAR_STYLES = [
  { backgroundColor: "var(--primary)", color: "#ffffff" },
  { backgroundColor: "var(--info-text)", color: "#ffffff" },
  { backgroundColor: "var(--success-text)", color: "#ffffff" },
  { backgroundColor: "var(--warning-text)", color: "#ffffff" },
  { backgroundColor: "var(--danger-text)", color: "#ffffff" },
];

function getInitials(name) {
  return (name || "")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarStyle(id) {
  return AVATAR_STYLES[(id || 0) % AVATAR_STYLES.length];
}

// Maps every PAGE_PERMISSIONS key to the category it belongs in.
// Unknown keys (e.g. newly-added feature pages) auto-fall into "features".
const PAGE_CATEGORY_MAP = {
  // sales
  pos: "sales", sales_returns: "sales", quotations: "sales", promotions: "sales", analytics: "sales", whatsapp_receipt: "sales",
  // purchases
  purchases: "purchases", purchase_orders: "purchases", purchase_returns: "purchases",
  // stock
  stock: "stock", items: "stock", categories: "stock", bulk_price_update: "stock",
  stock_transfer: "stock", physical_count: "stock", branch_transfer: "stock", warehouses: "stock", units: "stock",
  // finance
  daily_treasury: "finance", customer_accounts: "finance", supplier_accounts: "finance",
  revenues: "finance", expenses: "finance", withdrawals: "finance", payment_methods: "finance",
  cheques: "finance", payments: "finance", financial_categories: "finance",
  // contacts
  customers: "contacts", suppliers: "contacts",
  // hr
  employees: "hr", users: "hr", employee_adjustments: "hr",
  // system
  settings: "system", branches: "system", reports: "system", owner_statement: "system",
  print_settings: "system",
  whatsapp_crm: "system", dashboard: "system", backup: "system", notifications: "system",
  updates: "system", history: "system",
  // feature-gated pages — anything not listed above lands here automatically
  restaurant_tables: "features", restaurant_modifiers: "features",
  gold_pricing: "features", repair_orders: "features", serial_search: "features",
};

// Maps feature-gated pages to their feature toggle setting key.
// Pages hidden when their feature toggle is off.
const PAGE_FEATURE_MAP = {
  restaurant_tables: "feature_restaurant",
  restaurant_modifiers: "feature_restaurant",
  gold_pricing: "feature_gold",
  repair_orders: "feature_repair_orders",
  serial_search: "feature_serials",
};

const CATEGORY_META = [
  { id: "sales",           label: "المبيعات ونقاط البيع" },
  { id: "purchases",       label: "المشتريات والعمليات" },
  { id: "stock",           label: "المخزون والمستودعات" },
  { id: "finance",         label: "المالية والحسابات" },
  { id: "contacts",        label: "العملاء والموردين" },
  { id: "hr",              label: "الموظفين والصلاحيات" },
  { id: "system",          label: "النظام والإعدادات" },
  { id: "reports_sources", label: "صلاحيات التقارير" },
  { id: "features",        label: "ميزات متخصصة" },
];

// Computed once at module load. Adding a new key to PAGE_PERMISSIONS
// automatically places it in the right bucket via PAGE_CATEGORY_MAP.
const CATEGORIES = (() => {
  const buckets = Object.fromEntries(CATEGORY_META.map(c => [c.id, []]));
  REPORT_SOURCE_KEYS.forEach(k => buckets.reports_sources.push(k));
  Object.keys(PAGE_PERMISSIONS).forEach(key => {
    const bucket = PAGE_CATEGORY_MAP[key] || "features";
    if (buckets[bucket]) buckets[bucket].push(key);
    else buckets.features.push(key);
  });
  return CATEGORY_META
    .map(c => ({ id: c.id, label: c.label, pages: buckets[c.id] }))
    .filter(c => c.pages.length > 0);
})();

const EMPTY_FORM = { full_name: "", username: "", password: "", role: "user", is_active: true, can_view_updates: false };
const CREATE_TEMPLATE_ROLE = { user: "user", admin: "admin", none: "user" };

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

export default function UsersPage() {
  usePageTour('users');
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "dev";
  const settings = useAppSettingsStore((s) => s.settings);

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
  const [defaultPermissionsModalOpen, setDefaultPermissionsModalOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Permissions state
  const [permissions, setPermissions] = useState(buildEmptyPermissions());
  const [permTemplate, setPermTemplate] = useState("user");
  const [permLoading, setPermLoading] = useState(false);
  const [permSaving, setPermSaving] = useState(false);
  const [permSearch, setPermSearch] = useState("");
  const [expandedCats, setExpandedCats] = useState({});

  const [showPassword, setShowPassword] = useState(false);

  // Dirty tracking — snapshots taken when editing starts
  const originalFormRef = useRef(null);
  const originalPermsRef = useRef(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Unsaved-changes guard for sidebar navigation
  const isDirty = hasChanges && !!editingRow;
  const { blocker } = useUnsavedChangesGuard(isDirty);

  // Pending action when user switches while dirty
  const pendingActionRef = useRef(null);
  const [showDiscardModal, setShowDiscardModal] = useState(false);

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

  // Dirty tracking — compare current state to snapshots
  useEffect(() => {
    if (!editingRow) {
      setHasChanges(false);
      return;
    }
    if (!originalFormRef.current || !originalPermsRef.current) return;
    const formChanged = JSON.stringify(form) !== JSON.stringify(originalFormRef.current);
    const permsChanged = JSON.stringify(permissions) !== JSON.stringify(originalPermsRef.current);
    setHasChanges(formChanged || permsChanged);
  }, [form, permissions, editingRow]);

  function doStartCreate(openCreateModal) {
    setEditingRow(null);
    setForm(EMPTY_FORM);
    setPermissions(buildEmptyPermissions());
    setCreateTemplate("");
    setShowPassword(false);
    setExpandedCats({});
    setHasChanges(false);
    originalFormRef.current = null;
    originalPermsRef.current = null;
    if (openCreateModal) setShowCreateModal(true);
    else requestAnimationFrame(() => fullNameRef.current?.focus());
  }

  function startCreate(openCreateModal) {
    if (isDirty) {
      pendingActionRef.current = () => doStartCreate(openCreateModal);
      setShowDiscardModal(true);
      return;
    }
    doStartCreate(openCreateModal);
  }

  function doStartEdit(row) {
    setEditingRow(row);
    setForm({
      full_name: row.full_name || "",
      username: row.username || "",
      password: "",
      role: row.role || "user",
      is_active: row.is_active !== 0,
      can_view_updates: row.can_view_updates === 1 || row.can_view_updates === true,
    });
    setPermTemplate(row.role === "admin" || row.role === "dev" ? "admin" : "user");
    setShowPassword(false);
    setHasChanges(false);
    loadEditData(row);
  }

  function startEdit(row) {
    if (isDirty && editingRow?.id !== row.id) {
      pendingActionRef.current = () => doStartEdit(row);
      setShowDiscardModal(true);
      return;
    }
    doStartEdit(row);
  }

  async function loadEditData(row) {
    let loadedPassword = "";
    try {
      const res = await api.get(`/api/users/${row.id}`);
      const pw = res.data?.data?.password || "";
      // Only show plaintext passwords (skip bcrypt hashes)
      if (pw && !pw.startsWith("$2")) {
        loadedPassword = pw;
        setForm((p) => ({ ...p, password: pw }));
      }
    } catch { /* non-critical */ }
    // Load permissions
    if (isAdmin) {
      setPermLoading(true);
      try {
        const res = await api.get(`/api/users/${row.id}/permissions`);
        const loaded = res.data?.data;
        if (loaded && typeof loaded === "object") {
          const merged = buildEmptyPermissions();
          Object.entries(loaded).forEach(([k, v]) => {
            if (merged[k] !== undefined && Array.isArray(v)) merged[k] = v;
          });
          setPermissions(merged);
          originalPermsRef.current = merged;
        } else {
          // No stored permissions (admin/dev who was never customized) — show all checked
          const full = buildEmptyPermissions();
          Object.keys(full).forEach((k) => { full[k] = [...ALL_ACTIONS]; });
          setPermissions(full);
          originalPermsRef.current = full;
        }
      } catch {
        const empty = buildEmptyPermissions();
        setPermissions(empty);
        originalPermsRef.current = empty;
      } finally {
        setPermLoading(false);
      }
    } else {
      originalPermsRef.current = buildEmptyPermissions();
    }
    // Snapshot for dirty tracking — include loaded password so loading doesn't false-trigger dirty
    originalFormRef.current = { full_name: row.full_name || "", username: row.username || "", password: loadedPassword, role: row.role || "user", is_active: row.is_active !== 0, can_view_updates: row.can_view_updates === 1 || row.can_view_updates === true };
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

  useEffect(() => {
    if (!deleteTarget) return;
    const h = (e) => { if (e.key === "Escape") closeDeleteModal(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [deleteTarget, deleting]);

  useEffect(() => {
    if (!showCreateModal) return;
    const h = (e) => { if (e.key === "Escape" && !isSubmitting) setShowCreateModal(false); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [showCreateModal, isSubmitting]);

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
        // Step 1: Save user info
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        const res = await api.put(`/api/users/${editingRow.id}`, payload);
        const updated = res.data?.data;

        // Step 2: Save permissions
        if (isAdmin) {
          const compact = {};
          Object.entries(permissions).forEach(([k, v]) => {
            if (Array.isArray(v) && v.length) compact[k] = v;
          });
          await api.put(`/api/users/${editingRow.id}/permissions`, { permissions: compact });
          // Sync auth store so changes take effect without re-login
          if (editingRow.id === currentUser?.id) {
            useAuthStore.getState().updatePermissions(compact);
          }
        }

        toast.success("✓ تم حفظ التغييرات بنجاح");
        loadRows();

        // Refresh form data
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

        // Refresh permissions display
        if (isAdmin) {
          try {
            const permRes = await api.get(`/api/users/${editingRow.id}/permissions`);
            const loaded = permRes.data?.data || {};
            const merged = buildEmptyPermissions();
            Object.entries(loaded).forEach(([k, v]) => {
              if (merged[k] !== undefined && Array.isArray(v)) merged[k] = v;
            });
            setPermissions(merged);
            originalPermsRef.current = merged;
          } catch { /* non-critical */ }
        }
        // Re-snapshot so hasChanges resets after save
        const savedPassword = updated?.password || form.password || "";
        originalFormRef.current = {
          full_name: updated?.full_name || "",
          username: updated?.username || "",
          password: savedPassword,
          role: updated?.role || "user",
          is_active: updated?.is_active !== 0,
          can_view_updates: updated?.can_view_updates === 1 || updated?.can_view_updates === true,
        };
      } else {
        // Creating user
        if (!createTemplate) {
          toast.error("يرجى اختيار نمط الصلاحيات");
          setIsSubmitting(false);
          return;
        }
        const role = CREATE_TEMPLATE_ROLE[createTemplate] || "user";
        // Send permissions inline with the create call. Creating the account
        // and granting its permissions in two requests made the owner's
        // Telegram alert arrive as two disconnected messages, the first of
        // which could not name the privileges being granted.
        const compact = {};
        Object.entries(permissions).forEach(([k, v]) => {
          if (Array.isArray(v) && v.length) compact[k] = v;
        });
        await api.post("/api/users", { ...form, role, ...(isAdmin ? { permissions: compact } : {}) });
        toast.success("✓ تمت إضافة المستخدم بنجاح");
        loadRows();
        setShowCreateModal(false);
        startCreate();
      }
    } catch (err) {
      const data = err?.response?.data;
      const serverError = data?.error || data?.message;
      const ERROR_MESSAGES = {
        "Username already taken": "اسم المستخدم مستخدم بالفعل",
        "System owner username is reserved": "اسم المستخدم هذا محجوز",
        "User not found": "المستخدم غير موجود",
        "System owner account cannot be edited": "لا يمكن تعديل حساب مالك النظام",
        "Permissions payload is required": "بيانات الصلاحيات غير صالحة",
      };
      const msg = ERROR_MESSAGES[serverError] || serverError || "حدث خطأ، يرجى المحاولة مجدداً";
      toast.error(msg);
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

  // Keep handleSavePermissions for template-apply refresh and backward compat
  async function handleSavePermissions() {
    if (!editingRow) return;
    setPermSaving(true);
    try {
      const compact = {};
      Object.entries(permissions).forEach(([k, v]) => {
        if (Array.isArray(v) && v.length) compact[k] = v;
      });
      await api.put(`/api/users/${editingRow.id}/permissions`, {
        permissions: compact,
      });
      toast.success("✓ تم حفظ الصلاحيات بنجاح");
      const res = await api.get(`/api/users/${editingRow.id}/permissions`);
      const loaded = res.data?.data || {};
      const merged = buildEmptyPermissions();
      Object.entries(loaded).forEach(([k, v]) => {
        if (merged[k] !== undefined && Array.isArray(v)) merged[k] = v;
      });
      setPermissions(merged);
    } catch (err) {
      const serverError = err?.response?.data?.error || err?.response?.data?.message;
      toast.error(serverError || "فشل حفظ الصلاحيات، يرجى المحاولة مجدداً");
    } finally {
      setPermSaving(false);
    }
  }

  const filteredCategories = useMemo(() => {
    const filterByFeature = (pages) => pages.filter((pageKey) => {
      const featureKey = PAGE_FEATURE_MAP[pageKey];
      if (featureKey && settings && !(featureKey in settings ? settings[featureKey] : true)) return false;
      return true;
    });
    const mapped = CATEGORIES.map((cat) => ({ ...cat, pages: filterByFeature(cat.pages) })).filter((c) => c.pages.length > 0);
    if (!permSearch) return mapped;
    return mapped.map((cat) => {
      const matchingPages = cat.pages.filter((pageKey) => {
        const meta = PAGE_PERMISSIONS[pageKey];
        return meta && meta.label.includes(permSearch);
      });
      if (matchingPages.length > 0) {
        return { ...cat, pages: matchingPages };
      }
      return null;
    }).filter(Boolean);
  }, [permSearch, settings]);

  const handleToggleCategoryAll = (catPages, type) => {
    setPermissions((prev) => {
      const next = { ...prev };
      catPages.forEach((pageKey) => {
        if (pageKey.startsWith("report_")) {
          next[pageKey] = type === "all" ? ["view"] : [];
          return;
        }
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
          <span className="text-[11px] number-fmt" style={{ color: "var(--text-muted)" }}>
            {info.getValue()}
          </span>
        ),
        size: 50,
      },
      {
        accessorKey: "full_name",
        header: "المستخدم",
        cell: (info) => {
          const row = info.row.original;
          const initials = getInitials(row.full_name);
          const avatarStyle = getAvatarStyle(row.id);
          return (
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-[11px] font-black shadow-sm"
                style={avatarStyle}
              >
                {initials}
              </div>
              <div className="flex flex-col items-start min-w-0 leading-tight">
                <span className="text-sm font-bold truncate max-w-[140px]" style={{ color: "var(--text-primary)" }}>
                  {row.full_name ?? "-"}
                </span>
                <span className="text-[10px] font-mono font-bold" style={{ color: "var(--text-muted)" }}>
                  @{row.username}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        id: "role",
        accessorKey: "role",
        header: "الدور",
        cell: (info) => {
          const val = info.getValue();
          const isAdminRole = val === "admin" || val === "dev";
          return (
            <span
              className="inline-flex items-center gap-1.5 text-[11px] font-black tracking-wide px-2.5 py-1 rounded-full border"
              style={{
                backgroundColor: isAdminRole ? "var(--accent-soft)" : "var(--bg-input)",
                color: isAdminRole ? "var(--primary)" : "var(--text-secondary)",
                borderColor: isAdminRole ? "var(--border-accent)" : "var(--border-normal)"
              }}
            >
              {isAdminRole ? <Shield className="h-3 w-3" /> : <UserIcon className="h-3 w-3" />}
              {val ?? "-"}
            </span>
          );
        },
      },
      {
        id: "is_active",
        accessorKey: "is_active",
        header: "الحالة",
        cell: (info) => {
          const active = info.getValue();
          return (
            <span
              className="inline-flex items-center gap-1.5 text-[12px] font-bold"
              style={{ color: active ? "var(--success-text)" : "var(--text-muted)" }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: active ? "var(--primary)" : "var(--text-muted)" }}
              />
              {active ? "نشط" : "غير نشط"}
            </span>
          );
        },
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
                  className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${editingRow?.id === info.row.original.id
                    ? "text-white shadow-sm"
                    : "hover:bg-[var(--bg-input-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    }`}
                  style={{
                    backgroundColor: editingRow?.id === info.row.original.id ? "var(--primary)" : "transparent"
                  }}
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
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--text-muted)] hover:bg-[var(--danger-light)] hover:text-[var(--danger-text)] transition-all"
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

  const showPermissionsSection = isAdmin;
  const isEditingAdmin = editingRow?.role === "admin" || editingRow?.role === "dev";

  const renderFormFields = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[
        { name: "full_name", label: "الاسم الكامل", required: true, ref: fullNameRef, placeholder: "مثل: محمد علي أحمد" },
        { name: "username", label: "اسم المستخدم", required: true, ref: usernameRef, placeholder: "مثل: mohamed_ali" },
        { name: "password", label: "كلمة المرور", type: "password", required: !editingRow, ref: passwordRef, placeholder: "••••••••" },
      ].map((field) => (
        <div key={field.name} className="flex flex-col gap-1.5">
          <label className="text-xs font-bold flex items-center justify-start gap-1" style={{ color: "var(--text-secondary)" }}>
            <span>{field.label}</span>
            {field.required && (
              <span className="text-xs font-black text-red-500">*</span>
            )}
          </label>
          <div className="relative">
            <input
              ref={field.ref}
              type={field.name === "password" ? (showPassword ? "text" : "password") : "text"}
              autoComplete={field.name === "password" ? "new-password" : field.name === "username" ? "username" : "off"}
              required={field.required}
              value={form[field.name] ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, [field.name]: e.target.value }))}
              onKeyDown={e => {
                const nextMap = { full_name: usernameRef, username: passwordRef, password: !editingRow ? templateRef : roleRef };
                const prevMap = { username: fullNameRef, password: usernameRef };
                handleKeyDown(e, { nextRef: nextMap[field.name], prevRef: prevMap[field.name] });
              }}
              className={`w-full h-11 rounded-lg px-4 text-xs font-bold outline-none transition-all border ${
                field.name === "password" ? "pl-10 text-left pr-4" : field.name === "username" ? "text-left pl-4 pr-4" : "text-right"
              }`}
              style={{ 
                backgroundColor: "var(--bg-surface)", 
                color: "var(--text-primary)", 
                borderColor: "var(--border-normal)",
                boxShadow: "inset 0 1.5px 3px rgba(0, 0, 0, 0.02)"
              }}
              placeholder={field.placeholder}
              dir={field.name === "full_name" ? "rtl" : "ltr"}
              onFocus={(e) => { 
                e.target.style.borderColor = "var(--primary)"; 
                e.target.style.boxShadow = "0 0 0 2px var(--primary-glow)"; 
              }}
              onBlur={(e) => { 
                e.target.style.borderColor = "var(--border-normal)"; 
                e.target.style.boxShadow = "none"; 
              }}
            />
            {field.name === "password" && (
              <button 
                type="button" 
                onClick={() => setShowPassword((v) => !v)} 
                className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center p-1 rounded-lg hover:bg-[var(--bg-input-hover)] transition-colors" 
                style={{ color: "var(--text-muted)" }} 
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Account Type Card Switcher */}
      <div className="col-span-1 md:col-span-2 lg:col-span-3 flex flex-col gap-2 mt-2">
        <label className="text-[10px] font-black tracking-widest text-right" style={{ color: "var(--text-secondary)" }}>
          نوع الحساب وصلاحيات الدور
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 select-none">
          <button
            type="button"
            onClick={() => {
              setPermTemplate("user");
              if (!editingRow) setCreateTemplate("user");
              setForm((p) => ({ ...p, role: "user" }));
            }}
            className="p-4 rounded-2xl border text-right transition-all flex items-start gap-3 cursor-pointer group outline-none"
            style={{
              backgroundColor: form.role !== "admin" ? "var(--accent-soft)" : "var(--bg-surface)",
              borderColor: form.role !== "admin" ? "var(--primary)" : "var(--border-normal)",
            }}
          >
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
              form.role !== "admin" ? "bg-[var(--primary)] text-white" : "bg-[var(--bg-input)] text-[var(--text-muted)] group-hover:text-[var(--text-primary)]"
            }`}>
              <UserIcon className="h-5 w-5" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-black" style={{ color: "var(--text-primary)" }}>موظف / مشغل نظام</span>
              <span className="text-[10px] leading-normal" style={{ color: "var(--text-muted)" }}>يخضع لصلاحيات مخصصة لكل صفحة وجزء في النظام بشكل دقيق.</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setPermTemplate("admin");
              if (!editingRow) setCreateTemplate("admin");
              setForm((p) => ({ ...p, role: "admin" }));
              const full = buildEmptyPermissions();
              Object.keys(full).forEach((k) => { full[k] = [...ALL_ACTIONS]; });
              setPermissions(full);
            }}
            className="p-4 rounded-2xl border text-right transition-all flex items-start gap-3 cursor-pointer group outline-none"
            style={{
              backgroundColor: form.role === "admin" ? "var(--accent-soft)" : "var(--bg-surface)",
              borderColor: form.role === "admin" ? "var(--primary)" : "var(--border-normal)",
            }}
          >
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
              form.role === "admin" ? "bg-[var(--primary)] text-white" : "bg-[var(--bg-input)] text-[var(--text-muted)] group-hover:text-[var(--text-primary)]"
            }`}>
              <Shield className="h-5 w-5" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-black" style={{ color: "var(--text-primary)" }}>مدير للنظام</span>
              <span className="text-[10px] leading-normal" style={{ color: "var(--text-muted)" }}>يمتلك كامل الصلاحيات والتحكم المطلق بكافة إعدادات النظام والعمليات تلقائياً.</span>
            </div>
          </button>
        </div>
      </div>

      {/* Account Settings (Active status & updates) */}
      <div className="col-span-1 md:col-span-2 lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
        {/* Status switch */}
        <div 
          className="flex items-center justify-between p-3 rounded-2xl border transition-all"
          style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-normal)" }}
        >
          <div className="flex flex-col gap-0.5 text-right">
            <span className="text-xs font-black" style={{ color: "var(--text-primary)" }}>حالة الحساب</span>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>تمكين أو تعطيل دخول المستخدم للنظام.</span>
          </div>
          <button
            type="button"
            onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))}
            className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none"
            style={{ backgroundColor: form.is_active ? "var(--primary)" : "var(--border-strong)" }}
          >
            <span
              className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-bg-surface shadow ring-0 transition duration-200 ease-in-out"
              style={{ transform: form.is_active ? "translateX(-20px)" : "translateX(0)" }}
            />
          </button>
        </div>

        {/* View Updates switch */}
        <div 
          className="flex items-center justify-between p-3 rounded-2xl border transition-all"
          style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-normal)" }}
        >
          <div className="flex flex-col gap-0.5 text-right">
            <span className="text-xs font-black" style={{ color: "var(--text-primary)" }}>مشاهدة التحديثات</span>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>السماح للمستخدم باستعراض سجل تحديثات النظام.</span>
          </div>
          <button
            type="button"
            onClick={() => setForm(p => ({ ...p, can_view_updates: !p.can_view_updates }))}
            className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none"
            style={{ backgroundColor: form.can_view_updates ? "var(--primary)" : "var(--border-strong)" }}
          >
            <span
              className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-bg-surface shadow ring-0 transition duration-200 ease-in-out"
              style={{ transform: form.can_view_updates ? "translateX(-20px)" : "translateX(0)" }}
            />
          </button>
        </div>
      </div>
    </div>
  );

  const renderPermissionsSection = (inModal) => (
    <div data-help="permissions-section" className="flex flex-col gap-4 px-6 pb-4">
      {showPermissionsSection && (
        <>
          {editingRow && !inModal && (
            <div className="border-t pt-4" style={{ borderColor: "var(--border-subtle)" }} />
          )}

          {/* Template selector */}
          <div className="flex flex-col gap-2 p-4 rounded-2xl border" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-normal)" }}>
            <span className="text-[10px] font-black uppercase tracking-wider text-right" style={{ color: "var(--text-secondary)" }}>
              اختيار وتطبيق قالب الصلاحيات السريع
            </span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "user", label: "صلاحيات موظف" },
                { id: "admin", label: "كامل الصلاحيات" },
                { id: "none", label: "بدون صلاحيات" }
              ].map((tmpl) => {
                const isActive = permTemplate === tmpl.id;
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => {
                      setPermTemplate(tmpl.id);
                      if (!editingRow) setCreateTemplate(tmpl.id);
                      
                      // Trigger template logic automatically for a premium feel
                      let nextPerms = buildEmptyPermissions();
                      if (tmpl.id === "admin") {
                        Object.keys(nextPerms).forEach((k) => { nextPerms[k] = [...ALL_ACTIONS]; });
                      } else if (tmpl.id === "user") {
                        if (serverDefaultPermissions) {
                          nextPerms = applyTemplate(serverDefaultPermissions);
                        } else {
                          nextPerms = applyTemplate(DEFAULT_USER_PERMISSIONS);
                        }
                      }
                      setPermissions(nextPerms);
                      toast.success(`تم تطبيق قالب (${tmpl.label})`);
                    }}
                    className="h-9 rounded-xl text-[10px] font-black border transition-all select-none"
                    style={{
                      backgroundColor: isActive ? "var(--primary)" : "var(--bg-input)",
                      color: isActive ? "#ffffff" : "var(--text-secondary)",
                      borderColor: isActive ? "var(--primary)" : "var(--border-normal)",
                    }}
                  >
                    {tmpl.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: "var(--text-muted)" }} />
            <input
              value={permSearch}
              onChange={(e) => setPermSearch(e.target.value)}
              placeholder="بحث في الصفحات والموديولات..."
              className="w-full h-9 rounded-lg pr-9 pl-9 text-2sm font-bold outline-none border transition-all"
              style={{ backgroundColor: "var(--bg-input)", color: "var(--text-primary)", borderColor: "var(--border-normal)" }}
            />
            {permSearch && (
              <button onClick={() => setPermSearch("")} className="absolute left-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-bg-overlay text-text-muted hover:text-text-secondary">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
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
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap transition-all shadow-sm shrink-0"
                    style={{
                      backgroundColor: isOpen
                        ? "var(--primary)"
                        : activeCount > 0
                          ? "var(--accent-soft)"
                          : "var(--bg-surface)",
                      color: isOpen
                        ? "#ffffff"
                        : activeCount > 0
                          ? "var(--primary)"
                          : "var(--text-secondary)",
                      borderColor: isOpen
                        ? "var(--primary)"
                        : activeCount > 0
                          ? "var(--border-accent)"
                          : "var(--border-normal)",
                    }}
                  >
                    <IconComponent className="h-3 w-3" />
                    <span>{cat.label.split(" ")[0]}</span>
                    <span
                      className="text-[8px] px-1.5 py-0.5 rounded font-black"
                      style={{
                        backgroundColor: isOpen ? "rgba(255,255,255,0.2)" : "var(--bg-input)",
                        color: isOpen ? "#ffffff" : "var(--text-secondary)"
                      }}
                    >
                      {activeCount}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {permLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="rounded-xl border border-border-normal bg-bg-surface p-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-bg-overlay animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-bg-overlay rounded animate-pulse w-1/3" />
                    <div className="h-2 bg-bg-overlay rounded animate-pulse w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <AnimatePresence>
                {filteredCategories.map((cat) => {
                  const IconComponent = CATEGORY_ICONS[cat.id] || Shield;
                  const isOpen = permSearch || !!expandedCats[cat.id];

                  const activeCount = cat.pages.filter(pageKey => (permissions[pageKey] || []).includes('view')).length;
                  const totalCount = cat.pages.length;

                  return (
                    <div
                      key={cat.id}
                      id={`cat-panel-${cat.id}`}
                      className="border rounded-2xl p-1.5 transition-all duration-300"
                      style={{ backgroundColor: "var(--bg-surface)", borderColor: isOpen ? "var(--border-accent)" : "var(--border-normal)" }}
                    >
                      <div
                        onClick={() => {
                          if (permSearch) return;
                          setExpandedCats(p => ({ ...p, [cat.id]: !p[cat.id] }));
                        }}
                        className="flex items-center justify-between p-3 rounded-xl cursor-pointer select-none transition-all hover:bg-[var(--bg-input-hover)]"
                        style={{
                          backgroundColor: isOpen ? "var(--bg-overlay)" : "transparent",
                          borderBottom: isOpen ? "1px solid var(--border-subtle)" : "none",
                          paddingTop: isOpen ? "14px" : undefined,
                          paddingBottom: isOpen ? "14px" : undefined,
                          marginBottom: isOpen ? "6px" : undefined
                        }}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors" style={{ backgroundColor: activeCount > 0 ? "var(--accent-soft)" : "var(--bg-overlay)", color: activeCount > 0 ? "var(--primary)" : "var(--text-muted)" }}>
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
                                className="flex h-6 px-1.5 items-center justify-center rounded-md text-[9px] font-bold transition hover:bg-[var(--bg-input-hover)]"
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
                                className="flex h-6 px-1.5 items-center justify-center rounded-md text-[9px] font-bold transition hover:bg-[var(--bg-input-hover)]"
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
                        <>
                        <div
                          className="mr-5 pr-4 rounded-xl flex flex-col gap-2.5 mt-2 py-2.5 pl-2.5"
                          style={{ borderRight: "2px dashed var(--border-subtle)", backgroundColor: "var(--bg-overlay)" }}
                        >
                          {cat.pages.map((pageKey) => {
                            if (pageKey.startsWith("report_")) {
                              const sourceId = pageKey.replace("report_", "");
                              const sourceMeta = REPORT_SOURCES.find(s => s.id === sourceId);
                              if (!sourceMeta) return null;
                              const enabled = (permissions[pageKey] || []).includes("view");
                              const status = enabled ? "full" : "blocked";
                              return (
                                <div key={pageKey} className="border transition-all duration-300 rounded-xl p-3 relative" style={{ backgroundColor: "var(--bg-surface)", borderColor: enabled ? "var(--border-accent)" : "var(--border-normal)" }}>
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <div className="flex flex-col items-start gap-0.5">
                                        <span className="text-[9px] font-black tracking-wide uppercase" style={{ color: "var(--text-muted)" }}>تقرير</span>
                                        <span className="text-2sm font-black" style={{ color: "var(--text-primary)" }}>{sourceMeta.label}</span>
                                      </div>
                                      {status === "blocked" && (
                                        <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full border" style={{ backgroundColor: "var(--danger-bg)", color: "var(--danger-text)", borderColor: "var(--danger-border)" }}>
                                          <span className="h-1 w-1 rounded-full bg-[var(--danger-text)]" />
                                          محظورة
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex p-0.5 rounded-lg border shadow-inner select-none shrink-0" style={{ backgroundColor: "var(--bg-overlay)", borderColor: "var(--border-subtle)" }}>
                                      <button
                                        type="button"
                                        onClick={() => setPermissions(prev => ({ ...prev, [pageKey]: [] }))}
                                        className="flex items-center gap-1 text-[9px] font-black px-2.5 py-1 rounded-md transition-all outline-none"
                                        style={{ backgroundColor: status === "blocked" ? "var(--danger-bg)" : "transparent", color: status === "blocked" ? "var(--danger-text)" : "var(--text-muted)", border: status === "blocked" ? "1px solid var(--danger-border)" : "1px solid transparent" }}
                                      >
                                        <Lock className="h-2.5 w-2.5" />
                                        حظر
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setPermissions(prev => ({ ...prev, [pageKey]: ["view"] }))}
                                        className="flex items-center gap-1 text-[9px] font-black px-2.5 py-1 rounded-md transition-all outline-none"
                                        style={{ backgroundColor: status === "full" ? "var(--success-bg)" : "transparent", color: status === "full" ? "var(--success-text)" : "var(--text-muted)", border: status === "full" ? "1px solid var(--success-border)" : "1px solid transparent" }}
                                      >
                                        <Check className="h-2.5 w-2.5" />
                                        مفعل
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            }

                            const meta = PAGE_PERMISSIONS[pageKey];
                            if (!meta) return null;

                            const currentActions = permissions[pageKey] || [];
                            const hasView = currentActions.includes("view");
                            const status = getPageStatus(pageKey, meta.actions);

                            return (
                              <div
                                key={pageKey}
                                className="border transition-all duration-300 rounded-xl p-3 relative"
                                style={{ 
                                  backgroundColor: "var(--bg-surface)", 
                                  borderColor: hasView ? "var(--border-accent)" : "var(--border-normal)" 
                                }}
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
                                      <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-0.5 border" style={{ backgroundColor: "var(--success-bg)", color: "var(--success-text)", borderColor: "var(--success-border)" }}>
                                        <span className="h-1 w-1 rounded-full bg-[var(--success-text)]" />
                                        كاملة
                                      </span>
                                    )}
                                    {status === "custom" && (
                                      <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-0.5 border" style={{ backgroundColor: "var(--info-bg)", color: "var(--info-text)", borderColor: "var(--info-border)" }}>
                                        <span className="h-1 w-1 rounded-full bg-[var(--info-text)]" />
                                        مخصصة
                                      </span>
                                    )}
                                    {status === "blocked" && (
                                      <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full border" style={{ backgroundColor: "var(--danger-bg)", color: "var(--danger-text)", borderColor: "var(--danger-border)" }}>
                                        <span className="h-1 w-1 rounded-full bg-[var(--danger-text)]" />
                                        محظورة
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex p-0.5 rounded-lg border shadow-inner select-none shrink-0" style={{ backgroundColor: "var(--bg-overlay)", borderColor: "var(--border-subtle)" }}>
                                    <SmartTooltip content="حظر الوصول — لا توجد صلاحيات">
                                      <button
                                        type="button"
                                        onClick={() => setPermissions(prev => ({ ...prev, [pageKey]: [] }))}
                                        className="flex items-center gap-1 text-[9px] font-black px-2.5 py-1 rounded-md transition-all outline-none"
                                        style={{ 
                                          backgroundColor: status === "blocked" ? "var(--danger-bg)" : "transparent", 
                                          color: status === "blocked" ? "var(--danger-text)" : "var(--text-muted)",
                                          border: status === "blocked" ? "1px solid var(--danger-border)" : "1px solid transparent"
                                        }}
                                      >
                                        <Lock className="h-2.5 w-2.5" />
                                        حظر
                                      </button>
                                    </SmartTooltip>
                                    <SmartTooltip content="قراءة فقط — عرض البيانات دون تعديل">
                                      <button
                                        type="button"
                                        onClick={() => setPermissions(prev => ({ ...prev, [pageKey]: ["view"] }))}
                                        className="flex items-center gap-1 text-[9px] font-black px-2.5 py-1 rounded-md transition-all outline-none"
                                        style={{ 
                                          backgroundColor: (status === "custom" && currentActions.length === 1 && currentActions.includes("view")) ? "var(--info-bg)" : "transparent", 
                                          color: (status === "custom" && currentActions.length === 1 && currentActions.includes("view")) ? "var(--info-text)" : "var(--text-muted)",
                                          border: (status === "custom" && currentActions.length === 1 && currentActions.includes("view")) ? "1px solid var(--info-border)" : "1px solid transparent"
                                        }}
                                      >
                                        <Eye className="h-2.5 w-2.5" />
                                        عرض
                                      </button>
                                    </SmartTooltip>
                                    {meta.actions.length > 1 && (
                                      <SmartTooltip content="كامل الصلاحيات — تمكين كل الإجراءات المتاحة">
                                        <button
                                          type="button"
                                          onClick={() => setPermissions(prev => ({ ...prev, [pageKey]: [...meta.actions] }))}
                                          className="flex items-center gap-1 text-[9px] font-black px-2.5 py-1 rounded-md transition-all outline-none"
                                          style={{ 
                                            backgroundColor: status === "full" ? "var(--success-bg)" : "transparent", 
                                            color: status === "full" ? "var(--success-text)" : "var(--text-muted)",
                                            border: status === "full" ? "1px solid var(--success-border)" : "1px solid transparent"
                                          }}
                                        >
                                          <Check className="h-2.5 w-2.5" />
                                          كامل
                                        </button>
                                      </SmartTooltip>
                                    )}
                                  </div>
                                </div>

                                {hasView && meta.actions.length > 1 && (
                                  <div className="flex flex-wrap gap-1.5 mt-3 pt-2.5 border-t border-dashed border-[var(--border-subtle)]">
                                    {meta.actions
                                      .filter((act) => act !== "view")
                                      .map((act) => {
                                        const checked = currentActions.includes(act);
                                        return (
                                          <SmartTooltip key={act} content={ACTION_DESCRIPTIONS[act] || ""}>
                                            <button
                                              type="button"
                                              onClick={() => toggleAction(pageKey, act)}
                                              className="h-7 px-2.5 rounded-lg text-[10px] font-black border transition-all flex items-center gap-1 select-none hover:opacity-90 outline-none"
                                              style={{ 
                                                backgroundColor: checked ? "var(--accent-soft)" : "var(--bg-overlay)", 
                                                color: checked ? "var(--primary)" : "var(--text-secondary)", 
                                                borderColor: checked ? "var(--primary)" : "var(--border-subtle)" 
                                              }}
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
                        </div>
                      </>
                      )}
                    </div>
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
        </>
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col font-sans w-full max-w-full relative pb-12" style={{ background: "linear-gradient(145deg, var(--bg-base) 0%, color-mix(in srgb, var(--primary) 3.5%, var(--bg-base)) 60%, var(--bg-surface) 100%)" }} dir="rtl">
      {/* Premium Glassmorphic Ambient Background — theme-aware */}
      <div className="fixed inset-0 pointer-events-none select-none z-0 overflow-hidden opacity-[0.95]">
        {/* Primary brand blob — top right */}
        <div 
          className="absolute -top-[10%] -right-[15%] w-[70vw] h-[70vw] max-w-[850px] rounded-full blur-[140px]" 
          style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--primary) 28%, transparent) 0%, transparent 70%)" }}
        />
        {/* Info/secondary blob — bottom left */}
        <div 
          className="absolute -bottom-[15%] -left-[10%] w-[65vw] h-[65vw] max-w-[750px] rounded-full blur-[150px]" 
          style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--primary) 14%, transparent) 0%, transparent 70%)" }}
        />
        {/* Subtle mid blob — center */}
        <div 
          className="absolute top-[25%] left-[20%] w-[55vw] h-[55vw] max-w-[650px] rounded-full blur-[130px]" 
          style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--bg-overlay) 60%, transparent) 0%, transparent 70%)" }}
        />
      </div>

      {/* Modern High-End Radial Masked Gridline Pattern */}
      <div 
        className="fixed inset-0 pointer-events-none select-none z-0 opacity-[0.55]" 
        style={{ 
          backgroundImage: `linear-gradient(to right, var(--border-normal) 1px, transparent 1px), 
                            linear-gradient(to bottom, var(--border-normal) 1px, transparent 1px)`, 
          backgroundSize: "45px 45px"
        }} 
      />

      {/* Compact header with page description (Fully Transparent) */}
      <header className="relative z-10 shrink-0 px-6 md:px-8 pt-6 pb-2" style={{ backgroundColor: "transparent" }}>
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex flex-col gap-1 text-right">
            <div className="flex items-center gap-1.5 text-[9px] font-black tracking-widest text-[var(--primary)] uppercase">
              <Database className="h-3 w-3" />
              <span>البوابة الأمنية وإدارة الرقابة</span>
            </div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>
              المستخدمون وصلاحيات الوصول
            </h1>
            <p className="text-[11px] font-bold" style={{ color: "var(--text-secondary)" }}>
              إدارة وإعداد حسابات الموظفين، تهيئة الصلاحيات، الرقابة، والأمان في موديولات النظام المختلفة.
            </p>
          </div>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => startCreate(true)}
            className="h-10 px-5 rounded-xl text-white text-xs font-black shadow-md flex items-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all"
            style={{ backgroundColor: "var(--primary)" }}
          >
            <span>+</span>
            إضافة مستخدم جديد
          </motion.button>
        </div>
      </header>

      {/* Main Layout Workspace with independent scrollings */}
      <main className="relative z-10 w-full max-w-[1600px] mx-auto px-6 md:px-8 pb-12 flex-1">
        <div className="flex flex-col lg:flex-row gap-8 w-full">

          {/* LEFT: User directory panel */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
            className="lg:w-[380px] shrink-0 flex flex-col rounded-3xl border overflow-hidden shadow-elevated backdrop-blur-md transition-all duration-300 hover:shadow-modal"
            style={{
              backgroundColor: "color-mix(in srgb, var(--bg-surface) 60%, transparent)",
              borderColor: "var(--border-subtle)",
              boxShadow: "var(--shadow-elevated), var(--card-top-highlight)"
            }}
          >
            {/* Directory header */}
            <div className="px-5 py-4 border-b flex items-center justify-between shrink-0" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-overlay)" }}>
              <div>
                <h3 className="text-sm font-black" style={{ color: "var(--text-primary)" }}>المستخدمون</h3>
                <p className="text-[11px] number-fmt font-bold mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {rows.length} مستخدم
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: "var(--accent-soft)", color: "var(--primary)" }}>
                <UsersIcon className="h-4.5 w-4.5" />
              </div>
            </div>

            {/* Directory search */}
            <div className="px-4 pt-3 pb-2 shrink-0">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: "var(--text-muted)" }} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="بحث سريع عن مستخدم..."
                  className="w-full h-10 rounded-xl pr-10 pl-9 text-xs font-bold outline-none border transition-all"
                  style={{ backgroundColor: "var(--bg-overlay)", color: "var(--text-primary)", borderColor: "var(--border-subtle)" }}
                  onFocus={(e) => { 
                    e.target.style.borderColor = "var(--primary)"; 
                    e.target.style.boxShadow = "0 0 0 2px var(--primary-glow)"; 
                  }}
                  onBlur={(e) => { 
                    e.target.style.borderColor = "var(--border-subtle)"; 
                    e.target.style.boxShadow = "none"; 
                  }}
                />
                {query && (
                  <button onClick={() => setQuery("")} className="absolute left-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-bg-overlay text-text-muted hover:text-text-secondary">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable user list with thin elegant scrollbars */}
            <div className="px-3 pb-3 space-y-3">
              {loading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="rounded-2xl border border-border-normal bg-bg-surface p-4 flex items-center gap-4">
                      <div className="h-11 w-11 rounded-xl bg-bg-overlay animate-pulse" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-bg-overlay rounded animate-pulse w-1/3" />
                        <div className="h-2 bg-bg-overlay rounded animate-pulse w-1/2" />
                      </div>
                      <div className="h-6 w-16 rounded-lg bg-bg-overlay animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : rows.length === 0 ? (
                <div className="text-center py-12 text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                  لا يوجد مستخدمين
                </div>
              ) : (
                rows
                  .filter((r) => {
                    if (!query) return true;
                    const q = query.toLowerCase();
                    return (r.full_name || "").toLowerCase().includes(q) || (r.username || "").toLowerCase().includes(q);
                  })
                  .map((user, i) => {
                    const isSelected = editingRow?.id === user.id;
                    const initials = getInitials(user.full_name);
                    const avatarStyle = getAvatarStyle(user.id);
                    const isActive = user.is_active !== 0;
                    return (
                      <motion.button
                        key={user.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.02, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
                        whileHover={{ y: -2, scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        type="button"
                        onClick={() => startEdit(user)}
                        className={`w-full flex flex-col gap-3 p-4 rounded-2xl text-right transition-all border ${isSelected
                          ? "shadow-md"
                          : "shadow-sm hover:shadow-md"
                          }`}
                        style={{
                          backgroundColor: isSelected ? "var(--accent-soft)" : "var(--bg-overlay)",
                          borderColor: isSelected ? "var(--primary)" : "var(--border-subtle)",
                        }}
                      >
                        <div className="flex items-center gap-3 w-full">
                          {/* Avatar Container */}
                          <div 
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white text-sm font-black shadow-inner relative border border-border-normal/10"
                            style={avatarStyle}
                          >
                            {initials}
                            {/* Active Status indicator dot with breathing glow */}
                            <span className="absolute -bottom-1 -left-1 flex h-3.5 w-3.5 rounded-full border-2 border-[var(--bg-surface)] items-center justify-center" style={{ backgroundColor: isActive ? "var(--primary)" : "var(--text-muted)" }}>
                              {isActive && (
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: "var(--primary)" }} />
                              )}
                            </span>
                          </div>
                          
                          {/* User Metadata */}
                          <div className="flex-1 min-w-0 text-right">
                            <div className="flex items-center gap-1.5 justify-start">
                              <span className={`text-xs font-black truncate tracking-wide ${isSelected ? "text-[var(--primary)]" : "text-[var(--text-primary)]"}`}>
                                {user.full_name || user.username}
                              </span>
                              {!isActive && (
                                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 bg-[var(--bg-overlay)] border-[var(--border-subtle)] text-[var(--text-muted)]">
                                  معطل
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-mono font-bold block mt-0.5 text-[var(--text-muted)]">
                              @{user.username}
                            </span>
                          </div>

                          {/* Role Badge */}
                          <div 
                            className="flex items-center gap-1 h-6 px-2.5 rounded-lg text-[9px] font-black border tracking-wide uppercase shrink-0"
                            style={{
                              backgroundColor: (user.role === "admin" || user.role === "dev") ? "var(--accent-soft)" : "var(--bg-surface)",
                              color: (user.role === "admin" || user.role === "dev") ? "var(--primary)" : "var(--text-secondary)",
                              borderColor: (user.role === "admin" || user.role === "dev") ? "var(--border-accent)" : "var(--border-subtle)"
                            }}
                          >
                            {(user.role === "admin" || user.role === "dev") ? <Shield className="h-2.5 w-2.5" /> : <UserIcon className="h-2.5 w-2.5" />}
                            <span>{user.role === "admin" || user.role === "dev" ? "مدير" : "موظف"}</span>
                          </div>
                        </div>

                        {/* Last Login Info */}
                        <div className="flex items-center justify-between text-[9px] font-bold w-full pt-2 border-t border-dashed border-[var(--border-subtle)] text-[var(--text-muted)]">
                          <span className="flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            <span>آخر دخول:</span>
                          </span>
                          <span className="font-mono number-fmt">
                            {user.last_login_at ? formatDateTime(user.last_login_at) : "لم يدخل بعد"}
                          </span>
                        </div>
                      </motion.button>
                    );
                  })
              )}
            </div>
          </motion.div>

          {/* RIGHT: Editor + Permissions panel */}
          <motion.div
            data-help="user-form"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.32, 0.72, 0, 1] }}
            className="flex-1 flex flex-col rounded-3xl border overflow-hidden shadow-elevated backdrop-blur-md transition-all duration-300 hover:shadow-modal"
            style={{
              backgroundColor: "color-mix(in srgb, var(--bg-surface) 80%, transparent)",
              borderColor: editingRow ? "var(--border-accent)" : "var(--border-normal)"
            }}
          >
            {/* Panel header */}
            {editingRow ? (
              <div className="px-6 py-4 border-b flex items-center justify-between shrink-0" style={{ borderColor: "var(--border-subtle)" }}>
                <div className="flex items-center gap-4">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white text-lg font-black shadow-sm"
                    style={getAvatarStyle(editingRow.id)}
                  >
                    {getInitials(editingRow.full_name)}
                  </div>
                  <div>
                    <h2 className="text-lg font-black" style={{ color: "var(--text-primary)" }}>
                      {editingRow.full_name || editingRow.username}
                    </h2>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border" style={{
                        backgroundColor: (editingRow.role === "admin" || editingRow.role === "dev") ? "var(--accent-soft)" : "var(--bg-input)",
                        color: (editingRow.role === "admin" || editingRow.role === "dev") ? "var(--primary)" : "var(--text-secondary)",
                        borderColor: "var(--border-subtle)"
                      }}>
                        {(editingRow.role === "admin" || editingRow.role === "dev") ? <Shield className="h-2.5 w-2.5" /> : <UserIcon className="h-2.5 w-2.5" />}
                        {editingRow.role}
                      </span>
                      <span className={`flex items-center gap-1 text-[10px] font-bold ${editingRow.is_active ? "text-[var(--primary)]" : "text-[var(--text-muted)]"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${editingRow.is_active ? "bg-[var(--primary)]" : "bg-[var(--text-muted)]"}`} />
                        {editingRow.is_active ? "نشط" : "غير نشط"}
                      </span>
                      <span className="text-[10px] font-mono font-bold" style={{ color: "var(--text-muted)" }}>
                        ID: {editingRow.id}
                      </span>
                    </div>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={startCreate}
                  className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors hover:bg-[var(--bg-input-hover)]"
                  style={{ backgroundColor: "var(--accent-soft)", color: "var(--text-muted)" }}
                >
                  <X className="h-4 w-4" />
                </motion.button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col p-8 overflow-y-auto scrollbar-thin text-right gap-6">
                
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
                      <svg className="h-8 w-8 relative z-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        <path d="m9 11 2 2 4-4" />
                      </svg>
                    </div>

                    <div className="flex-1 text-right">
                      <span className="text-[9px] font-black tracking-widest text-[var(--primary)] uppercase mb-1 block">
                        صلاحيات الوصول والرقابة
                      </span>
                      <h2 className="text-base font-black mb-1.5" style={{ color: "var(--text-primary)" }}>
                        بوابة حوكمة وإدارة أمان المتجر
                      </h2>
                      <p className="text-[11px] font-bold leading-relaxed text-[var(--text-secondary)]">
                        قم بتهيئة وإدارة حسابات الموظفين وتخصيص صلاحياتهم بدقة لكل صفحة وعملية في النظام. يمكنك إيقاف الحسابات مؤقتاً، وتفعيلها، وتعيين الأدوار القيادية لمتابعة عمليات الدخول بشكل آمن.
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
                        إجراءات إدارية سريعة
                      </h3>
                      <p className="text-[10px] font-bold text-[var(--text-secondary)] mt-1">
                        ابدأ بتسجيل حساب موظف جديد وتخصيص صلاحيات الوصول الخاصة به فوراً.
                      </p>
                    </div>
                    
                    <motion.button
                      whileHover={{ scale: 1.01, y: -1 }}
                      whileTap={{ scale: 0.99 }}
                      type="button"
                      onClick={() => startCreate(true)}
                      className="p-3.5 rounded-2xl border text-right flex items-center justify-between transition-all cursor-pointer group outline-none hover:bg-[var(--accent-soft)] hover:border-[var(--primary)] w-full"
                      style={{ backgroundColor: "var(--bg-overlay)", borderColor: "var(--border-normal)" }}
                    >
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-[var(--accent-soft)] text-[var(--primary)] group-hover:bg-[var(--primary)] group-hover:text-white transition-colors">
                          <UserIcon className="h-4 w-4" />
                        </div>
                        <span className="text-xs font-black text-[var(--text-primary)]">إضافة مستخدم جديد</span>
                      </div>
                      <ChevronDown className="h-3.5 w-3.5 -rotate-90 text-[var(--text-muted)] group-hover:text-[var(--primary)] transition-all transform group-hover:translate-x-[-3px]" />
                    </motion.button>
                  </div>
                </div>

                {/* Bottom Row: Summary Bento Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {[
                    { 
                      title: "إجمالي الحسابات", 
                      value: rows.length, 
                      desc: "حساب مسجل بالنظام", 
                      icon: UsersIcon, 
                      color: "var(--primary)" 
                    },
                    { 
                      title: "مدراء النظام", 
                      value: rows.filter(r => r.role === 'admin' || r.role === 'dev').length, 
                      desc: "يمتلكون صلاحيات كاملة", 
                      icon: Shield, 
                      color: "var(--info-text)" 
                    },
                    { 
                      title: "الحسابات النشطة", 
                      value: rows.filter(r => r.is_active).length, 
                      desc: "مصرح لها بتسجيل الدخول", 
                      icon: UserCheck, 
                      color: "var(--success-text)" 
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
                          <span className="text-3xl font-black font-mono tracking-tight number-fmt" style={{ color: "var(--text-primary)" }}>{metric.value}</span>
                        </div>
                        <span className="text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>{metric.desc}</span>
                        {/* Sparkline simulation lines */}
                        <div className="absolute bottom-0 inset-x-0 h-1 bg-gradient-to-l opacity-20" style={{ from: "transparent", to: metric.color }} />
                      </motion.div>
                    );
                  })}
                </div>

              </div>
            )}

            {/* Scrollable editor body with custom scrollbars (edit mode only) */}
            {editingRow && (
              <div className="flex-1 overflow-y-auto scrollbar-thin">
                {/* Account Info Card */}
                <div className="mx-5 mt-5 rounded-2xl border shadow-sm" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-normal)" }}>
                  <div className="flex items-center gap-2.5 px-5 py-3.5 border-b" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-overlay)" }}>
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--primary)] text-white">
                      <UserIcon className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-black tracking-wide" style={{ color: "var(--text-primary)" }}>بيانات الحساب الأساسية</span>
                  </div>
                  <form id="user-form" onSubmit={handleSubmit}>
                    <div className="p-5">
                      {renderFormFields()}
                    </div>
                  </form>
                </div>

                {/* Divider with icon */}
                <div className="flex items-center gap-3 px-8 my-3 select-none">
                  <div className="flex-1 h-px" style={{ backgroundColor: "var(--border-subtle)" }} />
                  <div className="flex h-6 w-6 items-center justify-center rounded-full border-2" style={{ borderColor: "var(--border-subtle)", color: "var(--text-muted)" }}>
                    <Shield className="h-3 w-3" />
                  </div>
                  <div className="flex-1 h-px" style={{ backgroundColor: "var(--border-subtle)" }} />
                </div>

                {/* Permissions Card */}
                <div className="mx-5 rounded-2xl border shadow-sm overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-normal)" }}>
                  <div className="flex items-center gap-2.5 px-5 py-3.5 border-b" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-overlay)" }}>
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: "var(--accent-soft)", color: "var(--primary)" }}>
                      <Lock className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-black tracking-wide" style={{ color: "var(--text-primary)" }}>صلاحيات الوصول والصفحات</span>
                  </div>
                  {renderPermissionsSection(false)}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </main>

      {/* === FIXED BOTTOM SAVE BAR — only when changes detected === */}
      <AnimatePresence>
        {hasChanges && editingRow && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            className="fixed bottom-8 left-1/2 z-[60] -translate-x-1/2 flex items-center gap-5 rounded-sm border border-border-normal bg-bg-surface px-5 py-3 shadow-2xl"
          >
            <span className="text-[11px] font-black uppercase tracking-widest text-text-secondary">
              تغييرات غير محفوظة
            </span>
            <motion.button
              ref={submitBtnRef}
              whileTap={{ scale: 0.98 }}
              type="submit"
              form="user-form"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 text-[11px] font-black text-white rounded-sm shadow-md transition-all active:scale-95 disabled:opacity-50 bg-primary"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {isSubmitting ? "جاري الحفظ..." : "حفظ الكل"}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unsaved-changes guard — sidebar navigation */}
      <AnimatePresence>
        {blocker.state === "blocked" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => blocker.reset?.()}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm mx-4 rounded-2xl shadow-2xl border border-border-normal bg-bg-surface overflow-hidden"
            >
              <div className="p-6 flex flex-col items-center text-center">
                <div className="h-14 w-14 rounded-full bg-warning-bg flex items-center justify-center mb-3">
                  <AlertTriangle className="h-7 w-7 text-warning-text" />
                </div>
                <h3 className="text-base font-black text-text-primary mb-1">تغييرات غير محفوظة</h3>
                <p className="text-[12px] font-bold text-text-secondary mb-5">
                  لديك تغييرات لم يتم حفظها. ماذا تريد أن تفعل؟
                </p>
                <div className="flex flex-col gap-2 w-full">
                  <button
                    onClick={async () => {
                      const fakeEvent = { preventDefault: () => {} };
                      await handleSubmit(fakeEvent);
                      blocker.proceed?.();
                    }}
                    className="w-full rounded-xl bg-primary py-2.5 text-[13px] font-black text-white transition-all active:scale-95"
                  >
                    حفظ ومغادرة
                  </button>
                  <button
                    onClick={() => blocker.proceed?.()}
                    className="w-full rounded-xl bg-danger-bg py-2.5 text-[13px] font-bold text-danger-text transition-all active:scale-95"
                  >
                    مغادرة بدون حفظ
                  </button>
                  <button
                    onClick={() => blocker.reset?.()}
                    className="w-full rounded-xl bg-bg-overlay py-2.5 text-[13px] font-bold text-text-secondary transition-all active:scale-95"
                  >
                    ابقَ في الصفحة
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unsaved-changes guard — in-page user switching */}
      <AnimatePresence>
        {showDiscardModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => { setShowDiscardModal(false); pendingActionRef.current = null; }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm mx-4 rounded-2xl shadow-2xl border border-border-normal bg-bg-surface overflow-hidden"
            >
              <div className="p-6 flex flex-col items-center text-center">
                <div className="h-14 w-14 rounded-full bg-warning-bg flex items-center justify-center mb-3">
                  <AlertTriangle className="h-7 w-7 text-warning-text" />
                </div>
                <h3 className="text-base font-black text-text-primary mb-1">تغييرات غير محفوظة</h3>
                <p className="text-[12px] font-bold text-text-secondary mb-5">
                  لديك تغييرات لم يتم حفظها. ماذا تريد أن تفعل؟
                </p>
                <div className="flex flex-col gap-2 w-full">
                  <button
                    onClick={async () => {
                      const fakeEvent = { preventDefault: () => {} };
                      await handleSubmit(fakeEvent);
                      const action = pendingActionRef.current;
                      pendingActionRef.current = null;
                      setShowDiscardModal(false);
                      setHasChanges(false);
                      if (action) action();
                    }}
                    className="w-full rounded-xl bg-primary py-2.5 text-[13px] font-black text-white transition-all active:scale-95"
                  >
                    حفظ ومغادرة
                  </button>
                  <button
                    onClick={() => {
                      const action = pendingActionRef.current;
                      pendingActionRef.current = null;
                      setShowDiscardModal(false);
                      setHasChanges(false);
                      if (action) action();
                    }}
                    className="w-full rounded-xl bg-danger-bg py-2.5 text-[13px] font-bold text-danger-text transition-all active:scale-95"
                  >
                    مغادرة بدون حفظ
                  </button>
                  <button
                    onClick={() => { setShowDiscardModal(false); pendingActionRef.current = null; }}
                    className="w-full rounded-xl bg-bg-overlay py-2.5 text-[13px] font-bold text-text-secondary transition-all active:scale-95"
                  >
                    ابقَ في الصفحة
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
              <div className="p-6 flex items-start gap-4 border-b" style={{ backgroundColor: "var(--bg-overlay)", borderColor: "var(--border-subtle)" }}>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ backgroundColor: "var(--accent-soft)" }}>
                  <AlertTriangle className="h-6 w-6" style={{ color: "var(--primary)" }} />
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
                    className="flex-1 h-11 rounded-xl text-sm font-black transition disabled:opacity-50 hover:bg-[var(--bg-input-hover)]"
                    style={{ backgroundColor: "var(--bg-overlay)", color: "var(--text-secondary)" }}
                  >
                    إلغاء
                  </button>
                  {deleteRefs ? (
                    <button
                      type="button"
                      onClick={deactivateUser}
                      disabled={deleting}
                      className="flex-1 h-11 flex items-center justify-center gap-2 rounded-xl text-white text-sm font-black transition disabled:opacity-50 hover:opacity-90"
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
                      className="flex-1 h-11 flex items-center justify-center gap-2 rounded-xl text-white text-sm font-black transition disabled:opacity-50 hover:opacity-90"
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

      {/* Create User Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => { if (!isSubmitting) setShowCreateModal(false); }}
            dir="rtl"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl flex flex-col rounded-3xl shadow-2xl border overflow-hidden"
              style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-normal)" }}
            >
              <form id="create-user-form" onSubmit={handleSubmit} className="flex flex-col max-h-[85vh]">
                <div className="px-6 py-4 border-b flex items-center justify-between shrink-0" style={{ borderColor: "var(--border-subtle)" }}>
                  <h2 className="text-lg font-black" style={{ color: "var(--text-primary)" }}>
                    إضافة مستخدم جديد
                  </h2>
                  <button
                    type="button"
                    onClick={() => { if (!isSubmitting) setShowCreateModal(false); }}
                    className="flex h-8 w-8 items-center justify-center rounded-xl transition-colors hover:bg-black/5"
                  >
                    <X className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
                  {renderFormFields()}

                  <div className="mt-6 pt-6 border-t" style={{ borderColor: "var(--border-subtle)" }}>
                    {renderPermissionsSection(true)}
                  </div>
                </div>

                <div className="px-6 py-4 border-t flex items-center justify-between shrink-0" style={{ borderColor: "var(--border-subtle)" }}>
                  <div>
                    {!createTemplate && (
                      <span className="text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>
                        * يجب اختيار نمط صلاحيات قبل الحفظ
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => { if (!isSubmitting) setShowCreateModal(false); }}
                      disabled={isSubmitting}
                      className="h-11 px-5 rounded-xl text-sm font-black transition disabled:opacity-50 hover:bg-[var(--bg-input-hover)]"
                      style={{ backgroundColor: "var(--bg-overlay)", color: "var(--text-secondary)" }}
                    >
                      إلغاء
                    </button>
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      form="create-user-form"
                      disabled={isSubmitting}
                      className="h-11 px-6 flex items-center justify-center gap-2 rounded-xl text-sm font-black text-white transition-all shadow-xl disabled:opacity-50 hover:opacity-90"
                      style={{ backgroundColor: "var(--primary)" }}
                    >
                      {isSubmitting ? (
                        "جاري الحفظ..."
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          إضافة المستخدم
                        </>
                      )}
                    </motion.button>
                  </div>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

