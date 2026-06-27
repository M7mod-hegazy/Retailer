import { create } from "zustand";

const FAKE_ITEMS = [
  { id: 1, name: "مياه معدنية 1.5ل", price: 12, qty: 50 },
  { id: 2, name: "عصير تمو", price: 8, qty: 30 },
  { id: 3, name: "تيشيرت قطن", price: 100, qty: 20 },
  { id: 4, name: "بنطلون جينز", price: 250, qty: 15 },
  { id: 5, name: "حذاء رياضي", price: 350, qty: 10 },
  { id: 6, name: "شوكولاتة", price: 15, qty: 100 },
  { id: 7, name: "زيت طعام 1ل", price: 30, qty: 40 },
  { id: 8, name: "سكر 1ك", price: 20, qty: 60 },
  { id: 9, name: "رز 1ك", price: 25, qty: 45 },
  { id: 10, name: "مكرونة", price: 10, qty: 80 },
];

export const useSandboxStore = create((set, get) => ({
  active: false,
  step: 0,
  invoiceLines: [],
  searchQuery: "",
  searchResults: [],
  currentScenario: null,
  scenarioStep: 0,
  completed: false,

  startScenario(scenario) {
    set({ active: true, currentScenario: scenario, scenarioStep: 0, step: 0, invoiceLines: [], searchQuery: "", searchResults: [], completed: false });
  },

  nextScenarioStep() {
    const s = get();
    if (!s.currentScenario) return;
    if (s.scenarioStep < s.currentScenario.steps.length - 1) {
      set({ scenarioStep: s.scenarioStep + 1 });
    } else {
      set({ completed: true });
    }
  },

  prevScenarioStep() {
    const s = get();
    if (s.scenarioStep > 0) set({ scenarioStep: s.scenarioStep - 1 });
  },

  searchItems(query) {
    if (!query.trim()) return set({ searchResults: [], searchQuery: query });
    const results = FAKE_ITEMS.filter(i => i.name.includes(query) || query.includes(String(i.id)));
    set({ searchResults: results, searchQuery: query });
  },

  addToInvoice(item) {
    const s = get();
    const existing = s.invoiceLines.find(l => l.item.id === item.id);
    if (existing) {
      set({ invoiceLines: s.invoiceLines.map(l => l.item.id === item.id ? { ...l, qty: l.qty + 1 } : l) });
    } else {
      set({ invoiceLines: [...s.invoiceLines, { item, qty: 1 }] });
    }
  },

  removeFromInvoice(itemId) {
    set({ invoiceLines: get().invoiceLines.filter(l => l.item.id !== itemId) });
  },

  updateQty(itemId, qty) {
    if (qty <= 0) return get().removeFromInvoice(itemId);
    set({ invoiceLines: get().invoiceLines.map(l => l.item.id === itemId ? { ...l, qty } : l) });
  },

  resetScenario() {
    set({ active: false, currentScenario: null, scenarioStep: 0, invoiceLines: [], searchQuery: "", searchResults: [], completed: false, step: 0 });
  },

  get total() {
    return get().invoiceLines.reduce((sum, l) => sum + l.item.price * l.qty, 0);
  },
}));
