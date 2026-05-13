import re

with open("client/src/pages/pos/POSPage.jsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add SearchInput import if missing
if "SearchInput" not in content:
    content = content.replace(
        "import BarcodeListener from \"../../components/pos/BarcodeListener\";",
        "import BarcodeListener from \"../../components/pos/BarcodeListener\";\nimport SearchInput from \"../../components/ui/SearchInput\";\nimport { LayoutGrid, List } from \"lucide-react\";"
    )

# 2. Add state variables
state_injection = """
  // Payment
  const [amountPaid, setAmountPaid]         = useState("");
  const [amountReceived, setAmountReceived] = useState("");
  const [selectedBankId, setSelectedBankId]         = useState("");
  const [selectedTreasuryId, setSelectedTreasuryId] = useState("");
  const [activeMultiPayments, setActiveMultiPayments] = useState([]);
  const [multiModalOpen, setMultiModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState("grid");
  const [multiCash, setMultiCash] = useState("");
  const [multiBank, setMultiBank] = useState("");
  const [multiCredit, setMultiCredit] = useState("");
"""

content = re.sub(r"  // Payment\s+const \[amountPaid,.*?setMultiModalOpen\(false\);", state_injection.strip(), content, flags=re.DOTALL)


# 3. Handle save logic for multi payment
save_invoice_logic = """
    let finalAmountPaid = 0;
    let paymentDetails = null;

    if (paymentType === "cash") {
      finalAmountPaid = totals.total;
    } else if (paymentType === "bank_transfer") {
      if (!selectedBankId) { setSaveMessage("يجب اختيار البنك / الفيزا."); return; }
      finalAmountPaid = totals.total;
      paymentDetails = { bank_id: Number(selectedBankId) };
    } else if (paymentType === "credit") {
      finalAmountPaid = Number(amountPaid) || 0;
    } else if (paymentType === "multi") {
      const c = Number(multiCash) || 0;
      const b = Number(multiBank) || 0;
      const cr = Number(multiCredit) || 0;
      const totalEntered = c + b + cr;
      if (Math.abs(totalEntered - totals.total) > 0.01) {
         setSaveMessage("يجب أن يساوي مجموع الدفعات الإجمالي المطلوب."); return;
      }
      if (b > 0 && !selectedBankId) { setSaveMessage("يجب اختيار البنك/الفيزا للدفع البنكي."); return; }
      finalAmountPaid = c + b;
      paymentDetails = {
         multi_payments: [
            ...(c > 0 ? [{ amount: c, method: "cash" }] : []),
            ...(b > 0 ? [{ amount: b, method: "bank_transfer", bank_id: Number(selectedBankId) }] : [])
         ]
      };
    }
"""

# Replace the save logic where finalAmountPaid is calculated. 
content = re.sub(
    r"\s*let finalAmountPaid = 0;.*?if \(paymentType === \"cash\"\).*?finalAmountPaid = totals\.total;\s*\}",
    save_invoice_logic,
    content,
    flags=re.DOTALL
)

# 4. In the Left Column header, replace the old search with SearchInput and Layout toggle
search_header_replacement = """
          {/* Header */}
          <div className="flex flex-col gap-3 shrink-0 bg-white border-b border-slate-200 p-4 shadow-sm z-10">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <SearchInput
                  value={detailedSearchQuery}
                  onChange={(val) => setDetailedSearchQuery(val)}
                  placeholder="ابحث بالاسم، الكود، الباركود (عربي/إنجليزي)..."
                  className="w-full text-[13px] py-2"
                />
              </div>
              <div className="flex shrink-0 bg-slate-100 rounded-md p-1 border border-slate-200">
                <button 
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded-sm transition-all ${viewMode === "grid" ? "bg-white shadow-sm text-emerald-600" : "text-slate-500 hover:text-slate-700"}`}
                  title="عرض الشبكة"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 rounded-sm transition-all ${viewMode === "list" ? "bg-white shadow-sm text-emerald-600" : "text-slate-500 hover:text-slate-700"}`}
                  title="عرض القائمة"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
              <button onClick={() => setDetailedSearchQuery("")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-slate-200 bg-white text-slate-500 hover:bg-slate-50">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
"""

content = re.sub(
    r"\s*\{\/\* Header \*\/\}\s*<div className=\"flex flex-col gap-3 shrink-0 bg-white border-b border-slate-200 p-4 shadow-sm z-10\">\s*<div className=\"flex items-center gap-3\">\s*<div className=\"relative flex-1\">.*?<RefreshCw className=\"h-4 w-4\" />\s*</button>\s*</div>",
    search_header_replacement,
    content,
    flags=re.DOTALL
)

# 5. Fix List Mode rendering
list_mode_injection = """
          {/* Main Body Toggle */}
          {viewMode === "grid" ? (
             <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
"""

# replace the Grid Body start
content = content.replace("          {/* Grid Body */}\n          <div className=\"flex-1 overflow-y-auto p-4 custom-scrollbar\">", list_mode_injection)

# replace the Grid Body end
list_mode_end_injection = """
          ) : (
             <div className="flex-1 overflow-y-auto bg-white custom-scrollbar flex flex-col">
                <DataGrid
                  data={detailedItemResults}
                  sortConfig={detailedSortConfig}
                  onSort={(k) => setDetailedSortConfig({ key: k, dir: detailedSortConfig.key === k && detailedSortConfig.dir === "asc" ? "desc" : "asc" })}
                  colWidths={detailedColWidths}
                  onResizeColumn={(k, w) => setDetailedColWidths(p => ({...p, [k]: w}))}
                  columns={[
                    { key: "image", label: "صورة", width: detailedColWidths.image, render: (r) => (
                      <div className="flex h-8 w-8 items-center justify-center rounded-md border bg-slate-50 overflow-hidden">
                         {getItemImage(r) ? <img src={getItemImage(r)} className="h-full w-full object-cover" /> : <ImageIcon className="h-4 w-4 text-slate-300"/>}
                      </div>
                    )},
                    { key: "code", label: "الكود", width: detailedColWidths.code, render: r => <span className="font-mono text-slate-500">{r.code}</span> },
                    { key: "name", label: "اسم الصنف", width: detailedColWidths.name, render: r => <span className="font-bold">{r.name}</span> },
                    { key: "price", label: "السعر", width: detailedColWidths.price, render: r => <span className="font-mono font-bold text-emerald-600">{formatMoney(r.sale_price || r.price)}</span> },
                    { key: "stock", label: "الرصيد", width: detailedColWidths.stock, render: r => <span className="font-mono">{r.stock_quantity || r.stock || 0}</span> },
                    { key: "actions", label: "", width: 60, render: r => (
                        <button onClick={() => handleGridItemClick(r)} className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100"><Plus className="h-4 w-4"/></button>
                    )}
                  ]}
                />
             </div>
          )}
"""
content = re.sub(
    r"\s*\{\/\* ── Right Column: Fixed Invoice Panel \(~35%\) ── \*\/\}\s*<div className=\"flex flex-col flex-1 max-w-\[420px\] min-w-\[340px\]",
    list_mode_end_injection + "\n\n        {/* ── Right Column: Fixed Invoice Panel (~35%) ── */}\n        <div className=\"flex flex-col flex-1 max-w-[420px] min-w-[340px]",
    content
)


# 6. Payment method tabs restriction & advanced Multi calculator
payment_tabs_replacement = """
            {/* Payment Methods */}
            <div className="flex flex-col p-3 gap-3 bg-white">
              <div className="flex gap-1.5">
                {PAYMENT_TYPES.map(({ type, label, Icon }) => {
                  const isWalkIn = !customer || customer.id === null;
                  const isDisabled = isWalkIn && type !== "cash";
                  return (
                    <button 
                      key={type} 
                      type="button" 
                      onClick={() => !isDisabled && setPaymentType(type)} 
                      disabled={isDisabled}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border px-1 py-2 text-[11px] font-black transition-all 
                        ${paymentType === type ? "border-slate-800 bg-slate-800 text-white shadow-md" : 
                          isDisabled ? "opacity-40 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400" : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-400"}`}
                      title={isDisabled ? "متاح للعملاء المسجلين فقط" : label}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" /> {label}
                    </button>
                  );
                })}
              </div>

              {/* Dynamic Payment Input */}
              {paymentType === "cash" && (
                <div className="flex gap-2 items-center">
                  <input type="number" min="0" value={amountReceived} onChange={(e) => setAmountReceived(e.target.value)} placeholder="المبلغ المستلم..." className="flex-1 rounded-sm border border-slate-300 bg-slate-50 px-3 py-2 text-[14px] font-black text-slate-800 outline-none focus:border-emerald-500 focus:bg-white shadow-inner" />
                  {Number(amountReceived) > 0 && (
                    <div className={`rounded-sm px-3 py-2 text-[12px] font-black shrink-0 ${Number(amountReceived) - totals.total >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                      الباقي: {formatMoney(Math.abs(Number(amountReceived) - totals.total))}
                    </div>
                  )}
                </div>
              )}
              {paymentType === "bank_transfer" && (
                <select value={selectedBankId} onChange={(e) => setSelectedBankId(e.target.value)} className="w-full rounded-sm border border-slate-300 bg-slate-50 px-3 py-2 text-[13px] font-black text-slate-700 outline-none focus:border-slate-800 shadow-inner">
                  <option value="">اختر البنك / البطاقة</option>
                  {banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              )}
              {paymentType === "credit" && (
                <div className="flex flex-col gap-1.5">
                  <input type="number" min="0" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} placeholder="المدفوع الآن (اختياري)" className="w-full rounded-sm border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] font-black text-amber-900 outline-none focus:border-amber-500 shadow-inner" />
                  <div className="text-[11px] font-black text-amber-700 text-center">المتبقي آجل على العميل: {formatMoney(Math.max(0, totals.total - Number(amountPaid)))}</div>
                </div>
              )}
              {paymentType === "multi" && (
                <div className="flex flex-col gap-2 p-2 bg-slate-50 border border-slate-200 rounded-md shadow-inner">
                   <div className="flex items-center gap-2">
                      <span className="text-[11px] font-black text-slate-500 w-12">نقدي:</span>
                      <input type="number" min="0" value={multiCash} onChange={(e) => setMultiCash(e.target.value)} placeholder="0.00" className="flex-1 rounded-sm border border-slate-300 px-2 py-1.5 text-[13px] font-black outline-none focus:border-emerald-500" />
                   </div>
                   <div className="flex items-center gap-2">
                      <span className="text-[11px] font-black text-slate-500 w-12">بنكي:</span>
                      <input type="number" min="0" value={multiBank} onChange={(e) => setMultiBank(e.target.value)} placeholder="0.00" className="w-24 rounded-sm border border-slate-300 px-2 py-1.5 text-[13px] font-black outline-none focus:border-emerald-500" />
                      <select value={selectedBankId} onChange={(e) => setSelectedBankId(e.target.value)} className="flex-1 rounded-sm border border-slate-300 px-2 py-1.5 text-[12px] font-bold outline-none focus:border-slate-800">
                         <option value="">اختر بنك</option>
                         {banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                   </div>
                   <div className="flex items-center gap-2">
                      <span className="text-[11px] font-black text-slate-500 w-12">آجل:</span>
                      <input type="number" min="0" value={multiCredit} onChange={(e) => setMultiCredit(e.target.value)} placeholder="0.00" className="flex-1 rounded-sm border border-amber-300 px-2 py-1.5 text-[13px] font-black text-amber-900 outline-none focus:border-amber-500 bg-amber-50" />
                   </div>
                   <div className={`mt-1 text-center text-[11px] font-black rounded-sm py-1 ${Math.abs((Number(multiCash)||0) + (Number(multiBank)||0) + (Number(multiCredit)||0) - totals.total) < 0.01 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                      الإجمالي المُدخل: {formatMoney((Number(multiCash)||0) + (Number(multiBank)||0) + (Number(multiCredit)||0))} من {formatMoney(totals.total)}
                   </div>
                </div>
              )}
"""

content = re.sub(
    r"\s*\{\/\* Payment Methods \*\/\}\s*<div className=\"flex flex-col p-3 gap-3 bg-white\">\s*<div className=\"flex gap-1.5\">.*?\{paymentType === \"credit\" && \(.*?</div>\s*\)\}\s*\{\/\* Main Actions \*\/\}",
    payment_tabs_replacement + "\n              {/* Main Actions */}",
    content,
    flags=re.DOTALL
)

with open("client/src/pages/pos/POSPage.jsx", "w", encoding="utf-8") as f:
    f.write(content)

print("POS enhancements applied successfully.")
