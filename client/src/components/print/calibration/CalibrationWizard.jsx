import React, { useEffect, useState } from "react";
import Modal from "../../ui/Modal";
import {
  Printer, CheckCircle2, XCircle, Scissors, DoorOpen,
  ArrowRight, ToggleLeft, ToggleRight, ChevronLeft,
} from "lucide-react";
import toast from "react-hot-toast";
import { printContent, isElectronPrint } from "../../../services/printService";
import { resolveCalibration, saveCalibration } from "../../../services/printCalibration";

/* ─── math helpers (unchanged) ─── */
function computeBandShift(paperMm, leftMm, rightMm) {
  const L = Number(leftMm);
  const R = Number(rightMm);
  const valid = Number.isFinite(L) && Number.isFinite(R) && L >= 0 && L < R && R <= paperMm;
  const band = valid ? Math.max(1, R - L) : 0;
  const shift = valid ? L - (paperMm - band) / 2 : 0;
  return { valid, band, shift };
}
function bandLeftMm(paperMm, bandMm, shiftMm) {
  const centered = (paperMm - bandMm) / 2;
  const left = centered + shiftMm;
  return Math.min(Math.max(0, left), Math.max(0, paperMm - bandMm));
}

/* ─── HTML builders (unchanged) ─── */
function buildRulerHtml(paperMm) {
  const ticks = [];
  for (let mm = 0; mm <= paperMm; mm += 5) {
    ticks.push(`
      <div style="position:absolute; left:${mm}mm; top:0;">
        <div style="position:absolute; top:0; left:0; transform:translateX(-50%); font-size:9px; font-weight:900; color:#000; white-space:nowrap; font-family:Tahoma,Arial,sans-serif;">${mm}</div>
        <div style="position:absolute; top:13px; left:0; width:1px; height:10px; background:#000; transform:translateX(-50%);"></div>
      </div>`);
  }
  return `
    <div style="direction:ltr; width:${paperMm}mm; box-sizing:border-box; background:#fff; color:#000; padding:2mm 0;">
      <div style="position:relative; height:26px;">${ticks.join("")}</div>
      <div style="margin-top:4mm; width:100%; height:10mm; border:1px solid #000; box-sizing:border-box; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:900; color:#000; font-family:Tahoma,Arial,sans-serif;">
        حدود الورقة
      </div>
    </div>`;
}
function buildSampleHtml(paperMm) {
  return `
    <div style="direction:rtl; width:${paperMm}mm; box-sizing:border-box; background:#fff; color:#000; font-family:Tahoma,Arial,sans-serif; padding:2mm; font-size:11px;">
      <div style="text-align:center; font-weight:900; font-size:13px;">متجر تجريبي</div>
      <div style="border-top:1px dashed #000; margin:2mm 0;"></div>
      <div style="display:flex; justify-content:space-between; padding:1mm 0;"><span>منتج ١</span><span>٢ × ١٠</span></div>
      <div style="display:flex; justify-content:space-between; padding:1mm 0;"><span>منتج ٢</span><span>١ × ٢٥</span></div>
      <div style="border-top:1px dashed #000; margin:2mm 0;"></div>
      <div style="display:flex; justify-content:space-between; font-weight:900; padding:1mm 0;"><span>الإجمالي</span><span>٤٥</span></div>
    </div>`;
}
function buildVerifyHtml(paperMm, bandMm, leftMm) {
  return `
    <div style="direction:ltr; width:${paperMm}mm; box-sizing:border-box; background:#fff;">
      <div style="width:${bandMm}mm; margin-left:${leftMm}mm; height:30mm; border:2px solid #000; box-sizing:border-box; position:relative; font-family:Tahoma,Arial,sans-serif;">
        <span style="position:absolute; top:2px; left:3px; font-size:11px; font-weight:900; color:#000;">١</span>
        <span style="position:absolute; top:2px; right:3px; font-size:11px; font-weight:900; color:#000;">٢</span>
        <span style="position:absolute; bottom:2px; right:3px; font-size:11px; font-weight:900; color:#000;">٣</span>
        <span style="position:absolute; bottom:2px; left:3px; font-size:11px; font-weight:900; color:#000;">٤</span>
        <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); font-size:11px; font-weight:900; color:#000; text-align:center; width:80%;">
          هل ترى الإطار كاملاً؟
        </div>
      </div>
    </div>`;
}

/* ─── SVG illustrations ─── */
function IllustrationIntro() {
  return (
    <svg viewBox="0 0 200 110" className="w-full h-auto" aria-hidden="true">
      {/* Printer body */}
      <rect x="40" y="45" width="120" height="50" rx="6" fill="var(--bg-overlay)" stroke="var(--border-normal)" strokeWidth="1.5" />
      {/* Printer top slot */}
      <rect x="55" y="35" width="90" height="14" rx="3" fill="var(--bg-input)" stroke="var(--border-normal)" strokeWidth="1.5" />
      {/* Paper coming out */}
      <rect x="70" y="5" width="60" height="36" rx="2" fill="#fff" stroke="var(--border-subtle)" strokeWidth="1" />
      {/* Lines on paper */}
      <line x1="78" y1="13" x2="122" y2="13" stroke="var(--text-muted)" strokeWidth="1" />
      <line x1="78" y1="19" x2="118" y2="19" stroke="var(--text-muted)" strokeWidth="1" />
      <line x1="78" y1="25" x2="112" y2="25" stroke="var(--border-subtle)" strokeWidth="0.8" />
      <line x1="78" y1="31" x2="122" y2="31" stroke="var(--border-subtle)" strokeWidth="0.8" />
      {/* Ruler marks on paper */}
      {[0,10,20,30,40,50,60].map((x,i) => (
        <g key={i}>
          <line x1={78 + x} y1="36" x2={78 + x} y2="41" stroke="var(--primary)" strokeWidth="1" />
          {i % 3 === 0 && <text x={78 + x} y="30" fontSize="4" fill="var(--primary)" textAnchor="middle">{i*5}</text>}
        </g>
      ))}
      {/* Printer button */}
      <circle cx="140" cy="70" r="5" fill="var(--primary)" opacity="0.7" />
      {/* Tray lines */}
      <line x1="55" y1="80" x2="145" y2="80" stroke="var(--border-subtle)" strokeWidth="1" strokeDasharray="3,3" />
    </svg>
  );
}

function IllustrationRuler({ paperMm, leftMm, rightMm, valid }) {
  const w = 160;
  const scale = w / paperMm;
  const L = Math.max(0, Math.min(Number(leftMm) * scale, w));
  const R = Math.max(0, Math.min(Number(rightMm) * scale, w));
  const bandW = Math.max(0, R - L);
  return (
    <svg viewBox="0 0 200 80" className="w-full h-auto" aria-hidden="true">
      {/* Paper rect */}
      <rect x="20" y="20" width={w} height="30" rx="3" fill="#fff" stroke="var(--border-normal)" strokeWidth="1.5" />
      {/* Printable band highlight */}
      {valid && <rect x={20 + L} y="20" width={bandW} height="30" rx="2" fill="var(--primary)" opacity="0.15" />}
      {/* Ruler ticks */}
      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
        const x = 20 + t * w;
        const label = Math.round(t * paperMm);
        return (
          <g key={i}>
            <line x1={x} y1="20" x2={x} y2="50" stroke="var(--border-normal)" strokeWidth="0.8" />
            <text x={x} y="62" fontSize="7" fill="var(--text-muted)" textAnchor="middle">{label}</text>
          </g>
        );
      })}
      {/* L arrow */}
      {valid && (
        <g>
          <line x1={20 + L} y1="12" x2={20 + L} y2="22" stroke="var(--success-text)" strokeWidth="1.5" />
          <text x={20 + L} y="10" fontSize="7" fill="var(--success-text)" textAnchor="middle">ش</text>
        </g>
      )}
      {/* R arrow */}
      {valid && (
        <g>
          <line x1={20 + R} y1="12" x2={20 + R} y2="22" stroke="var(--success-text)" strokeWidth="1.5" />
          <text x={20 + R} y="10" fontSize="7" fill="var(--success-text)" textAnchor="middle">ي</text>
        </g>
      )}
      {/* mm label */}
      {valid && (
        <text x={20 + L + bandW / 2} y="38" fontSize="8" fill="var(--primary)" textAnchor="middle" fontWeight="900">
          {(R / scale - L / scale).toFixed(0)}mm
        </text>
      )}
    </svg>
  );
}

function IllustrationPaperMode({ mode }) {
  const gapA = 0; // custom = no gap
  const gapB = 8;
  const activeGap = mode === "custom" ? gapA : gapB;
  return (
    <svg viewBox="0 0 200 90" className="w-full h-auto" aria-hidden="true">
      {/* Two side-by-side receipts */}
      {[
        { label: "أ", x: 20, gap: gapA, active: mode === "custom" },
        { label: "ب", x: 110, gap: gapB, active: mode === "driver" },
      ].map(({ label, x, gap, active }) => (
        <g key={label}>
          {/* Paper */}
          <rect x={x} y="10" width="70" height="70" rx="3"
            fill="#fff"
            stroke={active ? "var(--primary)" : "var(--border-normal)"}
            strokeWidth={active ? 2 : 1} />
          {/* Gap zone */}
          {gap > 0 && <rect x={x} y="10" width="70" height={gap * 2.2} rx="2" fill="var(--danger-bg)" opacity="0.5" />}
          {/* Receipt lines */}
          <line x1={x+8} y1={10+gap*2.2+6} x2={x+62} y2={10+gap*2.2+6} stroke="var(--text-muted)" strokeWidth="1" />
          <line x1={x+8} y1={10+gap*2.2+14} x2={x+55} y2={10+gap*2.2+14} stroke="var(--border-subtle)" strokeWidth="0.8" />
          <line x1={x+8} y1={10+gap*2.2+21} x2={x+62} y2={10+gap*2.2+21} stroke="var(--border-subtle)" strokeWidth="0.8" />
          {/* Label */}
          <text x={x+35} y="88" fontSize="8" fill={active ? "var(--primary)" : "var(--text-muted)"}
            textAnchor="middle" fontWeight={active ? "900" : "400"}>
            وضع {label}
          </text>
          {/* Active tick */}
          {active && <circle cx={x+62} cy="16" r="5" fill="var(--primary)" />}
          {active && <text x={x+62} y="19" fontSize="6" fill="#fff" textAnchor="middle" fontWeight="900">✓</text>}
        </g>
      ))}
      {/* Arrow between */}
      <text x="100" y="50" fontSize="10" fill="var(--text-muted)" textAnchor="middle">←</text>
    </svg>
  );
}

function IllustrationVerify({ complete }) {
  return (
    <svg viewBox="0 0 200 90" className="w-full h-auto" aria-hidden="true">
      {/* Paper */}
      <rect x="50" y="10" width="100" height="70" rx="4" fill="#fff" stroke="var(--border-normal)" strokeWidth="1.5" />
      {/* Verify frame */}
      <rect x="58" y="18" width="84" height="54" rx="2"
        fill="transparent"
        stroke={complete ? "var(--success-text)" : "var(--primary)"}
        strokeWidth="2"
        strokeDasharray={complete ? "0" : "4,2"} />
      {/* Corner numbers */}
      <text x="63" y="28" fontSize="8" fill="var(--text-secondary)" fontWeight="900">١</text>
      <text x="130" y="28" fontSize="8" fill="var(--text-secondary)" fontWeight="900">٢</text>
      <text x="130" y="67" fontSize="8" fill="var(--text-secondary)" fontWeight="900">٣</text>
      <text x="63" y="67" fontSize="8" fill="var(--text-secondary)" fontWeight="900">٤</text>
      {complete && (
        <>
          <circle cx="100" cy="45" r="14" fill="var(--success-bg)" />
          <text x="100" y="50" fontSize="14" textAnchor="middle" fill="var(--success-text)">✓</text>
        </>
      )}
      {!complete && (
        <text x="100" y="48" fontSize="8" fill="var(--text-muted)" textAnchor="middle">?</text>
      )}
    </svg>
  );
}

function IllustrationExtras({ cut, drawer }) {
  return (
    <svg viewBox="0 0 200 80" className="w-full h-auto" aria-hidden="true">
      {/* Printer */}
      <rect x="60" y="20" width="80" height="45" rx="5" fill="var(--bg-overlay)" stroke="var(--border-normal)" strokeWidth="1.5" />
      {/* Cut scissors indicator */}
      <line x1="60" y1="52" x2="140" y2="52" stroke={cut ? "var(--primary)" : "var(--border-subtle)"}
        strokeWidth={cut ? 1.5 : 1} strokeDasharray={cut ? "0" : "3,3"} />
      {cut && <text x="145" y="55" fontSize="9" fill="var(--primary)">✂</text>}
      {/* Drawer */}
      <rect x="72" y="58" width="56" height="7" rx="2"
        fill={drawer ? "var(--primary)" : "var(--bg-input)"}
        stroke={drawer ? "var(--primary)" : "var(--border-normal)"}
        strokeWidth="1" />
      {drawer && <text x="100" y="64" fontSize="6" fill="#fff" textAnchor="middle" fontWeight="900">مفتوح</text>}
      {/* Paper slot */}
      <rect x="72" y="24" width="56" height="4" rx="1" fill="var(--bg-input)" />
    </svg>
  );
}

/* ─── Step header ─── */
function StepHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-start gap-3 mb-2">
      <div className="shrink-0 flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 text-primary">
        <Icon size={18} />
      </div>
      <div>
        <h3 className="text-sm font-black text-text-primary leading-tight">{title}</h3>
        <p className="text-[11px] font-bold text-text-muted leading-relaxed mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

/* ─── Progress dots ─── */
function ProgressDots({ total, current }) {
  return (
    <div className="flex items-center justify-center gap-2 py-1">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all duration-300 ${
            i < current
              ? "w-5 h-1.5 bg-primary"
              : i === current
              ? "w-7 h-1.5 bg-primary"
              : "w-5 h-1.5 bg-bg-overlay"
          }`}
        />
      ))}
    </div>
  );
}

/* ─── Nav buttons ─── */
function NavRow({ onBack, onNext, nextLabel = "التالي", nextDisabled = false, busy = false, nextVariant = "primary" }) {
  return (
    <div className="flex gap-2 pt-1">
      {onBack && (
        <button type="button" onClick={onBack}
          className="flex items-center gap-1.5 rounded-xl border border-border-normal bg-bg-surface px-4 py-2.5 text-xs font-black text-text-secondary hover:bg-bg-base transition-all active:scale-95">
          <ArrowRight size={13} className="rotate-180" />
          السابق
        </button>
      )}
      <button type="button" onClick={onNext} disabled={nextDisabled || busy}
        className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-all active:scale-95 disabled:opacity-40 ${
          nextVariant === "success"
            ? "bg-success-bg text-success-text border border-success-border hover:opacity-90"
            : nextVariant === "danger"
            ? "bg-danger-bg text-danger-text border border-danger-border hover:opacity-90"
            : nextVariant === "ghost"
            ? "bg-bg-surface text-text-secondary border border-border-normal hover:bg-bg-base"
            : "bg-primary text-white hover:opacity-90"
        }`}>
        {busy && <div className="w-3.5 h-3.5 border-2 border-border-normal/30 border-t-white rounded-full animate-spin" />}
        {nextLabel}
      </button>
    </div>
  );
}

/* ─── Main component ─── */
const TOTAL_STEPS = 5;

export default function CalibrationWizard({ open, onClose, printerName, sizeKey }) {
  const paperMm = parseFloat(sizeKey) || 80;
  const [step, setStep] = useState(0);
  const [leftMm, setLeftMm] = useState(0);
  const [rightMm, setRightMm] = useState(paperMm);
  const [cal, setCal] = useState(() => resolveCalibration(printerName, sizeKey));
  const [busy, setBusy] = useState(false);
  const [verifyPrinted, setVerifyPrinted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setLeftMm(0);
    setRightMm(paperMm);
    setCal(resolveCalibration(printerName, sizeKey));
    setVerifyPrinted(false);
  }, [open, printerName, sizeKey, paperMm]);

  const { valid, band, shift } = computeBandShift(paperMm, leftMm, rightMm);

  async function runPrint(contentHtml, docLabel) {
    if (!printerName) return;
    setBusy(true);
    try {
      await printContent({ contentHtml, pageSizeStr: `${paperMm}mm auto`, deviceName: printerName, title: docLabel, docType: "calibration", docLabel });
    } finally { setBusy(false); }
  }

  const printRuler = () => runPrint(buildRulerHtml(paperMm), `معايرة ${sizeKey}`);

  async function printSampleMode(mode) {
    saveCalibration(printerName, sizeKey, { paperMode: mode });
    setCal(resolveCalibration(printerName, sizeKey));
    await runPrint(buildSampleHtml(paperMm), `عينة (${mode === "custom" ? "أ" : "ب"})`);
  }

  function choosePaperMode(mode) {
    const next = saveCalibration(printerName, sizeKey, { paperMode: mode });
    setCal(next);
  }

  async function printVerify() {
    await runPrint(buildVerifyHtml(paperMm, band, bandLeftMm(paperMm, band, shift)), `تأكيد ${sizeKey}`);
    setVerifyPrinted(true);
  }

  function confirmGood() {
    saveCalibration(printerName, sizeKey, { printAreaWidthMm: band, shiftXMm: shift });
    toast.success("تم حفظ إعدادات الطابعة بنجاح 🎉");
    setStep(4); // go to extras
  }

  function toggleExtra(key, value) {
    const next = saveCalibration(printerName, sizeKey, { [key]: value });
    setCal(next);
  }

  async function testEscpos(op) {
    if (!isElectronPrint() || !printerName) return;
    try {
      const res = await window.electronAPI.invoke("print:escpos-raw", { deviceName: printerName, ops: [op] });
      if (res?.success) toast.success(op === "cut" ? "تم إرسال أمر القص ✓" : "تم فتح الدرج ✓");
      else toast.error(res?.error || "فشل تنفيذ الأمر");
    } catch (e) {
      toast.error(e?.message || "فشل تنفيذ الأمر");
    }
  }

  const stepLabels = ["مقدمة", "المسطرة", "بداية الورق", "التأكيد", "إضافات"];

  return (
    <Modal open={open} onClose={onClose} title={`معايرة الطابعة — ${sizeKey}`} maxWidth="max-w-md">
      <div className="space-y-4" dir="rtl">
        {/* Progress */}
        <div>
          <ProgressDots total={TOTAL_STEPS} current={step} />
          <p className="text-center text-[10px] font-bold text-text-muted mt-1">
            {step + 1} من {TOTAL_STEPS} — {stepLabels[step]}
          </p>
        </div>

        {/* ── Step 0: Intro ── */}
        {step === 0 && (
          <div className="space-y-3">
            <StepHeader
              icon={Printer}
              title="اهلاً في معالج المعايرة"
              subtitle={`هنعاير الطابعة ${printerName || "المحددة"} بحجم ورق ${sizeKey} عشان الإيصالات تطلع صح من غير قطع أو إزاحة.`}
            />
            <IllustrationIntro />
            <div className="rounded-xl border border-border-subtle bg-bg-surface p-3 space-y-2">
              <p className="text-[11px] font-black text-text-primary">هنعمل إيه؟</p>
              <div className="space-y-1.5">
                {[
                  { n: "١", text: "نطبع صفحة مسطرة ونقرأ أرقامها" },
                  { n: "٢", text: "نجرب وضعين لتجنب الفراغ في أعلى الإيصال" },
                  { n: "٣", text: "نطبع صفحة تأكيد ونتحقق إن الإطار ظاهر كامل" },
                  { n: "٤", text: "نضبط القص التلقائي وفتح الدرج لو محتاج" },
                ].map(({ n, text }) => (
                  <div key={n} className="flex items-start gap-2">
                    <span className="shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-black mt-0.5">{n}</span>
                    <p className="text-[11px] font-bold text-text-secondary">{text}</p>
                  </div>
                ))}
              </div>
            </div>
            <NavRow
              nextLabel="يلا نبدأ"
              onNext={() => setStep(1)}
            />
          </div>
        )}

        {/* ── Step 1: Ruler ── */}
        {step === 1 && (
          <div className="space-y-3">
            <StepHeader
              icon={Printer}
              title="خطوة ١ — مساحة الطباعة"
              subtitle="الطابعة الحرارية ممكن تطبع نطاق أضيق من الورق أو تزيحه شوية. دي خطوة القياس."
            />

            {/* Visual how-to */}
            <div className="rounded-xl border border-border-subtle bg-bg-surface p-3 space-y-2">
              <p className="text-[11px] font-black text-text-primary mb-1">إزاي تقرأ المسطرة؟</p>
              <IllustrationRuler paperMm={paperMm} leftMm={leftMm} rightMm={rightMm} valid={valid} />
              <p className="text-[11px] font-bold text-text-muted leading-relaxed">
                بعد الطباعة، بص على الورقة من <span className="text-text-primary font-black">الشمال</span> — الرقم الأول اللي شايفه هو
                {" "}<span className="text-success-text font-black">اليسار (ش)</span>، والرقم الأخير هو{" "}
                <span className="text-success-text font-black">اليمين (ي)</span>.
              </p>
            </div>

            <button type="button" onClick={printRuler} disabled={!printerName || busy}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-black text-white hover:opacity-90 disabled:opacity-40 transition-all active:scale-95">
              {busy
                ? <div className="w-3.5 h-3.5 border-2 border-border-normal/30 border-t-white rounded-full animate-spin" />
                : <Printer size={14} />}
              اطبع صفحة المسطرة
            </button>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-[11px] font-black text-text-secondary mb-1">أول رقم من الشمال</span>
                <div className="relative">
                  <input type="number" value={leftMm} min={0} max={paperMm}
                    onChange={(e) => setLeftMm(Number(e.target.value))}
                    className="w-full rounded-xl border border-border-normal bg-bg-input py-2.5 px-3 pe-8 text-sm font-black text-text-primary outline-none focus:border-primary transition-colors" />
                  <span className="absolute end-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-text-muted">mm</span>
                </div>
              </label>
              <label className="block">
                <span className="block text-[11px] font-black text-text-secondary mb-1">آخر رقم من اليمين</span>
                <div className="relative">
                  <input type="number" value={rightMm} min={0} max={paperMm}
                    onChange={(e) => setRightMm(Number(e.target.value))}
                    className="w-full rounded-xl border border-border-normal bg-bg-input py-2.5 px-3 pe-8 text-sm font-black text-text-primary outline-none focus:border-primary transition-colors" />
                  <span className="absolute end-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-text-muted">mm</span>
                </div>
              </label>
            </div>

            {valid ? (
              <div className="flex items-center gap-2 rounded-xl border border-success-border bg-success-bg px-3 py-2">
                <CheckCircle2 size={14} className="shrink-0 text-success-text" />
                <p className="text-[11px] font-black text-success-text">
                  مساحة الطباعة: <span className="font-mono">{band.toFixed(1)}mm</span>
                  {shift !== 0 && <> — إزاحة: <span className="font-mono">{shift >= 0 ? "+" : ""}{shift.toFixed(1)}mm</span></>}
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-xl border border-warning-border bg-warning-bg px-3 py-2">
                <XCircle size={14} className="shrink-0 text-warning-text mt-0.5" />
                <p className="text-[11px] font-bold text-warning-text">
                  لازم الرقم الأيسر يكون أصغر من الأيمن، والأيمن ما يعدّيش {paperMm}mm
                </p>
              </div>
            )}

            <NavRow
              onBack={() => setStep(0)}
              nextLabel="التالي — اختبار الفراغ العلوي"
              nextDisabled={!valid}
              onNext={() => setStep(2)}
            />
          </div>
        )}

        {/* ── Step 2: Paper mode ── */}
        {step === 2 && (
          <div className="space-y-3">
            <StepHeader
              icon={Printer}
              title="خطوة ٢ — بداية الورق"
              subtitle="بعض الطابعات بتحط فراغ فاضي فوق الإيصال. هنجرب وضعين ونختار اللي ما فيهوش فراغ."
            />

            <IllustrationPaperMode mode={cal.paperMode} />

            {/* Print buttons */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { mode: "custom", label: "اطبع وضع أ" },
                { mode: "driver", label: "اطبع وضع ب" },
              ].map(({ mode, label }) => (
                <button key={mode} type="button" onClick={() => printSampleMode(mode)} disabled={!printerName || busy}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-border-normal bg-bg-surface px-3 py-3 text-xs font-black text-text-secondary hover:bg-bg-base hover:border-primary hover:text-primary disabled:opacity-40 transition-all active:scale-95">
                  {busy
                    ? <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    : <Printer size={16} />}
                  {label}
                </button>
              ))}
            </div>

            {/* Choose mode */}
            <div>
              <p className="text-[11px] font-black text-text-secondary mb-2">أيهما طلع بدون فراغ فوق؟</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { mode: "custom", label: "وضع أ — بدون فراغ" },
                  { mode: "driver", label: "وضع ب — بدون فراغ" },
                ].map(({ mode, label }) => (
                  <button key={mode} type="button" onClick={() => choosePaperMode(mode)}
                    className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[11px] font-black border transition-all active:scale-95 ${
                      cal.paperMode === mode
                        ? "bg-primary text-white border-primary"
                        : "bg-bg-surface text-text-secondary border-border-normal hover:border-primary hover:text-primary"
                    }`}>
                    {cal.paperMode === mode && <CheckCircle2 size={12} />}
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Persisted hint */}
            <div className="rounded-xl border border-border-subtle bg-bg-surface px-3 py-2">
              <p className="text-[10px] font-bold text-text-muted leading-relaxed">
                لو الفراغ فاضل بعد التجربة، يمكن يجي من إعدادات تعريف الطابعة نفسها.
                روح: خصائص الطابعة ← تفضيلات ← تأكد إن مقاس الورق مطابق لعرض الرول الحقيقي.
              </p>
            </div>

            <NavRow
              onBack={() => setStep(1)}
              nextLabel="التالي — طباعة التأكيد"
              onNext={() => { setVerifyPrinted(false); setStep(3); }}
            />
          </div>
        )}

        {/* ── Step 3: Verify ── */}
        {step === 3 && (
          <div className="space-y-3">
            <StepHeader
              icon={CheckCircle2}
              title="خطوة ٣ — التأكيد النهائي"
              subtitle="هنطبع إطار مربع بالمساحة اللي اتحسبت. لو الإطار ظهر كامل من الجهات الأربعة — تمام!"
            />

            <IllustrationVerify complete={verifyPrinted} />

            <button type="button" onClick={printVerify} disabled={!printerName || busy}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-black text-white hover:opacity-90 disabled:opacity-40 transition-all active:scale-95">
              {busy
                ? <div className="w-3.5 h-3.5 border-2 border-border-normal/30 border-t-white rounded-full animate-spin" />
                : <Printer size={14} />}
              اطبع صفحة التأكيد
            </button>

            {verifyPrinted && (
              <div className="space-y-2">
                <p className="text-[11px] font-black text-text-secondary text-center">الإطار ظاهر كامل من الجهات الأربعة؟</p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={confirmGood}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-success-border bg-success-bg px-3 py-2.5 text-xs font-black text-success-text hover:opacity-90 transition-all active:scale-95">
                    <CheckCircle2 size={14} />
                    آه، كامل تمام
                  </button>
                  <button type="button" onClick={() => setStep(1)}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-danger-border bg-danger-bg px-3 py-2.5 text-xs font-black text-danger-text hover:opacity-90 transition-all active:scale-95">
                    <XCircle size={14} />
                    لأ، أعيد المعايرة
                  </button>
                </div>
              </div>
            )}

            {!verifyPrinted && (
              <NavRow
                onBack={() => setStep(2)}
                nextLabel="تخطي — اطلع الإضافات"
                nextVariant="ghost"
                onNext={() => setStep(4)}
              />
            )}

            {verifyPrinted && (
              <button type="button" onClick={() => setStep(2)}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-border-normal bg-bg-surface px-4 py-2 text-xs font-black text-text-secondary hover:bg-bg-base transition-all active:scale-95">
                <ArrowRight size={13} className="rotate-180" /> رجوع
              </button>
            )}
          </div>
        )}

        {/* ── Step 4: Extras ── */}
        {step === 4 && (
          <div className="space-y-3">
            <StepHeader
              icon={Scissors}
              title="خطوة ٤ — الإضافات"
              subtitle="ضبط القص التلقائي وفتح درج النقود بعد كل طباعة."
            />

            <IllustrationExtras cut={cal.escposCut} drawer={cal.escposDrawer} />

            <div className="space-y-2">
              {/* Cut toggle */}
              <div className="rounded-xl border border-border-normal bg-bg-surface p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Scissors size={15} className="text-text-secondary" />
                    <span className="text-xs font-black text-text-primary">قص تلقائي بعد الطباعة</span>
                  </div>
                  <button type="button" onClick={() => toggleExtra("escposCut", !cal.escposCut)}
                    className="transition-all active:scale-90">
                    {cal.escposCut
                      ? <ToggleRight className="h-6 w-6 text-primary" />
                      : <ToggleLeft className="h-6 w-6 text-text-muted" />}
                  </button>
                </div>
                <p className="text-[10px] font-bold text-text-muted mb-2">
                  يبعت أمر قص ESC/POS للطابعة بعد كل إيصال — يشتغل بس على الطابعات اللي فيها قاطع.
                </p>
                <button type="button" onClick={() => testEscpos("cut")} disabled={!isElectronPrint() || !printerName}
                  className="w-full rounded-lg border border-border-subtle bg-bg-base px-3 py-1.5 text-[11px] font-black text-text-secondary hover:text-text-primary hover:border-primary disabled:opacity-40 transition-all active:scale-95">
                  اختبر القص دلوقتي
                </button>
              </div>

              {/* Drawer toggle */}
              <div className="rounded-xl border border-border-normal bg-bg-surface p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <DoorOpen size={15} className="text-text-secondary" />
                    <span className="text-xs font-black text-text-primary">فتح درج النقود</span>
                  </div>
                  <button type="button" onClick={() => toggleExtra("escposDrawer", !cal.escposDrawer)}
                    className="transition-all active:scale-90">
                    {cal.escposDrawer
                      ? <ToggleRight className="h-6 w-6 text-primary" />
                      : <ToggleLeft className="h-6 w-6 text-text-muted" />}
                  </button>
                </div>
                <p className="text-[10px] font-bold text-text-muted mb-2">
                  يبعت نبضة كهربية لفتح درج النقود أوتوماتيك بعد كل طباعة.
                </p>
                <button type="button" onClick={() => testEscpos("drawer")} disabled={!isElectronPrint() || !printerName}
                  className="w-full rounded-lg border border-border-subtle bg-bg-base px-3 py-1.5 text-[11px] font-black text-text-secondary hover:text-text-primary hover:border-primary disabled:opacity-40 transition-all active:scale-95">
                  اختبر الدرج دلوقتي
                </button>
              </div>

              {!isElectronPrint() && (
                <p className="text-[10px] font-bold text-text-muted px-1">
                  اختبارات القص والدرج شغالة بس جوه تطبيق سطح المكتب.
                </p>
              )}
            </div>

            {/* Finish */}
            <button type="button" onClick={onClose}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-black text-white hover:opacity-90 transition-all active:scale-95">
              <CheckCircle2 size={14} />
              تم — إغلاق المعالج
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
