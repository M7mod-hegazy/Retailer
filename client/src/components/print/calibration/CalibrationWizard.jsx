import React, { useEffect, useState } from "react";
import Modal from "../../ui/Modal";
import {
  Ruler, Printer, CheckCircle2, XCircle, Scissors, DoorOpen,
  ChevronDown, ChevronUp, HelpCircle, ArrowRight, ToggleLeft, ToggleRight,
} from "lucide-react";
import toast from "react-hot-toast";
import { printContent, isElectronPrint } from "../../../services/printService";
import { resolveCalibration, saveCalibration } from "../../../services/printCalibration";

/**
 * Compute the printable band + horizontal shift from a ruler-reading test.
 * L / R are the leftmost / rightmost mm numbers the user can actually see
 * printed on the paper (measured from the paper's physical left edge).
 */
function computeBandShift(paperMm, leftMm, rightMm) {
  const L = Number(leftMm);
  const R = Number(rightMm);
  const valid = Number.isFinite(L) && Number.isFinite(R) && L >= 0 && L < R && R <= paperMm;
  const band = valid ? Math.max(1, R - L) : 0;
  const shift = valid ? L - (paperMm - band) / 2 : 0;
  return { valid, band, shift };
}

/** Left offset (mm) of a band inside the paper, clamped so it never leaves the paper. */
function bandLeftMm(paperMm, bandMm, shiftMm) {
  const centered = (paperMm - bandMm) / 2;
  const left = centered + shiftMm;
  return Math.min(Math.max(0, left), Math.max(0, paperMm - bandMm));
}

/** Ruler test page — plain black-on-white ticks every 5mm across the full paper width. */
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

/** ~40mm-tall sample receipt used to compare top-gap behavior between paper modes. */
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

/** Verification page — draws the actual computed band so the user confirms it prints whole. */
function buildVerifyHtml(paperMm, bandMm, leftMm) {
  return `
    <div style="direction:ltr; width:${paperMm}mm; box-sizing:border-box; background:#fff;">
      <div style="width:${bandMm}mm; margin-left:${leftMm}mm; margin-right:0; height:30mm; border:1px solid #000; box-sizing:border-box; position:relative; font-family:Tahoma,Arial,sans-serif;">
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

export default function CalibrationWizard({ open, onClose, printerName, sizeKey }) {
  const paperMm = parseFloat(sizeKey) || 80;
  const [step, setStep] = useState(1);
  const [leftMm, setLeftMm] = useState(0);
  const [rightMm, setRightMm] = useState(paperMm);
  const [cal, setCal] = useState(() => resolveCalibration(printerName, sizeKey));
  const [helpOpen, setHelpOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setLeftMm(0);
    setRightMm(paperMm);
    setCal(resolveCalibration(printerName, sizeKey));
  }, [open, printerName, sizeKey, paperMm]);

  const { valid, band, shift } = computeBandShift(paperMm, leftMm, rightMm);

  async function runPrint(contentHtml, docLabel) {
    if (!printerName) return;
    setBusy(true);
    try {
      await printContent({
        contentHtml,
        pageSizeStr: `${paperMm}mm auto`,
        deviceName: printerName,
        title: docLabel,
        docType: "calibration",
        docLabel,
      });
    } finally {
      setBusy(false);
    }
  }

  const printRuler = () => runPrint(buildRulerHtml(paperMm), `صفحة معايرة ${sizeKey}`);

  async function printSample(mode) {
    saveCalibration(printerName, sizeKey, { paperMode: mode });
    setCal(resolveCalibration(printerName, sizeKey));
    await runPrint(buildSampleHtml(paperMm), `عينة طباعة (${mode === "custom" ? "أ" : "ب"})`);
  }

  function choosePaperMode(mode) {
    const next = saveCalibration(printerName, sizeKey, { paperMode: mode });
    setCal(next);
    toast.success(mode === "custom" ? "تم اعتماد الوضع أ (مخصص)" : "تم اعتماد الوضع ب (الطابعة)");
  }

  const printVerify = () => runPrint(buildVerifyHtml(paperMm, band, bandLeftMm(paperMm, band, shift)), `تأكيد معايرة ${sizeKey}`);

  function confirmGood() {
    saveCalibration(printerName, sizeKey, { printAreaWidthMm: band, shiftXMm: shift });
    toast.success("تم حفظ معايرة الطابعة بنجاح");
    onClose?.();
  }

  function toggleExtra(key, value) {
    const next = saveCalibration(printerName, sizeKey, { [key]: value });
    setCal(next);
  }

  async function testEscpos(op) {
    if (!isElectronPrint() || !printerName) return;
    try {
      const res = await window.electronAPI.invoke("print:escpos-raw", { deviceName: printerName, ops: [op] });
      if (res && res.success) toast.success(op === "cut" ? "تم إرسال أمر القص" : "تم فتح الدرج");
      else toast.error((res && res.error) || "فشل تنفيذ الأمر");
    } catch (e) {
      toast.error((e && e.message) || "فشل تنفيذ الأمر");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`معايرة الطابعة — ${sizeKey}`} maxWidth="max-w-lg">
      <div className="space-y-4" dir="rtl">
        {/* Step progress */}
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className={`flex-1 h-1.5 rounded-full transition-colors ${step >= n ? "bg-primary" : "bg-[var(--bg-input)]"}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-xl border border-[var(--border-normal)] bg-[var(--bg-input)] p-3">
              <Ruler className="h-4 w-4 shrink-0 text-[var(--text-secondary)] mt-0.5" />
              <p className="text-[11px] font-bold text-[var(--text-secondary)] leading-relaxed">
                اطبع صفحة المعايرة، ثم اقرأ أصغر وأكبر رقم يظهر فعلياً على الورق (من الحافة اليسرى للورقة).
                بعض الطابعات الحرارية تطبع نطاقاً أضيق من عرض الورق نفسه أو تزيحه جانبياً.
              </p>
            </div>

            <button
              type="button" onClick={printRuler} disabled={!printerName || busy}
              className="btn btn-primary w-full disabled:opacity-50"
            >
              <Printer size={15} /> طباعة صفحة المعايرة
            </button>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-[11px] font-black text-[var(--text-secondary)] mb-1">أصغر رقم ظاهر (يسار)</span>
                <input
                  type="number" value={leftMm} min={0} max={paperMm}
                  onChange={(e) => setLeftMm(Number(e.target.value))}
                  className="w-full rounded-sm border border-[var(--border-normal)] bg-[var(--bg-input)] py-2 px-3 text-2sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--border-accent)]"
                />
              </label>
              <label className="block">
                <span className="block text-[11px] font-black text-[var(--text-secondary)] mb-1">أكبر رقم ظاهر (يمين)</span>
                <input
                  type="number" value={rightMm} min={0} max={paperMm}
                  onChange={(e) => setRightMm(Number(e.target.value))}
                  className="w-full rounded-sm border border-[var(--border-normal)] bg-[var(--bg-input)] py-2 px-3 text-2sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--border-accent)]"
                />
              </label>
            </div>

            {valid ? (
              <div className="rounded-xl border border-success-border bg-success-bg px-3 py-2 text-[11px] font-black text-success-text">
                عرض الطباعة الفعلي: {band.toFixed(1)}mm — الإزاحة: {shift >= 0 ? "+" : ""}{shift.toFixed(1)}mm
              </div>
            ) : (
              <div className="rounded-xl border border-danger-border bg-danger-bg px-3 py-2 text-[11px] font-black text-danger-text">
                أدخل رقمين صحيحين بحيث يكون الأصغر أقل من الأكبر ولا يتجاوز الأكبر عرض الورق ({paperMm}mm)
              </div>
            )}

            <button
              type="button" onClick={() => valid && setStep(2)} disabled={!valid}
              className="btn btn-primary w-full disabled:opacity-50"
            >
              التالي: اختبار الفراغ العلوي
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-[11px] font-bold text-[var(--text-secondary)] leading-relaxed">
              اطبع نفس العينة بالوضعين، ثم اختر أيهما ظهر بدون فراغ فارغ أعلى الإيصال.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => printSample("custom")} disabled={!printerName || busy}
                className="btn btn-ghost flex-col !gap-1 py-3 disabled:opacity-50">
                <Printer size={15} /> طباعة أ (مخصص)
              </button>
              <button type="button" onClick={() => printSample("driver")} disabled={!printerName || busy}
                className="btn btn-ghost flex-col !gap-1 py-3 disabled:opacity-50">
                <Printer size={15} /> طباعة ب (الطابعة)
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => choosePaperMode("custom")}
                className={`btn ${cal.paperMode === "custom" ? "btn-primary" : "btn-ghost"} py-2.5`}>
                أ: بدون فراغ علوي
              </button>
              <button type="button" onClick={() => choosePaperMode("driver")}
                className={`btn ${cal.paperMode === "driver" ? "btn-primary" : "btn-ghost"} py-2.5`}>
                ب: بدون فراغ علوي
              </button>
            </div>

            <button type="button" onClick={() => setHelpOpen((v) => !v)}
              className="w-full flex items-center justify-between text-[11px] font-black text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-1">
              <span className="flex items-center gap-1.5"><HelpCircle size={13} /> لماذا ما زال هناك فراغ؟</span>
              {helpOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            {helpOpen && (
              <div className="rounded-xl border border-[var(--border-normal)] bg-[var(--bg-input)] p-3 text-[11px] font-bold text-[var(--text-secondary)] leading-relaxed">
                باقي الفراغ العلوي عادة يأتي من إعدادات التغذية بتعريف الطابعة نفسه (وليس من هذا البرنامج).
                افتح: خصائص الطابعة ← تفضيلات ← مقاس الورق، وتأكد أن مقاس الورق المُعرَّف مطابق لعرض الرول الفعلي.
              </div>
            )}

            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(1)} className="btn btn-ghost flex-1">
                <ArrowRight size={14} className="rotate-180" /> السابق
              </button>
              <button type="button" onClick={() => setStep(3)} className="btn btn-primary flex-1">
                التالي: التأكيد
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <p className="text-[11px] font-bold text-[var(--text-secondary)] leading-relaxed">
              اطبع صفحة التأكيد وتحقق أن الإطار المربع يظهر كاملاً على الورق (وليس مقطوعاً من أي جانب).
            </p>
            <button type="button" onClick={printVerify} disabled={!printerName || busy}
              className="btn btn-primary w-full disabled:opacity-50">
              <Printer size={15} /> طباعة صفحة التأكيد
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={confirmGood}
                className="btn w-full disabled:opacity-50" style={{ background: "var(--success-text)", color: "#fff" }}>
                <CheckCircle2 size={15} /> نعم، الإطار كامل
              </button>
              <button type="button" onClick={() => setStep(1)} className="btn btn-danger w-full">
                <XCircle size={15} /> لا
              </button>
            </div>
          </div>
        )}

        {/* Extras — always visible */}
        <div className="border-t border-[var(--border-subtle)] pt-3 space-y-2">
          <h4 className="text-[11px] font-black text-[var(--text-secondary)] uppercase tracking-widest">إضافات</h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-[var(--border-normal)] bg-[var(--bg-input)] p-2.5 space-y-1.5">
              <button type="button" onClick={() => toggleExtra("escposCut", !cal.escposCut)}
                className="w-full flex items-center justify-between">
                <span className="text-[11px] font-black text-[var(--text-primary)] flex items-center gap-1.5"><Scissors size={13} /> قص تلقائي</span>
                {cal.escposCut ? <ToggleRight className="h-5 w-5 shrink-0 text-primary" /> : <ToggleLeft className="h-5 w-5 shrink-0 text-[var(--text-muted)]" />}
              </button>
              <button type="button" onClick={() => testEscpos("cut")} disabled={!isElectronPrint() || !printerName}
                className="w-full text-[10px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 py-1">
                اختبار القص
              </button>
            </div>
            <div className="rounded-xl border border-[var(--border-normal)] bg-[var(--bg-input)] p-2.5 space-y-1.5">
              <button type="button" onClick={() => toggleExtra("escposDrawer", !cal.escposDrawer)}
                className="w-full flex items-center justify-between">
                <span className="text-[11px] font-black text-[var(--text-primary)] flex items-center gap-1.5"><DoorOpen size={13} /> فتح الدرج</span>
                {cal.escposDrawer ? <ToggleRight className="h-5 w-5 shrink-0 text-primary" /> : <ToggleLeft className="h-5 w-5 shrink-0 text-[var(--text-muted)]" />}
              </button>
              <button type="button" onClick={() => testEscpos("drawer")} disabled={!isElectronPrint() || !printerName}
                className="w-full text-[10px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 py-1">
                اختبار فتح الدرج
              </button>
            </div>
          </div>
          {!isElectronPrint() && (
            <p className="text-[10px] font-bold text-[var(--text-muted)]">اختبارات القص والدرج متاحة فقط داخل تطبيق سطح المكتب.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
