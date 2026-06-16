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

const KEEP = 'MONO_KEEP_XXX';

const keepers = {
  [`${CLIENT}/purchases/PurchaseOrderFormPage.jsx`]: [
    `text-center font-mono text-2sm text-slate-400 border-l border-slate-100`,
    `font-mono text-2sm font-black tracking-wider text-slate-500 border-l border-slate-100 text-center`,
  ],
  [`${CLIENT}/purchases/PurchaseOrdersPage.jsx`]: [
    `font-mono text-[18px] font-black text-slate-900 tracking-tight`,
    `font-mono text-[11px] text-slate-500 bg-white/70 border border-slate-200 rounded px-1.5 py-0.5`,
    `font-bold text-slate-700 font-mono tracking-tight`,
    `text-sm font-black font-mono text-slate-900`,
    `font-mono text-2sm text-slate-500`,
  ],
  [`${CLIENT}/purchases/PurchasesHubPage.jsx`]: [
    `font-black text-zinc-800 font-mono`,
    `font-mono text-xl font-black text-zinc-950`,
    `font-mono text-sm font-bold text-zinc-600`,
    `font-mono text-[11px] font-black text-zinc-400`,
    `font-black text-zinc-900 font-mono tracking-tight`,
    `font-mono text-[11px] font-black text-emerald-700 shrink-0`,
    `px-5 py-4 font-mono font-black text-zinc-700`,
    `font-mono text-[11px] whitespace-nowrap`,
  ],
  [`${CLIENT}/purchases/PurchaseReturnFormPage.jsx`]: [
    `font-black text-amber-900 font-mono tracking-tight leading-tight`,
    `font-mono text-[8px] text-slate-400 leading-none`,
    `font-mono text-slate-500`,
    `font-mono font-black text-slate-400 cursor-not-allowed outline-none`,
    `font-mono text-slate-400`,
  ],
  [`${CLIENT}/purchases/PurchaseReturnsListPage.jsx`]: [
    `font-black text-zinc-800 font-mono`,
    `font-mono text-xl font-black text-zinc-950`,
    `font-mono text-sm font-bold text-zinc-600`,
    `font-mono text-sm font-black text-indigo-700 hover:underline`,
    `font-mono text-[11px] font-black text-zinc-400`,
    `font-black text-zinc-900 font-mono tracking-tight`,
    `font-mono text-zinc-700 hover:text-blue-600`,
    `font-mono text-[11px] font-black text-blue-700 shrink-0`,
    `font-mono font-black text-zinc-700`,
    `font-mono text-[11px] whitespace-nowrap`,
  ],
  [`${CLIENT}/sales/SalesHubPage.jsx`]: [
    `font-mono text-xl font-black text-zinc-950`,
    `font-mono text-sm font-bold text-zinc-600`,
    `="font-mono font-black text-zinc-700"`,
    `font-mono text-[11px] font-black text-zinc-400`,
    `font-black text-zinc-900 font-mono tracking-tight`,
    `font-mono text-[11px] font-black text-blue-700 shrink-0`,
    `px-5 py-4 font-mono font-black text-zinc-700`,
    `font-mono text-[11px] whitespace-nowrap`,
  ],
  [`${CLIENT}/sales/SalesReturnFormPage.jsx`]: [
    `font-black text-amber-900 font-mono tracking-tight leading-tight`,
    `font-mono text-[8px] text-slate-400 leading-none`,
    `font-mono text-slate-500`,
    `font-mono font-black text-slate-400 cursor-not-allowed outline-none`,
    `font-mono text-slate-400`,
  ],
  [`${CLIENT}/sales/SalesReturnsListPage.jsx`]: [
    `font-black text-zinc-800 font-mono`,
    `font-mono text-xl font-black text-zinc-950`,
    `font-mono text-sm font-bold text-zinc-600`,
    `font-mono text-sm font-black text-indigo-700 hover:underline`,
    `font-mono text-[11px] font-black text-zinc-400`,
    `font-black text-zinc-900 font-mono tracking-tight`,
    `font-mono text-zinc-700 hover:text-emerald-600`,
    `font-mono text-[11px] font-black text-emerald-700 shrink-0`,
    `font-mono font-black text-zinc-700`,
    `font-mono text-[11px] whitespace-nowrap`,
  ],
  [`${CLIENT}/operations/BranchTransferFormPage.jsx`]: [
    `text-center font-mono text-[11px] text-slate-400 border-l border-slate-100`,
    `font-mono text-[11px] font-black tracking-wider text-slate-500 border-l border-slate-100 text-center`,
    `font-mono text-slate-600 min-w-[36px] text-center`,
    `font-mono font-black text-slate-500`,
    `font-mono font-bold text-slate-400`,
    `font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 tracking-wide`,
  ],
  [`${CLIENT}/operations/BranchTransferPage.jsx`]: [
    `font-mono text-2sm text-slate-400`,
    `font-mono text-2sm text-slate-600`,
    `font-mono text-[11px] font-black text-emerald-700 shrink-0`,
    `font-mono text-[16px] font-black text-zinc-900 tracking-tight`,
    `font-mono font-black text-zinc-700`,
    `font-mono text-[11px] whitespace-nowrap`,
    `font-mono text-[11px] font-black text-zinc-400`,
  ],
  [`${CLIENT}/operations/QuotationFormPage.jsx`]: [
    `font-mono text-[11px] font-black text-indigo-700 shrink-0`,
    `text-[11px] font-mono text-slate-400`,
    `font-mono text-[11px] font-black rounded-sm px-1 shrink-0`,
    `font-mono text-slate-400 border-l border-slate-50 text-[11px]`,
    `font-mono text-[11px] font-bold text-slate-500 truncate block`,
    `font-mono text-sm font-black`,
  ],
  [`${CLIENT}/operations/QuotationsPage.jsx`]: [
    `font-mono text-[18px] font-black text-slate-900 tracking-tight`,
    `font-bold text-slate-700 font-mono mt-0.5`,
    `font-mono text-[10px] text-slate-400 truncate`,
    `font-mono text-sm text-slate-600`,
    `font-mono text-sm text-rose-500`,
  ],
};

for (const filePath of files) {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`SKIP: ${filePath} not found`);
    continue;
  }

  let content = fs.readFileSync(fullPath, 'utf-8');
  const fileKeepers = keepers[filePath] || [];
  let keeperCount = 0;

  for (const k of fileKeepers) {
    const pat = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const count = (content.match(new RegExp(pat, 'g')) || []).length;
    if (count === 0) {
      console.log(`  NOT FOUND in ${path.basename(filePath)}: "${k.substring(0, 60)}..."`);
    }
    content = content.replaceAll(k, k.replace(/font-mono/g, KEEP));
    keeperCount += count;
  }

  let beforeCount = (content.match(/font-mono/g) || []).length;

  // 1) font-black ~ font-mono (separated, any order) → number-fmt-primary
  while (/(font-black)((?:\s+\S+)*?)\s+font-mono/.test(content)) {
    content = content.replace(/(font-black)((?:\s+\S+)*?)\s+font-mono/g, 'number-fmt-primary$2');
  }
  while (/(font-mono)((?:\s+\S+)*?)\s+font-black/.test(content)) {
    content = content.replace(/(font-mono)((?:\s+\S+)*?)\s+font-black/g, 'number-fmt-primary$2');
  }

  // 2) font-bold ~ font-mono (separated, any order) → number-fmt
  while (/(font-bold)((?:\s+\S+)*?)\s+font-mono/.test(content)) {
    content = content.replace(/(font-bold)((?:\s+\S+)*?)\s+font-mono/g, 'number-fmt$2');
  }
  while (/(font-mono)((?:\s+\S+)*?)\s+font-bold/.test(content)) {
    content = content.replace(/(font-mono)((?:\s+\S+)*?)\s+font-bold/g, 'number-fmt$2');
  }

  // 3) tabular-nums font-mono → number-fmt
  content = content.replace(/tabular-nums\s+font-mono/g, 'number-fmt');

  // 4) standalone font-mono → number-fmt
  content = content.replace(/font-mono/g, 'number-fmt');

  // Restore sentinels
  content = content.replaceAll(KEEP, 'font-mono');

  fs.writeFileSync(fullPath, content, 'utf-8');

  let afterCount = (content.match(/font-mono/g) || []).length;
  let done = keeperCount - beforeCount;
  console.log(`${path.basename(filePath)}: ${keeperCount} keepers, ${beforeCount} remaining → ${afterCount} after (${keeperCount - afterCount} net replaced)`);
}

console.log("\nDone!");
