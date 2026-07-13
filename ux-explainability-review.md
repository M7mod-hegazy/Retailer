# UX Explainability Review — every page, fitted ideas (not tooltips)

Goal: make every page self-explanatory the way `/whatsapp-crm` connection steps are — but with the **right pattern per page**, not one pattern everywhere.

## What already exists (and why it's not enough)

| Layer | Where | Problem |
|---|---|---|
| `PageTour` spotlight tours | ~40 pages via `usePageTour()` | Shown once, points at buttons — doesn't explain *concepts* (what is a shift? where does card money go?) |
| `EmptyState` | Used on only 2 pages (`WhatsAppCrmPage`, `SyncPage`) | 47 pages import it but most tables show a bare "لا توجد بيانات" |
| `helpContent` / assistant knowledge | Help center | User must go *looking* for help; pages don't teach in place |
| `ChannelConnectWizard` | WhatsApp/Telegram only | The best pattern in the app — illustrated steps, gated Next, live status — used nowhere else |
| `FeaturesTab` cards | Settings → Features | Second-best pattern: desc + "recommended for" + "affected pages" + warnings — this *voice* should exist on every complex page |

## The toolkit — 8 reusable patterns to build once, apply everywhere

1. **`IllustratedGuide`** — generalize `ChannelConnectWizard` into a page-agnostic component. Every complex page gets a "كيف تعمل هذه الصفحة؟" button in its header that opens 3–5 illustrated steps *specific to that page*. Auto-opens on first visit (reuse `helpStore` seen-tracking), never again unless asked.
2. **`TeachingEmptyState`** — upgrade `EmptyState`: illustration + one-sentence "what this page is for" + numbered mini-steps (1. أضف مخزن 2. أضف صنف 3. …) + primary CTA. An empty page is the single best teaching moment — right now it's wasted.
3. **`FlowStepper`** — a horizontal pipeline header for document chains (عرض سعر ← أمر شراء ← فاتورة استلام). Shows where *this* document sits, what came before, what happens next, with clickable stages.
4. **`ConsequencePreview`** — before destructive/committing actions (close shift, commit physical count, restore backup): a plain-Arabic before/after summary, "سيحدث الآتي: …" with numbers, not just "هل أنت متأكد؟".
5. **`MoneyPath` badge** — one-line live sentence under money forms: "سيُخصم المبلغ من خزنة الفرع ← ويُسجَّل على حساب المورد". Kills the #1 confusion class (treasuries vs banks vs payment methods).
6. **`ConceptCard`** — dismissible first-3-visits card at top of concept-heavy pages ("ما هي الوردية؟ الوردية هي…"). One shared component + a glossary map for terms (آجل، تقسيط، وردية، جرد، عجز/زيادة، له/عليه).
7. **`ReadinessChecklist`** — pages with prerequisites show a checklist instead of failing (loyalty needs settings, physical count needs a warehouse, WhatsApp send needs connection). Same idea as FeaturesTab activation blockers — reuse that mental model.
8. **"Which one do I use?" chooser** — for sibling pages that confuse (مصروف vs مسحوبات، آجل vs تقسيط vs شيك، تحويل مخزني vs تحويل فرع): a small decision card that asks 1–2 questions and routes you.

---

## Per-area review and fitted ideas

### 1. POS (`POSPage`) — **highest priority** *(shift modals not used in this build — removed from scope)*
- **Fitted ideas:**
  - Page guide: invoice lifecycle (scan → cart → payment method → print/WhatsApp) + held invoices concept.
  - "?" keyboard overlay (cheat-sheet of shortcuts, ShortcutsTab data reused in-place).
  - Payment-step MoneyPath chip: chosen method shows where the money lands (خزنة/بنك).
  - Optional later: **training mode** toggle (practice invoices that don't touch stock/treasury) — the ultimate "easy to learn".

### 2. Daily Treasury / Cashflow (`DailyTreasuryPage`, `CashflowLedgerPage`) — **highest priority**
- **Problem:** 12+ doc types flowing in/out; users can't tell why the number is what it is.
- **Fitted ideas:**
  - A **"day equation" strip** at top: opening + inflows − outflows = current, each term clickable to filter the ledger to those rows.
  - Doc-type legend as a collapsible ConceptCard (the `DOC_TYPE_LABEL` map already exists — render it as a legend with one-line meaning each, instead of living only in code).

### 3. Purchases chain (`PurchasesHubPage`, `QuotationsPage/Form`, `PurchaseOrdersPage`, `PurchaseFormPage`, returns) — **highest priority**
- **Problem:** 3-step flow (عرض سعر ← أمر شراء ← استلام) is nowhere visualized; users jump straight to استلام and don't know what the other two are for.
- **Fitted ideas:**
  - `FlowStepper` on the hub: pipeline with live counts per stage (٣ عروض بانتظار التحويل ← ٥ أوامر لم تُستلم ← …), each stage explains itself on hover/click.
  - Each form page shows its position in the chain + "التالي: حوّل لأمر شراء" as the natural next action.
  - Hub TeachingEmptyState explains *when to use* the full chain vs direct استلام ("لو بتشتري وتستلم فوراً، ادخل على فاتورة الاستلام مباشرة").

### 4. Money definitions (`TreasuriesPage`, `BanksPage`, `PaymentMethodsPage` ×2, `BankOperationsPage`, `TreasuryTransferPage`) — **highest priority**
- **Problem:** the treasury/bank/payment-method triangle is the most-asked confusion; two pages are even named PaymentMethodsPage.
- **Fitted ideas:**
  - A **"خريطة الفلوس" (money map)** IllustratedGuide shared by all these pages: customer pays → payment method decides → cash goes to treasury / card goes to bank → transfers move between them.
  - `PaymentMethodsPage`: each method row shows a `MoneyPath` chip — "تذهب إلى: بنك CIB" — so the mapping is visible in the list, not hidden in the edit modal.
  - `TreasuryTransferPage` / `BankOperationsPage`: live plain-sentence preview of the movement before saving.
  - Also: audit the duplicate `definitions/PaymentMethodsPage` vs `operations/PaymentMethodsPage` — two entry points for one concept is itself a UX bug.

### 5. Ajal / Installments / Cheques (`AjalTrackerPage`, `InstallmentsPage`, `ChequesPage`)
- **Problem:** three sibling credit concepts, statuses everywhere, schedule creation is blind.
- **Fitted ideas:**
  - Shared **"Which one do I use?"** chooser card linked from all three (آجل = دين مفتوح، تقسيط = جدول ملزم، شيك = ورقة بتاريخ).
  - AjalTracker schedule form → **preview generated due dates** (table of ٣ أقساط بتواريخها ومبالغها) *before* saving.
  - ChequesPage → cheque **lifecycle diagram** (مستلم ← مودع ← محصَّل / مرتد) as the page header, with each status count as a live filter.

### 6. Stock (`PhysicalCountPage`, `StockTransferPage`, `BranchTransferPage`, `StockMovementsPage`, `StockLevelsPage`, `SerialLookupPage`)
- **Fitted ideas:**
  - PhysicalCount → rebuild entry as a 3-step wizard (اختر النطاق ← عُدّ ← راجع الفروقات واعتمد) with `ConsequencePreview` at commit: "سيتم تعديل مخزون ١٢ صنف؛ إجمالي فرق بالقيمة −٤٥٠ ج".
  - Transfers → direction diagram (من ← إلى with warehouse icons) + plain sentence, and a chooser: تحويل مخزني (نفس الفرع) vs تحويل فرع.
  - StockMovements → movement-type legend ConceptCard (بيع/شراء/تحويل/جرد/مرتجع each with in/out arrow).

### 7. Accounts & parties (`CustomerAccountsPage`, `SupplierAccountsPage`, `CustomerDetailPage`, statements)
- **Problem:** "له/عليه" and balance direction confuse everyone.
- **Fitted ideas:** balance always paired with a sentence: "العميل مديون لك بـ ٥٠٠ ج" / "أنت مديون للمورد بـ…", color-coded via theme tokens. Statement page header gets a one-time ConceptCard explaining debit/credit columns in shop language.

### 8. Expenses / Revenues / Withdrawals (`ExpensesListPage`, `RevenuesListPage`, `WithdrawalsListPage`, `OwnerStatementPage`)
- **Fitted ideas:** chooser card: "مصروف تشغيل (كهرباء، إيجار) vs مسحوبات صاحب المحل" — wrong categorization here silently corrupts owner statement. OwnerStatement header explains in one paragraph what's included/excluded.

### 9. Items (`ItemFormModal`, `ItemsListPage`, import wizard)
- **Import wizard already good** (10 steps) — add a step-0 "download sample file" + what-will-happen summary.
- `ItemFormModal` is the field-heaviest form in the app → **progressive disclosure rebuild**: essential fields first (اسم، سعر، فئة)، everything else in labeled collapsible sections that only appear when their feature flag is ON, each section header carrying the same one-line desc used in FeaturesTab (reuse those strings — they're already written and excellent).

### 10. Reports (`ReportsCenter`)
- Already overhauled. Missing piece: every report card gets a **"يجاوب على سؤال: …"** one-liner ("مين أكتر صنف بيتباع؟") — people look for questions, not report names. Consider a "أسئلة شائعة" search box on the center that maps questions → report + pre-applied filters.

### 11. Settings (`FeaturesTab`, `BackupSettingsTab`, `PrintingSettingsPanel`, protection/licensing)
- FeaturesTab is the gold standard — leave it.
- Backup/Restore → `ConsequencePreview` on restore ("سيستبدل كل بياناتك الحالية؛ آخر نسخة قبل الاستعادة ستُحفظ تلقائياً في …").
- PrintingSettings → **live receipt preview pane** that re-renders as you toggle options (the print-preview templates already exist — mount one beside the form).
- Activation/protection → plain-language state card: "الرخصة سارية حتى … / وضع Windows-managed يعني …".

### 12. Sync (`SyncPage`, `SyncConfig`) — *current branch!*
- This is the natural next `ChannelConnectWizard` client: illustrated connect steps (main ↔ branch pairing, what syncs, what happens offline), live connection status per step, gated Next until the branch answers — exactly the WhatsApp pattern.

### 13. Repairs / Restaurant / Gold (`RepairOrdersPage`, `TableMapPage`, `ModifierGroupsPage`, `GoldRatesPage`)
- Status-workflow pages → **pipeline header** (مستلم ← جارٍ الإصلاح ← جاهز ← مُسلَّم) doubling as filter + explanation. These are feature-flagged, so first-open after enabling the flag should auto-show the IllustratedGuide seeded from the FeaturesTab "affectedPages" text.

### 14. Hubs & workspaces (`SalesHubPage`, `PurchasesHubPage`, 7 workspace pages)
- Rebuild hubs **verb-first**: big action cards "عايز تعمل إيه؟" (اقبض من عميل / اعمل مرتجع / حوّل بضاعة) above the tables — tables are for finding records, cards are for doing tasks. New users think in verbs.

### 15. Dashboard / Analytics
- Every KPI card gets an ⓘ that expands to: what it means + how it's computed + link to the source report with matching filters. No orphan numbers.

---

## Specialized per-page ideas (v2 additions — approved to execute)

- **Dashboard/Analytics:** every KPI card gets ⓘ → "المعنى + طريقة الحساب + افتح التقرير المصدر بنفس الفلاتر". Charts get a one-line "إيه اللي الرسمة دي بتقولهولك".
- **ItemFormModal:** live **margin helper** — as you type cost & sell price, show "ربحك ١٥ ج (٢٠٪)" inline; red hint if selling below cost.
- **ItemsListPage:** stock-color legend chip row (أخضر = فوق الحد، أصفر = قرب الحد، أحمر = نافد).
- **BulkPriceUpdate:** mandatory **dry-run diff table** (الصنف | السعر الحالي ← الجديد | نسبة التغيير) via ConsequencePreview before applying.
- **Promotions:** **live simulator** inside the form — "مثال: عميل اشترى ٣ قطع بـ ٣٠٠ ج ← الخصم ٤٥ ج، يدفع ٢٥٥ ج" recalculated from the rule being edited.
- **Quotations:** expiry countdown badge + conversion chip ("حوّلها لفاتورة") so the doc explains its own next step.
- **SerialLookupPage:** scan-first hero (big input + "امسح الباركود أو اكتب السيريال" + example placeholder).
- **StockMovementsPage:** movement-type legend (بيع↓ شراء↑ تحويل⇄ جرد⚖ مرتجع↩) as ConceptCard.
- **Employees payroll:** net-salary **equation strip** (أساسي + حوافز − خصومات − سلف = الصافي) with each term linking to its tab.
- **UsersPage (permissions):** **role preview** — selecting a role shows "هيشوف: … / مش هيشوف: …" summary before saving.
- **BackupSettingsTab:** backup-age health banner (آخر نسخة من ٣ أيام — اعمل نسخة الآن) + restore ConsequencePreview.
- **GoldRatesPage:** example strip — "جرام ٢١ = س ج ← خاتم ٥ جرام + مصنعية ٥٠ = كذا" live from entered rate.
- **RepairOrdersPage:** FlowStepper lifecycle (مستلم ← جارٍ الفحص ← جاهز ← مُسلَّم) as header-filter + overdue badge.
- **TableMapPage:** table status color legend + tap-flow guide (اختر ترابيزة ← افتح أوردر ← اقفل بالحساب).
- **HistoryPage:** preset filter chips (اليوم | تعديلات أسعار | حذف | تسجيل دخول) — audit log becomes answerable questions.
- **CustomerAccounts/SupplierAccounts:** balance rendered as a **sentence** (العميل عليه ٥٠٠ ج ليك) + aging buckets explainer.
- **OwnerStatementPage:** header equation (رأس المال + أرباح − مسحوبات = صافي حقك) with term links.
- **Import wizards:** step-0 sample-file download + "what will happen" summary before commit.
- **ReportsCenter:** each report card gets "يجاوب على: …" question one-liner.
- **SyncPage:** full ChannelConnectWizard-style pairing wizard (fits sync-system-overhaul branch).

## Suggested phasing

- **Phase 1 — build the toolkit:** `IllustratedGuide` (generalize ChannelConnectWizard), `TeachingEmptyState`, `ConceptCard` + glossary, `ConsequencePreview`. Wire `helpStore` first-visit auto-show.
- **Phase 2 — the money core:** DailyTreasury reading guide, money map across treasury/bank/payment-method pages, MoneyPath chips, transfer plain-sentence previews.
- **Phase 3 — flows:** Purchases FlowStepper, PhysicalCount wizard, transfers direction preview, Ajal schedule preview, cheque lifecycle.
- **Phase 4 — sweep:** TeachingEmptyState + guide content on every remaining page; choosers; hub verb-first cards; KPI explainers.

Content authoring note: guide/concept copy follows the existing help-system convention (Arabic-only, in js content files like `helpContent.js`); FeaturesTab tone. Mechanical sweep phases are good candidates for a cheaper-model subagent after the toolkit + 2–3 reference pages are done by hand.

---

## Execution log (2026-07-13 — implemented, uncommitted)

**Toolkit (new components):** `components/help/IllustratedGuide.jsx` (generalized ChannelConnectWizard), `components/help/PageGuideLauncher.jsx` (Topbar host, first-visit auto-open, tour-always-wins guard), `ui/ConceptCard.jsx`, `ui/ConsequencePreview.jsx`, `ui/FlowStepper.jsx`, `ui/MoneyPath.jsx`, `ui/ChooserCard.jsx`, `EmptyState` steps prop, `helpStore.markSeen`.

**Content:** `help/pageGuides.jsx` — 40+ illustrated guides keyed by pageKey (shared money-map step), auto-surfaced on every mapped route via Topbar BookOpen button. Guide seen-state persists server-side as `guide:<pageKey>` (no server changes needed).

**Non-conflict guarantees with the existing tour system:** separate button, separate key namespace, and the guide never auto-opens on a page whose spotlight tour hasn't completed yet.

**Fitted integrations:** DailyTreasury reading-guide ConceptCard · PaymentMethods per-card MoneyPath destination chips · TreasuryTransfer live plain-sentence preview with post-transfer balance · PurchasesHub 3-stage FlowStepper + skip hint · AjalTracker installment schedule preview with real dates · Cheques lifecycle FlowStepper doubling as status filter · PhysicalCount ConsequencePreview (up/down/uncounted breakdown) · Expenses & Withdrawals "متأكد إن ده مكانه هنا؟" choosers · ItemFormModal live margin helper with below-cost warning.

**Verified:** `npm run build` exit 0 (twice, before and after integrations); vitest 30/30 passing on EmptyState/helpStore/PageTour-guard suites.

**Still open (next passes):** TeachingEmptyState rollout across list pages, Dashboard KPI ⓘ explainers, BulkPriceUpdate dry-run diff, Promotions simulator, UsersPage role preview, payroll equation strip, ReportsCenter "يجاوب على" one-liners, Sync pairing wizard, backup-age banner, GoldRates example strip, Repairs pipeline header, History preset chips, accounts balance sentences.
