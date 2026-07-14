import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Printer, CheckCircle2, Wrench, Zap, Eye, TestTube, AlertTriangle } from "lucide-react";
import ChannelConnectWizard from "../whatsapp/wizard/ChannelConnectWizard";
import { listPrinters, setPrinterSizeMap, getPrinterSizeMap, isElectronPrint, printContent } from "../../services/printService";
import { resolveCalibration } from "../../services/printCalibration";
import CalibrationWizard from "./calibration/CalibrationWizard";

const PAPER_SIZES = [
  { size: "58mm", label: "58mm", subKey: "print.wizard.step2.thermal_small", color: "#f59e0b", wMm: 58 },
  { size: "80mm", label: "80mm", subKey: "print.wizard.step2.thermal_large", color: "#10b981", wMm: 80 },
  { size: "A5",   label: "A5",   subKey: "print.wizard.step2.sheet_half",  color: "#6366f1", wMm: 148 },
  { size: "A4",   label: "A4",   subKey: "print.wizard.step2.sheet_full",  color: "#3b82f6", wMm: 210 },
];

const SAMPLE_DOC_TYPES = [
  { key: "pos_receipt",   labelKey: "print.wizard.step4.pos_receipt" },
  { key: "sales_return",  labelKey: "print.wizard.step4.sales_invoice" },
  { key: "kitchen_ticket", labelKey: "print.wizard.step4.kitchen_ticket" },
];

/* ─── SVG Illustrations ─── */

function FastPrintSvg() {
  return (
    <svg width="200" height="90" viewBox="0 0 200 90" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="30" width="50" height="40" rx="6" fill="var(--success-bg)" stroke="var(--success-text)" strokeWidth="2"/>
      <text x="35" y="55" textAnchor="middle" fontSize="10" fontWeight="900" fill="var(--success-text)">F12</text>
      <path d="M65 50 L90 50" stroke="var(--success-text)" strokeWidth="2.5" strokeDasharray="4 3"/>
      <polygon points="88,45 98,50 88,55" fill="var(--success-text)"/>
      <rect x="105" y="22" width="48" height="56" rx="8" fill="var(--bg-input)" stroke="var(--border-normal)" strokeWidth="2"/>
      <rect x="111" y="28" width="36" height="3" rx="1" fill="var(--text-muted)"/>
      <rect x="111" y="35" width="28" height="2" rx="1" fill="var(--text-muted)" opacity="0.5"/>
      <rect x="111" y="41" width="32" height="2" rx="1" fill="var(--text-muted)" opacity="0.5"/>
      <rect x="111" y="50" width="20" height="2" rx="1" fill="var(--success-text)" opacity="0.7"/>
      <line x1="111" y1="58" x2="147" y2="58" stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="2 2"/>
      <rect x="111" y="62" width="36" height="8" rx="2" fill="var(--success-text)"/>
      <text x="129" y="69" textAnchor="middle" fontSize="6" fontWeight="900" fill="#fff">OK</text>
      <path d="M158 50 L175 50" stroke="var(--success-text)" strokeWidth="2.5" strokeDasharray="4 3"/>
      <polygon points="173,45 183,50 173,55" fill="var(--success-text)"/>
      <circle cx="193" cy="50" r="5" fill="var(--success-text)"/>
      <polyline points="190,50 192,53 196,47" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function PaperSizeSvg({ wMm, color }) {
  const maxW = 130, maxH = 60;
  const isRoll = wMm <= 80;
  const dw = isRoll ? Math.round((wMm / 80) * 50) : Math.round((wMm / 210) * maxW);
  const dh = isRoll ? maxH : Math.round((210 / 297) * maxH * (wMm / 210));
  const ox = (maxW + 20 - dw) / 2, oy = (maxH + 20 - dh) / 2;
  return (
    <svg width={maxW + 20} height={maxH + 20} viewBox={`0 0 ${maxW + 20} ${maxH + 20}`} fill="none">
      <rect x={ox} y={oy} width={dw} height={dh} rx={isRoll ? 3 : 2} fill={color + "18"} stroke={color} strokeWidth="2"/>
      <text x={(maxW + 20) / 2} y={(maxH + 20) / 2 + 4} textAnchor="middle" fontSize="13" fontWeight="900" fill={color}>{wMm}mm</text>
    </svg>
  );
}

function CalibrationExampleSvg() {
  return (
    <svg width="220" height="80" viewBox="0 0 220 80" fill="none">
      <rect x="10" y="10" width="200" height="60" rx="4" fill="var(--bg-input)" stroke="var(--border-normal)" strokeWidth="2"/>
      <text x="110" y="26" textAnchor="middle" fontSize="8" fontWeight="900" fill="var(--text-muted)">عرض الورق 80mm</text>
      <rect x="28" y="14" width="164" height="52" rx="2" fill="var(--success-bg)" stroke="var(--success-text)" strokeWidth="2" strokeDasharray="4 2"/>
      <text x="110" y="50" textAnchor="middle" fontSize="9" fontWeight="900" fill="var(--success-text)">المنطقة المطبوعة 72mm</text>
      <line x1="10" y1="40" x2="28" y2="40" stroke="var(--danger-text)" strokeWidth="1.5"/>
      <text x="19" y="37" textAnchor="middle" fontSize="7" fontWeight="700" fill="var(--danger-text)">4mm</text>
      <line x1="192" y1="40" x2="210" y2="40" stroke="var(--danger-text)" strokeWidth="1.5"/>
      <text x="201" y="37" textAnchor="middle" fontSize="7" fontWeight="700" fill="var(--danger-text)">4mm</text>
    </svg>
  );
}

/* ─── Helpers ─── */

function getFirstAssignedPrinter(sizePrinterMap) {
  const entries = Object.entries(sizePrinterMap);
  if (entries.length === 0) return null;
  const [size, name] = entries[0];
  return { size, name };
}

/* ─── Main Wizard Component ─── */

export default function PrinterSetupWizard({ open, onClose }) {
  const { t } = useTranslation();
  const [printers, setPrinters] = useState([]);
  const [sizePrinterMap, setSizePrinterMap] = useState(() => getPrinterSizeMap());
  const [calWizard, setCalWizard] = useState({ open: false, sizeKey: "", printerName: "" });
  const [docPrintModes, setDocPrintModes] = useState({});
  const [testState, setTestState] = useState("idle");
  const [testPrinter, setTestPrinter] = useState("");

  useEffect(() => {
    if (!open) return;
    listPrinters().then(setPrinters);
    setSizePrinterMap(getPrinterSizeMap());
    setTestState("idle");
  }, [open]);

  const handlePrinterSelect = (size, printerName) => {
    const next = { ...sizePrinterMap };
    if (printerName) next[size] = printerName;
    else delete next[size];
    setSizePrinterMap(next);
    setPrinterSizeMap(next);
  };

  const openCalibration = (sizeKey) => {
    const printerName = sizePrinterMap[sizeKey] || "";
    setCalWizard({ open: true, sizeKey, printerName });
  };

  const handleTestPrint = async () => {
    const target = sizePrinterMap["80mm"] || sizePrinterMap["58mm"] || "";
    if (!target) { setTestState("fail"); return; }
    const pSize = sizePrinterMap["80mm"] ? "80mm" : "58mm";
    setTestPrinter(target);
    setTestState("printing");
    try {
      const testHtml = pSize === "80mm"
        ? `<div style="direction:rtl; width:80mm; box-sizing:border-box; background:#fff; color:#000; font-family:Tahoma,Arial,sans-serif; padding:3mm; font-size:11px;">
            <div style="text-align:center; font-weight:900; font-size:14px; margin-bottom:2mm;">متجر تجريبي</div>
            <div style="border-top:1px dashed #000; margin:2mm 0;"></div>
            <div style="display:flex; justify-content:space-between; padding:1.5mm 0;"><span>كولا</span><span>2 × 15 = 30</span></div>
            <div style="display:flex; justify-content:space-between; padding:1.5mm 0;"><span>بيبسي</span><span>1 × 10 = 10</span></div>
            <div style="display:flex; justify-content:space-between; padding:1.5mm 0;"><span>شيبسي</span><span>3 × 8 = 24</span></div>
            <div style="border-top:1px dashed #000; margin:2mm 0;"></div>
            <div style="display:flex; justify-content:space-between; font-weight:900; font-size:13px;"><span>الإجمالي</span><span>64.00</span></div>
            <div style="display:flex; justify-content:space-between; padding:1mm 0; font-size:10px;"><span>المدفوع</span><span>70.00</span></div>
            <div style="display:flex; justify-content:space-between; padding:1mm 0; font-size:10px; font-weight:900;"><span>المباقي</span><span>6.00</span></div>
            <div style="border-top:1px dashed #000; margin:2mm 0;"></div>
            <div style="text-align:center; font-size:9px; color:#666;">شكراً لاختيارك متجرنا</div>
          </div>`
        : `<div style="direction:rtl; width:58mm; box-sizing:border-box; background:#fff; color:#000; font-family:Tahoma,Arial,sans-serif; padding:2mm; font-size:9px;">
            <div style="text-align:center; font-weight:900; font-size:11px;">متجر تجريبي</div>
            <div style="border-top:1px dashed #000; margin:1mm 0;"></div>
            <div style="display:flex; justify-content:space-between;"><span>كولا</span><span>2×15</span></div>
            <div style="display:flex; justify-content:space-between;"><span>بيبسي</span><span>1×10</span></div>
            <div style="border-top:1px dashed #000; margin:1mm 0;"></div>
            <div style="display:flex; justify-content:space-between; font-weight:900;"><span>الإجمالي</span><span>40.00</span></div>
          </div>`;
      const result = await printContent({
        contentHtml: testHtml,
        pageSizeStr: `${pSize} auto`,
        deviceName: target,
        title: "اختبار الطباعة",
        docType: "calibration",
        docLabel: "اختبار",
      });
      setTestState(result.mode === "silent" ? "success" : "dialog");
    } catch {
      setTestState("fail");
    }
  };

  const hasAnyPrinterAssigned = Object.keys(sizePrinterMap).length > 0;

  const steps = [
    /* ── Step 1: Introduction ── */
    {
      key: "intro",
      illustration: <FastPrintSvg />,
      caption: t("print.wizard.step1.caption"),
      content: (
        <div className="space-y-2 w-full">
          <div className="rounded-xl border border-success-border bg-success-bg p-3 flex items-start gap-2">
            <Zap size={14} className="text-success-text shrink-0 mt-0.5"/>
            <div>
              <div className="text-[11px] font-black text-success-text">{t("print.wizard.step1.fast_title")}</div>
              <div className="text-[10px] font-bold text-[var(--text-secondary)]">{t("print.wizard.step1.fast_desc")}</div>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border-normal)] bg-[var(--bg-input)] p-3 flex items-start gap-2">
            <Printer size={14} className="text-[var(--text-muted)] shrink-0 mt-0.5"/>
            <div>
              <div className="text-[11px] font-black text-[var(--text-secondary)]">{t("print.wizard.step1.slow_title")}</div>
              <div className="text-[10px] font-bold text-[var(--text-muted)]">{t("print.wizard.step1.slow_desc")}</div>
            </div>
          </div>
        </div>
      ),
      nextLabel: t("print.wizard.step2.title"),
      canGoNext: true,
    },
    /* ── Step 2: Pick printer per size ── */
    {
      key: "pick-printers",
      illustration: (
        <div className="grid grid-cols-2 gap-2 w-full">
          {PAPER_SIZES.map(({ size, color, wMm }) => (
            <div key={size} className="flex flex-col items-center gap-1 rounded-lg border border-[var(--border-normal)] bg-[var(--bg-input)] p-2">
              <PaperSizeSvg wMm={wMm} color={color} />
              <span className="text-[10px] font-black" style={{ color }}>{size}</span>
            </div>
          ))}
        </div>
      ),
      caption: t("print.wizard.step2.caption"),
      content: (
        <div className="space-y-3 w-full">
          {!isElectronPrint() ? (
            <div className="rounded-xl border border-[var(--warning-border)] bg-[var(--warning-bg)] p-3 flex items-start gap-2">
              <AlertTriangle size={13} className="text-[var(--warning-text)] shrink-0 mt-0.5"/>
              <div className="text-[10px] font-bold text-[var(--warning-text)]">
                {t("print.wizard.step2.connect_hint")}
              </div>
            </div>
          ) : printers.length === 0 ? (
            <div className="rounded-xl border border-[var(--border-normal)] bg-[var(--bg-input)] p-3 flex items-start gap-2">
              <AlertTriangle size={13} className="text-[var(--text-muted)] shrink-0 mt-0.5"/>
              <div>
                <div className="text-[10px] font-bold text-[var(--text-muted)]">مفيش طابعات متصلة بالجهاز دلوقتي.</div>
                <div className="text-[9px] font-bold text-[var(--text-muted)] mt-1">ممكن تكمل الخطوات الباقية وتعدّل الإعدادات بعدين لما توصل الطابعة.</div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {PAPER_SIZES.map(({ size, label, subKey, color }) => {
                const isRoll = size === "58mm" || size === "80mm";
                const assigned = sizePrinterMap[size] || "";
                const cal = isRoll && assigned ? resolveCalibration(assigned, size) : null;
                const isCalibrated = !!(cal && cal.printAreaWidthMm > 0);
                return (
                  <div key={size} className="rounded-xl border border-[var(--border-normal)] bg-[var(--bg-surface)] p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md px-2 py-0.5 text-[10px] font-black text-white" style={{ backgroundColor: color }}>{label}</span>
                        <span className="text-[9px] font-bold text-[var(--text-muted)]">{t(subKey)}</span>
                      </div>
                      {isRoll && assigned && (
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${isCalibrated ? "bg-success-bg text-success-text" : "bg-[var(--bg-input)] text-[var(--text-muted)]"}`}>
                          {isCalibrated ? `معايَر: ${cal.printAreaWidthMm}mm` : "غير معاير"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={assigned}
                        onChange={(e) => handlePrinterSelect(size, e.target.value)}
                        className="flex-1 rounded-lg border border-[var(--border-normal)] bg-[var(--bg-input)] px-2 py-1.5 text-[10px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--border-accent)]"
                      >
                        <option value="">— اختار طابعة —</option>
                        {printers.map((p) => (
                          <option key={p.name} value={p.name}>
                            {p.displayName || p.name}{p.isDefault ? " (الافتراضية)" : ""}
                          </option>
                        ))}
                      </select>
                      {isRoll && assigned && (
                        <button type="button" onClick={() => openCalibration(size)}
                          className="flex items-center gap-1 rounded-lg border border-[var(--border-normal)] bg-[var(--bg-surface)] px-2 py-1.5 text-[9px] font-black text-[var(--text-secondary)] hover:border-[var(--border-strong)] transition-all whitespace-nowrap">
                          <Wrench size={10} /> معايرة
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {!isElectronPrint() && (
            <div className="rounded-xl border border-[var(--border-normal)] bg-[var(--bg-input)] p-2 text-[9px] font-bold text-[var(--text-muted)]">
              الطابعات هتظهر هنا لما تفتح التطبيق من سطح المكتب (.exe)
            </div>
          )}
        </div>
      ),
      canGoNext: true,
    },
    /* ── Step 3: Calibration ── */
    {
      key: "calibration",
      illustration: <CalibrationExampleSvg />,
      caption: t("print.wizard.step3.caption"),
      content: (
        <div className="space-y-3 w-full">
          <div className="rounded-xl border border-[var(--border-normal)] bg-[var(--bg-input)] p-3">
            <div className="text-[10px] font-black text-[var(--text-secondary)] mb-1">{t("print.wizard.step3.example_label")}</div>
            <div className="text-[9px] font-bold text-[var(--text-muted)] leading-relaxed">{t("print.wizard.step3.example_desc")}</div>
          </div>
          {Object.entries(sizePrinterMap).filter(([sz]) => sz === "58mm" || sz === "80mm").length > 0 ? (
            <div className="space-y-2">
              {Object.entries(sizePrinterMap).filter(([sz]) => sz === "58mm" || sz === "80mm").map(([sz, printer]) => {
                const cal = resolveCalibration(printer, sz);
                const ok = !!(cal && cal.printAreaWidthMm > 0);
                const printerLabel = printers.find((p) => p.name === printer)?.displayName || printer;
                return (
                  <div key={sz} className="rounded-xl border border-[var(--border-normal)] bg-[var(--bg-surface)] p-2.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-[var(--text-primary)]">{sz}</span>
                        <span className="text-[9px] font-bold text-[var(--text-muted)] truncate max-w-[140px]">{printerLabel}</span>
                      </div>
                      {ok ? (
                        <span className="flex items-center gap-1 text-[9px] font-black text-success-text">
                          <CheckCircle2 size={11} /> معايَر
                        </span>
                      ) : (
                        <span className="text-[8px] font-black text-[var(--text-muted)]">غير معاير</span>
                      )}
                    </div>
                    {!ok && (
                      <button type="button" onClick={() => openCalibration(sz)}
                        className="w-full flex items-center justify-center gap-1 rounded-lg border border-[var(--border-accent)] bg-[var(--accent-soft)] py-1.5 text-[9px] font-black text-primary hover:bg-primary hover:text-white transition-all">
                        <Wrench size={10} /> {t("print.wizard.step3.open_wizard")} — {sz}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--border-normal)] bg-[var(--bg-input)] p-3 text-[10px] font-bold text-[var(--text-muted)]">
              مفيش طابعات حرارية معيّنة — المعايرة مش محتاجة دلوقتي.
            </div>
          )}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2 text-[9px] font-bold text-[var(--text-muted)] italic">
            {t("print.wizard.step3.skip")}
          </div>
        </div>
      ),
      canGoNext: true,
    },
    /* ── Step 4: Print mode per doc ── */
    {
      key: "print-mode",
      illustration: (
        <div className="flex gap-3">
          <div className="flex flex-col items-center gap-1 rounded-xl border border-success-border bg-success-bg p-3 w-[100px]">
            <Zap size={20} className="text-success-text" />
            <span className="text-[10px] font-black text-success-text">{t("print.wizard.step4.instant")}</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-xl border border-[var(--border-normal)] bg-[var(--bg-input)] p-3 w-[100px]">
            <Eye size={20} className="text-[var(--text-muted)]" />
            <span className="text-[10px] font-black text-[var(--text-secondary)]">{t("print.wizard.step4.preview")}</span>
          </div>
        </div>
      ),
      caption: t("print.wizard.step4.caption"),
      content: (
        <div className="space-y-2 w-full">
          {SAMPLE_DOC_TYPES.map(({ key, labelKey }) => (
            <div key={key} className="flex items-center justify-between rounded-xl border border-[var(--border-normal)] bg-[var(--bg-surface)] p-2.5">
              <span className="text-[10px] font-black text-[var(--text-primary)]">{t(labelKey)}</span>
              <div className="flex gap-1">
                <button type="button" onClick={() => setDocPrintModes((m) => ({ ...m, [key]: "instant" }))}
                  className={`rounded-lg px-3 py-1.5 text-[9px] font-black transition-all ${
                    (docPrintModes[key] || "preview") === "instant"
                      ? "bg-success-text text-white" : "bg-[var(--bg-input)] text-[var(--text-muted)] hover:bg-[var(--bg-input-hover)]"
                  }`}>
                  <Zap size={10} className="inline ml-1" />{t("print.wizard.step4.instant")}
                </button>
                <button type="button" onClick={() => setDocPrintModes((m) => ({ ...m, [key]: "preview" }))}
                  className={`rounded-lg px-3 py-1.5 text-[9px] font-black transition-all ${
                    (docPrintModes[key] || "preview") === "preview"
                      ? "bg-[var(--text-secondary)] text-white" : "bg-[var(--bg-input)] text-[var(--text-muted)] hover:bg-[var(--bg-input-hover)]"
                  }`}>
                  <Eye size={10} className="inline ml-1" />{t("print.wizard.step4.preview")}
                </button>
              </div>
            </div>
          ))}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2 text-[9px] font-bold text-[var(--text-muted)] italic">
            تقدر تغيّر أي مستند تاني من الإعدادات — دول بس أمثلة.
          </div>
        </div>
      ),
      canGoNext: true,
    },
    /* ── Step 5: Test print ── */
    {
      key: "test",
      illustration: (
        <div className="flex flex-col items-center gap-2">
          {testState === "idle" && <TestTube size={48} className="text-primary" />}
          {testState === "printing" && <Printer size={48} className="text-primary animate-pulse" />}
          {testState === "success" && <CheckCircle2 size={48} className="text-success-text" />}
          {(testState === "fail" || testState === "dialog") && <Printer size={48} className="text-danger-text" />}
        </div>
      ),
      caption: testState === "success"
        ? t("print.wizard.step5.success_desc")
        : testState === "fail"
        ? t("print.wizard.step5.fail")
        : t("print.wizard.step5.caption"),
      content: (
        <div className="flex flex-col items-center gap-3 w-full">
          {testState === "idle" && (
            <>
              {hasAnyPrinterAssigned ? (
                <button type="button" onClick={handleTestPrint} className="btn btn-primary w-full">
                  <TestTube size={15} /> {t("print.wizard.step5.print_test")}
                </button>
              ) : (
                <div className="rounded-xl border border-[var(--border-normal)] bg-[var(--bg-input)] p-3 text-center text-[10px] font-bold text-[var(--text-muted)]">
                  مفيش طابعة معيّنة — تقدر تكمل وتعدّل الإعدادات بعدين.
                </div>
              )}
            </>
          )}
          {testState === "printing" && (
            <div className="text-[11px] font-black text-primary animate-pulse">{t("print.wizard.step5.testing")}</div>
          )}
          {testState === "success" && (
            <div className="rounded-xl border border-success-border bg-success-bg p-3 text-center">
              <div className="text-[12px] font-black text-success-text">{t("print.wizard.step5.success_title")}</div>
              <div className="text-[9px] font-bold text-[var(--text-secondary)] mt-1">
                تم الطباعة من {testPrinter}
              </div>
            </div>
          )}
          {testState === "fail" && (
            <div className="space-y-2 w-full">
              <div className="rounded-xl border border-danger-border bg-danger-bg p-3 text-center">
                <div className="text-[10px] font-black text-danger-text">{t("print.wizard.step5.fail")}</div>
              </div>
              <button type="button" onClick={() => setTestState("idle")} className="btn btn-ghost w-full">
                حاول تاني
              </button>
            </div>
          )}
          {testState === "dialog" && (
            <div className="space-y-2 w-full">
              <div className="rounded-xl border border-[var(--warning-border)] bg-[var(--warning-bg)] p-3 text-center">
                <div className="text-[10px] font-black text-[var(--warning-text)]">اتفتحت نافذة الطباعة — اختار الطابعة وابدأ الطباعة.</div>
              </div>
              <button type="button" onClick={() => setTestState("idle")} className="btn btn-ghost w-full">
                حاول تاني
              </button>
            </div>
          )}
        </div>
      ),
      nextLabel: testState === "success" || testState === "dialog" ? "تم" : "تم",
      canGoNext: true,
    },
  ];

  return (
    <>
      <ChannelConnectWizard
        open={open}
        onClose={onClose}
        icon={Printer}
        title={t("print.wizard.title")}
        subtitle={t("print.wizard.subtitle")}
        accent="var(--primary)"
        steps={steps}
        cancelLabel="إلغاء"
      />
      <CalibrationWizard
        open={calWizard.open}
        onClose={() => setCalWizard({ open: false, sizeKey: "", printerName: "" })}
        printerName={calWizard.printerName}
        sizeKey={calWizard.sizeKey}
      />
    </>
  );
}
