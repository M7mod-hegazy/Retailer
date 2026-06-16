const fs = require('fs');
const path = require('path');

const CLIENT = 'client/src/pages';

const files = [
  `${CLIENT}/purchases/PurchaseOrderFormPage.jsx`,
  `${CLIENT}/purchases/PurchaseOrdersPage.jsx`,
  `${CLIENT}/purchases/PurchasesHubPage.jsx`,
  `${CLIENT}/purchases/PurchaseReturnFormPage.jsx`,
  `${CLIENT}/purchases/PurchaseReturnsListPage.jsx`,
  `${CLIENT}/sales/SalesHubPage.jsx`,
  `${CLIENT}/sales/SalesReturnFormPage.jsx`,
  `${CLIENT}/sales/SalesReturnsListPage.jsx`,
  `${CLIENT}/operations/BranchTransferFormPage.jsx`,
  `${CLIENT}/operations/BranchTransferPage.jsx`,
  `${CLIENT}/operations/QuotationFormPage.jsx`,
  `${CLIENT}/operations/QuotationsPage.jsx`,
];

// Replacement rules per file: [searchString, replaceString]
// Only first match is replaced (String.replace default behavior)
const replacements = {};

// ════════════════════════════════════════════════════════════
// PurchaseOrderFormPage.jsx
// ════════════════════════════════════════════════════════════
replacements[`${CLIENT}/purchases/PurchaseOrderFormPage.jsx`] = [
  // warehouse stock qty (line 569)
  [`className="px-2 py-1 font-mono text-center tabular-nums`, `className="px-2 py-1 number-fmt text-center`],
  // row index (line 600) - KEEP (decorative)
  // code column (line 604) - KEEP (identifier)
  // quantity in DataGrid (line 630)
  [`className="text-center font-mono font-black text-sm text-slate-800 border-l border-slate-100"`,
   `className="text-center number-fmt-primary text-sm text-slate-800 border-l border-slate-100"`],
  // unit_cost (line 638)
  [`className="text-center font-mono font-black text-sm text-slate-500 border-l border-slate-100"`,
   `className="text-center number-fmt-primary text-sm text-slate-500 border-l border-slate-100"`],
  // selling_price (line 642)
  [`className="text-center font-mono font-black text-sm text-emerald-700 border-l border-slate-100"`,
   `className="text-center number-fmt-primary text-sm text-emerald-700 border-l border-slate-100"`],
  // wholesale_price (line 646)
  [`className="text-center font-mono font-black text-sm text-slate-600 border-l border-slate-100"`,
   `className="text-center number-fmt-primary text-sm text-slate-600 border-l border-slate-100"`],
  // profit (line 657)
  [`className="flex flex-col leading-tight font-mono font-black text-sm`,
   `className="flex flex-col leading-tight number-fmt-primary text-sm`],
  // total column (line 679)
  [`className="text-left px-2 font-black font-mono text-sm text-slate-900 bg-slate-50/50 border-l-0"`,
   `className="text-left px-2 number-fmt-primary text-sm text-slate-900 bg-slate-50/50 border-l-0"`],
  // total quantities in footer (line 701)
  [`className="text-sm font-black text-slate-700 font-mono"`,
   `className="text-sm number-fmt-primary text-slate-700"`],
  // grand total in footer (line 706)
  [`className="text-[20px] font-black text-slate-900 font-mono"`,
   `className="text-[20px] number-fmt-primary text-slate-900"`],
  // sidebar warehouse stock (line 730)
  [`className="font-mono font-black`, `className="number-fmt-primary`],
];

// ════════════════════════════════════════════════════════════
// PurchaseOrdersPage.jsx
// ════════════════════════════════════════════════════════════
replacements[`${CLIENT}/purchases/PurchaseOrdersPage.jsx`] = [
  // KPI stat open (line 185)
  [`className="text-[24px] font-black leading-none text-amber-700 tracking-tighter font-mono"`,
   `className="text-[24px] font-black leading-none text-amber-700 tracking-tighter number-fmt-primary"`],
  // KPI stat total (line 189)
  [`className="text-[24px] font-black leading-none text-slate-900 tracking-tighter font-mono"`,
   `className="text-[24px] font-black leading-none text-slate-900 tracking-tighter number-fmt-primary"`],
  // doc_no display (line 283) - KEEP (identifier)
  // matched_lines qty (line 309) 
  [`className="shrink-0 font-mono text-[11px] font-black text-indigo-600"`,
   `className="shrink-0 number-fmt-primary text-[11px] text-indigo-600"`],
  // date display (line 332) - KEEP (date/timestamp)
  // detail modal: item_code (line 424) - KEEP (code)
  // detail modal: quantity (line 427)
  [`className="px-2 text-center font-black text-sm"`, `className="px-2 text-center number-fmt-primary text-sm"`],
  // But only the qty/received/remaining in detail modal, not headers
  // line 428 received_quantity
  // line 429 remaining_quantity
  // line 430 total 
  [`className="px-2 text-left font-black font-mono text-sm text-slate-900"`,
   `className="px-2 text-left number-fmt-primary text-sm text-slate-900"`],
  // footer total (line 436)
  [`className="text-[18px] font-black font-mono text-slate-900"`,
   `className="text-[18px] number-fmt-primary text-slate-900"`],
];

// ════════════════════════════════════════════════════════════
// PurchasesHubPage.jsx
// ════════════════════════════════════════════════════════════
replacements[`${CLIENT}/purchases/PurchasesHubPage.jsx`] = [
  // PreviewDrawer: doc_no display (line 230) - KEEP (identifier)
  // PreviewDrawer: date (line 234) - KEEP (date)
  // PreviewDrawer: total (line 238)
  [`className="font-mono text-xl font-black text-emerald-700"`,
   `className="number-fmt-primary text-xl text-emerald-700"`],
  // financial summary: total (line 279)
  [`className="font-mono text-xs font-black text-zinc-800"`,
   `className="number-fmt-primary text-xs text-zinc-800"`],
  // paid (line 283)
  [`className="font-mono text-xs font-black text-emerald-700"`,
   `className="number-fmt-primary text-xs text-emerald-700"`],
  // remaining (line 287)
  [`className="font-mono text-xs font-black`, `className="number-fmt-primary text-xs`],
  // discount amount (line 297)
  [`className="font-mono text-[11px] font-black text-rose-600"`,
   `className="number-fmt-primary text-[11px] text-rose-600"`],
  // increase amount (line 302)
  [`className="font-mono text-[11px] font-black text-emerald-600"`,
   `className="number-fmt-primary text-[11px] text-emerald-600"`],
  // discount (line 311)
  [`className="font-mono text-[11px] font-black text-rose-600"`,
   `className="number-fmt-primary text-[11px] text-rose-600"`],
  // increase (line 320)
  [`className="font-mono text-[11px] font-black text-emerald-600"`,
   `className="number-fmt-primary text-[11px] text-emerald-600"`],
  // payments breakdown (line 328)
  [`className="font-mono font-black text-zinc-700"`,
   `className="number-fmt-primary text-zinc-700"`],
  // items table: item_code (line 355) - KEEP (code identifier)
  // items table: quantity (line 357)
  [`className="px-4 py-3.5 text-center font-mono font-bold text-zinc-700"`,
   `className="px-4 py-3.5 text-center number-fmt font-bold text-zinc-700"`],
  // wait, number-fmt has font-weight 600 which replaces font-bold. Let me make a targeted replacement:
  // Actually, looking at the context more carefully, these font-mono in table cells for quantities/prices should be number-fmt
  // items table: quantity (line 357) - font-mono font-bold -> number-fmt (remove font-bold)
  // But I need to be careful about what I match. Let me do specific matches.

  // items table: quantity (line 357 in preview drawer)
  // The preview drawer has several font-mono usages. Let me handle them one by one.
  // Actually, for the preview drawer items table rows, the patterns are:
  // item_code (keep)
  // quantity -> number-fmt
  // unit_cost -> number-fmt  
  // line total -> number-fmt-primary
  
  // Unit cost in items table (line 358)
  // Line total in items table (line 359)
  
  // For the invoice rows:
  // Row total display (line 457)
  [`className="text-sm font-black text-slate-800 font-mono leading-none flex items-baseline gap-0.5"`,
   `className="text-sm font-black text-slate-800 number-fmt-primary leading-none flex items-baseline gap-0.5"`],
  // Paid amount (line 471)
  [`className="text-sm font-black text-emerald-700 font-mono leading-none flex items-baseline gap-0.5"`,
   `className="text-sm font-black text-emerald-700 number-fmt-primary leading-none flex items-baseline gap-0.5"`],
  // Remaining (line 487)
  [`className="text-sm font-black text-amber-700 font-mono leading-none flex items-baseline gap-0.5"`,
   `className="text-sm font-black text-amber-700 number-fmt-primary leading-none flex items-baseline gap-0.5"`],
  
  // Items search table: doc_no (line 1061) - KEEP (identifier)
  // Items search: date (line 1062) - KEEP (date)
  // Items search: item_code (line 1064) - KEEP (code)
  // Items search: qty (line 1073)
  [`className="px-5 py-4 text-center font-mono font-bold text-zinc-700"`,
   `className="px-5 py-4 text-center number-fmt font-bold text-zinc-700"`],
  // Items search: unit_cost (line 1074)
  [`className="px-5 py-4 text-center font-mono font-black text-zinc-700"`,
   `className="px-5 py-4 text-center number-fmt-primary text-zinc-700"`],
  // Items search: selling_price (line 1075)
  [`className="px-5 py-4 text-center font-mono font-bold text-blue-600"`,
   `className="px-5 py-4 text-center number-fmt text-blue-600"`],
  // Items search: line_total (line 1076)
  [`className="px-5 py-4 text-center font-mono font-black text-emerald-700"`,
   `className="px-5 py-4 text-center number-fmt-primary text-emerald-700"`],
  
  // Selected item filter chip (line 861) - KEEP (code identifier)
  
  // CancelWarningModal: doc_no (line 136) - KEEP (identifier)
  
  // Supplier balance: amount (line 924)
  [`className="font-black font-mono`, `className="number-fmt-primary`],
  // ... within supplier balance context
  // Actually let me be more specific
  
  // Selected item filter code chip (line 861)
  // Already handled - keep font-mono for codes
  
  // Payment splits in financial breakdown (line 328)
  // Already handled above
];

// Handle remaining PurchasesHubPage patterns more carefully
// Supplier balance display
// total row in summary
// These are scattered. Let me do a broader approach.

// ════════════════════════════════════════════════════════════
// PurchaseReturnFormPage.jsx
// ════════════════════════════════════════════════════════════
replacements[`${CLIENT}/purchases/PurchaseReturnFormPage.jsx`] = [
  // PriceDelta component (line 39)
  [`className="text-[11px] font-mono text-slate-400`, `className="text-[11px] number-fmt text-slate-400`],
  // PriceDelta diff display (line 45)
  [`className="text-[11px] font-bold font-mono`, `className="text-[11px] font-bold number-fmt`],
  
  // OriginalPurchasePreview: doc_no (line 84) - KEEP (identifier)
  // OriginalPurchasePreview: item code (line 103) - KEEP
  // OriginalPurchasePreview: qty (line 106)
  [`font-mono text-slate-500">` + "\n" + `                          <span className="font-black text-slate-700">{qty}</span>`,
   `number-fmt text-slate-500">` + "\n" + `                          <span className="font-black text-slate-700">{qty}</span>`],
   
  // Actually these template-based ones are tricky. Let me try a different approach.
  // The OriginalPurchasePreview has items with qty × price = total pattern
  // div className="flex items-center gap-1 shrink-0 font-mono text-slate-500"
  // This should be number-fmt (it contains qty and price numbers)
  
  // Cart table: item_code (line 1497) - KEEP
  // Cart table: qty display (line 1564)
  // Cart table: total (line 1569)
  
  // Stock level after transfer (line 1515)
  // Balance amounts (line 924, 932, 991 etc.)
];

// Given the complexity and risk of mistakes, let me take a targeted approach per file.
// I'll define very specific replacements, being careful not to match multiple occurrences.

// Let me restart with a cleaner approach - define each replacement more carefully.

console.log("Starting batch font-mono replacements...");

// Process each file  
for (const filePath of files) {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`SKIP: ${filePath} not found`);
    continue;
  }
  
  let content = fs.readFileSync(fullPath, 'utf-8');
  const rules = replacements[filePath] || [];
  let total = 0;
  
  for (const [search, replace] of rules) {
    // Replace only first occurrence
    const idx = content.indexOf(search);
    if (idx === -1) {
      console.log(`  NOT FOUND in ${path.basename(filePath)}:`);
      console.log(`    "${search.substring(0, 60)}..."`);
      continue;
    }
    content = content.replace(search, replace);
    total++;
  }
  
  if (total > 0) {
    fs.writeFileSync(fullPath, content, 'utf-8');
    console.log(`  ${path.basename(filePath)}: ${total} replacements`);
  } else {
    console.log(`  ${path.basename(filePath)}: no replacements defined yet`);
  }
}

console.log("\nDone! Now run targeted replacements for remaining patterns.");
