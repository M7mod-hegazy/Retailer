// Builds the searchable index for the offline assistant from the curated intent
// knowledge base (assistantKnowledge.js). Each entry keeps the natural answer
// and exact route, plus two token sets: "strong" (triggers/title/keywords — what
// the user actually types) and "weak" (answer text — supporting signal).

import KNOWLEDGE from "./assistantKnowledge";
import { tokenize } from "./arabicText";

let cachedIndex = null;

function buildEntry(intent) {
  const strongText = [intent.title, ...(intent.triggers || []), ...(intent.keywords || [])].join(" ");
  const strongTokens = new Set(tokenize(strongText));
  const weakTokens = new Set(tokenize(intent.answer || ""));
  return {
    id: intent.id,
    route: intent.route || null,
    title: intent.title,
    answer: intent.answer,
    followups: intent.followups || [],
    pageKey: intent.pageKey || null,
    strongTokens,
    // Combined set used for coverage; strong tokens also live here.
    tokens: new Set([...strongTokens, ...weakTokens]),
  };
}

export function buildHelpIndex() {
  if (cachedIndex) return cachedIndex;
  cachedIndex = KNOWLEDGE.map(buildEntry);
  return cachedIndex;
}

// Look up a single intent entry by id (for follow-up suggestions).
export function getIntentById(id) {
  return buildHelpIndex().find((e) => e.id === id) || null;
}

export function _resetHelpIndex() {
  cachedIndex = null;
}
