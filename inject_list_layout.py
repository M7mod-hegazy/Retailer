import re

with open("client/src/pages/pos/POSPage.jsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update detailedItemResults to use fuzzyFilterRows
detailed_item_replacement = """  const detailedItemResults = useMemo(() => {
    const q = (detailedSearchQuery || itemNameQuery || itemCodeQuery).trim();
    let source = q
      ? fuzzyFilterRows(items, q, ["name", "code", "barcode", "category_name"])
      : items;
    if (detailedCategoryFilter !== "all")
      source = source.filter((item) => String(item.category_name || "غير مصنف") === detailedCategoryFilter);
    if (detailedSortConfig.key) {
"""
content = re.sub(
    r"\s*const detailedItemResults = useMemo\(\(\) => \{\s*const q = \(detailedSearchQuery \|\| itemNameQuery \|\| itemCodeQuery\)\.trim\(\)\.toLowerCase\(\);\s*let source = q.*?if \(detailedCategoryFilter !== \"all\"\)\s*source = source\.filter\(\(item\) => String\(item\.category_name \|\| \"غير مصنف\"\) === detailedCategoryFilter\);\s*if \(detailedSortConfig\.key\) \{",
    detailed_item_replacement,
    content,
    flags=re.DOTALL
)

# 2. Add the List View Layout
# We need to completely replace the viewMode === "list" block and the Right Column (since the Right Column shouldn't render in list mode!)
# Wait, the best way to do this is to replace the entire return body!

# Let's find the start of `return (`
start_return_idx = content.find("  return (\n    <div className=\"flex h-screen")

if start_return_idx != -1:
    before_return = content[:start_return_idx]
    
    # Generate the return block logic
    return_block = """  if (viewMode === "list") {
    return (
      <div className="flex h-screen flex-col bg-slate-50 font-sans overflow-hidden" dir="rtl">
        <BarcodeListener />
        {navLockVisible && <NavLockModal onProceed={navProceed} onCancel={navCancel} />}
        {isOffline && (
          <div className="flex items-center justify-center gap-2 bg-rose-600 px-4 py-1.5 text-center text-[12px] font-black tracking-wide text-white shrink-0 z-50">
            <AlertTriangle className="h-3.5 w-3.5" />
            لا يوجد اتصال بالشبكة — سيتم التزامن تلقائياً عند الاتصال
          </div>
        )}

        {/* Header like purchases/new */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-300 bg-white px-6 z-40">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <h1 className="text-[14px] font-black text-slate-800">فاتورة مبيعات جديدة</h1>
              <span className="text-[10px] font-bold text-slate-400">نقطة البيع - القائمة</span>
            </div>
            <div className="flex shrink-0 bg-slate-100 rounded-md p-1 border border-slate-200 mr-4">
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
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => window.print()}
              className="flex h-9 items-center gap-2 rounded-sm border border-slate-300 bg-white px-4 text-[13px] font-black text-slate-700 hover:bg-slate-50 transition-all"
            >
              <Printer className="h-4 w-4" /> طباعة
            </button>
            <button
              onClick={() => saveInvoice(false)}
              disabled={isSaving || !lines.length}
              className="flex h-9 items-center gap-2 rounded-sm bg-slate-800 px-6 text-[13px] font-black text-white hover:bg-slate-700 disabled:opacity-50 transition-all"
            >
              {isSaving ? "جاري الحفظ..." : "حفظ الفاتورة (F9)"}
            </button>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 gap-4 p-4 overflow-hidden" style={{ filter: !shift ? "blur(6px)" : "none", opacity: !shift ? 0.4 : 1, pointerEvents: !shift ? "none" : "auto" }}>
          
          {/* Right Sidebar (Customer, Summary, Payment) */}
          <aside className="w-[280px] shrink-0 flex flex-col gap-3 overflow-y-auto custom-scrollbar">
            {/* Customer Card */}
            <div className="rounded-md border border-slate-300 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">العميل</h3>
              </div>
              <div className="flex flex-col gap-2">
                <div className="relative">
                  <User className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    ref={customerInputRef}
                    type="text"
                    value={(!customer && !customerQuery) ? "زبون نقدي" : customerQuery}
                    onChange={(e) => { setCustomerQuery(e.target.value); setCustomerLookupOpen(true); }}
                    onFocus={(e) => { setCustomerLookupOpen(true); e.target.select(); }}
                    onBlur={() => setTimeout(() => setCustomerLookupOpen(false), 200)}
                    placeholder="ابحث برقم الهاتف أو الاسم..."
                    className="w-full rounded-sm border border-slate-300 bg-white py-2 pl-3 pr-9 text-[12px] font-bold text-slate-800 outline-none focus:border-slate-800"
                  />
                  {customerLookupOpen && (
                    <LookupList
                      items={customerResults}
                      onPick={handlePickCustomer}
                      activeIndex={activeCustomerIndex}
                      query={customerQuery}
                      emptyLabel="لم يتم العثور على عميل"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Invoice Summary */}
            <div className="rounded-md border border-slate-300 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-[11px] font-black text-slate-400 uppercase tracking-widest border-b pb-2 border-slate-100">ملخص الفاتورة</h3>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold text-slate-500">إجمالي الأصناف</span>
                  <span className="text-[12px] font-black text-slate-800">{lines.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold text-slate-500">مجموع الكميات</span>
                  <span className="text-[12px] font-black text-slate-800">{lines.reduce((acc, l) => acc + Number(l.quantity), 0)}</span>
                </div>
                <div className="h-px bg-slate-100" />
                <div className="mt-3 rounded-sm bg-slate-900 p-4 text-center text-white">
                  <div className="text-[10px] font-bold opacity-60 uppercase tracking-widest">إجمالي المستحق</div>
                  <div className="text-[26px] font-black tracking-tighter font-mono">
                    {totals.total.toLocaleString("ar-EG", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] opacity-40">ج.م</div>
                </div>
              </div>
            </div>

            {/* Payment Method */}
            <div className="rounded-md border border-slate-300 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-[11px] font-black text-slate-400 uppercase tracking-widest">طريقة الدفع</h3>
              <div className="space-y-2">
                {PAYMENT_TYPES.map(({ type, label, Icon }) => {
                  const isWalkIn = !customer || customer.id === null;
                  const isDisabled = isWalkIn && type !== "cash";
                  return (
                    <button
                      key={type}
                      onClick={() => !isDisabled && setPaymentType(type)}
                      disabled={isDisabled}
                      title={isDisabled ? "يجب اختيار عميل مسجل أولاً" : undefined}
                      className={`flex w-full items-center gap-3 rounded-sm border p-3 text-right transition-all ${
                        paymentType === type
                          ? "border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm"
                          : isDisabled
                            ? "border-slate-200 opacity-40 cursor-not-allowed bg-slate-50 text-slate-400"
                            : "border-slate-200 hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <div className="flex flex-col">
                        <span className="text-[12px] font-black">{label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* Main Content (Entry & Grid) */}
          <div className="flex flex-1 flex-col gap-3 min-w-0 overflow-hidden">
            {/* Quick Entry Bar */}
            <section className="rounded-md border border-slate-300 bg-white p-3 shadow-sm shrink-0">
              <div className="grid grid-cols-[3fr_110px_80px_100px_80px] gap-2 items-end">
                {/* Item search */}
                <div className="relative flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-600">الصنف</label>
                  <div className="relative">
                    <SearchInput
                      value={itemNameQuery}
                      onChange={(val) => { setItemNameQuery(val); setItemLookupOpen(true); setSelectedItem(null); }}
                      onFocus={(e) => { setItemLookupOpen(true); e.target.select(); }}
                      onBlur={() => setTimeout(() => setItemLookupOpen(false), 200)}
                      placeholder="ابحث بالاسم، الباركود، أو الكود..."
                      onKeyDown={(e) => {
                         if (e.key === "Enter" && itemResults.length > 0) {
                            e.preventDefault();
                            handleSelectItem(itemResults[activeLookupIndex]);
                            setTimeout(() => priceInputRef.current?.focus(), 50);
                         } else if (e.key === "ArrowDown") {
                            e.preventDefault();
                            setActiveLookupIndex(prev => (prev < itemResults.length - 1 ? prev + 1 : prev));
                         } else if (e.key === "ArrowUp") {
                            e.preventDefault();
                            setActiveLookupIndex(prev => (prev > 0 ? prev - 1 : 0));
                         }
                      }}
                    />
                    {itemLookupOpen && (
                      <LookupList
                        items={itemResults}
                        onPick={(i) => { handleSelectItem(i); setTimeout(() => priceInputRef.current?.focus(), 50); }}
                        activeIndex={activeLookupIndex}
                        query={itemNameQuery}
                      />
                    )}
                  </div>
                </div>

                {/* Qty */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-600">الكمية</label>
                  <input
                    ref={qtyInputRef}
                    type="number"
                    min="0.001"
                    step="any"
                    value={staging.quantity}
                    onChange={(e) => setStaging(s => ({ ...s, quantity: e.target.value }))}
                    onFocus={e => e.target.select()}
                    onKeyDown={(e) => { if(e.key === "Enter") priceInputRef.current?.focus(); }}
                    className="w-full h-[37px] border border-slate-300 rounded-sm bg-slate-50 py-2 px-2 text-[12px] font-black text-slate-800 outline-none focus:border-slate-800 text-center"
                  />
                </div>

                {/* Price */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-600">السعر</label>
                  <input
                    ref={priceInputRef}
                    type="number"
                    step="any"
                    value={staging.unitPrice}
                    onChange={(e) => setStaging(s => ({ ...s, unitPrice: e.target.value }))}
                    onFocus={e => e.target.select()}
                    onKeyDown={(e) => { if(e.key === "Enter") addLine(); }}
                    className="w-full h-[37px] border border-slate-300 rounded-sm bg-slate-50 py-2 px-2 text-[12px] font-black text-slate-800 outline-none focus:border-slate-800 text-center"
                  />
                </div>

                {/* Add */}
                <button
                  onClick={addLine}
                  disabled={!selectedItem}
                  className="flex h-[37px] items-center justify-center gap-1.5 rounded-sm bg-slate-800 px-3 text-[12px] font-black text-white hover:bg-slate-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors"
                >
                  <Plus className="h-4 w-4" /> إضافة
                </button>
              </div>
            </section>

            {/* Cart DataGrid */}
            <section className="flex-1 rounded-md border border-slate-300 bg-white shadow-sm overflow-hidden flex flex-col min-h-0">
              <DataGrid
                data={lines}
                columns={[
                  { key: "index", label: "#", width: 40, render: (_, i) => <span className="font-mono text-slate-400 text-[10px]">{i + 1}</span> },
                  { key: "name", label: "الصنف", width: 300, render: (l) => <span className="font-bold text-[12px]">{l.name}</span> },
                  { key: "quantity", label: "الكمية", width: 100, render: (l, i) => (
                    <input type="number" step="any" value={l.quantity} onChange={(e) => updateLine(i, "quantity", e.target.value)} className="w-full h-[30px] text-center font-mono font-black text-[12px] outline-none bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-sm" />
                  )},
                  { key: "price", label: "السعر", width: 100, render: (l, i) => (
                    <input type="number" step="any" value={l.unitPrice} onChange={(e) => updateLine(i, "unitPrice", e.target.value)} className="w-full h-[30px] text-center font-mono font-black text-[12px] outline-none bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-sm" />
                  )},
                  { key: "total", label: "الإجمالي", width: 100, render: (l) => <span className="font-mono font-black text-emerald-600">{formatMoney(l.total)}</span> },
                  { key: "actions", label: "", width: 60, render: (_, i) => (
                    <button onClick={() => removeLine(i)} className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                  )}
                ]}
              />
            </section>
          </div>
        </main>

        {/* ── Toast ── */}
        {saveMessage && (
          <div className="absolute left-1/2 top-4 z-[150] -translate-x-1/2 rounded-sm border border-rose-200 bg-rose-50 px-5 py-2.5 font-bold text-[13px] text-rose-700 shadow-xl">
            {saveMessage}
          </div>
        )}
      </div>
    );
  }

"""
    
    # We construct the entire return function
    old_return = content[start_return_idx:]
    content = before_return + return_block + old_return
    
    with open("client/src/pages/pos/POSPage.jsx", "w", encoding="utf-8") as f:
        f.write(content)
    print("Injected list view layout.")
else:
    print("Could not find start of return block.")
