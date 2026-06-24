// Offline, dependency-free Arabic intent search for the assistant.
//
// Scores the user's question against curated intents: matching a "strong" token
// (a trigger/keyword the user actually types) counts much more than matching the
// answer text. Synonyms are expanded so reworded questions still hit. Results
// bias toward the page the user is currently on. The same `searchHelp` interface
// can later front a semantic-embedding layer without touching callers.

import { buildHelpIndex } from "./helpIndex";
import { tokenize } from "./arabicText";

const SYNONYM_GROUPS = [
  ["خصم", "تخفيض", "خصومات", "تنزيلات"],
  ["وردية", "شيفت", "ورديه"],
  ["فاتوره", "فاتورة", "فواتير", "بيع"],
  ["مرتجع", "استرجاع", "ارجاع", "مرتجعات", "رد"],
  ["مخزن", "مخازن", "مستودع", "المخزون"],
  ["مورد", "موردين"],
  ["عميل", "عملاء", "زبون", "زباين"],
  ["خزنه", "خزينه", "خزنة", "كاش"],
  ["تقرير", "تقارير", "كشف"],
  ["صنف", "اصناف", "منتج", "منتجات", "سلعه", "بضاعه"],
  ["طباعه", "طباعة", "طبع", "اطبع"],
  ["اجل", "دين", "الحساب", "تقسيط", "اقساط"],
  ["جرد", "تسويه", "عد"],
];

const SYNONYM_MAP = (() => {
  const map = new Map();
  for (const group of SYNONYM_GROUPS) {
    const norm = group.map((w) => tokenize(w)[0]).filter(Boolean);
    for (const w of norm) map.set(w, norm);
  }
  return map;
})();

function expandTokens(tokens) {
  const out = new Set();
  for (const t of tokens) {
    out.add(t);
    const syns = SYNONYM_MAP.get(t);
    if (syns) syns.forEach((s) => out.add(s));
  }
  return [...out];
}

function partialHit(token, set) {
  if (token.length < 3) return false;
  for (const et of set) {
    if (et.length >= 3 && (et.includes(token) || token.includes(et))) return true;
  }
  return false;
}

function scoreEntry(entry, queryTokens, currentPath) {
  let strong = 0;
  let weak = 0;
  for (const qt of queryTokens) {
    if (entry.strongTokens.has(qt)) strong += 1;
    else if (entry.tokens.has(qt)) weak += 1;
    else if (partialHit(qt, entry.strongTokens)) strong += 0.5;
    else if (partialHit(qt, entry.tokens)) weak += 0.25;
  }
  if (strong === 0 && weak === 0) return 0;

  // Strong (trigger/keyword) matches dominate; answer-text matches help break ties.
  let score = strong * 2 + weak * 0.5;

  // Current-page bias (applied only to intents that already matched something):
  // strongly prefer the intent for the page the user is actually on.
  if (currentPath && entry.route) {
    if (currentPath === entry.route) score += 4;
    else if (currentPath.startsWith(entry.route + "/")) score += 2;
  }
  return score;
}

/**
 * @param {string} query
 * @param {Object} [opts]
 * @param {string} [opts.currentPath]  the current route, for page-biasing
 * @param {number} [opts.limit=3]
 * @returns {{ results: Array<{entry, score}>, confident: boolean }}
 */
export function searchHelp(query, opts = {}) {
  const { currentPath = null, limit = 3 } = opts;
  const baseTokens = tokenize(query);
  if (baseTokens.length === 0) return { results: [], confident: false };

  const queryTokens = expandTokens(baseTokens);
  const index = buildHelpIndex();

  const scored = [];
  for (const e of index) {
    const score = scoreEntry(e, queryTokens, currentPath);
    if (score > 0) scored.push({ entry: e, score });
  }
  scored.sort((a, b) => b.score - a.score);

  const results = scored.slice(0, limit);
  const top = results[0];
  // Confident when the best intent clearly matched real trigger words — used by
  // the hybrid flow to decide whether the optional AI fallback should fire.
  const confident = Boolean(top) && top.score >= 3.5;

  return { results, confident };
}
