const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const { default: traverse } = require('@babel/traverse');
const ROOT = 'D:/code/retailer/client/src';
const KNOWN_GLOBALS = new Set([
  'React','Fragment','Suspense','lazy','memo','forwardRef',
  'createContext','useRef','useEffect','useState','useContext',
  'useReducer','useCallback','useMemo','useImperativeHandle',
  'useLayoutEffect','useDebugValue','useTransition','useDeferredValue',
  'useId','useSyncExternalStore','useInsertionEffect',
  'useNavigate','useParams','useLocation','useSearchParams',
  'useRouteError','useLoaderData','useActionData',
  'useFormStatus','useFormState',
  'describe','it','test','expect','beforeEach','afterEach',
  'beforeAll','afterAll','vi','jest',
  'window','document','console','setTimeout','setInterval',
  'clearTimeout','clearInterval','fetch',
  'useTranslation','Trans',
  'motion','AnimatePresence',
]);
function analyzeFile(filepath) {
  const content = fs.readFileSync(filepath, 'utf8');
  const filename = path.relative(ROOT, filepath);
  let ast;
  try {
    ast = parser.parse(content, {
      sourceType: 'module',
      plugins: ['jsx','decorators','classProperties','optionalChaining','nullishCoalescingOperator','dynamicImport'],
      errorRecovery: true,
    });
  } catch(e) { return { filename, missing: [], parseError: e.message }; }
  const imported = new Map();
  const importLines = [];
  const NL = "\n";
  for (const node of ast.program.body) {
    if (node.type !== 'ImportDeclaration') continue;
    importLines.push({ line: node.loc.start.line, text: content.split(NL)[node.loc.start.line-1].trim() });
    for (const spec of node.specifiers) {
      if (spec.type === 'ImportDefaultSpecifier' || spec.type === 'ImportSpecifier') imported.set(spec.local.name, node.source.value);
      else if (spec.type === 'ImportNamespaceSpecifier') imported.set(spec.local.name, node.source.value);
    }
  }
  const locals = new Set();
  function procDecl(d) {
    if (d.id && d.id.type === 'Identifier' && /^[A-Z]/.test(d.id.name)) locals.add(d.id.name);
    if (d.id && d.id.type === 'ObjectPattern') {
      for (const p of d.id.properties) {
        if (p.type === 'ObjectProperty' && p.value && p.value.type === 'Identifier' && /^[A-Z]/.test(p.value.name)) locals.add(p.value.name);
      }
    }
  }
  for (const node of ast.program.body) {
    if (node.type === 'VariableDeclaration') for (const d of node.declarations) procDecl(d);
    if (node.type === 'FunctionDeclaration' && node.id && /^[A-Z]/.test(node.id.name)) locals.add(node.id.name);
    if (node.type === 'ExportDefaultDeclaration' && node.declaration) {
      if (node.declaration.type === 'FunctionDeclaration' && node.declaration.id) locals.add(node.declaration.id.name);
      else if (node.declaration.type === 'Identifier') locals.add(node.declaration.name);
    }
  }
  const inlineLocals = new Set();
  traverse(ast, {
    VariableDeclarator(np) {
      if (np.parentPath && np.parentPath.parentPath && np.parentPath.parentPath.type === 'Program') return;
      const id = np.node.id;
      if (id && id.type === 'Identifier' && /^[A-Z]/.test(id.name)) inlineLocals.add(id.name);
    },
    FunctionDeclaration(np) {
      if (np.parentPath && np.parentPath.type === 'Program') return;
      if (np.node.id && /^[A-Z]/.test(np.node.id.name)) inlineLocals.add(np.node.id.name);
    }
  });
  const dynamicProps = new Set();
  traverse(ast, {
    JSXOpeningElement(np) {
      const n = np.node.name;
      if (n.type === 'JSXMemberExpression') {
        let obj = n.object;
        while (obj.type === 'JSXMemberExpression') obj = obj.object;
        if (obj.type === 'JSXIdentifier' && /^[a-z_]/.test(obj.name)) dynamicProps.add(n.property.name);
      }
    }
  });
  const tagLines = new Map();
  traverse(ast, {
    JSXOpeningElement(np) {
      const n = np.node.name;
      if (n.type === 'JSXIdentifier' && /^[A-Z]/.test(n.name)) {
        if (!tagLines.has(n.name)) tagLines.set(n.name, []);
        tagLines.get(n.name).push(np.node.loc.start.line);
      }
    }
  });
  const missing = [];
  for (const [tag, lines] of tagLines) {
    if (KNOWN_GLOBALS.has(tag) || imported.has(tag) || locals.has(tag) || inlineLocals.has(tag) || dynamicProps.has(tag)) continue;
    missing.push({ tag, lines: [...new Set(lines)].sort((a,b)=>a-b) });
  }
  return { filename, missing, importLines, locals: [...locals], inlineLocals: [...inlineLocals], dynamicProps: [...dynamicProps] };
}
const files = [
  'pages/settings/PrintingSettingsPanel.jsx','pages/reports/reportsCenterParts.jsx','pages/reports/ReportWorkspacePage.jsx',
  'pages/reports/SourceWorkspacePage.jsx','pages/reports/ReportsCenter.jsx','pages/settings/AppIdentityTab.jsx',
  'pages/operations/PaymentMethodsPage.jsx','pages/operations/AjalTrackerPage.jsx','pages/updates/UpdatesPage.jsx',
  'pages/definitions/FinancialCategoriesPage.jsx','pages/definitions/UsersPage.jsx','pages/items/import/WizardShell.jsx',
  'components/print/designer/PrintDesigner.jsx','components/print/LayoutRenderer.jsx','components/ui/PerformanceSettings.jsx',
  'components/ui/DateInput.jsx','pages/dashboard/AnalyticsPage.jsx','pages/accounts/CustomerAccountsPage.jsx',
  'pages/accounts/SupplierAccountsPage.jsx','pages/payments/PaymentsListPage.jsx','pages/expenses/ExpensesListPage.jsx',
  'pages/expenses/RevenuesListPage.jsx','pages/expenses/WithdrawalsListPage.jsx','pages/notifications/NotificationsPage.jsx',
  'pages/items/import/steps/Step10Done.jsx','pages/pos/POSPage.jsx','pages/purchases/PurchaseFormPage.jsx',
  'pages/search/GlobalSearchPage.jsx','pages/owner/OwnerStatementPage.jsx','pages/stock/StockLevelsPage.jsx',
  'pages/settings/WhatsAppSettingsTab.jsx','pages/pos/DailyTreasuryPage.jsx','components/document/DocumentActionButton.jsx',
  'components/layout/MobileLayout.jsx','components/operations/DocumentPreviewModal.jsx','components/pos/AdvancedSearchModal.jsx',
  'components/pos/InvoiceProfitModal.jsx','components/print/PrintPreviewModal.jsx','components/stock/PhysicalCountStepper.jsx',
  'components/ui/SectionHero.jsx','components/ui/StatCard.jsx','components/ui/ThemeLanguageControls.jsx',
  'components/ui/Button.jsx','components/print/Receipt58mm.jsx','components/print/Receipt80mm.jsx',
  'pages/dashboard/DashboardPage.jsx',
];
let found = false;
const NL = "\n";
for (const relPath of files) {
  const fp = path.join(ROOT, relPath);
  if (!fs.existsSync(fp)) continue;
  const r = analyzeFile(fp);
  if (r.parseError) { console.log('PARSE_ERR: ' + r.filename + ' | ' + r.parseError); continue; }
  if (r.missing.length > 0) {
    found = true;
    console.log('--- ' + r.filename + ' ---');
    console.log('  IMPORTS:');
    for (const il of r.importLines) console.log('    L' + il.line + ': ' + il.text);
    if (r.locals.length > 0) console.log('  LOCALS: ' + r.locals.join(', '));
    if (r.inlineLocals.length > 0) console.log('  INLINE: ' + r.inlineLocals.join(', '));
    if (r.dynamicProps.length > 0) console.log('  DYNAMIC: ' + r.dynamicProps.join(', '));
    for (const m of r.missing) {
      console.log('  >>> <' + m.tag + '> at lines ' + m.lines.join(', '));
      const lines = fs.readFileSync(fp, 'utf8').split(NL);
      for (const ln of m.lines) {
        for (let i = Math.max(0,ln-2); i < Math.min(lines.length,ln+1); i++) {
          console.log((i+1===ln ? '  >>>' : '     ') + ' L' + (i+1) + ': ' + lines[i]);
        }
      }
    }
  }
}
if (!found) console.log('None found.');
