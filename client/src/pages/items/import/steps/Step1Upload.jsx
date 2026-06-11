import React, { useState, useEffect } from "react";
import { ArrowLeft, CheckCircle2, FileSpreadsheet, Sparkles, Upload } from "lucide-react";

export default function Step1Upload({ wizard, goNext }) {
  const [fakeLoading, setFakeLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);

  const statusMessages = [
    "جاري قراءة وتحليل هيكل الملف والصفوف...",
    "فحص توافق أسماء الأعمدة مع الحقول المتاحة...",
    "مطابقة المخازن والوحدات والتحقق من التكرارات...",
    "اكتشاف صف العناوين الرئيسي وجدولة البيانات...",
    "جاري تحضير واجهة ربط الأعمدة الذكية..."
  ];

  async function handlePickedFile(event) {
    const ok = await wizard.handleFile(event);
    if (ok) {
      triggerFakeLoading();
    }
  }

  async function handleDroppedFile(event) {
    const ok = await wizard.handleDrop(event);
    if (ok) {
      triggerFakeLoading();
    }
  }

  function triggerFakeLoading() {
    setFakeLoading(true);
    setProgress(0);
    setStatusIndex(0);
  }

  useEffect(() => {
    if (!fakeLoading) return;

    const duration = 2800; // 2.8 seconds
    const intervalTime = 40;
    const increment = 100 / (duration / intervalTime);

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(() => {
            setFakeLoading(false);
            goNext?.("upload");
          }, 300);
          return 100;
        }
        
        const nextProgress = prev + increment;
        const msgIdx = Math.min(
          Math.floor((nextProgress / 100) * statusMessages.length),
          statusMessages.length - 1
        );
        setStatusIndex(msgIdx);
        
        return nextProgress;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [fakeLoading, goNext]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 md:p-10 shadow-card transition-all duration-300 hover:shadow-elevated" dir="rtl">
      {/* Fake Loading Overlay */}
      {fakeLoading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/75 p-6 text-center backdrop-blur-md animate-in fade-in duration-300">
          <div className="flex flex-col items-center max-w-sm">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-4 ring-emerald-500/10">
              <Sparkles className="h-7 w-7 animate-pulse" />
              <div className="absolute inset-[-3px] rounded-2xl border-2 border-emerald-500/10 border-t-emerald-600 animate-spin" />
            </div>
            
            <h3 className="mt-5 text-lg font-black text-slate-800 font-display">جاري تجهيز وتحليل الملف</h3>
            <p className="mt-1 text-xs font-black text-emerald-600 font-mono tracking-wide">{Math.floor(progress)}%</p>
            
            {/* Progress Bar */}
            <div className="mt-4 h-1.5 w-56 overflow-hidden rounded-full bg-slate-100 p-[1px] ring-1 ring-slate-200/50">
              <div 
                className="h-full rounded-full bg-gradient-to-l from-emerald-500 to-teal-500 transition-all duration-100 ease-out" 
                style={{ width: `${progress}%` }}
              />
            </div>
            
            {/* Dynamic Status Text */}
            <div className="mt-4 text-xs font-bold text-slate-500 transition-all duration-300 animate-in fade-in-50">
              {statusMessages[statusIndex]}
            </div>
          </div>
        </div>
      )}

      <div className={`flex flex-col items-center justify-center transition-all duration-500 ${fakeLoading ? "blur-md scale-[0.99]" : ""}`}>
        {/* Drag & Drop Container */}
        <div
          onDragEnter={(event) => { event.preventDefault(); wizard.setDragActive(true); }}
          onDragOver={(event) => { event.preventDefault(); wizard.setDragActive(true); }}
          onDragLeave={(event) => { event.preventDefault(); wizard.setDragActive(false); }}
          onDrop={handleDroppedFile}
          onClick={() => !wizard.fileName && wizard.fileInputRef.current?.click()}
          className={`group relative flex w-full max-w-2xl flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-300 ${
            wizard.fileName
              ? "border-emerald-200 bg-emerald-50/10 cursor-default"
              : wizard.dragActive 
              ? "border-emerald-500 bg-emerald-50/50 ring-4 ring-emerald-100/50 cursor-pointer" 
              : "border-slate-200 bg-slate-50/50 hover:border-slate-350 hover:bg-slate-50/80 cursor-pointer"
          }`}
        >
          {/* File Input */}
          <input ref={wizard.fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handlePickedFile} className="hidden" />

          {!wizard.fileName ? (
            <>
              {/* Icon */}
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-emerald-55 text-emerald-700 transition-transform duration-300 group-hover:scale-105 shadow-sm ring-4 ring-emerald-105/20">
                <FileSpreadsheet className="h-8 w-8" />
              </div>
              
              {/* Title & Description */}
              <h3 className="mt-5 text-xl font-black text-slate-900 font-display">ارفع ملف الأصناف</h3>
              <p className="mt-2 max-w-md text-xs font-semibold leading-relaxed text-slate-500 font-title">
                اسحب ملف Excel أو CSV وأفلته هنا، أو اضغط لاختيار ملف من جهازك
              </p>

              {/* Supported Files Info Badges */}
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <span className="rounded-lg bg-white border border-slate-200/80 px-2.5 py-1 text-[10px] font-black text-slate-500 font-mono tracking-wide">xlsx / xls / csv</span>
                <span className="rounded-lg bg-white border border-slate-200/80 px-2.5 py-1 text-[10px] font-black text-slate-500 font-mono tracking-wide">غير محدود</span>
                <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700">معالجة فورية</span>
              </div>
            </>
          ) : (
            <>
              {/* Uploaded File View */}
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 shadow-sm ring-4 ring-emerald-50">
                <CheckCircle2 className="h-7 w-7 animate-in zoom-in-50 duration-300" />
              </div>
              
              <h3 className="mt-4 text-lg font-black text-slate-900 font-display">تم قراءة الملف بنجاح</h3>
              <p className="mt-1 text-xs font-bold text-emerald-700 font-mono truncate max-w-lg" dir="ltr">{wizard.fileName}</p>
              
              {/* Stats Grid */}
              <div className="mt-5 grid grid-cols-2 gap-3 w-full max-w-sm">
                <div className="rounded-xl border border-slate-150 bg-white p-3 shadow-sm text-center">
                  <div className="text-[9px] font-black text-slate-400 font-mono tracking-wider">الأعمدة</div>
                  <div className="mt-0.5 text-sm font-black text-slate-800">{wizard.importStats.totalColumns}</div>
                </div>
                <div className="rounded-xl border border-slate-150 bg-white p-3 shadow-sm text-center">
                  <div className="text-[9px] font-black text-slate-400 font-mono tracking-wider">الصفوف</div>
                  <div className="mt-0.5 text-sm font-black text-slate-800">{wizard.importStats.totalRows}</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); wizard.fileInputRef.current?.click(); }}
                  disabled={wizard.reading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-650 shadow-sm transition-all duration-200 hover:bg-slate-50 hover:border-slate-350"
                >
                  <Upload className="h-3.5 w-3.5" /> تغيير الملف
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footnote Options */}
        <div className="mt-8 flex flex-col items-center gap-3.5">
          <p className="text-[10px] font-semibold leading-relaxed text-slate-400 text-center max-w-md">
            يرجى التأكد من أن الملف يحتوي على صف العناوين في السطر الأول. سيقوم النظام بمطابقة أعمدة الجدول تلقائياً بالخطوة التالية.
          </p>
        </div>
      </div>
    </div>
  );
}
