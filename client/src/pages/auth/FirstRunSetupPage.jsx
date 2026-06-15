import React, { useState, useRef } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, User as UserIcon, Eye, EyeOff, Loader2, CheckCircle2, ShieldAlert, Crown } from "lucide-react";
import api from "../../services/api";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";

// Shown once, right after the license screen, when the app has no real
// (non-system) users yet. Creates the first administrator (full privileges)
// then hands control back to the normal login flow. Mandatory — there is no
// skip, because the app is unusable without at least one real account.
export default function FirstRunSetupPage({ onDone }) {
  const [form, setForm] = useState({ full_name: "", username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const handleKeyDown = useFieldNavigation();
  const fullNameRef = useRef(null);
  const usernameRef = useRef(null);
  const passwordRef = useRef(null);
  const submitBtnRef = useRef(null);

  async function onSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await api.post("/api/auth/setup", {
        full_name: form.full_name.trim() || form.username.trim(),
        username: form.username.trim(),
        password: form.password,
      });
      setSuccess(true);
      window.setTimeout(() => onDone?.(), 1300);
    } catch (err) {
      const code = err?.response?.data?.code;
      const serverMsg = err?.response?.data?.message;
      const MAP = {
        "Username already taken": "اسم المستخدم مستخدم بالفعل",
        "System owner username is reserved": "اسم المستخدم هذا محجوز",
      };
      if (code === "setup_already_done") {
        // Another path already created a user — just continue to login.
        onDone?.();
        return;
      }
      setError(MAP[serverMsg] || serverMsg || "تعذّر إنشاء الحساب، حاول مجدداً");
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[var(--bg-base)]" dir="rtl">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle2 className="w-11 h-11 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-black text-slate-900">تم إنشاء حساب المدير</h2>
          <p className="text-slate-400 text-sm">جاري فتح شاشة الدخول...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-y-auto bg-[var(--bg-base)] text-slate-800 font-sans" dir="rtl">
      <div className="flex min-h-full items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[520px] bg-white rounded-[2rem] border border-slate-200/70 shadow-[0_20px_60px_-10px_rgba(15,23,42,0.10)] p-8 md:p-10"
        >
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl text-emerald-600 mb-5">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h1 className="text-[26px] font-black text-slate-900 mb-2">الإعداد الأولي</h1>
            <p className="text-[15px] text-slate-500 font-medium leading-relaxed">
              لا يوجد أي مستخدم بعد. أنشئ حساب المدير الأول للنظام — سيملك كامل الصلاحيات.
            </p>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            <Field
              label="الاسم الكامل"
              icon={UserIcon}
              value={form.full_name}
              onChange={(v) => setForm((p) => ({ ...p, full_name: v }))}
              placeholder="اسم المدير"
              inputRef={fullNameRef}
              onFieldKeyDown={e => handleKeyDown(e, { nextRef: usernameRef })}
            />
            <Field
              label="اسم المستخدم"
              icon={UserIcon}
              required
              value={form.username}
              onChange={(v) => setForm((p) => ({ ...p, username: v }))}
              placeholder="username"
              dir="ltr"
              inputRef={usernameRef}
              onFieldKeyDown={e => handleKeyDown(e, { nextRef: passwordRef, prevRef: fullNameRef })}
            />
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                كلمة المرور <span className="text-emerald-600">*</span>
              </label>
              <div className="relative">
                <input
                  ref={passwordRef}
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  onKeyDown={e => handleKeyDown(e, { nextRef: submitBtnRef, prevRef: usernameRef })}
                  className="w-full h-12 bg-slate-50/80 rounded-xl px-4 pl-11 text-sm font-bold text-zinc-900 outline-none border-2 border-slate-200 focus:border-emerald-500 focus:bg-white transition-colors"
                  placeholder="••••••••"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-zinc-700"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error ? (
              <div className="p-4 rounded-xl flex items-center gap-3 bg-red-50 border border-red-200 text-red-800">
                <ShieldAlert className="w-5 h-5 shrink-0" />
                <p className="text-sm font-bold leading-relaxed">{error}</p>
              </div>
            ) : null}

            <button
              ref={submitBtnRef}
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-[var(--primary)] text-white font-black text-[16px] py-[16px] rounded-2xl hover:bg-[var(--primary-600)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  جاري الإنشاء...
                </>
              ) : (
                <>
                  <Crown className="w-5 h-5" />
                  إنشاء حساب المدير
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}

function Field({ label, icon: Icon, value, onChange, placeholder, required, dir, inputRef, onFieldKeyDown }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[11px] font-black uppercase tracking-widest text-slate-500">
        {label} {required && <span className="text-emerald-600">*</span>}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onFieldKeyDown}
          className="w-full h-12 bg-slate-50/80 rounded-xl px-4 pr-11 text-sm font-bold text-zinc-900 outline-none border-2 border-slate-200 focus:border-emerald-500 focus:bg-white transition-colors"
          placeholder={placeholder}
          dir={dir}
        />
        <Icon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
      </div>
    </div>
  );
}
