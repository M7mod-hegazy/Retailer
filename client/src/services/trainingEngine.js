import api from "./api";

// ─── Training tracks ──────────────────────────────────────────────────────────

const TRAINING_TRACKS = [
  {
    id: "cashier",
    nameAr: "الكاشير",
    nameEn: "Cashier",
    modules: [
      { key: "cashier_basics", nameAr: "أساسيات البيع", nameEn: "Sales Basics", icon: "🛒" },
      { key: "cashier_search", nameAr: "البحث عن الأصناف", nameEn: "Item Search", icon: "🔍" },
      { key: "cashier_payment", nameAr: "طرق الدفع", nameEn: "Payment Methods", icon: "💳" },
      { key: "cashier_discount", nameAr: "الخصم والخصومات", nameEn: "Discounts", icon: "🏷️" },
      { key: "cashier_return", nameAr: "المرتجعات", nameEn: "Returns", icon: "↩️" },
      { key: "cashier_receipt", nameAr: "طباعة الإيصال", nameEn: "Receipt Printing", icon: "🧾" },
    ],
  },
  {
    id: "manager",
    nameAr: "المدير",
    nameEn: "Manager",
    modules: [
      { key: "manager_reports", nameAr: "التقارير", nameEn: "Reports", icon: "📊" },
      { key: "manager_inventory", nameAr: "إدارة المخزون", nameEn: "Inventory Management", icon: "📦" },
      { key: "manager_purchases", nameAr: "المشتريات", nameEn: "Purchases", icon: "📥" },
      { key: "manager_employees", nameAr: "الموظفين", nameEn: "Employees", icon: "👥" },
      { key: "manager_shifts", nameAr: "الورديات والتسوية", nameEn: "Shifts & Settlement", icon: "🔄" },
      { key: "manager_accounts", nameAr: "حسابات العملاء والموردين", nameEn: "Accounts", icon: "📒" },
    ],
  },
];

export function getTrainingTracks(role) {
  if (role === "admin" || role === "manager") return TRAINING_TRACKS;
  return TRAINING_TRACKS.filter(t => t.id === "cashier");
}

// ─── Quiz definitions per module ──────────────────────────────────────────────

const QUIZZES = {
  cashier_basics: [
    { question: "من أي شاشة تبدأ عملية بيع جديدة؟", options: ["المخزون", "العملاء", "نقطة البيع", "التقارير"], correct: 2 },
    { question: "إزاي تضيف صنف للفاتورة؟", options: ["بضغط على الصنف", "بكتابة الاسم أو مسح الباركود", "بفتح المخزون", "كل ما سبق"], correct: 1 },
    { question: "أيه أول حاجة تعملها قبل البيع الآجل؟", options: ["تحديد طريقة الدفع", "تحديد العميل", "طباعة الفاتورة", "حفظ الفاتورة"], correct: 1 },
    { question: "إيه معنى فاتورة 'آجل'؟", options: ["العميل دفع كامل", "العميل هيدفع بعدين", "الفاتورة ملغية", "الفاتورة مطبوعة"], correct: 1 },
    { question: "كام حد أدنى للبحث عن صنف؟", options: ["أي حرف", "حرفين", "3 حروف", "الاسم كامل"], correct: 2 },
  ],
  cashier_search: [
    { question: "أسرع طريقة للبحث عن صنف في شاشة البيع؟", options: ["فتح قائمة الأصناف", "كتابة الاسم في خانة البحث", "فتح المخازن", "سؤال المدير"], correct: 1 },
    { question: "ينفع تبحث بالباركود؟", options: ["أيوه", "لأ", "فقط لو الرقم طويل"], correct: 0 },
    { question: "لو مش لاقي الصنف، تعمل إيه؟", options: ["تستنى", "تستخدم البحث المتقدم أو تتأكد من البيانات", "تفتح فاتورة جديدة"], correct: 1 },
    { question: "اختصار الكيبورد للبحث هو إيه؟", options: ["F1", "F2", "F3", "F4"], correct: 1 },
  ],
  cashier_payment: [
    { question: "أيه طرق الدفع المتاحة؟", options: ["نقدي وفيزا فقط", "نقدي وفيزا وآجل", "فيزا وآجل فقط", "نقدي فقط"], correct: 1 },
    { question: "إزاي تقسم الدفع بين طريقتين؟", options: ["ممكن", "مش ممكن", "فقط لو مدير"], correct: 0 },
    { question: "لو العميل دفع part وحط الباقي على حسابه؟", options: ["مش مسموح", "اختار جزء نقدي والباقي آجل", "الفاتورة تقف"], correct: 1 },
    { question: "أيه الزر اللي تضغط عليه بعد إضافة كل الأصناف؟", options: ["حفظ", "دفع", "طباعة", "رجوع"], correct: 1 },
  ],
  cashier_discount: [
    { question: "فيه كام نوع خصم في الفاتورة؟", options: ["نوع واحد", "نوعين: على السطر وعلى الإجمالي", "3 أنواع", "مفيش خصم"], correct: 1 },
    { question: "الخصم على سطر صنف بيأثر على إيه؟", options: ["الفاتورة كلها", "السطر بس", "العميل"], correct: 1 },
    { question: "مين اللي يحدد صلاحية الخصم؟", options: ["أي حد", "المدير من صلاحيات المستخدمين", "البرنامج"], correct: 1 },
    { question: "الخصم يتحدد بإيه؟", options: ["نسبة أو مبلغ", "نسبة بس", "مبلغ بس"], correct: 0 },
  ],
  cashier_return: [
    { question: "أول خطوة في عمل مرتجع؟", options: ["تحديد العميل", "ربطه بالفاتورة الأصلية", "تحديد الخزنة", "السبب"], correct: 1 },
    { question: "المرتجع بيأثر على إيه؟", options: ["المخزون بس", "العميل والمخزون", "العميل بس"], correct: 1 },
    { question: "طرق استرداد الفلوس في المرتجع؟", options: ["نقدي بس", "نقدي أو رصيد أو استبدال", "استبدال بس"], correct: 1 },
    { question: "المرتجع لازم يكون مرتبط بإيه؟", options: ["العميل", "الفاتورة الأصلية", "المخزون"], correct: 1 },
  ],
  cashier_receipt: [
    { question: "الفاتورة بتتطبع تلقائي بعد إيه؟", options: ["بعد الحفظ", "بعد اختيار الدفع", "بعد الضغط على طباعة"], correct: 0 },
    { question: "ممكن تطبع الفاتورة تاني منين؟", options: ["من التقارير", "من تفاصيل الفاتورة في المبيعات", "مش ممكن"], correct: 1 },
  ],
  manager_reports: [
    { question: "أهم تقرير لمعرفة أرباحك؟", options: ["تقرير مبيعات", "تقرير الأرباح", "تقرير المخزون"], correct: 1 },
    { question: "التقارير تتصدر بصيغة إيه؟", options: ["PDF و Excel", "Word فقط", "PDF فقط"], correct: 0 },
    { question: "مين يقدر يشوف التقارير؟", options: ["كل المستخدمين", "اللي عنده صلاحية بس", "المدير فقط"], correct: 1 },
  ],
  manager_inventory: [
    { question: "إزاي تعرف رصيد صنف في المخزون؟", options: ["من أرصدة المخزون", "من التقارير", "الاتنين صح"], correct: 2 },
    { question: "الفرق بين التحويل المخزني والنقل بين الفروع؟", options: ["مفيش فرق", "التحويل بنفس التكلفة، النقل بين الفروع ممكن يغير التكلفة", "النقل أسرع"], correct: 1 },
    { question: "الجرد الفعلي بيعمل إيه؟", options: ["بيزود الأسعار", "بيظبط الأرصدة على الواقع", "بيحذف الأصناف"], correct: 1 },
  ],
  manager_purchases: [
    { question: "الفرق بين فاتورة شراء وأمر توريد؟", options: ["هما نفس الحاجة", "أمر توريد طلب، فاتورة شراء استلام فعلي", "الأمر للموردين بس"], correct: 1 },
    { question: "لما البضاعة توصل بعد أمر التوريد، اعمل إيه؟", options: ["اعمل فاتورة شراء جديدة", "افتح الأمر واختار استلام", "استنى الفاتورة تيجي"], correct: 1 },
    { question: "فاتورة المشتريات بتزود إيه؟", options: ["المخزون والرصيد للمورد", "المخزون بس", "الفلوس بس"], correct: 0 },
  ],
  manager_employees: [
    { question: "الفرق بين الموظف والمستخدم؟", options: ["نفس الحاجة", "الموظف بياناته الشخصية، المستخدم حسابه لدخول النظام", "كل موظف لازم يكون مستخدم"], correct: 1 },
    { question: "العمولة بتتحسب بناء على إيه؟", options: ["حسب إعدادات العمولة", "نسبة من إجمالي المبيعات", "كل ما سبق"], correct: 2 },
    { question: "السلفة بتتسجل منين؟", options: ["من الموظفين", "من تسويات الموظفين", "من المصروفات"], correct: 1 },
  ],
  manager_shifts: [
    { question: "الوردية بتقفل إيه لوحدها؟", options: ["أيوه", "لأ، بتقفل يدوي", "بتقفل بنهاية اليوم"], correct: 1 },
    { question: "تسوية الخزنة بتتأكد من إيه؟", options: ["الفلوس في الدرج مع النظام", "الأصناف في المخزن", "الفواتير"], correct: 0 },
    { question: "الخلاف في تسوية الخزنة بيسجل في إيه؟", options: ["مصروف", "فرق خزنة", "ضريبة"], correct: 1 },
  ],
  manager_accounts: [
    { question: "كشف حساب العميل بيظهر إيه؟", options: ["كل فواتيره ومدفوعاته", "آخر فاتورة بس", "رصيده فقط"], correct: 0 },
    { question: "الحد الائتماني للعميل معناه إيه؟", options: ["أقصى دين مسموح", "أقل دين", "الخصم المسموح"], correct: 0 },
    { question: "المستحق للمورد معناه إيه؟", options: ["اللي أخدته منه", "اللي لسه مدفعتوش", "المبيعات"], correct: 1 },
  ],
};

export function getQuiz(moduleKey) {
  return QUIZZES[moduleKey] || [];
}

export function getModuleQuizzes() {
  return QUIZZES;
}

// ─── Scenario simulations ─────────────────────────────────────────────────────

const SCENARIOS = [
  {
    id: "scenario_1",
    track: "cashier",
    titleAr: "عميل عايز يشتري 3 منتجات",
    titleEn: "Customer buys 3 items",
    steps: [
      { instructionAr: "افتح شاشة نقطة البيع", instructionEn: "Open the POS screen", action: "navigate", route: "/pos" },
      { instructionAr: "ابحث عن أول صنف وضيفه", instructionEn: "Search and add first item", action: "highlight", target: "pos-search" },
      { instructionAr: "ظبط الكمية للصنف الأول", instructionEn: "Set quantity for first item", action: "highlight", target: "pos-qty" },
      { instructionAr: "ضيف الصنف التاني", instructionEn: "Add second item", action: "highlight", target: "pos-search" },
      { instructionAr: "ضيف الصنف التالت", instructionEn: "Add third item", action: "highlight", target: "pos-search" },
      { instructionAr: "اضغط على زر الدفع", instructionEn: "Press the pay button", action: "highlight", target: "pos-pay" },
      { instructionAr: "اختار طريقة الدفع واكمل", instructionEn: "Choose payment method and finish", action: "highlight", target: "pos-payment-method" },
    ],
  },
  {
    id: "scenario_2",
    track: "cashier",
    titleAr: "عميل عايز خصم على الفاتورة",
    titleEn: "Customer wants a discount",
    steps: [
      { instructionAr: "افتح نقطة البيع وضيف الأصناف", instructionEn: "Open POS and add items", action: "navigate", route: "/pos" },
      { instructionAr: "اختار صنف واضغط عليه عشان يظهر الخصم", instructionEn: "Select an item and click for discount", action: "highlight", target: "pos-item-line" },
      { instructionAr: "اختار خصم على السطر", instructionEn: "Choose line-item discount", action: "highlight", target: "pos-line-discount" },
      { instructionAr: "اكتب قيمة أو نسبة الخصم", instructionEn: "Enter discount value or percentage", action: "highlight", target: "pos-discount-input" },
      { instructionAr: "أكمل الدفع", instructionEn: "Complete payment", action: "highlight", target: "pos-pay" },
    ],
  },
  {
    id: "scenario_3",
    track: "cashier",
    titleAr: "عميل راجع منتج (مرتجع)",
    titleEn: "Customer returns a product",
    steps: [
      { instructionAr: "افتح شاشة المرتجعات", instructionEn: "Open returns screen", action: "navigate", route: "/sales/returns" },
      { instructionAr: "اختار مرتجع جديد واربطه بالفاتورة الأصلية", instructionEn: "New return and link to original invoice", action: "highlight", target: "return-new" },
      { instructionAr: "حدد الأصناف اللي هترجع", instructionEn: "Select items to return", action: "highlight", target: "return-items" },
      { instructionAr: "اختار سبب المرتجع وطريقة الاسترداد", instructionEn: "Choose reason and refund method", action: "highlight", target: "return-reason" },
      { instructionAr: "احفظ المرتجع", instructionEn: "Save the return", action: "highlight", target: "return-save" },
    ],
  },
  {
    id: "scenario_4",
    track: "manager",
    titleAr: "تشغيل تقرير مبيعات",
    titleEn: "Run a sales report",
    steps: [
      { instructionAr: "افتح مركز التقارير", instructionEn: "Open reports center", action: "navigate", route: "/reports/center" },
      { instructionAr: "اختار تقرير مبيعات من القائمة", instructionEn: "Choose sales report from list", action: "highlight", target: "report-sales" },
      { instructionAr: "ظبط الفترة الزمنية", instructionEn: "Set the date range", action: "highlight", target: "report-period" },
      { instructionAr: "اضغط عرض التقرير", instructionEn: "Click show report", action: "highlight", target: "report-show" },
      { instructionAr: "صدر التقرير PDF أو Excel", instructionEn: "Export as PDF or Excel", action: "highlight", target: "report-export" },
    ],
  },
  {
    id: "scenario_5",
    track: "manager",
    titleAr: "إضافة صنف جديد",
    titleEn: "Add a new item",
    steps: [
      { instructionAr: "افتح شاشة الأصناف", instructionEn: "Open items screen", action: "navigate", route: "/definitions/items" },
      { instructionAr: "اضغط إضافة صنف جديد", instructionEn: "Click add new item", action: "highlight", target: "item-add" },
      { instructionAr: "اكتب اسم الصنف والباركود", instructionEn: "Enter item name and barcode", action: "highlight", target: "item-name" },
      { instructionAr: "اختار القسم والسعر", instructionEn: "Choose category and price", action: "highlight", target: "item-category" },
      { instructionAr: "احفظ الصنف", instructionEn: "Save the item", action: "highlight", target: "item-save" },
    ],
  },
  {
    id: "scenario_6",
    track: "manager",
    titleAr: "تحويل مخزني بين المخازن",
    titleEn: "Stock transfer between warehouses",
    steps: [
      { instructionAr: "افتح التحويل المخزني", instructionEn: "Open stock transfer", action: "navigate", route: "/stock/transfer" },
      { instructionAr: "اختار المخزن المصدر", instructionEn: "Select source warehouse", action: "highlight", target: "transfer-source" },
      { instructionAr: "اختار المخزن المستلم", instructionEn: "Select destination warehouse", action: "highlight", target: "transfer-dest" },
      { instructionAr: "ضيف الأصناف والكميات", instructionEn: "Add items and quantities", action: "highlight", target: "transfer-items" },
      { instructionAr: "أكد التحويل", instructionEn: "Confirm transfer", action: "highlight", target: "transfer-confirm" },
    ],
  },
];

export function getScenarios(trackId) {
  return SCENARIOS.filter(s => s.track === trackId);
}

export function getAllScenarios() {
  return SCENARIOS;
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function fetchTrainingProgress() {
  const { data } = await api.get("/api/assistant/training/progress");
  return data;
}

export async function saveTrainingProgress(track, moduleKey, { completed, score, quizAnswers }) {
  const { data } = await api.post("/api/assistant/training/progress", { track, module_key: moduleKey, completed, score, quiz_answers: quizAnswers });
  return data;
}

export async function submitQuiz(track, moduleKey, answers) {
  const { data } = await api.post("/api/assistant/training/quiz", { track, module_key: moduleKey, answers });
  return data;
}

export async function fetchWeaknesses() {
  const { data } = await api.get("/api/assistant/training/weaknesses");
  return data;
}

export async function fetchAllWeaknesses() {
  const { data } = await api.get("/api/assistant/training/weaknesses/all");
  return data;
}

export async function fetchAssignments() {
  const { data } = await api.get("/api/assistant/training/assignments/mine");
  return data;
}

export async function fetchAllAssignments() {
  const { data } = await api.get("/api/assistant/training/assignments");
  return data;
}

export async function createAssignment(assignedTo, track, deadline) {
  const { data } = await api.post("/api/assistant/training/assignments", { assigned_to: assignedTo, track, deadline });
  return data;
}

export async function updateAssignmentStatus(id, status) {
  await api.patch(`/api/assistant/training/assignments/${id}/status`, { status });
}

export async function fetchTrainingUsers() {
  const { data } = await api.get("/api/assistant/training/users");
  return data;
}
