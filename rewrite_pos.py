import re

with open("client/src/pages/pos/POSPage.jsx", "r", encoding="utf-8") as f:
    content = f.read()

grid_item_logic = """
  function handleGridItemClick(item) {
    const warehouse = warehouses.length ? warehouses[0] : { id: "default", name: "المخزن الرئيسي" };
    const stockValue = Number(item.stock_quantity || item.stock || 0);
    const salePrice = Number(item.sale_price || item.price || 0);

    if (salePrice <= 0) { setSaveMessage("لا يمكن إضافة صنف بسعر صفر."); setTimeout(() => setSaveMessage(""), 3000); return; }
    if (1 > stockValue) { setSaveMessage(`المخزون غير كافٍ (المتاح: ${stockValue})`); setTimeout(() => setSaveMessage(""), 3000); return; }

    addLine({
      id: item.id,
      name: item.name,
      code: item.code || item.item_code || "",
      barcode: item.barcode || "",
      sale_price: salePrice,
      category_name: item.category_name || "غير مصنف",
      warehouse_id: warehouse.id,
      warehouse_name: warehouse.name,
      stock_quantity: stockValue,
      unit_name: item.unit_name || "قطعة",
      primary_image_url: getItemImage(item) || null,
      quantity: 1,
      line_discount: 0,
    });
    if (typeof playBeep === 'function') playBeep();
  }

  // ── Render ────────────────────────────────────────────────────────────────────
"""

content = content.replace("// ── Render ────────────────────────────────────────────────────────────────────", grid_item_logic)

render_start = content.find("  const multiTotal = activeMultiPayments.reduce((acc, p) => acc + Number(p.amount), 0);")
render_end = content.find("      {/* ── Toast ── */}")

new_render = """  const multiTotal = activeMultiPayments.reduce((acc, p) => acc + Number(p.amount), 0);

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

      {/* ── Shift bar ── */}
      <div className="shrink-0 border-b border-slate-200 bg-white z-40">
        <ShiftStatusBar shift={shift} onOpen={() => setOpenShiftModal(true)} onClose={() => setCloseShiftModal(true)} />
      </div>

      {/* Main blurred when shift closed */}
      <div
        className="flex min-h-0 flex-1 transition-all flex-row relative"
        style={{ filter: !shift ? "blur(6px)" : "none", opacity: !shift ? 0.4 : 1, pointerEvents: !shift ? "none" : "auto" }}
      >
        {/* ── Left Column: Grid & Search (~65%) ── */}
        <div className="flex flex-col flex-[1.8] bg-slate-50 border-l border-slate-200 overflow-hidden min-w-0">
          {/* Header */}
          <div className="flex flex-col gap-3 shrink-0 bg-white border-b border-slate-200 p-4 shadow-sm z-10">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  value={detailedSearchQuery}
                  onChange={(e) => setDetailedSearchQuery(e.target.value)}
                  placeholder="ابحث بالاسم، الكود، الباركود..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-sm py-2.5 pr-10 pl-4 text-[13px] font-black text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition-all shadow-inner"
                />
              </div>
              <button onClick={() => setDetailedSearchQuery("")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-slate-200 bg-white text-slate-500 hover:bg-slate-50">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            {/* Category Pills */}
            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1 custom-scrollbar">
              {detailedCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setDetailedCategoryFilter(cat)}
                  className={`shrink-0 px-4 py-1.5 rounded-full text-[12px] font-black transition-all border ${detailedCategoryFilter === cat ? "bg-slate-900 border-slate-900 text-white shadow-md" : "bg-white border-slate-200 text-slate-600 hover:border-slate-400"}`}
                >
                  {cat === "all" ? "كل الفئات" : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Grid Body */}
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {detailedItemResults.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-slate-400 opacity-60">
                <Search className="h-16 w-16 mb-4 text-slate-300" />
                <p className="text-[14px] font-black tracking-widest">لا توجد أصناف مطابقة</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {detailedItemResults.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleGridItemClick(item)}
                    className="group relative flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm hover:border-emerald-400 hover:shadow-lg hover:-translate-y-1 transition-all text-right overflow-hidden"
                  >
                    <div className="w-full aspect-square rounded-lg bg-slate-50 overflow-hidden flex items-center justify-center border border-slate-100">
                      {getItemImage(item) ? (
                        <img src={getItemImage(item)} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-slate-300" />
                      )}
                    </div>
                    <div className="flex flex-col w-full min-w-0">
                      <span className="text-[12px] font-black text-slate-800 truncate block leading-tight">{item.name}</span>
                      <span className="text-[10px] font-bold text-slate-400 font-mono truncate">{item.barcode || item.code || "—"}</span>
                    </div>
                    <div className="flex items-center justify-between w-full mt-auto pt-1 border-t border-slate-50">
                      <span className="text-[14px] font-black text-emerald-600 font-mono">{formatMoney(item.sale_price || item.price || 0)}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${Number(item.stock_quantity || item.stock || 0) <= 0 ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-500"}`}>
                        {Number(item.stock_quantity || item.stock || 0)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right Column: Fixed Invoice Panel (~35%) ── */}
        <div className="flex flex-col flex-1 max-w-[420px] min-w-[340px] bg-white shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.1)] z-20">
          
          {/* Top Panel: Customer & Actions */}
          <div className="flex flex-col shrink-0 border-b border-slate-100 bg-slate-50 p-3 gap-2.5">
            {/* Meta Row */}
            <div className="flex items-center justify-between text-[11px] font-black text-slate-500 uppercase tracking-widest px-1">
              <div className="flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5" />
                <span className="font-mono bg-white px-1.5 py-0.5 rounded-sm border border-slate-200">{invoiceNumber}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { clear(); resetPaymentFields(); resetStaging(); setPaymentType("cash"); setInvoiceSeq((s) => s + 1); }} className="hover:text-slate-800 transition-colors" title="إلغاء وبدء جديد">
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setProfitModalOpen(true)} className="hover:text-emerald-600 transition-colors" title="الربح المتوقع">
                  <TrendingUp className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setReceiptsOpen(true)} className="hover:text-slate-800 transition-colors" title="فواتير اليوم">
                  <ListTodo className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Customer Select */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <div className={`pointer-events-none absolute inset-y-0 right-2.5 flex items-center ${hasCustomerBalance ? "text-amber-500" : "text-slate-400"}`}>
                  <User className="h-4 w-4" />
                </div>
                <input
                  ref={customerInputRef}
                  type="text"
                  value={(!customer && !customerQuery) ? "زبون نقدي" : customerQuery}
                  placeholder="ابحث عن عميل..."
                  onChange={(e) => {
                    const v = e.target.value.replace("زبون نقدي", "");
                    setCustomerQuery(v); setCustomerLookupOpen(true); setActiveCustomerIndex(0);
                    if (!v) setCustomer(null);
                  }}
                  onFocus={() => setCustomerLookupOpen(true)}
                  onBlur={() => setTimeout(() => { setCustomerLookupOpen(false); if (!customer) setCustomerQuery(""); }, 200)}
                  onKeyDown={handleCustomerKeyDown}
                  className={`w-full border rounded-sm py-2 pl-2 pr-9 text-[13px] font-black outline-none transition-all shadow-inner ${
                    hasCustomerBalance
                      ? "border-amber-400 bg-amber-50 text-amber-900 focus:ring-1 focus:ring-amber-400"
                      : "border-slate-300 bg-white text-slate-800 focus:border-slate-800"
                  }`}
                />
                {customerLookupOpen && (
                  <LookupList items={customerResults} activeIndex={activeCustomerIndex} emptyLabel="ابحث عن عميل..." onPick={(c) => { setCustomer(c); setCustomerQuery(c.name); setCustomerLookupOpen(false); }} />
                )}
              </div>
              <button onClick={() => setCustomerCreateOpen(true)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-slate-300 bg-slate-50 text-slate-600 hover:border-slate-800 hover:text-slate-800 transition-colors shadow-sm">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {customer?.id && hasCustomerBalance && (
              <div className="text-[11px] font-black text-amber-700 bg-amber-100/50 border border-amber-200 px-2 py-1 rounded-sm text-center">
                رصيد العميل الحالي: {formatMoney(selectedCustomer.opening_balance)}
              </div>
            )}
          </div>

          {/* Cart List */}
          <div className="flex-1 overflow-y-auto p-2 bg-slate-50 custom-scrollbar shadow-inner relative">
            {lines.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center opacity-40">
                <ShoppingCart className="h-16 w-16 mb-4 text-slate-400" />
                <span className="text-[14px] font-black tracking-widest text-slate-500">الفاتورة فارغة</span>
                <span className="mt-1 text-[11px] font-bold text-slate-400">اضغط على الأصناف لإضافتها</span>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {lines.map((line, idx) => {
                  const isExceedingStock = Number(line.quantity || 0) > Number(line.stock_quantity || 0);
                  const lineTotal = Math.max(0, Number(line.quantity || 0) * Number(line.sale_price || line.unit_price || 0) - Number(line.line_discount || 0));
                  return (
                    <div key={`${line.item_id}-${idx}`} className={`flex flex-col gap-1.5 p-2.5 rounded-lg border shadow-sm transition-all ${isExceedingStock ? "border-rose-300 bg-rose-50" : "border-slate-200 bg-white"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col min-w-0">
                          <span className="text-[13px] font-black text-slate-800 truncate block leading-tight" title={line.item_name || line.name}>{line.item_name || line.name}</span>
                          <span className="text-[10px] font-mono text-slate-400 truncate">{line.code || "—"}</span>
                        </div>
                        <button onClick={() => removeLine(line.item_id)} className="shrink-0 p-1 rounded-sm text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center border border-slate-200 rounded-md overflow-hidden bg-slate-50">
                          <button onClick={() => updateLine(line.item_id, { quantity: Math.max(1, Number(line.quantity) - 1) })} className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"><Minus className="w-3 h-3" /></button>
                          <input type="number" min="1" value={line.quantity} onChange={(e) => updateLine(line.item_id, { quantity: Number(e.target.value || 1) })} className="w-10 h-7 text-center text-[12px] font-black bg-transparent outline-none ring-0 border-0" />
                          <button onClick={() => updateLine(line.item_id, { quantity: Number(line.quantity) + 1 })} className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"><Plus className="w-3 h-3" /></button>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="font-mono text-[14px] font-black text-emerald-700">{formatMoney(lineTotal)}</span>
                          <span className="text-[10px] font-bold text-slate-400">{formatMoney(line.sale_price || line.unit_price)} للقطعة</span>
                        </div>
                      </div>
                      {isExceedingStock && <div className="text-[10px] font-bold text-rose-600 bg-rose-100/50 px-1.5 py-0.5 rounded-sm self-start mt-0.5">تجاوز المخزون (متاح: {line.stock_quantity})</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bottom Totals & Payments */}
          <div className="shrink-0 flex flex-col border-t border-slate-200 bg-white shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)] z-30">
            {/* Totals Summary */}
            <div className="flex flex-col px-4 py-3 bg-slate-900 gap-1.5 border-b border-slate-800">
              <div className="flex items-center justify-between text-[12px]">
                <span className="font-bold text-slate-400">الفرعي</span>
                <span className="font-mono font-black text-slate-200">{formatMoney(totals.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="font-bold text-slate-400">خصم إضافي</span>
                <input type="number" min="0" max={totals.subtotal} value={discount} onChange={(e) => { const v = Number(e.target.value || 0); setDiscount(v > totals.subtotal ? totals.subtotal : v); }} className="w-20 rounded-sm border border-slate-700 bg-slate-800 px-2 py-0.5 text-right font-mono text-[12px] font-black text-white outline-none focus:border-slate-500" />
              </div>
              <div className="border-t border-slate-700 mt-1 pt-1.5 flex items-center justify-between">
                <span className="text-[12px] font-black text-slate-300 uppercase tracking-widest">الإجمالي المطلوب</span>
                <span className="font-mono text-[28px] font-black text-emerald-400 leading-none drop-shadow-md">{formatMoney(totals.total)}</span>
              </div>
            </div>

            {/* Payment Methods */}
            <div className="flex flex-col p-3 gap-3 bg-white">
              <div className="flex gap-1.5">
                {PAYMENT_TYPES.map(({ type, label, Icon }) => (
                  <button key={type} type="button" onClick={() => setPaymentType(type)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border px-1 py-2 text-[11px] font-black transition-all ${paymentType === type ? "border-slate-800 bg-slate-800 text-white shadow-md" : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-400"}`}>
                    <Icon className="h-3.5 w-3.5 shrink-0" /> {label}
                  </button>
                ))}
              </div>

              {/* Dynamic Payment Input */}
              {paymentType === "cash" && (
                <div className="flex gap-2 items-center">
                  <input type="number" min="0" value={amountReceived} onChange={(e) => setAmountReceived(e.target.value)} placeholder="المبلغ المستلم..." className="flex-1 rounded-sm border border-slate-300 bg-slate-50 px-3 py-2 text-[14px] font-black text-slate-800 outline-none focus:border-emerald-500 focus:bg-white shadow-inner" />
                  {Number(amountReceived) > 0 && (
                    <div className={`rounded-sm px-3 py-2 text-[12px] font-black shrink-0 ${changeAmount > 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                      الباقي: {formatMoney(Math.abs(changeAmount))}
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
                  <div className="text-[11px] font-black text-amber-700 text-center">المتبقي آجل على العميل: {formatMoney(creditRemaining)}</div>
                </div>
              )}
              
              {/* Main Actions */}
              <div className="flex gap-2 mt-1">
                <button type="button" onClick={() => saveInvoice(false)} disabled={!lines.length || isSaving} className={`flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-3 text-[13px] font-black transition-all ${!lines.length || isSaving ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400" : "border-slate-300 bg-white text-slate-800 hover:border-slate-800 hover:bg-slate-50 shadow-sm"}`}>
                  {isSaving ? "جارٍ الحفظ..." : "حفظ فقط"}
                </button>
                <button type="button" onClick={() => saveInvoice(true)} disabled={!lines.length || isSaving} className={`flex flex-[2] items-center justify-center gap-2 rounded-md px-3 py-3 text-[14px] font-black text-white transition-all shadow-md ${!lines.length || isSaving ? "cursor-not-allowed bg-slate-300" : "bg-emerald-600 hover:bg-emerald-700 hover:shadow-lg"}`}>
                  <Printer className="h-5 w-5" /> {isSaving ? "جارٍ الحفظ..." : "دفع وطباعة"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

"""

content = content[:render_start] + new_render + content[render_end:]

if "ShoppingCart" not in content[:500]:
    content = content.replace("  ShieldCheck,", "  ShieldCheck,\n  ShoppingCart,")

with open("client/src/pages/pos/POSPage.jsx", "w", encoding="utf-8") as f:
    f.write(content)
print("POSPage.jsx rewritten successfully.")
