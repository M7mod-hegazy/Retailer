import { PRIMARY_MENU, NAV_MODULES } from "../constants/navigation";

const NAV_PATH_TO_PAGE_KEY = {};
PRIMARY_MENU.forEach((item) => {
  if (item.pageKey) NAV_PATH_TO_PAGE_KEY[item.path] = item.pageKey;
});
NAV_MODULES.forEach((mod) => {
  mod.items.forEach((item) => {
    if (item.pageKey) NAV_PATH_TO_PAGE_KEY[item.path] = item.pageKey;
  });
});

const ROUTE_HELP_MATCHERS = [
  // ── Specific routes FIRST (most specific before generic) ──────────────────

  // Dashboard
  { match: /^\/$|^\/dashboard(?:\/|$)/, pageKey: "dashboard" },

  // Workspaces
  { match: /^\/workspace\/finance(?:\/|$)/, pageKey: "finance_workspace" },
  { match: /^\/workspace\/purchases(?:\/|$)/, pageKey: "purchases_workspace" },
  { match: /^\/workspace\/inventory(?:\/|$)/, pageKey: "inventory_workspace" },
  { match: /^\/workspace\/operations(?:\/|$)/, pageKey: "operations_workspace" },
  { match: /^\/workspace\/catalog(?:\/|$)/, pageKey: "catalog_workspace" },
  { match: /^\/workspace\/parties(?:\/|$)/, pageKey: "parties_workspace" },
  { match: /^\/workspace\/resources(?:\/|$)/, pageKey: "resources_workspace" },
  { match: /^\/workspace\/team(?:\/|$)/, pageKey: "team_workspace" },

  // Definitions — specific detail/import routes before generic
  { match: /^\/definitions\/items\/import$/, pageKey: "item_import" },
  { match: /^\/definitions\/items\/[^/]+$/, pageKey: "item_detail" },
  { match: /^\/definitions\/customers\/import$/, pageKey: "account_import" },
  { match: /^\/definitions\/customers\/[^/]+$/, pageKey: "customer_profile" },
  { match: /^\/definitions\/suppliers\/import$/, pageKey: "account_import" },
  { match: /^\/definitions\/suppliers\/[^/]+$/, pageKey: "supplier_profile" },
  { match: /^\/definitions\/expense-categories$/, pageKey: "expense_categories" },
  { match: /^\/definitions\/revenue-categories$/, pageKey: "revenue_categories" },

  // Accounts — import routes before generic
  { match: /^\/accounts\/customers\/import$/, pageKey: "account_import" },
  { match: /^\/accounts\/suppliers\/import$/, pageKey: "account_import" },

  // Sales — specific form/detail routes before list
  { match: /^\/sales\/returns\/new(?:\/|$)|^\/sales\/returns\/\d+\/edit(?:\/|$)/, pageKey: "sales_return_form" },
  { match: /^\/pos\/sales-returns\/[^/]+$/, pageKey: "sales_return_detail" },
  { match: /^\/sales\/returns(?:\/|$)/, pageKey: "sales_returns" },
  { match: /^\/sales(?:\/|$)/, pageKey: "sales_hub" },

  // POS / Invoices
  { match: /^\/invoices\/[^/]+$/, pageKey: "invoice_detail" },
  { match: /^\/pos(?:\/|$)/, pageKey: "pos" },

  // Payments — specific form before list
  { match: /^\/payments\/new$/, pageKey: "payment_form" },
  { match: /^\/payments(?:\/|$)/, pageKey: "payments" },
  { match: /^\/operations\/payment-transactions(?:\/|$)/, pageKey: "payments" },

  // Purchases — specific form/detail routes before list
  { match: /^\/purchases\/new(?:\/|$)|^\/purchases\/\d+\/edit(?:\/|$)/, pageKey: "purchase_form" },
  { match: /^\/purchases\/orders\/new(?:\/|$)|^\/purchases\/orders\/\d+\/edit(?:\/|$)/, pageKey: "purchase_order_form" },
  { match: /^\/purchases\/orders\/\d+\/details(?:\/|$)/, pageKey: "purchase_order_detail" },
  { match: /^\/purchases\/returns\/new(?:\/|$)|^\/purchases\/returns\/\d+\/edit(?:\/|$)/, pageKey: "purchase_return_form" },
  { match: /^\/purchases\/returns\/\d+\/details(?:\/|$)/, pageKey: "purchase_return_detail" },
  { match: /^\/purchases(?:\/|$)/, pageKey: "purchases" },

  // Operations — specific forms before generic
  { match: /^\/operations\/employee-adjustments(?:\/|$)/, pageKey: "employee_adjustments" },
  { match: /^\/operations\/items(?:\/|$)/, pageKey: "item_operations" },
  { match: /^\/branch-transfers\/new(?:\/|$)|^\/branch-transfers\/\d+\/edit(?:\/|$)/, pageKey: "branch_transfer_form" },
  { match: /^\/quotations\/new(?:\/|$)|^\/quotations\/\d+\/edit(?:\/|$)/, pageKey: "quotation_form" },
  { match: /^\/operations\/payment-methods(?:\/|$)/, pageKey: "payment_methods" },
  { match: /^\/operations\/cheques(?:\/|$)/, pageKey: "cheques" },
  { match: /^\/operations\/bulk-price-update(?:\/|$)/, pageKey: "bulk_price_update" },
  { match: /^\/operations\/bank-operations(?:\/|$)/, pageKey: "bank_operations" },

  // Daily Treasury — cashflow before generic
  { match: /^\/daily-treasury\/cashflow$/, pageKey: "cashflow_ledger" },
  { match: /^\/daily-treasury(?:\/|$)/, pageKey: "daily_treasury" },

  // Stock — specific forms before list
  { match: /^\/stock\/transfer\/new(?:\/|$)|^\/stock\/transfer\/\d+\/edit(?:\/|$)/, pageKey: "stock_transfer_form" },
  { match: /^\/stock\/physical-count(?:\/|$)/, pageKey: "physical_count" },
  { match: /^\/stock\/serials$/, pageKey: "serial_lookup" },
  { match: /^\/stock\/levels(?:\/|$)|^\/stock\/movements(?:\/|$)/, pageKey: "stock" },

  // Expenses / Revenues / Withdrawals
  { match: /^\/expenses(?:\/|$)/, pageKey: "expenses" },
  { match: /^\/revenues(?:\/|$)/, pageKey: "revenues" },
  { match: /^\/withdrawals(?:\/|$)/, pageKey: "withdrawals" },

  // Reports — specific before generic
  { match: /^\/reports\/owner-statement(?:\/|$)/, pageKey: "owner_statement" },
  { match: /^\/reports\/expiry-report$/, pageKey: "expiry_report" },
  { match: /^\/reports\/source\/[^/]+\/[^/]+\/[^/]+$/, pageKey: "source_workspace" },
  { match: /^\/reports(?:\/|$)/, pageKey: "reports" },

  // Definitions (simple pages)
  { match: /^\/definitions\/categories(?:\/|$)/, pageKey: "categories" },
  { match: /^\/definitions\/units(?:\/|$)/, pageKey: "units" },
  { match: /^\/definitions\/warehouses(?:\/|$)/, pageKey: "warehouses" },
  { match: /^\/definitions\/branches(?:\/|$)/, pageKey: "branches" },
  { match: /^\/definitions\/users(?:\/|$)/, pageKey: "users" },
  { match: /^\/definitions\/employees(?:\/|$)/, pageKey: "employees" },
  { match: /^\/definitions\/promotions(?:\/|$)/, pageKey: "promotions" },
  { match: /^\/definitions\/banks(?:\/|$)/, pageKey: "banks" },
  { match: /^\/definitions\/financial-categories(?:\/|$)/, pageKey: "financial_categories" },

  // Restaurant / Gold / Repairs
  { match: /^\/restaurant\/tables$/, pageKey: "table_map" },
  { match: /^\/restaurant\/modifier-groups$/, pageKey: "modifier_groups" },
  { match: /^\/gold\/rates$/, pageKey: "gold_rates" },
  { match: /^\/repairs(?:\/|$)/, pageKey: "repair_orders" },

  // Sync — config before generic
  { match: /^\/sync\/config$/, pageKey: "sync_config" },
  { match: /^\/sync(?:\/|$)/, pageKey: "sync_page" },

  // Misc
  { match: /^\/notifications(?:\/|$)/, pageKey: "notifications" },
  { match: /^\/whatsapp-crm(?:\/|$)/, pageKey: "whatsapp_crm" },
  { match: /^\/updates(?:\/|$)/, pageKey: "updates" },
  { match: /^\/history(?:\/|$)/, pageKey: "history" },
  { match: /^\/settings(?:\/|$)/, pageKey: "settings" },
];

export function getHelpPageKey(pathname) {
  const cleanPath = pathname || "/dashboard";
  const matchedRoute = ROUTE_HELP_MATCHERS.find((entry) => entry.match.test(cleanPath));
  if (matchedRoute) return matchedRoute.pageKey;

  const exact = NAV_PATH_TO_PAGE_KEY[cleanPath];
  if (exact) return exact;

  let best = null;
  for (const [path, pageKey] of Object.entries(NAV_PATH_TO_PAGE_KEY)) {
    if (cleanPath === path || cleanPath.startsWith(`${path}/`)) {
      if (!best || path.length > best.path.length) best = { path, pageKey };
    }
  }
  return best?.pageKey ?? null;
}
