const fs = require("fs");
let content = fs.readFileSync(
  "D:/code/retailer/client/src/pages/purchases/PurchaseFormPage.jsx",
  "utf8"
);

const replacements = [
  // Quantity input (regular attr)
  ['text-center text-sm font-mono font-black bg-transparent outline-none border-0 ring-0 focus:ring-0 focus:bg-emerald-50/50 transition-colors disabled:cursor-not-allowed"', 'text-center text-sm number-fmt-primary bg-transparent outline-none border-0 ring-0 focus:ring-0 focus:bg-emerald-50/50 transition-colors disabled:cursor-not-allowed"'],

  // Cost input (template literal)
  ['text-center text-sm font-mono font-black outline-none border-0 ring-0 focus:ring-0 transition-colors disabled:cursor-not-allowed ${costChanged', 'text-center text-sm number-fmt-primary outline-none border-0 ring-0 focus:ring-0 transition-colors disabled:cursor-not-allowed ${costChanged'],

  // Old cost display (regular attr)
  ['<span className="text-slate-400 font-mono">{Number(l.original_unit_cost).toFixed(2)}</span>', '<span className="text-slate-400 number-fmt">{Number(l.original_unit_cost).toFixed(2)}</span>'],

  // New cost (template literal)
  ['className={`font-mono font-black ${Number(l.unit_cost) > Number(l.original_unit_cost)', 'className={`number-fmt ${Number(l.unit_cost) > Number(l.original_unit_cost)'],

  // Selling price input (template literal)
  ['text-center text-sm font-mono font-black outline-none border-0 ring-0 focus:ring-0 transition-colors disabled:cursor-not-allowed ${belowMargin', 'text-center text-sm number-fmt-primary outline-none border-0 ring-0 focus:ring-0 transition-colors disabled:cursor-not-allowed ${belowMargin'],

  // Profit (template literal)
  ['<span className={`text-2sm font-mono font-black ${isProfit', '<span className={`text-2sm number-fmt ${isProfit'],

  // Wholesale input (template literal)
  ['text-center text-sm font-mono font-black outline-none border-0 ring-0 focus:ring-0 transition-colors disabled:cursor-not-allowed ${changed', 'text-center text-sm number-fmt-primary outline-none border-0 ring-0 focus:ring-0 transition-colors disabled:cursor-not-allowed ${changed'],

  // Expiry date input (regular attr) - KEEP font-mono for date inputs
  // Skipping - date input should keep font-mono

  // Total column (regular attr)
  ['font-black font-mono text-sm text-slate-900', 'number-fmt-primary text-sm text-slate-900'],

  // Balance (template literal)
  ['text-sm font-black font-mono ${dispBal', 'text-sm number-fmt-primary ${dispBal'],

  // Balance change badge (template literal)
  ['text-[9px] font-black font-mono px-1 py-0.5', 'text-[9px] number-fmt px-1 py-0.5'],

  // Balance change amount (template literal)
  ['text-2sm font-black font-mono ${balChange', 'text-2sm number-fmt ${balChange'],

  // New balance (template literal)
  ['text-sm font-black font-mono ${newBal', 'text-sm number-fmt-primary ${newBal'],

  // Multi payment input (regular attr)
  ['text-left font-mono text-2sm font-black text-slate-800 outline-none focus:border-indigo-400', 'text-left number-fmt-primary text-2sm text-slate-800 outline-none focus:border-indigo-400'],

  // Credit effect (regular attr)
  ['<span className="font-mono font-black text-amber-700">+{formatMoney(creditEffect)}</span>', '<span className="number-fmt-primary text-amber-700">+{formatMoney(creditEffect)}</span>'],

  // Price report original cost (regular attr)
  ['<td className="px-3 py-2 text-center font-mono text-slate-400 whitespace-nowrap">{Number(l.original_unit_cost)', '<td className="px-3 py-2 text-center number-fmt text-slate-400 whitespace-nowrap">{Number(l.original_unit_cost)'],

  // Price report new cost (regular attr)
  ['<td className="px-3 py-2 text-center font-mono font-black whitespace-nowrap">', '<td className="px-3 py-2 text-center number-fmt whitespace-nowrap">'],

  // Price report original sale (regular attr)
  ['<td className="px-3 py-2 text-center font-mono text-slate-400 whitespace-nowrap">{Number(l.original_sale_price)', '<td className="px-3 py-2 text-center number-fmt text-slate-400 whitespace-nowrap">{Number(l.original_sale_price)'],

  // Price report new sale (regular attr)
  // (same pattern as new cost above, skip since we replaced all instances)

  // Price report wholesale original (regular attr)
  ['<td className="px-3 py-2 text-center font-mono text-slate-400 whitespace-nowrap">{Number(l.original_wholesale_price)', '<td className="px-3 py-2 text-center number-fmt text-slate-400 whitespace-nowrap">{Number(l.original_wholesale_price)'],

  // Price report wholesale new (regular attr)

  // Invoices table total column (regular attr)
  ['px-3 font-mono text-sm font-black text-emerald-700"', 'px-3 number-fmt-primary text-sm text-emerald-700"'],
];

let count = 0;
for (const [oldStr, newStr] of replacements) {
  if (content.includes(oldStr)) {
    content = content.replace(oldStr, newStr);
    count++;
  } else {
    // Try without the line with template literal that might differ
  }
}

fs.writeFileSync(
  "D:/code/retailer/client/src/pages/purchases/PurchaseFormPage.jsx",
  content
);
console.log(count + " replacements applied.");
const remaining = (content.match(/font-mono/g) || []).length;
console.log("Remaining font-mono: " + remaining);
