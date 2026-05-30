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
  { match: /^\/$|^\/dashboard(?:\/|$)/, pageKey: "dashboard" },
  { match: /^\/workspace\/finance(?:\/|$)/, pageKey: "finance_workspace" },
  { match: /^\/workspace\/purchases(?:\/|$)/, pageKey: "purchases_workspace" },
  { match: /^\/workspace\/inventory(?:\/|$)/, pageKey: "inventory_workspace" },
  { match: /^\/workspace\/operations(?:\/|$)/, pageKey: "operations_workspace" },
  { match: /^\/workspace\/catalog(?:\/|$)/, pageKey: "catalog_workspace" },
  { match: /^\/workspace\/parties(?:\/|$)/, pageKey: "parties_workspace" },
  { match: /^\/workspace\/resources(?:\/|$)/, pageKey: "resources_workspace" },
  { match: /^\/workspace\/team(?:\/|$)/, pageKey: "team_workspace" },
  { match: /^\/definitions\/items\/[^/]+$/, pageKey: "item_detail" },
  { match: /^\/definitions\/customers\/[^/]+$/, pageKey: "customer_profile" },
  { match: /^\/definitions\/suppliers\/[^/]+$/, pageKey: "supplier_profile" },
  { match: /^\/operations\/items(?:\/|$)/, pageKey: "item_operations" },
  { match: /^\/sales\/returns(?:\/|$)|^\/pos\/sales-returns(?:\/|$)/, pageKey: "sales_returns" },
  { match: /^\/sales(?:\/|$)/, pageKey: "sales" },
  { match: /^\/invoices(?:\/|$)|^\/pos(?:\/|$)/, pageKey: "pos" },
  { match: /^\/payments(?:\/|$)/, pageKey: "payments" },
  { match: /^\/operations\/payment-transactions(?:\/|$)/, pageKey: "payments" },
  { match: /^\/operations\/employee-adjustments(?:\/|$)/, pageKey: "employee_adjustments" },
  { match: /^\/reports\/owner-statement(?:\/|$)/, pageKey: "owner_statement" },
  { match: /^\/reports(?:\/|$)/, pageKey: "reports" },
  { match: /^\/notifications(?:\/|$)/, pageKey: "notifications" },
  { match: /^\/stock\/levels(?:\/|$)|^\/stock\/movements(?:\/|$)/, pageKey: "stock" },
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
