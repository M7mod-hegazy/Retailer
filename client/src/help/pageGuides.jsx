import {
  LayoutDashboard, ShoppingCart, Wallet, TrendingUp, Receipt, RotateCcw,
  FileText, ClipboardList, PackageCheck, ArrowLeftRight, Users, Truck,
  Coins, CreditCard, Banknote, Landmark, ScrollText, Package, Tags,
  Calculator, Warehouse, ClipboardCheck, ScanBarcode, Wrench,
  UtensilsCrossed, Gem, BadgePercent, Ruler, FolderTree, BarChart3,
  UserCog, Settings, Download, History, RefreshCw, HandCoins,
  CalendarClock, CheckCircle2, Store, Printer, Search, Scale, GitBranch,
  PiggyBank, ListChecks, Layers, Clock, Wifi, BookOpen, Bell, MessageSquare,
  Inbox, Megaphone, Send,
} from "lucide-react";
import {
  PosCheckoutFlow, TreasuryEquationFlow, PurchaseChainFlow,
  BranchTransferFlow, PhysicalCountFlow, ChequeLifecycleFlow,
  PayrollEquationFlow, OwnerEquationFlow, CashflowEquationFlow,
  StockLevelsColorMap, GoldPricingFormula,
} from "./guideIllustrations";

// Illustrated per-page guides — "كيف تعمل هذه الصفحة؟".
// Keyed by the same pageKey system routeHelp/getHelpPageKey resolves, and
// hosted globally by <PageGuideLauncher /> in the Topbar (auto-opens once on
// first visit, never stacks on the spotlight tour).
//
// Authoring rules: shop-owner Arabic, concrete numbers in examples, 3–5 steps,
// every step earns its place. Same tone as the FeaturesTab cards.

// Shared "money map" step — the treasury/bank/method triangle explained once,
// reused by every money page so the mental model is identical everywhere.
const MONEY_MAP_STEP = {
  key: "money-map",
  caption: "خريطة الفلوس في البرنامج — ثلاث حاجات بس:",
  icons: [
    { icon: CreditCard, label: "طريقة الدفع" },
    { icon: Wallet, label: "الخزنة (كاش)" },
    { icon: Landmark, label: "البنك (بطاقات وتحويلات)" },
  ],
  points: [
    "طريقة الدفع بتحدد الفلوس تروح فين: الكاش يدخل الخزنة، والبطاقة أو التحويل يدخل البنك.",
    "رصيد الخزنة والبنك بيتحدث لوحده مع كل عملية — من غير أي إدخال يدوي.",
    "عايز تنقل فلوس بين خزنة وبنك أو بين خزنتين؟ استخدم «تحويل خزينة» عشان كل حركة تفضل مسجلة.",
  ],
};

const pageGuides = {
  // ─── Core ──────────────────────────────────────────────────────────────────
  dashboard: {
    title: "لوحة التحكم",
    subtitle: "صورة يومك في شاشة واحدة",
    icon: LayoutDashboard,
    steps: [
      {
        key: "what",
        caption: "كل رقم هنا جاي من عمليات حقيقية مسجلة — مفيش رقم بيتكتب بإيدك.",
        icons: [
          { icon: ShoppingCart, label: "مبيعات اليوم" },
          { icon: Wallet, label: "الكاش في الخزنة" },
          { icon: TrendingUp, label: "الربح" },
        ],
      },
      {
        key: "drill",
        caption: "أي كارت مش مجرد رقم — دوس عليه يفتح لك التفاصيل اللي طلع منها.",
        points: [
          "مبيعات اليوم → فواتير اليوم واحدة واحدة.",
          "تنبيهات المخزون → الأصناف اللي قربت تخلص.",
          "الآجل المستحق → مين المفروض يدفع لك النهارده.",
        ],
      },
      {
        key: "when",
        caption: "أفضل استخدام: افتحها أول اليوم وآخره — الصبح تعرف تبدأ منين، وبالليل تتأكد إن الخزنة مظبوطة.",
      },
    ],
  },

  pos: {
    title: "نقطة البيع",
    subtitle: "أسرع طريق من الرف للفاتورة",
    icon: ShoppingCart,
    steps: [
      {
        key: "flow",
        illustration: <PosCheckoutFlow />,
        caption: "البيعة كلها ٣ خطوات:",
        icons: [
          { icon: ScanBarcode, label: "امسح أو ابحث" },
          { icon: Receipt, label: "راجع الفاتورة" },
          { icon: Banknote, label: "اقبض واطبع" },
        ],
        points: [
          "امسح الباركود أو اكتب أول حرفين من اسم الصنف — هيظهر فوراً.",
          "عدّل الكمية أو اعمل خصم على السطر نفسه.",
          "اختار طريقة الدفع: كاش، بطاقة، آجل، أو أكتر من طريقة مع بعض.",
        ],
      },
      {
        key: "hold",
        caption: "زبون نسي المحفظة في العربية؟ «علّق» الفاتورة وابدأ مع اللي بعده — ترجع لها بضغطة من قائمة المعلّق.",
      },
      {
        key: "money",
        caption: "الكاش يدخل الخزنة، والبطاقة تدخل البنك، والآجل يتسجل على حساب العميل — كله لوحده.",
        icons: [
          { icon: Banknote, label: "كاش → خزنة" },
          { icon: CreditCard, label: "بطاقة → بنك" },
          { icon: CalendarClock, label: "آجل → حساب العميل" },
        ],
      },
      {
        key: "return",
        caption: "مرتجع؟ افتح الفاتورة الأصلية واعمل «مرتجع» منها — البضاعة ترجع للمخزون والفلوس تتخصم صح، من غير حسابات يدوية.",
      },
    ],
  },

  daily_treasury: {
    title: "يومية الخزنة",
    subtitle: "ليه الرقم اللي في الدرج هو ده؟",
    icon: Wallet,
    steps: [
      {
        key: "equation",
        illustration: <TreasuryEquationFlow />,
        caption: "الخزنة معادلة بسيطة — الصفحة دي بتفكهالك بند بند:",
        icons: [
          { icon: Wallet, label: "رصيد أول اليوم" },
          { icon: TrendingUp, label: "+ اللي دخل" },
          { icon: HandCoins, label: "− اللي خرج" },
          { icon: CheckCircle2, label: "= المفروض في الدرج" },
        ],
      },
      {
        key: "types",
        caption: "كل سطر في اليومية له نوع ولون — بيع، مصروف، تحصيل آجل، مرتجع… النوع بيقولك السطر ده دخّل ولا خرّج.",
      },
      {
        key: "verify",
        caption: "آخر اليوم: عدّ الكاش الفعلي وقارنه بالمتوقع. لو في فرق، اليومية هي اللي هتوريك الفرق جه من أنهي عملية.",
        note: "المسحوبات من الخزنة (سلفة، مصروف شخصي) سجّلها كسحب — متسبهاش «فرق» مجهول.",
      },
      MONEY_MAP_STEP,
    ],
  },

  analytics: {
    title: "التحليلات",
    subtitle: "مش أرقام — إجابات",
    icon: BarChart3,
    steps: [
      {
        key: "what",
        caption: "كل رسمة هنا بتجاوب على سؤال محدد: إيه اللي بيبيع؟ إمتى الزحمة؟ مين أحسن عميل؟",
      },
      {
        key: "period",
        caption: "غيّر الفترة من فوق وكل الرسمات تتحدث مع بعض — قارن الشهر ده بالشهر اللي فات قبل ما تقرر تشتري بضاعة.",
      },
      {
        key: "action",
        caption: "استخدمها في القرارات: الصنف اللي مبيتحركش من ٣ شهور ده رأس مال نايم — اعمله عرض وحرّكه.",
      },
    ],
  },

  // ─── Sales chain ───────────────────────────────────────────────────────────
  sales_returns: {
    title: "مرتجعات المبيعات",
    subtitle: "رجّع صح — من غير لخبطة",
    icon: RotateCcw,
    steps: [
      {
        key: "flow",
        caption: "المرتجع الصح دايماً مربوط بفاتورة:",
        icons: [
          { icon: Receipt, label: "الفاتورة الأصلية" },
          { icon: RotateCcw, label: "مرتجع" },
          { icon: Package, label: "البضاعة ترجع للمخزون" },
        ],
        points: [
          "ابدأ من الفاتورة الأصلية عشان الأسعار والخصومات تترجع بنفس قيمتها يوم البيع.",
          "اختار سبب المرتجع — بيطلع في تقارير الجودة بعدين.",
          "الفلوس ترجع من نفس مكان ما دخلت: كاش من الخزنة، أو تتخصم من حساب العميل الآجل.",
        ],
      },
      {
        key: "why",
        caption: "متعملش «بيع بالسالب» ولا تعدّل الفاتورة القديمة — المرتجع الرسمي هو الوحيد اللي بيسيب أثر محاسبي سليم.",
      },
    ],
  },

  quotations: {
    title: "عروض الأسعار",
    subtitle: "سعّر من غير ما تلمس المخزون",
    icon: FileText,
    steps: [
      {
        key: "what",
        caption: "عرض السعر ورقة وعد — مش فاتورة. مبيحركش مخزون ولا فلوس، بس بيثبت السعر للعميل.",
        icons: [
          { icon: FileText, label: "عرض سعر" },
          { icon: CheckCircle2, label: "العميل وافق" },
          { icon: Receipt, label: "يتحوّل فاتورة بضغطة" },
        ],
      },
      {
        key: "convert",
        caption: "لما العميل يوافق، متكتبش الفاتورة من الأول — زرار «تحويل» بينقل كل الأصناف والأسعار زي ما هي.",
      },
      {
        key: "expiry",
        caption: "حط تاريخ صلاحية للعرض — الأسعار بتتغير، والعرض المفتوح من غير تاريخ بيرجعلك بعد ٦ شهور يطالبك بسعر قديم.",
      },
    ],
  },

  // ─── Purchases chain ───────────────────────────────────────────────────────
  purchases: {
    title: "المشتريات",
    subtitle: "من المورد للرف — بالتلاتة أو على طول",
    icon: Truck,
    steps: [
      {
        key: "chain",
        illustration: <PurchaseChainFlow />,
        caption: "سلسلة الشراء الكاملة مستندات:",
        icons: [
          { icon: ClipboardList, label: "أمر شراء" },
          { icon: PackageCheck, label: "فاتورة استلام" },
        ],
        points: [
          "بتشتري وتستلم في نفس اللحظة؟ ادخل على «فاتورة استلام» مباشرة وخلاص.",
          "بتطلب بضاعة تتسلم بعدين؟ اعمل «أمر شراء» الأول — بيفضل معلّق لحد ما البضاعة توصل.",
          "بتقارن بين موردين؟ سجّل عروضهم كـ«عروض أسعار» وحوّل الأحسن لأمر شراء.",
        ],
      },
      {
        key: "receive",
        caption: "فاتورة الاستلام هي اللي بتضيف للمخزون فعلياً وبتسجل المديونية للمورد — قبلها كله كلام على ورق.",
      },
      {
        key: "payment",
        caption: "الدفع مستقل عن الاستلام: استلم دلوقتي وادفع آخر الشهر — المتبقي بيبان في حساب المورد لحد ما تسدده.",
        icons: [
          { icon: PackageCheck, label: "استلمت" },
          { icon: CalendarClock, label: "على الحساب" },
          { icon: Banknote, label: "سداد لما تحب" },
        ],
      },
    ],
  },

  purchase_orders: {
    title: "أوامر الشراء",
    subtitle: "طلبت — لسه مستلمتش",
    icon: ClipboardList,
    steps: [
      {
        key: "what",
        caption: "أمر الشراء هو «يا مورد ابعتلي دول» — مبيلمسش المخزون ولا الفلوس لحد ما البضاعة توصل فعلاً.",
        icons: [
          { icon: ClipboardList, label: "أمر شراء" },
          { icon: Truck, label: "البضاعة في السكة" },
          { icon: PackageCheck, label: "استلام → مخزون" },
        ],
      },
      {
        key: "track",
        caption: "الأوامر المفتوحة هنا هي «البضاعة اللي في السكة» — راجعها قبل ما تطلب تاني عشان متطلبش حاجة مطلوبة أصلاً.",
      },
      {
        key: "convert",
        caption: "البضاعة وصلت؟ افتح الأمر ودوس «استلام» — يتحوّل فاتورة استلام بنفس الأصناف، وتعدّل لو في نواقص.",
      },
    ],
  },

  purchase_returns: {
    title: "مرتجعات المشتريات",
    subtitle: "رجّع للمورد بأثر مسجل",
    icon: RotateCcw,
    steps: [
      {
        key: "flow",
        caption: "بضاعة بايظة أو غلط من المورد؟ المرتجع بيعمل التلاتة دول مرة واحدة:",
        points: [
          "يخصم الكمية من مخزونك.",
          "يقلل مديونيتك للمورد (أو يسجل له فلوس عندك لو كنت دفعت).",
          "يسيب مستند رسمي تحاسب بيه المورد.",
        ],
      },
      {
        key: "tip",
        caption: "ارجع من فاتورة الاستلام الأصلية عشان سعر الرد يبقى بنفس سعر الشراء بالظبط.",
      },
    ],
  },

  branch_transfer: {
    title: "تحويلات الفروع",
    subtitle: "بضاعة تسافر بين فرعين",
    icon: GitBranch,
    steps: [
      {
        key: "flow",
        illustration: <BranchTransferFlow />,
        caption: "التحويل بين الفروع طرفين وتأكيد:",
        icons: [
          { icon: Store, label: "الفرع المرسل" },
          { icon: Truck, label: "في الطريق" },
          { icon: CheckCircle2, label: "الفرع المستلم يأكّد" },
        ],
        points: [
          "الإرسال بيخصم من مخزون فرعك فوراً.",
          "البضاعة بتفضل «في الطريق» — محسوبة، بس مش على رف حد.",
          "الفرع التاني لازم يأكّد الاستلام عشان تدخل مخزونه — لو في نواقص بتبان هنا.",
        ],
      },
      {
        key: "why",
        caption: "خطوة التأكيد دي هي اللي بتحميك: من غيرها أي كرتونة تقع من العربية تبقى «مخزون شبح» محدش يعرف راح فين.",
      },
    ],
  },

  // ─── Money pages ───────────────────────────────────────────────────────────
  customer_accounts: {
    title: "حسابات العملاء",
    subtitle: "مين واخد بكام — ومين دفع",
    icon: Users,
    steps: [
      {
        key: "read",
        caption: "اقرأ الرصيد كجملة: «العميل ده عليه ٥٠٠ ج ليك» — الأحمر يعني له فلوس عندك واجبة التحصيل.",
        icons: [
          { icon: Users, label: "العميل" },
          { icon: CalendarClock, label: "اشترى آجل" },
          { icon: HandCoins, label: "بيسدد على دفعات" },
        ],
      },
      {
        key: "statement",
        caption: "كشف الحساب بيحكي القصة كاملة بالترتيب: كل فاتورة زوّدت عليه، وكل دفعة نزّلت منه — والرصيد الجاري جنب كل سطر.",
      },
      {
        key: "collect",
        caption: "التحصيل من هنا: افتح العميل → «سداد» → المبلغ يدخل الخزنة ويتخصم من حسابه في نفس الحركة.",
      },
    ],
  },

  supplier_accounts: {
    title: "حسابات الموردين",
    subtitle: "انت مديون لمين بكام",
    icon: Truck,
    steps: [
      {
        key: "read",
        caption: "هنا العكس: الرصيد بيقولك انت اللي عليك — «للمورد ده ٣٬٠٠٠ ج عندك» من بضاعة استلمتها ولسه مدفعتش.",
      },
      {
        key: "pay",
        caption: "السداد بضغطة: اختار المورد → المبلغ → طريقة الدفع — يتخصم من الخزنة أو البنك ويقلل مديونيتك فوراً.",
      },
      {
        key: "why",
        caption: "قبل ما تطلب من مورد، بص على حسابه — معرفة إن عليك ٥٠٠٠ ج ليه بتفرق في التفاوض على الطلبية الجاية.",
      },
    ],
  },

  payments: {
    title: "حركات الدفع",
    subtitle: "كل قبض وصرف في مكان واحد",
    icon: HandCoins,
    steps: [
      {
        key: "what",
        caption: "الصفحة دي سجل الفلوس نفسها — مش الفواتير: كل تحصيل من عميل وكل سداد لمورد، بتاريخه وطريقته ومكان دخوله.",
      },
      MONEY_MAP_STEP,
    ],
  },

  payment_methods: {
    title: "طرق الدفع",
    subtitle: "كل طريقة → الفلوس تروح فين",
    icon: CreditCard,
    steps: [
      MONEY_MAP_STEP,
      {
        key: "map",
        caption: "كل طريقة دفع لازم تكون موصّلة بوجهة: كاش → خزنة، بطاقة → بنك. الوصلة دي هي اللي بتخلي الأرصدة تتحدث لوحدها.",
        icons: [
          { icon: Banknote, label: "كاش" },
          { icon: Wallet, label: "خزنة الفرع" },
        ],
      },
      {
        key: "warn",
        caption: "طريقة دفع من غير وجهة صح = فلوس بتتسجل في مكان غلط. لو رصيد البنك مش مظبوط، أول حاجة تراجعها هي الصفحة دي.",
      },
    ],
  },

  cheques: {
    title: "إدارة الشيكات",
    subtitle: "الشيك رحلة — مش فلوس لسه",
    icon: ScrollText,
    steps: [
      {
        key: "lifecycle",
        illustration: <ChequeLifecycleFlow />,
        caption: "الشيك بيمشي في خط واحد، وكل خطوة بتتسجل:",
        icons: [
          { icon: ScrollText, label: "مستلم" },
          { icon: Landmark, label: "مودَع في البنك" },
          { icon: CheckCircle2, label: "محصَّل" },
        ],
        points: [
          "«مستلم» = ورقة في الدرج، مش رصيد. متعتبرهاش فلوس لسه.",
          "«مودَع» = في البنك مستني التحصيل.",
          "«محصَّل» = بقى فلوس حقيقية في رصيد البنك. «مرتد» = ارجع كلّم العميل.",
        ],
      },
      {
        key: "due",
        caption: "رتّب بالاستحقاق — شيك آجل معدّى تاريخه ومحدش ودّاه البنك ده فلوس واقفة على الرف.",
      },
    ],
  },

  expenses: {
    title: "المصروفات",
    subtitle: "مصاريف تشغيل المحل",
    icon: Receipt,
    steps: [
      {
        key: "which",
        caption: "قبل ما تسجّل، اسأل: الصرف ده عشان المحل يشتغل؟",
        points: [
          "إيجار، كهربا، مرتبات، نت، صيانة → «مصروف» — بيتخصم من ربح المحل.",
          "سحبت لنفسك أو لبيتك → «مسحوبات» مش مصروف — دي من حقك في المحل، مش تكلفة عليه.",
          "الخلط بينهم بيخلي المحل يبان خسران وهو كسبان — أو العكس.",
        ],
      },
      {
        key: "category",
        caption: "اختار التصنيف صح — في آخر الشهر تقرير المصروفات هيقولك فلوسك بتروح فين بالظبط.",
      },
    ],
  },

  revenues: {
    title: "الإيرادات الأخرى",
    subtitle: "دخل من غير البيع",
    icon: TrendingUp,
    steps: [
      {
        key: "what",
        caption: "أي فلوس دخلت المحل مش من فاتورة بيع: إيجار فترينة، عمولة خدمة، بيع كرتون فارغ… بتتسجل هنا بتصنيفها.",
      },
      {
        key: "why",
        caption: "متدخلهاش كفاتورة بيع وهمية — كده بتبوّظ تقارير المبيعات وتحليل الأصناف. الإيراد الجانبي له بابه.",
      },
    ],
  },

  withdrawals: {
    title: "المسحوبات",
    subtitle: "فلوسك انت — بحساب",
    icon: PiggyBank,
    steps: [
      {
        key: "what",
        caption: "سحبت كاش لنفسك؟ سجّلها هنا — مش «مصروف». المسحوبات بتتخصم من حقك كصاحب محل، مش من ربح المحل.",
        icons: [
          { icon: Wallet, label: "الخزنة" },
          { icon: PiggyBank, label: "جيبك" },
        ],
      },
      {
        key: "why",
        caption: "الفايدة في آخر السنة: كشف حساب المالك هيقولك سحبت كام فعلاً — وساعتها بتعرف المحل بيصرف عليك ولا انت عليه.",
      },
    ],
  },

  // ─── Catalog & stock ───────────────────────────────────────────────────────
  items: {
    title: "قاعدة الأصناف",
    subtitle: "الصنف المظبوط = نص الشغل",
    icon: Package,
    steps: [
      {
        key: "core",
        caption: "لكل صنف ٤ حاجات أساسية — الباقي رفاهية:",
        points: [
          "اسم واضح — اللي هيدور بيه الكاشير وقت الزحمة.",
          "سعر الشراء — من غيره مفيش حساب ربح خالص.",
          "سعر البيع — وبص على نسبة الربح وانت بتكتبه.",
          "الباركود — امسحه بالجهاز نفسه وانت واقف على الصنف.",
        ],
      },
      {
        key: "import",
        caption: "عندك أصناف كتير؟ متدخلهمش واحد واحد — استيراد Excel بيعمل مئات الأصناف في دقايق، ومعاه معالج بيصلّح الأخطاء خطوة بخطوة.",
        icons: [
          { icon: Download, label: "ملف Excel" },
          { icon: ListChecks, label: "معالج الاستيراد" },
          { icon: Package, label: "الأصناف جاهزة" },
        ],
      },
      {
        key: "alert",
        caption: "حط «حد أدنى» لكل صنف مهم — البرنامج هينبهك قبل ما يخلص، بدل ما تكتشف وانت بتبيع.",
      },
    ],
  },

  item_operations: {
    title: "عمليات الأصناف",
    subtitle: "شغل جماعي على الكتالوج",
    icon: Layers,
    steps: [
      {
        key: "what",
        caption: "التعديلات اللي بتلمس أصناف كتير مرة واحدة بتتعمل من هنا — بدل ما تفتح ١٠٠ صنف واحد واحد.",
      },
      {
        key: "safe",
        caption: "أي عملية جماعية بتوريك «قبل ← بعد» قبل التنفيذ — راجع الجدول كويس، التراجع بعد التنفيذ أصعب من المراجعة قبله.",
      },
    ],
  },

  categories: {
    title: "الفئات",
    subtitle: "رتب الكتالوج زي رفوف المحل",
    icon: FolderTree,
    steps: [
      {
        key: "what",
        caption: "الفئة بتخدم حاجتين: الكاشير يلاقي الصنف بسرعة، والتقارير تقولك «قسم إيه اللي شغال» مش بس «صنف إيه».",
      },
      {
        key: "tip",
        caption: "خليها بسيطة — ٥ لـ ١٥ فئة رئيسية كفاية. التقسيم الزيادة عن اللزوم بيصعّب التسجيل ومحدش بيستفيد منه.",
      },
    ],
  },

  bulk_price_update: {
    title: "تحديث الأسعار الجماعي",
    subtitle: "غلاء المورد؟ ٥ دقايق",
    icon: Calculator,
    steps: [
      {
        key: "flow",
        caption: "ثلاث خطوات — والثالثة أهم واحدة:",
        icons: [
          { icon: FolderTree, label: "اختار النطاق" },
          { icon: Calculator, label: "حدد الزيادة" },
          { icon: ListChecks, label: "راجع قبل ← بعد" },
        ],
        points: [
          "اختار فئة أو مورد أو أصناف محددة.",
          "زوّد بنسبة (٪) أو بمبلغ ثابت — أو حدد هامش ربح موحد.",
          "راجع جدول «السعر الحالي ← الجديد» صنف صنف قبل الاعتماد.",
        ],
      },
      {
        key: "warn",
        caption: "التحديث الجماعي مبيتراجعش بضغطة — لو مش متأكد، جرّب على فئة صغيرة الأول.",
      },
    ],
  },

  stock: {
    title: "المخزون",
    subtitle: "الأرصدة وحركتها",
    icon: Warehouse,
    steps: [
      {
        key: "levels",
        illustration: <StockLevelsColorMap />,
        caption: "شاشة الأرصدة بتقولك «عندك كام دلوقتي» — والألوان بتقولك مين محتاج طلبية:",
        points: [
          "أخضر: فوق الحد الأدنى — تمام.",
          "أصفر: قرّب من الحد — حطه في الطلبية الجاية.",
          "أحمر: خلص أو تحت الحد — بتخسر مبيعات دلوقتي.",
        ],
      },
      {
        key: "movements",
        caption: "شاشة الحركات بتقولك «الرصيد ده جه منين» — كل دخول وخروج بنوعه: بيع، شراء، تحويل، جرد، مرتجع.",
        icons: [
          { icon: PackageCheck, label: "شراء +" },
          { icon: ShoppingCart, label: "بيع −" },
          { icon: ArrowLeftRight, label: "تحويل ⇄" },
        ],
      },
      {
        key: "trust",
        caption: "رصيد الشاشة مش مطابق للرف؟ متعدّلش الرقم بإيدك أبداً — اعمل «جرد» عشان الفرق يتسجل بسبب وتاريخ.",
      },
    ],
  },

  stock_transfer: {
    title: "التحويل المخزني",
    subtitle: "من مخزن لمخزن — جوا نفس الفرع",
    icon: ArrowLeftRight,
    steps: [
      {
        key: "what",
        caption: "نقل بضاعة بين مخازنك (المخزن الرئيسي ← رف المحل مثلاً). فوري — يخصم من مخزن ويضيف للتاني في نفس اللحظة.",
        icons: [
          { icon: Warehouse, label: "من مخزن" },
          { icon: ArrowLeftRight, label: "" },
          { icon: Store, label: "إلى مخزن" },
        ],
      },
      {
        key: "vs",
        caption: "الفرق بينه وبين «تحويل الفروع»: ده جوا نفس الفرع وبيتم فوراً — أما بين الفروع فبيعدي بمرحلة «في الطريق» وتأكيد استلام.",
      },
    ],
  },

  physical_count: {
    title: "الجرد الفعلي",
    subtitle: "الرف هو الصادق — مش الشاشة",
    icon: ClipboardCheck,
    steps: [
      {
        key: "flow",
        illustration: <PhysicalCountFlow />,
        caption: "الجرد ٣ مراحل — وخد وقتك في التانية:",
        icons: [
          { icon: FolderTree, label: "١. حدد النطاق" },
          { icon: ScanBarcode, label: "٢. عُدّ وسجّل" },
          { icon: Scale, label: "٣. راجع الفروقات واعتمد" },
        ],
        points: [
          "اختار النطاق: مخزن كامل، فئة، أو أصناف معينة — الجرد الجزئي المنتظم أحسن من جرد سنوي مرهق.",
          "امشِ على الرف وامسح وسجّل العدد الحقيقي — البرنامج بيقارن لوحده.",
          "شاشة الفروقات بتوريك كل صنف: كان في الشاشة كام، لقيته كام، والفرق بكام فلوس.",
        ],
      },
      {
        key: "commit",
        caption: "الاعتماد بيعدّل المخزون فعلياً ويسجل الفرق — راجع الفروقات الكبيرة قبله: يمكن كرتونة ورا الباب مش عجز حقيقي.",
      },
      {
        key: "tip",
        caption: "اعمل الجرد والمحل مقفول أو في أهدى وقت — بيع أثناء العد بيديك فروقات وهمية.",
      },
    ],
  },

  promotions: {
    title: "العروض والخصومات",
    subtitle: "عرض بيشتغل لوحده على الكاشير",
    icon: BadgePercent,
    steps: [
      {
        key: "what",
        caption: "اظبط القاعدة هنا مرة واحدة، والكاشير مش محتاج يفتكرها — الخصم بيتطبق لوحده على نقطة البيع لما شروطه تتحقق.",
        icons: [
          { icon: BadgePercent, label: "قاعدة العرض" },
          { icon: ShoppingCart, label: "POS يطبقها لوحده" },
        ],
      },
      {
        key: "types",
        caption: "جرّب بمثال وانت بتظبط: «اشترِ ٢ والتالت مجاناً» على صنف سعره ١٠٠ = العميل ياخد ٣ ويدفع ٢٠٠.",
      },
      {
        key: "dates",
        caption: "حط تاريخ نهاية دايماً — العرض المنسي شغال بياكل من هامش ربحك في صمت.",
      },
    ],
  },

  // ─── Definitions ───────────────────────────────────────────────────────────
  branches: {
    title: "الفروع",
    subtitle: "كل فرع عالم مستقل",
    icon: Store,
    steps: [
      {
        key: "what",
        caption: "كل فرع ليه مخازنه ومستخدميه وحساباته — التقارير تقدر تفصل كل فرع لوحده.",
        icons: [
          { icon: Store, label: "الفرع" },
          { icon: Warehouse, label: "مخازنه" },
          { icon: Users, label: "مستخدميه" },
        ],
      },
      {
        key: "tip",
        caption: "الفرع الرئيسي هو المركز — التقارير والنسخ الاحتياطي والتحديثات من هنا. الفروع التانية بتاخد البيانات من المركز.",
      },
    ],
  },

  warehouses: {
    title: "المستودعات",
    subtitle: "أماكن البضاعة",
    icon: Warehouse,
    steps: [
      {
        key: "what",
        caption: "المخزن مكان فيه بضاعة بتتعد — محل، مخزن خلفي، عربية توزيع. الرصيد بيتحسب لكل مخزن لوحده.",
      },
      {
        key: "tip",
        caption: "أبسط تركيبة شغالة: مخزن «رف المحل» ومخزن «ستوك» — البيع بيخصم من الرف، والتحويل المخزني بيملاه من الستوك.",
      },
    ],
  },

  units: {
    title: "وحدات القياس",
    subtitle: "قطعة، كيلو، كرتونة…",
    icon: Ruler,
    steps: [
      {
        key: "what",
        caption: "الوحدة الأساسية هي اللي المخزون بيتحسب بيها — لو الصنف بيتباع قطعة وكرتونة، القطعة هي الأساس.",
        icons: [
          { icon: Ruler, label: "وحدة أساسية" },
          { icon: Package, label: "كرتونة = ١٢ قطعة" },
        ],
      },
      {
        key: "tip",
        caption: "لما تبيع كرتونة، البرنامج بيخصم العدد من المخزون تلقائي: لو الكرتونة فيها ١٢ قطعة وبيعت كرتونة، المخزون بيقل ١٢ مش ١.",
      },
    ],
  },

  financial_categories: {
    title: "التصنيفات المالية",
    subtitle: "عناوين تقرير المصروفات",
    icon: Tags,
    steps: [
      {
        key: "what",
        caption: "كل تصنيف هنا بيبقى سطر في تقرير المصروفات — سمّيه بالاسم اللي يوضح: إيجار، مرتبات، كهربا، نقل.",
        icons: [
          { icon: Tags, label: "التصنيف" },
          { icon: BarChart3, label: "تقرير المصروفات" },
        ],
      },
      {
        key: "tip",
        caption: "التصنيف ده بيأثر على شكل التقارير — لو سميتها صح، في آخر الشهر هتشوف بالظبط فلوسك بتروح فين من غير ما تحسب.",
      },
    ],
  },

  // ─── Feature modules ───────────────────────────────────────────────────────
  repair_orders: {
    title: "أوامر الصيانة",
    subtitle: "الجهاز رحلة والعميل مستني",
    icon: Wrench,
    steps: [
      {
        key: "lifecycle",
        caption: "كل جهاز بيمشي في خط واضح — والعميل ممكن يسأل في أي لحظة «وصل فين؟»:",
        icons: [
          { icon: Wrench, label: "مستلم" },
          { icon: Search, label: "جارٍ الفحص" },
          { icon: CheckCircle2, label: "جاهز" },
          { icon: HandCoins, label: "مُسلَّم ومدفوع" },
        ],
      },
      {
        key: "receipt",
        caption: "وقت الاستلام سجّل الحالة الظاهرة وعيوب الجهاز — إيصال الاستلام بيحميك من «الشرخ ده كان موجود؟» بعد أسبوعين.",
      },
    ],
  },

  // ─── Reports & admin ───────────────────────────────────────────────────────
  reports: {
    title: "مركز التقارير",
    subtitle: "كل تقرير بيجاوب على سؤال",
    icon: BarChart3,
    steps: [
      {
        key: "how",
        caption: "متدورش على «اسم تقرير» — دوّر على سؤالك:",
        points: [
          "«إيه أكتر حاجة بتبيع؟» → تقارير المبيعات حسب الصنف.",
          "«الفلوس بتروح فين؟» → تقارير المصروفات.",
          "«مين مديون لي؟» → أعمار الديون.",
          "«رأس مالي نايم في إيه؟» → تقييم المخزون.",
        ],
      },
      {
        key: "period",
        caption: "نفس التقرير بفترتين مختلفتين = قصة مختلفة — قارن الشهر بالشهر اللي قبله قبل أي قرار شراء أو تسعير.",
      },
    ],
  },

  owner_statement: {
    title: "كشف حساب المالك",
    subtitle: "حقك في المحل — بالمعادلة",
    icon: PiggyBank,
    steps: [
      {
        key: "equation",
        illustration: <OwnerEquationFlow />,
        caption: "الكشف معادلة واحدة:",
        icons: [
          { icon: PiggyBank, label: "رأس المال" },
          { icon: TrendingUp, label: "+ الأرباح" },
          { icon: HandCoins, label: "− المسحوبات" },
          { icon: CheckCircle2, label: "= صافي حقك" },
        ],
      },
      {
        key: "why",
        caption: "عشان الرقم ده يبقى صادق: سجّل مسحوباتك الشخصية كمسحوبات (مش مصروفات)، وأي فلوس بتحطها في المحل كزيادة رأس مال.",
      },
    ],
  },

  users: {
    title: "المستخدمون والصلاحيات",
    subtitle: "مين يشوف إيه ويعمل إيه",
    icon: UserCog,
    steps: [
      {
        key: "what",
        caption: "لكل موظف حسابه الخاص بصلاحياته — الكاشير يبيع من غير ما يشوف الأرباح، والمشرف يراجع من غير ما يمسح.",
      },
      {
        key: "why",
        caption: "متسيبش الكل يشتغل على حساب واحد — سجل العمليات بيسجل «مين عمل إيه»، وده قيمته الحقيقية لما كل واحد بحسابه.",
      },
    ],
  },

  employees: {
    title: "الموظفون",
    subtitle: "من الملف للمرتب",
    icon: Users,
    steps: [
      {
        key: "overview",
        caption: "الصفحة دي فيها كل حاجة تحتاجها لإدارة موظفينك — من إضافة الموظف لصرف مرتبه.",
        icons: [
          { icon: UserCog, label: "إضافة" },
          { icon: ClipboardList, label: "بيانات" },
          { icon: Coins, label: "سلف" },
          { icon: Scale, label: "خصومات" },
          { icon: TrendingUp, label: "مكافآت" },
          { icon: Wallet, label: "رواتب" },
        ],
      },
      {
        key: "tabs",
        caption: "٥ تبويبات كل واحد شايل مجال مختلف:",
        points: [
          "البيانات الأساسية — اسم وراتب وموبايل الموظف. هنا بتعدّل أي حاجة.",
          "السلفيات — سجّل كل سلفة وتابع أقساطها. تقدر تسدد جزئي أو كلي.",
          "الخصومات — غياب أو غرامة أو تأمين. متكررة أو لمرة واحدة.",
          "المكافئات — حافز أداء أو بونص. كمان متكررة أو لمرة واحدة.",
          "الرواتب — صرف الراتب مع ملخص كامل. تقدر تصرف كامل أو جزئي.",
        ],
      },
      {
        key: "payroll",
        illustration: <PayrollEquationFlow />,
        caption: "صرف الرواتب — المعادلة الكاملة:",
        icons: [
          { icon: Banknote, label: "أساسي" },
          { icon: TrendingUp, label: "+ حوافز" },
          { icon: Scale, label: "− خصومات" },
          { icon: HandCoins, label: "− سلف" },
        ],
        points: [
          "اضغط 'صرف الراتب' وهتلاقي كل الأرقام جاهزة.",
          "تقدر تصرف كامل أو جزئي — لو جزئي، المتبقي بيتسجل وتمتّ تتبعه.",
          "الدفع الجزئي ممكن ينخصم تلقائياً من الفترة الجاية أو يتتتبع يدوي.",
          "كل صرف بيتسجيل كمصروف في الخزينة تلقائياً.",
        ],
      },
      {
        key: "tips",
        caption: "نصائح مهمة:",
        points: [
          "سجّل السلفة يومها بدل ما تفتكرها آخر الشهر.",
          "الحوافز والخصومات المتكررة بتنطبق تلقائياً كل فترة.",
          "ممكن تطبع كشف راتب الموظف من تبويب الرواتب.",
          "لو موظف مش شغال، مش لازم تحذفه — أوقفه بس.",
        ],
      },
    ],
  },

  settings: {
    title: "الإعدادات",
    subtitle: "اظبطها مرة — تنسى",
    icon: Settings,
    steps: [
      {
        key: "map",
        caption: "أهم ٣ تبويبات تزورها:",
        points: [
          "«المزايا» — شغّل وحدات تخص نشاطك بس (متغيرات، صيانة، مطاعم…) وسيب الباقي مقفول.",
          "«النسخ الاحتياطي» — اتأكد إنه شغال تلقائياً. البيانات أغلى حاجة في البرنامج.",
          "«الطباعة» — شكل الفاتورة، اللوجو، والرسالة اللي تحت — بيتطبع في كل فاتورة.",
        ],
      },
    ],
  },

  updates: {
    title: "التحديثات",
    subtitle: "نسخة أجدد = مشاكل أقل",
    icon: RefreshCw,
    steps: [
      {
        key: "what",
        caption: "التحديث بيتنزّل في الخلفية ومش بيلمس بياناتك — بياناتك في قاعدة منفصلة عن البرنامج نفسه.",
      },
    ],
  },

  history: {
    title: "سجل العمليات",
    subtitle: "مين عمل إيه وإمتى",
    icon: History,
    steps: [
      {
        key: "what",
        caption: "كل عملية حساسة بتتسجل هنا بصاحبها ووقتها — تعديل سعر، حذف فاتورة، تسجيل دخول.",
      },
      {
        key: "how",
        caption: "استخدمه بالأسئلة: «مين عدّل سعر الصنف ده؟» — فلتر بالصنف والفترة، الإجابة قدامك بالاسم والساعة.",
      },
    ],
  },

  sync: {
    title: "مزامنة الفروع",
    subtitle: "فرعين — دفاتر واحدة",
    icon: RefreshCw,
    steps: [
      {
        key: "what",
        caption: "المزامنة بتخلي بيانات الفروع تتجمع مع بعض — الأصناف والأسعار توصل للفروع، والمبيعات ترجع للمركز.",
        icons: [
          { icon: Store, label: "الفرع" },
          { icon: RefreshCw, label: "مزامنة" },
          { icon: Store, label: "المركز" },
        ],
      },
      {
        key: "offline",
        caption: "النت قطع؟ الفرع بيكمل بيع عادي وبيسجل محلياً — وأول ما النت يرجع كل اللي اتعمل يتزامن لوحده.",
      },
    ],
  },

  // ─── NEW PAGES ──────────────────────────────────────────────────────────────

  invoice_detail: {
    title: "فاتورة البيع",
    subtitle: "قصة البيع كاملة في مكان واحد",
    icon: FileText,
    steps: [
      {
        key: "what",
        caption: "الفاتورة دي بتحكي كل حاجة حصلت في البيع: مين اشترى، إمتى، بكام، وإيه اللي حصل بعدها.",
        icons: [
          { icon: Receipt, label: "فاتورة البيع" },
          { icon: Printer, label: "طباعة" },
          { icon: HandCoins, label: "مدفوع / آجل" },
        ],
      },
      {
        key: "actions",
        caption: "أربعة أزرار في الأعلى: اطبعها، بعتها واتساب للعميل، عدّلها، أو ألغها. الإلغاء بيطلب سبب عشان يفضل مسجل.",
      },
      {
        key: "timeline",
        caption: "لو الفاتورة اتمددت أكتر من مرة، السايدبار بيوريك سلسلة التعديلات—كل نسخة والوقت والمستخدم.",
      },
    ],
  },

  cashflow_ledger: {
    title: "كشف الحركات التفصيلي",
    subtitle: " كل جنيه دخل أو خرج متسجل",
    icon: BookOpen,
    steps: [
      {
        key: "equation",
        illustration: <CashflowEquationFlow />,
        caption: "الكشف معادلة بسيطة في ٤ أرقام:",
        icons: [
          { icon: Wallet, label: "رصيد الصبح" },
          { icon: TrendingUp, label: "+ الدخل" },
          { icon: HandCoins, label: "− الخروج" },
          { icon: CheckCircle2, label: "= الرصيد بالليل" },
        ],
      },
      {
        key: "verify",
        caption: "آخر اليوم بص على البانر: 'مطابق' = الخزنة مظبوطة. 'في فرق' = في حركة مش متطابقة—الكشف بيوريك فين بالظبط.",
      },
    ],
  },

  sales_hub: {
    title: "فواتير المبيعات",
    subtitle: "أرشيف كل اللي اتباع",
    icon: Receipt,
    steps: [
      {
        key: "what",
        caption: "كل فاتورة من نقطة البيع أو شاشة البيع بتظهر هنا—one-stop-shop للفواتير.",
        icons: [
          { icon: ShoppingCart, label: "بيع من POS" },
          { icon: Receipt, label: "تتسجل هنا" },
          { icon: Printer, label: "طباعة / واتساب" },
        ],
      },
      {
        key: "find",
        caption: "دوّر بالاسم أو رقم الفاتورة أو التاريخ. افتح أي فاتورة تشوف تفاصيلها وتطبعها تاني أو تبعتها واتساب.",
      },
      {
        key: "return",
        caption: "المرتجع بيبدأ من هنا: افتح الفاتورة → 'مرتجع' → اختار الأصناف—كده المخزون والفلوس بيترجعوا مربوطين.",
      },
    ],
  },

  sales_return_detail: {
    title: "مرتجع المبيعات",
    subtitle: "البضاعة رجعت — والحساب اتعدل",
    icon: RotateCcw,
    steps: [
      {
        key: "what",
        caption: "المرتجع ده مرتبط بالفاتورة الأصلية—يعني الأسعار والخصومات اترجعت بنفس قيمتها يوم البيع.",
        icons: [
          { icon: Receipt, label: "فاتورة أصلية" },
          { icon: RotateCcw, label: "مرتجع" },
          { icon: Wallet, label: "الفلوس رجعت" },
        ],
      },
      {
        key: "actions",
        caption: "اطبع المرتجع أو بعته واتساب. التعديل بيفتح شاشة تعديل جديدة (مش بيعدّل القديمة). الإلغاء بيطلب سبب.",
      },
    ],
  },

  purchase_return_detail: {
    title: "مرتجع المشتريات",
    subtitle: "رجّع للمورد بأثر محاسبي",
    icon: RotateCcw,
    steps: [
      {
        key: "what",
        caption: "المرتجع ده بيخفف مديونيتك للمورد أو بيرجعلك فلوس—حسب التسوية اللي اخترتها.",
        icons: [
          { icon: Truck, label: "المورد" },
          { icon: RotateCcw, label: "مرتجع" },
          { icon: HandCoins, label: "الدين قل" },
        ],
      },
      {
        key: "actions",
        caption: "اطبع أو بعت واتساب. التعديل بيفتح شاشة جديدة. الإلغاء بيسجل السبب في السجل.",
      },
    ],
  },

  payment_form: {
    title: "تسجيل حركة مالية",
    subtitle: "تحصيل أو سداد في مكان واحد",
    icon: HandCoins,
    steps: [
      {
        key: "what",
        caption: "الصفحة دي بتسجل كل فلوس دخلت أو خرجت من غير فاتورة: تحصيل من عميل أو سداد لمورد.",
        icons: [
          { icon: Users, label: "عميل (تحصيل)" },
          { icon: HandCoins, label: "" },
          { icon: Truck, label: "مورد (سداد)" },
        ],
      },
      {
        key: "allocate",
        caption: "الحاجة الأهم: وزّع المبلغ على الفواتير الآجلة. 'توزيع آلي' بيعملها لوحده، أو توزع بإيدك سطر سطر.",
      },
      MONEY_MAP_STEP,
    ],
  },

  item_import: {
    title: "استيراد الأصناف",
    subtitle: "مئات الأصناف في دقايق",
    icon: Download,
    steps: [
      {
        key: "flow",
        caption: "المعالج بيمشي معاك خطوة بخطوة:",
        icons: [
          { icon: Download, label: "١. رفع Excel" },
          { icon: ListChecks, label: "٢. ربط الأعمدة" },
          { icon: Package, label: "٣. معاينة" },
          { icon: CheckCircle2, label: "٤. تنفيذ" },
        ],
      },
      {
        key: "warn",
        caption: "المعالج بيحذرك من الأخطاء قبل التنفيذ—أسماء مكررة، أسعار ناقصة، أعمدة مش مربوطة. راجعه كويس.",
      },
    ],
  },

  expiry_report: {
    title: "تقرير انتهاء الصلاحية",
    subtitle: "الدفعات اللي قربت أو خلصت",
    icon: Clock,
    steps: [
      {
        key: "what",
        caption: "الدفعات الحمراء خلصت الصلاحية النهارده. البرتقالية خلصت خلال أسبوع. الأصفر خلال ١٤ يوم. الأخضر لسه ساري.",
        icons: [
          { icon: Clock, label: "منتهي" },
          { icon: Clock, label: "حرج ≤ ٧ أيام" },
          { icon: Clock, label: "تحذير ١٤ يوم" },
          { icon: CheckCircle2, label: "ساري" },
        ],
      },
      {
        key: "act",
        caption: "الأولوية: الحمراء بتتباع أو تترجع فوراً—البضاعة دي مش هتتباع تاني. البرتقالية حطها في الطلبية الجاية.",
      },
    ],
  },

  revenue_categories: {
    title: "تصنيفات الإيرادات",
    subtitle: "باب الدخل اللي مش من البيع",
    icon: Tags,
    steps: [
      {
        key: "what",
        caption: "أي فلوس دخلت من غير فاتورة بيع: إيجار فترينة، عمولة خدمة، بيع خردة — كل واحدة بتصنيفها.",
      },
      {
        key: "tip",
        caption: "متدخلهاش كفاتورة بيع وهمية — كده بتبوّظ تقارير المبيعات. الإيراد الجانبي له بابه زي ما المصروفات ليها بابها.",
      },
    ],
  },

  expense_categories: {
    title: "أقسام المصروفات",
    subtitle: "فلوسك بتروح فين بالظبط",
    icon: Tags,
    steps: [
      {
        key: "what",
        caption: "كل قسم هنا بيبقى سطر في تقرير المصروفات — سمّيها بالأسئلة: إيجار، مرتبات، كهربا، نقل، تسويق.",
      },
      {
        key: "tip",
        caption: "التصنيفات الصح بتفرق في آخر الشهر — تقرير «فلوسك بتروح فين» بيطلع من التصنيفات دي بالظبط.",
      },
    ],
  },

  account_import: {
    title: "استيراد الحسابات",
    subtitle: "عملاء أو موردين من Excel",
    icon: Download,
    steps: [
      {
        key: "flow",
        caption: "نفس معالج استيراد الأصناف بس للحسابات:",
        icons: [
          { icon: Download, label: "١. رفع الملف" },
          { icon: ListChecks, label: "٢. ربط الأعمدة" },
          { icon: Package, label: "٣. معاينة" },
          { icon: CheckCircle2, label: "٤. استيراد" },
        ],
      },
      {
        key: "warn",
        caption: "الحسابات المكررة (نفس الموبايل) بتتكتشف تلقائي—اختار تخطّى أو تحدّث.",
      },
    ],
  },

  sync_config: {
    title: "ربط المتجر الإلكتروني",
    subtitle: "الخطوة الأولى للمزامنة",
    icon: Wifi,
    steps: [
      {
        key: "what",
        caption: "عايز تربط متجر WooCommerce أو Shopify؟ الخطوة دي بتوصّل التطبيق بالمتجر عشان المنتجات تتزامن.",
        icons: [
          { icon: Store, label: "التطبيق" },
          { icon: Wifi, label: "ربط" },
          { icon: RefreshCw, label: "المتجر" },
        ],
      },
      {
        key: "fields",
        caption: "محتاج ٣ حاجات من لوحة تحكم المتجر: (١) رابط المتجر، (٢) رقم المتجر، (٣) مفتاح API. كلهم في صفحة الإعدادات.",
      },
    ],
  },

  sync_page: {
    title: "المزامنة",
    subtitle: "التطبيق والمتجر متصلين",
    icon: RefreshCw,
    steps: [
      {
        key: "what",
        caption: "المزامنة بتسحب المنتجات من المتجر وترفع التغييرات من التطبيق—أو العكس.",
        icons: [
          { icon: Store, label: "التطبيق" },
          { icon: RefreshCw, label: "مزامنة" },
          { icon: RefreshCw, label: "المتجر" },
        ],
      },
      {
        key: "tabs",
        caption: "٦ تبويبات: طلبات الموقع، منتجات جديدة، متاح من الموقع، تغييرات محلية، سجل المزامنة، واسترجاع.",
      },
      {
        key: "conflict",
        caption: "لو نفس الصنف اتغير هنا وعلى المتجر في نفس الوقت، التعارض بيظهر هنا—اختار احتفظ بالتطبيق أو بالمتجر.",
      },
    ],
  },

  table_map: {
    title: "خريطة الطاولات",
    subtitle: "الصالة على الشاشة",
    icon: UtensilsCrossed,
    steps: [
      {
        key: "flow",
        caption: "الدورة: اختار ترابيزة → افتح أوردر → زوّد عليه براحتك → اقفل بالحساب. اللون بيقولك حالة كل ترابيزة من بعيد.",
      },
      {
        key: "colors",
        caption: "٤ ألوان: أخضر = متاحة، أحمر = مشغولة (فيها أوردر شغال)، أزرق = محجوزة (العميل حجزها)، رمادي = تنظيف.",
      },
    ],
  },

  modifier_groups: {
    title: "إضافات الأصناف",
    subtitle: "«من غير بصل، جبنة زيادة»",
    icon: UtensilsCrossed,
    steps: [
      {
        key: "what",
        caption: "مجموعة الإضافات بتتربط بالصنف—لما الكاشير يختار ساندوتش، البرنامج يسأله عن الإضافات ويحسب فرق السعر لوحده.",
      },
      {
        key: "link",
        caption: "الربط خطوة مهمة: اختار الصنف من البحث، ثم اختار المجموعات اللي هتظهر معاه. من غير ربط، الإضافات مش هتظهر في البيع.",
      },
    ],
  },

  gold_rates: {
    title: "أسعار الذهب",
    subtitle: "سعر الجرام بيسوق كل حاجة",
    icon: Gem,
    steps: [
      {
        key: "what",
        illustration: <GoldPricingFormula />,
        caption: "حدّث سعر الجرام هنا، وكل الأصناف الموزونة تتسعّر لوحدها: (الوزن × سعر الجرام لعيارها) + المصنعية.",
        icons: [
          { icon: Gem, label: "سعر الجرام" },
          { icon: Scale, label: "× الوزن" },
          { icon: Calculator, label: "+ المصنعية" },
        ],
      },
      {
        key: "when",
        caption: "حدّثه أول اليوم قبل أول بيعة—السوق بيتحرك، وفاتورة اتعملت بسعر امبارح فرقها من جيبك.",
      },
    ],
  },

  serial_lookup: {
    title: "البحث بالسيريال",
    subtitle: "تاريخ القطعة الواحدة",
    icon: ScanBarcode,
    steps: [
      {
        key: "what",
        caption: "امسح سيريال أي قطعة يطلعلك ملفها الكامل: اشتريتها إمتى وبكام، اتباعت لمين، ولسه في الضمان ولا لأ.",
      },
      {
        key: "when",
        caption: "أكتر استخدام: عميل راجع بجهاز—امسح السيريال تعرف فوراً هو فعلاً اشتراه منك، وإمتى، وبأنهي فاتورة.",
      },
    ],
  },

  source_workspace: {
    title: "التقارير المخصصة",
    subtitle: "اختار اللي عايز تشوفه",
    icon: BarChart3,
    steps: [
      {
        key: "how",
        caption: "متدورش على 'تقرير' — دوّر على سؤالك. اختار المصدر ثم الفلاتر ثم شغّل.",
      },
      {
        key: "export",
        caption: "النتيجة تقدر تطبعها أو صدّرها Excel أو PDF. مناسب للتقارير الشهرية أو المراجعات الدورية.",
      },
    ],
  },

  // ─── Form pages (illustrated guides for key forms) ─────────────────────────
  sales_return_form: {
    title: "\u0625\u0634\u0639\u0627\u0631 \u0645\u0631\u062a\u062c\u0639 \u0645\u0628\u064a\u0639\u0627\u062a",
    subtitle: "\u0645\u0631\u062a\u062c\u0639 \u0645\u0631\u062a\u0628\u0637 \u0628\u0641\u0627\u062a\u0648\u0631\u0629 \u0623\u0635\u0644\u064a\u0629",
    icon: RotateCcw,
    steps: [
      {
        key: "flow",
        caption: "\u0627\u0628\u062f\u0623 \u0628\u0627\u062e\u062a\u064a\u0627\u0631 \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629 \u0627\u0644\u0623\u0635\u0644\u064a\u0629 \u2014 \u0627\u0644\u0623\u0633\u0639\u0627\u0631 \u0648\u0627\u0644\u062e\u0635\u0648\u0645\u0627\u062a \u0647\u062a\u062a\u0631\u062c\u0639 \u0628\u0646\u0641\u0633 \u0642\u064a\u0645\u062a\u0647\u0627 \u064a\u0648\u0645 \u0627\u0644\u0628\u064a\u0639:",
        icons: [
          { icon: Receipt, label: "\u0627\u062e\u062a\u064a\u0627\u0631 \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629" },
          { icon: RotateCcw, label: "\u0627\u062e\u062a\u064a\u0627\u0631 \u0627\u0644\u0623\u0635\u0646\u0627\u0641" },
          { icon: CheckCircle2, label: "\u062a\u0623\u0643\u064a\u062f" },
        ],
      },
      {
        key: "tip",
        caption: "\u0644\u0648 \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629 \u0627\u0644\u0623\u0635\u0644\u064a\u0629 \u0627\u062a\u0639\u0645\u0644\u062a \u0644\u0647\u0627 \u0645\u0631\u062a\u062c\u0639 \u062c\u0632\u064a\u0631\u064a \u0642\u0628\u0644 \u0643\u062f\u0647\u060c \u0647\u062a\u0644\u0627\u0642\u064a \u0627\u0644\u0645\u062a\u0628\u0642\u064a \u0645\u0643\u062a\u0648\u0628 \u2014 \u0645\u062a\u062a\u0631\u062c\u0639\u0634 \u0646\u0641\u0633 \u0627\u0644\u0635\u0646\u0641 \u0645\u0631\u062a\u064a\u0646.",
      },
    ],
  },

  purchase_form: {
    title: "\u0641\u0627\u062a\u0648\u0631\u0629 \u0634\u0631\u0627\u0621 \u062c\u062f\u064a\u062f\u0629",
    subtitle: "\u0627\u0633\u062a\u0644\u0645 \u0628\u0636\u0627\u0639\u0629 \u0648\u0633\u062c\u0651\u0644 \u0627\u0644\u0645\u062f\u064a\u0648\u0646\u064a\u0629",
    icon: Truck,
    steps: [
      {
        key: "flow",
        caption: "\u0627\u062e\u062a\u0627\u0631 \u0627\u0644\u0645\u0648\u0631\u062f \u2192 \u0627\u0645\u0633\u062d \u0627\u0644\u0623\u0635\u0646\u0627\u0641 \u0623\u0648 \u0627\u0628\u062d\u062b \u0639\u0646\u0647\u0627 \u2192 \u0627\u0644\u0633\u0639\u0631 \u0628\u064a\u0628\u0627\u0646 \u0645\u0646 \u062a\u0639\u0631\u064a\u0641 \u0627\u0644\u0635\u0646\u0641:",
        icons: [
          { icon: Truck, label: "\u0627\u0644\u0645\u0648\u0631\u062f" },
          { icon: ScanBarcode, label: "\u0627\u0644\u0628\u0636\u0627\u0639\u0629" },
          { icon: Wallet, label: "\u0637\u0631\u064a\u0642\u0629 \u0627\u0644\u062f\u0641\u0639" },
        ],
      },
      {
        key: "tip",
        caption: "\u0627\u0644\u0628\u0636\u0627\u0639\u0629 \u0645\u0634 \u0647\u062a\u062a\u0636\u0627\u0641 \u0644\u0644\u0645\u062e\u0632\u0648\u0646 \u0625\u0644\u0627 \u0644\u0645\u0627 \u062a\u0623\u0643\u062f \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629 \u2014 \u0644\u0648 \u0641\u064a \u062a\u0639\u062f\u064a\u0644\u060c \u0627\u0639\u0645\u0644\u0647 \u0642\u0628\u0644 \u0627\u0644\u062a\u0623\u0643\u064a\u062f.",
      },
    ],
  },

  purchase_order_form: {
    title: "\u0623\u0645\u0631 \u0634\u0631\u0627\u0621 \u062c\u062f\u064a\u062f",
    subtitle: "\u0627\u0637\u0644\u0628 \u0628\u0636\u0627\u0639\u0629 \u0645\u0646 \u0627\u0644\u0645\u0648\u0631\u062f",
    icon: ClipboardList,
    steps: [
      {
        key: "flow",
        caption: "\u0627\u062e\u062a\u0627\u0631 \u0627\u0644\u0645\u0648\u0631\u062f \u2192 \u0627\u0636\u0627\u0641 \u0627\u0644\u0623\u0635\u0646\u0627\u0641 \u2192 \u062d\u062f\u062f \u0627\u0644\u0643\u0645\u064a\u0629 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629:",
        icons: [
          { icon: Truck, label: "\u0627\u0644\u0645\u0648\u0631\u062f" },
          { icon: ClipboardList, label: "\u0627\u0644\u0623\u0635\u0646\u0627\u0641" },
          { icon: PackageCheck, label: "\u0644\u0645\u0627 \u062a\u0635\u0644" },
        ],
      },
      {
        key: "tip",
        caption: "\u0623\u0645\u0631 \u0627\u0644\u0634\u0631\u0627\u0621 \u0645\u0634 \u0641\u0627\u062a\u0648\u0631\u0629 \u2014 \u0645\u0628\u064a\u0644\u0645\u0633\u0634 \u0627\u0644\u0645\u062e\u0632\u0648\u0646 \u0648\u0644\u0627 \u0627\u0644\u0641\u0644\u0648\u0633. \u0627\u0644\u0645\u062e\u0632\u0648\u0646 \u0628\u064a\u062a\u062d\u0631\u0643 \u0628\u0633 \u0644\u0645\u0627 \u062a\u0639\u0645\u0644 \u0627\u0633\u062a\u0644\u0627\u0645.",
      },
    ],
  },

  branch_transfer_form: {
    title: "\u062a\u062d\u0648\u064a\u0644 \u0641\u0631\u0639 \u062c\u062f\u064a\u062f",
    subtitle: "\u0628\u0636\u0627\u0639\u0629 \u062a\u0633\u0627\u0641\u0631 \u0645\u0646 \u0641\u0631\u0639 \u0644\u0641\u0631\u0639",
    icon: GitBranch,
    steps: [
      {
        key: "flow",
        caption: "\u0627\u062e\u062a\u0627\u0631 \u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0645\u0631\u0633\u0644 \u2192 \u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0645\u0633\u062a\u0644\u0645 \u2192 \u0627\u0644\u0623\u0635\u0646\u0627\u0641 \u0648\u0627\u0644\u0643\u0645\u064a\u0627\u062a:",
        icons: [
          { icon: Store, label: "\u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0645\u0631\u0633\u0644" },
          { icon: Truck, label: "\u0641\u064a \u0627\u0644\u0637\u0631\u064a\u0642" },
          { icon: Store, label: "\u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0645\u0633\u062a\u0644\u0645" },
        ],
      },
      {
        key: "tip",
        caption: "\u0627\u0644\u0625\u0631\u0633\u0627\u0644 \u0628\u064a\u062e\u0635\u0645 \u0645\u0646 \u0645\u062e\u0632\u0648\u0646 \u0641\u0631\u0639\u0643 \u0641\u0648\u0631\u0627\u064b. \u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u062a\u0627\u0646\u064a \u0644\u0627\u0632\u0645 \u064a\u0623\u0643\u0651\u062f \u0627\u0644\u0627\u0633\u062a\u0644\u0627\u0645.",
      },
    ],
  },

  quotation_form: {
    title: "\u0639\u0631\u0636 \u0633\u0639\u0631 \u062c\u062f\u064a\u062f",
    subtitle: "\u0633\u0639\u5c3d \u0645\u0646 \u063a\u064a\u0631 \u0645\u0627 \u062a\u0644\u0645\u0633 \u0627\u0644\u0645\u062e\u0632\u0648\u0646",
    icon: FileText,
    steps: [
      {
        key: "flow",
        caption: "\u0627\u062e\u062a\u0627\u0631 \u0627\u0644\u0639\u0645\u064a\u0644 \u2192 \u0627\u0636\u0627\u0641 \u0627\u0644\u0623\u0635\u0646\u0627\u0641 \u2192 \u062d\u062f\u062f \u0627\u0644\u0623\u0633\u0639\u0627\u0631 \u0648\u0627\u0644\u0635\u0644\u0627\u062d\u064a\u0629:",
        icons: [
          { icon: Users, label: "\u0627\u0644\u0639\u0645\u064a\u0644" },
          { icon: FileText, label: "\u0627\u0644\u0639\u0631\u0636" },
          { icon: CalendarClock, label: "\u0627\u0644\u0635\u0644\u0627\u062d\u064a\u0629" },
        ],
      },
      {
        key: "tip",
        caption: "\u0639\u0631\u0636 \u0627\u0644\u0633\u0639\u0631 \u0645\u0634 \u0641\u0627\u062a\u0648\u0631\u0629 \u2014 \u0645\u0628\u064a\u062d\u0631\u0643\u0634 \u0645\u062e\u0632\u0648\u0646 \u0648\u0644\u0627 \u0641\u0644\u0648\u0633. \u0644\u0645\u0627 \u0627\u0644\u0639\u0645\u064a\u0644 \u064a\u0648\u0627\u0641\u0642\u060c \u062d\u0648\u0651\u0644\u0647 \u0641\u0627\u062a\u0648\u0631\u0629 \u0628\u0636\u063a\u0637\u0629.",
      },
    ],
  },

  stock_transfer_form: {
    title: "\u062a\u062d\u0648\u064a\u0644 \u0645\u062e\u0632\u0646\u064a \u062c\u062f\u064a\u062f",
    subtitle: "\u0645\u0646 \u0645\u062e\u0632\u0646 \u0644\u0645\u062e\u0632\u0646 \u062c\u0648\u0627 \u0646\u0641\u0633 \u0627\u0644\u0641\u0631\u0639",
    icon: ArrowLeftRight,
    steps: [
      {
        key: "flow",
        caption: "\u0627\u062e\u062a\u0627\u0631 \u0627\u0644\u0645\u062e\u0632\u0646 \u0627\u0644\u0645\u0631\u0633\u0644 \u2192 \u0627\u0644\u0645\u062e\u0632\u0646 \u0627\u0644\u0645\u0633\u062a\u0644\u0645 \u2192 \u0627\u0644\u0623\u0635\u0646\u0627\u0641 \u0648\u0627\u0644\u0643\u0645\u064a\u0627\u062a:",
        icons: [
          { icon: Warehouse, label: "\u0645\u0646 \u0645\u062e\u0632\u0646" },
          { icon: ArrowLeftRight, label: "" },
          { icon: Store, label: "\u0625\u0644\u0649 \u0645\u062e\u0632\u0646" },
        ],
      },
      {
        key: "tip",
        caption: "\u0627\u0644\u062a\u062d\u0648\u064a\u0644 \u0628\u064a\u062a\u0645 \u0641\u0648\u0631\u0627\u064b \u2014 \u064a\u062e\u0635\u0645 \u0645\u0646 \u0645\u062e\u0632\u0646 \u0648\u064a\u0636\u064a\u0641 \u0644\u0644\u062a\u0627\u0646\u064a \u0641\u064a \u0646\u0641\u0633 \u0627\u0644\u0644\u062d\u0638\u0629. \u0645\u0634 \u0632\u064a \u062a\u062d\u0648\u064a\u0644 \u0627\u0644\u0641\u0631\u0648\u0639 \u0627\u0644\u0644\u064a \u0628\u064a\u0639\u062f\u064a \u0628\u0645\u0631\u062d\u0644\u0629 \u00ab\u0641\u064a \u0627\u0644\u0637\u0631\u064a\u0642\u00bb.",
      },
    ],
  },

  employee_adjustments: {
    title: "\u0645\u0644\u0641\u0627\u062a \u0627\u0644\u0645\u0648\u0638\u0641\u064a\u0646",
    subtitle: "\u0633\u0644\u0641\u060c \u062e\u0635\u0648\u0645\u0627\u062a\u060c \u0645\u0643\u0627\u0641\u0622\u062a",
    icon: UserCog,
    steps: [
      {
        key: "flow",
        caption: "\u0627\u062e\u062a\u0627\u0631 \u0627\u0644\u0645\u0648\u0638\u0641\u0641 \u2192 \u0646\u0648\u0639 \u0627\u0644\u062a\u0639\u062f\u064a\u0644 \u2192 \u0627\u0644\u0645\u0628\u0644\u063a \u2192 \u0627\u0644\u0633\u0628\u0628:",
        icons: [
          { icon: Users, label: "\u0627\u0644\u0645\u0648\u0638\u0641" },
          { icon: Coins, label: "\u0646\u0648\u0639 \u0627\u0644\u062a\u0639\u062f\u064a\u0644" },
          { icon: Wallet, label: "\u0627\u0644\u0645\u0628\u0644\u063a" },
        ],
      },
      {
        key: "tip",
        caption: "\u0633\u062c\u0651\u0644 \u0627\u0644\u0633\u0644\u0641\u0629 \u064a\u0648\u0645\u0647\u0627 \u0628\u062f\u0644 \u0645\u0627 \u062a\u0641\u062a\u0643\u0631\u0647\u0627 \u0623\u0643\u0631\u0647\u060c \u0648\u0627\u0644\u062e\u0635\u0648\u0645\u0627\u062a \u0627\u0644\u0645\u062a\u0643\u0631\u0631\u0629 \u0628\u062a\u0646\u0637\u0628\u0642 \u062a\u0644\u0627\u0642\u064a\u0627\u064b \u0643\u0644 \u0641\u062a\u0631\u0629.",
      },
    ],
  },

  gold_rates: {
    title: "\u0623\u0633\u0639\u0627\u0631 \u0627\u0644\u0630\u0647\u0628",
    subtitle: "\u0633\u0639\u0631 \u0627\u0644\u062c\u0631\u0627\u0645 \u0628\u064a\u0633\u0648\u0642 \u0643\u0644 \u062d\u0627\u062c\u0629",
    icon: Gem,
    steps: [
      {
        key: "what",
        caption: "\u062d\u062f\u0651\u062b \u0633\u0639\u0631 \u0627\u0644\u062c\u0631\u0627\u0645 \u0647\u0646\u0627\u060c \u0648\u0643\u0644 \u0627\u0644\u0623\u0635\u0646\u0627\u0641 \u0627\u0644\u0645\u0648\u0632\u0648\u0646\u0629 \u062a\u062a\u0633\u0639\u0651\u0631 \u0644\u0648\u062d\u062f\u0647\u0627: (\u0627\u0644\u0648\u0632\u0646 \u00d7 \u0633\u0639\u0631 \u0627\u0644\u062c\u0631\u0627\u0645 \u0644\u0639\u064a\u0627\u0631\u0647\u0627) + \u0627\u0644\u0645\u0635\u0646\u0639\u064a\u0629.",
        icons: [
          { icon: Gem, label: "\u0633\u0639\u0631 \u0627\u0644\u062c\u0631\u0627\u0645" },
          { icon: Scale, label: "\u00d7 \u0627\u0644\u0648\u0632\u0646" },
          { icon: Calculator, label: "+ \u0627\u0644\u0645\u0635\u0646\u0639\u064a\u0629" },
        ],
      },
      {
        key: "when",
        caption: "\u062d\u062f\u0651\u062b\u0647 \u0623\u0648\u0644 \u0627\u0644\u064a\u0648\u0645 \u0642\u0628\u0644 \u0623\u0648\u0644 \u0628\u064a\u0639\u0629 \u2014 \u0627\u0644\u0633\u0648\u0642 \u0628\u064a\u062a\u062d\u0631\u0643\u060c \u0648\u0641\u0627\u062a\u0648\u0631\u0629 \u0627\u062a\u0639\u0645\u0644\u062a \u0628\u0633\u0639\u0631 \u0627\u0645\u0628\u0627\u0631\u062d \u0641\u0631\u0642\u0647\u0627 \u0645\u0646 \u062c\u064a\u0628\u0643.",
      },
    ],
  },

  notifications: {
    title: "\u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062a",
    subtitle: "\u0627\u0644\u062a\u0646\u0628\u064a\u0647\u0627\u062a \u0627\u0644\u0645\u0647\u0645\u0629",
    icon: Bell,
    steps: [
      {
        key: "what",
        caption: "\u0627\u0644\u062a\u0646\u0628\u064a\u0647\u0627\u062a \u0627\u0644\u0644\u0648\u0645\u0629 \u0628\u062a\u0642\u0648\u0644\u0643 \u0639\u0646 \u0623\u064a \u062a\u063a\u064a\u064a\u0631 \u0645\u0647\u0645: \u0645\u062e\u0632\u0646 \u0648\u0636\u0639 \u0627\u0644\u062d\u062f \u0627\u0644\u0623\u062f\u0646\u0649\u060c \u0634\u064a\u0643 \u0645\u0631\u062a\u062f\u060c \u0627\u0633\u062a\u062e\u062f\u0627\u0645 \u0645\u0648\u0639\u062f\u0646\u0629.",
      },
      {
        key: "tip",
        caption: "\u0645\u062a\u0628\u0639\u0634\u0634 \u0627\u0644\u062a\u0646\u0628\u064a\u0647\u0627\u062a \u0627\u0644\u0645\u0647\u0645\u0629 \u0648\u0627\u0639\u0645\u0644 \u0639\u0644\u064a\u0647\u0627 \u0645\u0628\u0644\u063a \u0645\u0627 \u064a\u062c\u0628 \u062a\u0646\u0641\u064a\u0630\u0647\u0627.",
      },
    ],
  },

  // ─── Profile & detail pages ─────────────────────────────────────────────
  customer_profile: {
    title: "\u0645\u0644\u0641 \u0627\u0644\u0639\u0645\u064a\u0644",
    subtitle: "\u0643\u0644 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u0641\u064a \u0645\u0643\u0627\u0646 \u0648\u0627\u062d\u062f",
    icon: Users,
    steps: [
      {
        key: "card",
        caption: "\u0627\u0644\u0628\u0637\u0627\u0642\u0629 \u0627\u0644\u0639\u0644\u0648\u064a\u0629 \u0628\u062a\u0648\u064a\u0646\u0643 \u0639\u0644\u0649 \u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0639\u0645\u064a\u0644: \u0627\u0644\u0627\u0633\u0645\u060c \u0627\u0644\u0645\u0648\u0628\u0627\u064a\u0644\u060c \u0627\u0644\u0625\u0645\u064a\u0644. \u0627\u0644\u0631\u0635\u064a\u062f \u0627\u0644\u0644\u0648\u0646\u064a \u0628\u064a\u0642\u0648\u0644\u0643: \u0623\u062e\u0636\u0631 \u064a\u0639\u0646\u064a \u0644\u0635\u062d\u0628\u0643\u060c \u0623\u062d\u0645\u0631 \u064a\u0639\u0646\u064a \u0639\u0644\u064a\u0643.",
        icons: [
          { icon: Users, label: "\u0627\u0644\u0639\u0645\u064a\u0644" },
          { icon: Receipt, label: "\u0641\u0648\u0627\u062a\u064a\u0631" },
          { icon: HandCoins, label: "\u062f\u064a\u0648\u0646" },
        ],
      },
      {
        key: "statement",
        caption: "\u0643\u0634\u0641 \u0627\u0644\u062d\u0633\u0627\u0628 \u0628\u064a\u062d\u0643\u064a \u0627\u0644\u0642\u0635\u0629 \u0643\u0627\u0645\u0644\u0629: \u0643\u0644 \u0641\u0627\u062a\u0648\u0631\u0629 \u0632\u0648\u062f\u062a \u0639\u0644\u064a\u0647\u060c \u0648\u0643\u0644 \u062f\u0641\u0639\u0629 \u0646\u0632\u0644\u062a \u0645\u0646\u0647 \u2014 \u0648\u0627\u0644\u0631\u0635\u064a\u062f \u0627\u0644\u062c\u0627\u0631\u064a \u062c\u0646\u0628 \u0643\u0644 \u0633\u0637\u0631.",
      },
      {
        key: "collect",
        caption: "\u0627\u0644\u062a\u062d\u0635\u064a\u0644 \u0645\u0646 \u0647\u0646\u0627: \u0627\u0636\u063a\u0637 \u0633\u062f\u0627\u062f \u2192 \u0627\u0644\u0645\u0628\u0644\u063a \u2192 \u0637\u0631\u064a\u0642\u0629 \u0627\u0644\u062f\u0641\u0639. \u0627\u0644\u0641\u0644\u0648\u0633 \u062a\u062f\u062e\u0644 \u0627\u0644\u062e\u0632\u0646\u0629 \u0648\u062a\u062a\u062e\u0635\u0645 \u0645\u0646 \u062d\u0633\u0627\u0628\u0647 \u0641\u0648\u0631\u0627\u064b.",
      },
    ],
  },

  supplier_profile: {
    title: "\u0645\u0644\u0641 \u0627\u0644\u0645\u0648\u0631\u062f",
    subtitle: "\u0645\u064a\u0646 \u0645\u062f\u064a\u0648\u0646\u064a\u0643 \u0648\u062d\u0633\u0627\u0628\u0627\u062a\u0647",
    icon: Truck,
    steps: [
      {
        key: "card",
        caption: "\u0628\u0637\u0627\u0642\u0629 \u0627\u0644\u0645\u0648\u0631\u062f \u0628\u062a\u0648\u064a\u0646\u0643 \u0639\u0644\u0649 \u0643\u0644 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a: \u0627\u0644\u0627\u0633\u0645\u060c \u0627\u0644\u0645\u0648\u0628\u0627\u064a\u0644\u060c \u0627\u0644\u0639\u0646\u0648\u0627\u0646. \u0627\u0644\u0631\u0635\u064a\u062f \u0628\u064a\u0642\u0648\u0644\u0643 \u0639\u0644\u064a\u0643 \u0645\u062f\u064a\u0648\u0646\u064a\u062a\u0643 \u0644\u0647.",
        icons: [
          { icon: Truck, label: "\u0627\u0644\u0645\u0648\u0631\u062f" },
          { icon: PackageCheck, label: "\u0627\u0633\u062a\u0644\u0627\u0645" },
          { icon: HandCoins, label: "\u0633\u062f\u0627\u062f" },
        ],
      },
      {
        key: "statement",
        caption: "\u0643\u0634\u0641 \u0627\u0644\u062d\u0633\u0627\u0628 \u0628\u064a\u0648\u0636\u062d\u0643 \u0639\u0644\u0649 \u0627\u0644\u0641\u0648\u0627\u062a\u064a\u0631 \u0648\u0627\u0644\u0645\u062f\u0641\u0648\u0639\u0627\u062a \u0628\u062a\u0631\u062a\u064a\u0628: \u0641\u0627\u062a\u0648\u0631\u0629 \u0627\u0634\u062a\u0631\u0627\u0621 \u0632\u0648\u062f\u062a \u0639\u0644\u064a\u0647 \u0627\u0644\u0645\u0648\u0631\u062f\u060c \u0648\u0643\u0644 \u062f\u0641\u0639\u0629 \u0633\u062f\u062f\u062a\u0647\u0627.",
      },
      {
        key: "pay",
        caption: "\u0627\u0644\u0633\u062f\u0627\u062f \u0628\u0636\u063a\u0637\u0629: \u0627\u0636\u063a\u0637 \u0633\u062f\u0627\u062f \u2192 \u0627\u0644\u0645\u0628\u0644\u063a \u2192 \u0637\u0631\u064a\u0642\u0629 \u0627\u0644\u062f\u0641\u0639. \u064a\u062a\u062e\u0635\u0645 \u0645\u0646 \u0627\u0644\u062e\u0632\u0646\u0629 \u0623\u0648 \u0627\u0644\u0628\u0646\u0643 \u0641\u0648\u0631\u0627\u064b.",
      },
    ],
  },

  item_detail: {
    title: "\u062a\u0641\u0627\u0635\u064a\u0644 \u0627\u0644\u0635\u0646\u0641",
    subtitle: "\u0643\u0644 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u0641\u064a \u0645\u0643\u0627\u0646 \u0648\u0627\u062d\u062f",
    icon: Package,
    steps: [
      {
        key: "info",
        caption: "\u0627\u0644\u0635\u0646\u0641 \u0628\u064a\u0628\u064a\u0646\u0643 \u0643\u0644 \u0628\u064a\u0627\u0646\u0627\u062a\u0647: \u0627\u0644\u0627\u0633\u0645\u060c \u0627\u0644\u0623\u0633\u0639\u0627\u0631\u060c \u0627\u0644\u0628\u0627\u0631\u0643\u0648\u062f\u060c \u0627\u0644\u0641\u0626\u0629\u060c \u0648\u0623\u0631\u0642\u0627\u0645 \u0627\u0644\u0645\u062e\u0632\u0648\u0646 \u0644\u0643\u0644 \u0645\u062e\u0632\u0646.",
        icons: [
          { icon: Package, label: "\u0627\u0644\u0635\u0646\u0641" },
          { icon: Warehouse, label: "\u0627\u0644\u0623\u0631\u0642\u0627\u0645" },
          { icon: BarChart3, label: "\u0627\u0644\u062a\u0642\u0627\u0631\u064a\u0631" },
        ],
      },
      {
        key: "history",
        caption: "\u0627\u0644\u062a\u0627\u0631\u064a\u062e \u0628\u064a\u0648\u0636\u062d\u0643 \u0639\u0644\u0649 \u0643\u0644 \u0627\u0644\u062d\u0643\u0627\u064a\u0627\u062a: \u0627\u0634\u062a\u0631\u0627\u0621\u060c \u0628\u064a\u0639\u060c \u062a\u062d\u0648\u064a\u0644\u060c \u062c\u0631\u062f. \u0643\u0644 \u062d\u0631\u0643\u0629 \u0628\u062a\u0627\u0631\u064a\u062e\u0647\u0627 \u0648\u062a\u0627\u0631\u064a\u062e\u0647\u0627.",
      },
    ],
  },

  // ─── WhatsApp CRM (tab page) ───────────────────────────────────────────
  whatsapp_crm: {
    title: "\u0645\u0631\u0643\u0632 \u0627\u0644\u0631\u0633\u0627\u0626\u0644 \u0648\u0627\u0644\u062d\u0645\u0644\u0627\u062a",
    subtitle: "\u062a\u0648\u0627\u0635\u0644 \u0648\u062a\u0633\u0648\u064a\u0642 \u0645\u0646 \u062c\u0647\u0632\u0629 \u0648\u0627\u062d\u062f\u0629",
    icon: MessageSquare,
    steps: [
      {
        key: "tabs",
        caption: "\u062e\u0645\u0633\u0629 \u062a\u0628\u0648\u064a\u0628\u0627\u062a \u062a\u0628\u062f\u0623 \u0628\u0639\u0636 \u0627\u0644\u0625\u0637\u0644\u0627\u0639\u0627\u062a:",
        icons: [
          { icon: BarChart3, label: "\u0644\u0648\u062d\u0629 \u0627\u0644\u062a\u062d\u0643\u0645" },
          { icon: Inbox, label: "\u0627\u0644\u0648\u0627\u0631\u062f" },
          { icon: Megaphone, label: "\u0627\u0644\u0639\u0645\u0644\u0627\u0621" },
          { icon: FileText, label: "\u0627\u0644\u0642\u0648\u0627\u0644\u0628" },
          { icon: Send, label: "\u062a\u0644\u064a\u063a\u0631\u0627\u0645" },
        ],
      },
      {
        key: "channels",
        caption: "\u0642\u0646\u0648\u0627\u062a \u0627\u0644\u062a\u0648\u0627\u0635\u0644 \u0645\u062a\u0639\u062f\u062f\u0629 \u0641\u0648\u0642 \u0627\u0644\u0627\u062a\u0635\u0627\u0644: \u0648\u0627\u062a\u0633\u0627\u0628\u060c \u062a\u0644\u063a\u0631\u0627\u0645\u060c \u062a\u0631\u0633\u0644\u060c \u0625\u064a\u0645\u064a\u0644. \u0643\u0644 \u0642\u0646\u0627\u0629 \u062a\u0634\u062a\u063a\u0644 \u0644\u0648\u062d\u062f\u0629 \u0627\u0644\u062a\u062d\u0643\u0645 \u0628\u0639\u0636 \u0627\u0644\u0625\u0637\u0644\u0627\u0639\u0627\u062a.",
      },
      {
        key: "inbox",
        caption: "\u0635\u0646\u062f\u0648\u0642 \u0627\u0644\u0648\u0627\u0631\u062f: \u0627\u0644\u0645\u062d\u0627\u062f\u062b\u0627\u062a \u0627\u0644\u0648\u0627\u0631\u062f\u0629 \u0648\u0627\u0644\u0635\u0627\u062f\u0631\u0629. \u062a\u062a\u0631\u0633\u0644 \u0631\u0633\u0627\u0626\u0644 \u0645\u0628\u0627\u0634\u0631\u0629\u060c \u0623\u0648 \u0627\u0633\u062a\u062e\u062f\u0645 \u0632\u0648\u0631 \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629 \u0644\u0625\u0631\u0633\u0627\u0644 \u0641\u0627\u062a\u0648\u0631\u0629 \u0644\u0644\u0639\u0645\u064a\u0644 \u0643\u0635\u0648\u0631\u0629.",
      },
      {
        key: "campaigns",
        caption: "\u0627\u0644\u062d\u0645\u0644\u0627\u062a: \u0623\u0646\u0634\u0626 \u062d\u0645\u0644\u0629 \u0628\u0627\u062e\u062a\u064a\u0627\u0631 \u0627\u0644\u062c\u0645\u0647\u0648\u0631 \u0627\u0644\u0645\u0633\u062a\u0647\u062f\u0641 \u0648\u0646\u0635 \u0627\u0644\u0631\u0633\u0627\u0644\u0629. \u062a\u062a\u0645 \u0627\u0644\u0625\u0631\u0633\u0627\u0644 \u062a\u0644\u0642\u0627\u0626\u064a\u0627\u064b \u0628\u0645\u0639\u062f\u0644 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0645\u0639\u062f.",
      },
    ],
  },
};

export default pageGuides;
