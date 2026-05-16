const helpContent = {
  dashboard: {
    title_ar: 'لوحة التحكم',
    steps: [
      {
        id: 'dashboard-welcome',
        target: 'dashboard-header',
        title_ar: 'مرحباً بك في لوحة التحكم',
        body_ar: 'هذه الشاشة الرئيسية التي تعرض ملخصاً شاملاً لنشاط متجرك اليومي.',
        placement: 'bottom',
      },
      {
        id: 'dashboard-stats',
        target: 'stats-cards',
        title_ar: 'بطاقات الإحصائيات',
        body_ar: 'تعرض أهم الأرقام اليومية: المبيعات، المشتريات، الأرباح، وعدد الفواتير.',
        placement: 'bottom',
      },
      {
        id: 'dashboard-chart',
        target: 'sales-chart',
        title_ar: 'مخطط المبيعات',
        body_ar: 'يوضح اتجاه المبيعات خلال الفترة المحددة. يمكنك تغيير الفترة الزمنية من القائمة أعلاه.',
        placement: 'top',
      },
      {
        id: 'dashboard-top-items',
        target: 'top-items',
        title_ar: 'الأصناف الأكثر مبيعاً',
        body_ar: 'قائمة بأكثر الأصناف مبيعاً في الفترة الحالية لمساعدتك في قرارات الشراء.',
        placement: 'top',
      },
      {
        id: 'dashboard-alerts',
        target: 'alerts-section',
        title_ar: 'التنبيهات والإشعارات',
        body_ar: 'تنبيهات فورية للأصناف منخفضة المخزون والفواتير المتأخرة.',
        placement: 'bottom',
      },
    ],
  },

  pos: {
    title_ar: 'نقطة البيع',
    steps: [
      {
        id: 'pos-search',
        target: 'search-bar',
        title_ar: 'البحث عن الأصناف',
        body_ar: 'ابحث عن أي صنف بالاسم أو الباركود أو الكود. يمكنك أيضاً استخدام الماسح الضوئي مباشرةً.',
        placement: 'bottom',
        highlight_type: 'spotlight',
      },
      {
        id: 'pos-cart',
        target: 'cart',
        title_ar: 'سلة المشتريات',
        body_ar: 'تظهر هنا الأصناف المضافة للفاتورة. يمكنك تعديل الكمية أو الخصم لكل صنف بالنقر عليه.',
        placement: 'start',
      },
      {
        id: 'pos-customer',
        target: 'customer-select',
        title_ar: 'اختيار العميل',
        body_ar: 'اختر العميل لربط الفاتورة بحسابه وتطبيق أسعاره الخاصة وتجميع نقاط الولاء.',
        placement: 'bottom',
      },
      {
        id: 'pos-discount',
        target: 'discount-field',
        title_ar: 'الخصم الإجمالي',
        body_ar: 'أضف خصماً على إجمالي الفاتورة كنسبة مئوية أو قيمة ثابتة.',
        placement: 'top',
      },
      {
        id: 'pos-payment',
        target: 'payment-section',
        title_ar: 'طريقة الدفع',
        body_ar: 'اختر طريقة الدفع: نقداً، بطاقة، آجل، أو دفع مختلط. يمكن تقسيم المبلغ على أكثر من طريقة.',
        placement: 'top',
        highlight_type: 'glow',
      },
      {
        id: 'pos-hold',
        target: 'hold-button',
        title_ar: 'تعليق الفاتورة',
        body_ar: 'علّق الفاتورة الحالية واحتفظ بها لاسترجاعها لاحقاً دون فقدان البيانات.',
        placement: 'top',
      },
      {
        id: 'pos-confirm',
        target: 'confirm-button',
        title_ar: 'تأكيد البيع',
        body_ar: 'بعد مراجعة الفاتورة اضغط هنا لإتمام عملية البيع وطباعة الإيصال.',
        placement: 'top',
        highlight_type: 'spotlight',
      },
    ],
  },

  daily_treasury: {
    title_ar: 'الخزينة اليومية',
    steps: [
      {
        id: 'treasury-summary',
        target: 'stats-cards',
        title_ar: 'ملخص الخزينة',
        body_ar: 'يعرض إجمالي المقبوضات والمدفوعات ورصيد الخزينة الحالي لهذا اليوم.',
        placement: 'bottom',
      },
      {
        id: 'treasury-transactions',
        target: 'main-table',
        title_ar: 'حركات الخزينة',
        body_ar: 'جميع العمليات المالية المسجلة اليوم مرتبةً زمنياً مع تفاصيل كل حركة.',
        placement: 'top',
      },
      {
        id: 'treasury-filter',
        target: 'search-bar',
        title_ar: 'تصفية الحركات',
        body_ar: 'صفّ الحركات حسب النوع أو وسيلة الدفع أو الفترة الزمنية.',
        placement: 'bottom',
      },
      {
        id: 'treasury-shift',
        target: 'shift-section',
        title_ar: 'معلومات الوردية',
        body_ar: 'يعرض بيانات الوردية المفتوحة حالياً ورصيد البداية والمبالغ المتوقعة.',
        placement: 'bottom',
      },
    ],
  },

  analytics: {
    title_ar: 'التحليلات والمبيعات',
    steps: [
      {
        id: 'analytics-period',
        target: 'period-filter',
        title_ar: 'تحديد الفترة',
        body_ar: 'اختر الفترة الزمنية للتحليل: يومي، أسبوعي، شهري، أو نطاق مخصص.',
        placement: 'bottom',
      },
      {
        id: 'analytics-charts',
        target: 'sales-chart',
        title_ar: 'مخططات المبيعات',
        body_ar: 'تحليل بصري للمبيعات والأرباح والمقارنات بين الفترات المختلفة.',
        placement: 'top',
      },
      {
        id: 'analytics-top',
        target: 'top-items',
        title_ar: 'الأصناف والعملاء الأكثر نشاطاً',
        body_ar: 'ترتيب الأصناف والعملاء حسب حجم المبيعات والأرباح لاتخاذ قرارات أفضل.',
        placement: 'top',
      },
      {
        id: 'analytics-export',
        target: 'export-button',
        title_ar: 'تصدير التقارير',
        body_ar: 'صدّر بيانات التحليل إلى Excel أو PDF للمشاركة أو الأرشفة.',
        placement: 'bottom',
      },
    ],
  },

  purchases: {
    title_ar: 'فواتير المشتريات',
    steps: [
      {
        id: 'purchases-new',
        target: 'add-button',
        title_ar: 'فاتورة شراء جديدة',
        body_ar: 'اضغط هنا لإنشاء فاتورة شراء جديدة من أحد الموردين.',
        placement: 'bottom',
        highlight_type: 'spotlight',
      },
      {
        id: 'purchases-search',
        target: 'search-bar',
        title_ar: 'البحث في الفواتير',
        body_ar: 'ابحث عن فاتورة برقمها أو اسم المورد أو التاريخ.',
        placement: 'bottom',
      },
      {
        id: 'purchases-table',
        target: 'main-table',
        title_ar: 'قائمة الفواتير',
        body_ar: 'جميع فواتير الشراء مع الحالة والمبلغ والمورد. اضغط على أي فاتورة لعرض تفاصيلها.',
        placement: 'top',
      },
      {
        id: 'purchases-supplier',
        target: 'supplier-select',
        title_ar: 'اختيار المورد',
        body_ar: 'حدد المورد لتحميل أسعاره وشروط الدفع الخاصة به تلقائياً.',
        placement: 'bottom',
      },
      {
        id: 'purchases-items',
        target: 'items-section',
        title_ar: 'إضافة الأصناف',
        body_ar: 'أضف الأصناف المشتراة مع الكمية وسعر الشراء لكل صنف.',
        placement: 'top',
      },
      {
        id: 'purchases-payment',
        target: 'payment-section',
        title_ar: 'شروط الدفع',
        body_ar: 'حدد طريقة الدفع: فوري أو آجل. في حال الآجل ستُضاف الفاتورة لحساب المورد.',
        placement: 'top',
      },
    ],
  },

  purchase_orders: {
    title_ar: 'أوامر الشراء',
    steps: [
      {
        id: 'po-new',
        target: 'add-button',
        title_ar: 'أمر شراء جديد',
        body_ar: 'أنشئ أمر شراء لإرساله للمورد قبل استلام البضاعة.',
        placement: 'bottom',
        highlight_type: 'spotlight',
      },
      {
        id: 'po-table',
        target: 'main-table',
        title_ar: 'أوامر الشراء',
        body_ar: 'قائمة بجميع أوامر الشراء وحالتها: مفتوح، مستلم جزئياً، مكتمل.',
        placement: 'top',
      },
      {
        id: 'po-convert',
        target: 'convert-button',
        title_ar: 'تحويل لفاتورة شراء',
        body_ar: 'عند استلام البضاعة حوّل أمر الشراء مباشرةً إلى فاتورة شراء بضغطة واحدة.',
        placement: 'bottom',
      },
      {
        id: 'po-search',
        target: 'search-bar',
        title_ar: 'البحث والتصفية',
        body_ar: 'صفّ الأوامر حسب المورد أو الحالة أو التاريخ للوصول السريع.',
        placement: 'bottom',
      },
    ],
  },

  purchase_returns: {
    title_ar: 'مرتجع المشتريات',
    steps: [
      {
        id: 'pr-new',
        target: 'add-button',
        title_ar: 'مرتجع جديد',
        body_ar: 'سجّل إعادة بضاعة لمورد مع تحديد السبب والأصناف المرتجعة.',
        placement: 'bottom',
        highlight_type: 'spotlight',
      },
      {
        id: 'pr-table',
        target: 'main-table',
        title_ar: 'قائمة المرتجعات',
        body_ar: 'جميع مرتجعات الشراء مع المبلغ المسترد وحالة التسوية.',
        placement: 'top',
      },
      {
        id: 'pr-search',
        target: 'search-bar',
        title_ar: 'البحث',
        body_ar: 'ابحث عن مرتجع بالرقم أو اسم المورد.',
        placement: 'bottom',
      },
    ],
  },

  sales_returns: {
    title_ar: 'مرتجع المبيعات',
    steps: [
      {
        id: 'sr-new',
        target: 'add-button',
        title_ar: 'مرتجع مبيعات جديد',
        body_ar: 'سجّل إعادة بضاعة من عميل مع تحديد الفاتورة الأصلية والأصناف المرتجعة.',
        placement: 'bottom',
        highlight_type: 'spotlight',
      },
      {
        id: 'sr-table',
        target: 'main-table',
        title_ar: 'قائمة المرتجعات',
        body_ar: 'جميع مرتجعات المبيعات مع حالة استرداد المبلغ.',
        placement: 'top',
      },
      {
        id: 'sr-original',
        target: 'invoice-select',
        title_ar: 'الفاتورة الأصلية',
        body_ar: 'اختر الفاتورة الأصلية لاستيراد بياناتها تلقائياً وضمان دقة المرتجع.',
        placement: 'bottom',
      },
      {
        id: 'sr-search',
        target: 'search-bar',
        title_ar: 'البحث',
        body_ar: 'ابحث عن مرتجع بالرقم أو اسم العميل.',
        placement: 'bottom',
      },
    ],
  },

  branch_transfer: {
    title_ar: 'نقل المخزون',
    steps: [
      {
        id: 'bt-new',
        target: 'add-button',
        title_ar: 'طلب نقل جديد',
        body_ar: 'أنشئ طلب نقل مخزون بين الفروع أو المستودعات.',
        placement: 'bottom',
        highlight_type: 'spotlight',
      },
      {
        id: 'bt-table',
        target: 'main-table',
        title_ar: 'طلبات النقل',
        body_ar: 'جميع طلبات النقل وحالتها: معلق، جارٍ، مكتمل.',
        placement: 'top',
      },
      {
        id: 'bt-from-to',
        target: 'warehouse-select',
        title_ar: 'المستودع المصدر والوجهة',
        body_ar: 'حدد المستودع الذي تنقل منه وإليه للتأكد من تحديث الأرصدة بشكل صحيح.',
        placement: 'bottom',
      },
    ],
  },

  quotations: {
    title_ar: 'عروض الأسعار',
    steps: [
      {
        id: 'qt-new',
        target: 'add-button',
        title_ar: 'عرض سعر جديد',
        body_ar: 'أنشئ عرض سعر لعميل يمكن تحويله لاحقاً إلى فاتورة بيع.',
        placement: 'bottom',
        highlight_type: 'spotlight',
      },
      {
        id: 'qt-table',
        target: 'main-table',
        title_ar: 'عروض الأسعار',
        body_ar: 'جميع العروض المرسلة وحالتها: مفتوح، مقبول، مرفوض، منتهي الصلاحية.',
        placement: 'top',
      },
      {
        id: 'qt-convert',
        target: 'convert-button',
        title_ar: 'تحويل لفاتورة',
        body_ar: 'عند موافقة العميل حوّل العرض مباشرةً إلى فاتورة بيع.',
        placement: 'bottom',
      },
      {
        id: 'qt-search',
        target: 'search-bar',
        title_ar: 'البحث',
        body_ar: 'ابحث عن عرض برقمه أو اسم العميل.',
        placement: 'bottom',
      },
    ],
  },

  customer_accounts: {
    title_ar: 'حسابات العملاء',
    steps: [
      {
        id: 'ca-search',
        target: 'search-bar',
        title_ar: 'البحث عن عميل',
        body_ar: 'ابحث عن عميل بالاسم أو الهاتف لعرض رصيده وحركاته.',
        placement: 'bottom',
      },
      {
        id: 'ca-table',
        target: 'main-table',
        title_ar: 'أرصدة العملاء',
        body_ar: 'قائمة بجميع العملاء وأرصدتهم الحالية. العملاء باللون الأحمر لديهم مبالغ متأخرة.',
        placement: 'top',
      },
      {
        id: 'ca-collect',
        target: 'collect-button',
        title_ar: 'تحصيل دفعة',
        body_ar: 'سجّل دفعة من العميل لتخفيض رصيده المتأخر.',
        placement: 'bottom',
        highlight_type: 'glow',
      },
      {
        id: 'ca-statement',
        target: 'statement-button',
        title_ar: 'كشف حساب',
        body_ar: 'اطبع أو صدّر كشف حساب مفصّل للعميل لإرساله له.',
        placement: 'bottom',
      },
    ],
  },

  supplier_accounts: {
    title_ar: 'حسابات الموردين',
    steps: [
      {
        id: 'sa-search',
        target: 'search-bar',
        title_ar: 'البحث عن مورد',
        body_ar: 'ابحث عن مورد بالاسم لعرض رصيده وحركاته.',
        placement: 'bottom',
      },
      {
        id: 'sa-table',
        target: 'main-table',
        title_ar: 'أرصدة الموردين',
        body_ar: 'قائمة بجميع الموردين وإجمالي المديونيات لكل مورد.',
        placement: 'top',
      },
      {
        id: 'sa-pay',
        target: 'pay-button',
        title_ar: 'تسجيل دفعة',
        body_ar: 'سجّل دفعة لمورد لتخفيض الرصيد المستحق عليك.',
        placement: 'bottom',
        highlight_type: 'glow',
      },
      {
        id: 'sa-statement',
        target: 'statement-button',
        title_ar: 'كشف حساب',
        body_ar: 'استعرض وصدّر كشف حساب مفصّل مع المورد.',
        placement: 'bottom',
      },
    ],
  },

  revenues: {
    title_ar: 'تسجيل الإيرادات',
    steps: [
      {
        id: 'rev-new',
        target: 'add-button',
        title_ar: 'إيراد جديد',
        body_ar: 'سجّل أي إيراد غير مرتبط بفاتورة بيع مثل أجور الإيجار أو الخدمات.',
        placement: 'bottom',
        highlight_type: 'spotlight',
      },
      {
        id: 'rev-table',
        target: 'main-table',
        title_ar: 'سجل الإيرادات',
        body_ar: 'جميع الإيرادات المسجلة مرتبةً حسب التاريخ مع التصنيف والمبلغ.',
        placement: 'top',
      },
      {
        id: 'rev-search',
        target: 'search-bar',
        title_ar: 'البحث والتصفية',
        body_ar: 'صفّ الإيرادات حسب الفئة أو الفترة الزمنية.',
        placement: 'bottom',
      },
    ],
  },

  expenses: {
    title_ar: 'تسجيل المصروفات',
    steps: [
      {
        id: 'exp-new',
        target: 'add-button',
        title_ar: 'مصروف جديد',
        body_ar: 'سجّل أي مصروف تشغيلي مثل الإيجار، الفواتير، أو المواصلات.',
        placement: 'bottom',
        highlight_type: 'spotlight',
      },
      {
        id: 'exp-table',
        target: 'main-table',
        title_ar: 'سجل المصروفات',
        body_ar: 'جميع المصروفات المسجلة مع التصنيف والمبلغ وطريقة الدفع.',
        placement: 'top',
      },
      {
        id: 'exp-search',
        target: 'search-bar',
        title_ar: 'البحث والتصفية',
        body_ar: 'صفّ المصروفات حسب الفئة أو التاريخ.',
        placement: 'bottom',
      },
    ],
  },

  withdrawals: {
    title_ar: 'المسحوبات',
    steps: [
      {
        id: 'wd-new',
        target: 'add-button',
        title_ar: 'مسحوبات جديدة',
        body_ar: 'سجّل سحب نقدي من الخزينة سواء للمالك أو لأغراض أخرى.',
        placement: 'bottom',
        highlight_type: 'spotlight',
      },
      {
        id: 'wd-table',
        target: 'main-table',
        title_ar: 'سجل المسحوبات',
        body_ar: 'جميع السحوبات المسجلة مرتبةً زمنياً.',
        placement: 'top',
      },
      {
        id: 'wd-search',
        target: 'search-bar',
        title_ar: 'البحث',
        body_ar: 'صفّ المسحوبات حسب التاريخ أو المبلغ.',
        placement: 'bottom',
      },
    ],
  },

  payment_methods: {
    title_ar: 'وسائل الدفع',
    steps: [
      {
        id: 'pm-table',
        target: 'main-table',
        title_ar: 'وسائل الدفع المتاحة',
        body_ar: 'جميع وسائل الدفع المفعّلة في النظام مثل النقد والبطاقات والمحافظ الرقمية.',
        placement: 'top',
      },
      {
        id: 'pm-new',
        target: 'add-button',
        title_ar: 'إضافة وسيلة دفع',
        body_ar: 'أضف وسيلة دفع جديدة وحدد اسمها ونوعها والخزينة المرتبطة بها.',
        placement: 'bottom',
      },
      {
        id: 'pm-toggle',
        target: 'toggle-button',
        title_ar: 'تفعيل أو تعطيل',
        body_ar: 'يمكنك تعطيل وسيلة دفع مؤقتاً دون حذفها إذا لم تكن بحاجة إليها.',
        placement: 'bottom',
      },
    ],
  },

  bank_operations: {
    title_ar: 'البنوك والفيزا',
    steps: [
      {
        id: 'bo-new',
        target: 'add-button',
        title_ar: 'عملية بنكية جديدة',
        body_ar: 'سجّل إيداعاً أو سحباً بنكياً أو تحويلاً بين الحسابات.',
        placement: 'bottom',
        highlight_type: 'spotlight',
      },
      {
        id: 'bo-table',
        target: 'main-table',
        title_ar: 'الحركات البنكية',
        body_ar: 'جميع العمليات البنكية المسجلة مع الرصيد بعد كل عملية.',
        placement: 'top',
      },
      {
        id: 'bo-search',
        target: 'search-bar',
        title_ar: 'التصفية',
        body_ar: 'صفّ الحركات حسب الحساب البنكي أو نوع العملية أو الفترة.',
        placement: 'bottom',
      },
    ],
  },

  cheques: {
    title_ar: 'إدارة الشيكات',
    steps: [
      {
        id: 'ch-new',
        target: 'add-button',
        title_ar: 'شيك جديد',
        body_ar: 'سجّل شيكاً صادراً أو وارداً مع تاريخ الاستحقاق والمبلغ.',
        placement: 'bottom',
        highlight_type: 'spotlight',
      },
      {
        id: 'ch-table',
        target: 'main-table',
        title_ar: 'الشيكات',
        body_ar: 'قائمة بجميع الشيكات وحالتها: مستحق، محصّل، مرتجع.',
        placement: 'top',
      },
      {
        id: 'ch-due',
        target: 'due-filter',
        title_ar: 'الشيكات المستحقة',
        body_ar: 'فلترة لعرض الشيكات التي حلّ موعد استحقاقها لمتابعة التحصيل.',
        placement: 'bottom',
        highlight_type: 'glow',
      },
      {
        id: 'ch-search',
        target: 'search-bar',
        title_ar: 'البحث',
        body_ar: 'ابحث عن شيك برقمه أو اسم العميل أو المورد.',
        placement: 'bottom',
      },
    ],
  },

  items: {
    title_ar: 'قاعدة الأصناف',
    steps: [
      {
        id: 'items-new',
        target: 'add-button',
        title_ar: 'صنف جديد',
        body_ar: 'أضف صنفاً جديداً مع بياناته الكاملة: الاسم، الباركود، الأسعار، والمخزون الافتراضي.',
        placement: 'bottom',
        highlight_type: 'spotlight',
      },
      {
        id: 'items-search',
        target: 'search-bar',
        title_ar: 'البحث عن صنف',
        body_ar: 'ابحث عن أي صنف بالاسم أو الباركود أو الكود للوصول السريع.',
        placement: 'bottom',
      },
      {
        id: 'items-table',
        target: 'main-table',
        title_ar: 'قائمة الأصناف',
        body_ar: 'جميع الأصناف مع السعر والمخزون الحالي. اضغط على صنف لتعديل بياناته.',
        placement: 'top',
      },
      {
        id: 'items-filter',
        target: 'category-filter',
        title_ar: 'التصفية بالفئة',
        body_ar: 'صفّ الأصناف حسب الفئة أو المستودع لعرض مجموعة محددة.',
        placement: 'bottom',
      },
      {
        id: 'items-import',
        target: 'import-button',
        title_ar: 'استيراد من Excel',
        body_ar: 'استورد قائمة أصناف بالجملة من ملف Excel لتوفير وقت الإدخال اليدوي.',
        placement: 'bottom',
      },
    ],
  },

  categories: {
    title_ar: 'أقسام الأصناف',
    steps: [
      {
        id: 'cat-new',
        target: 'add-button',
        title_ar: 'قسم جديد',
        body_ar: 'أضف قسماً جديداً لتصنيف أصنافك وتسهيل البحث والتقارير.',
        placement: 'bottom',
      },
      {
        id: 'cat-table',
        target: 'main-table',
        title_ar: 'الأقسام الموجودة',
        body_ar: 'جميع الأقسام مع عدد الأصناف في كل قسم.',
        placement: 'top',
      },
      {
        id: 'cat-search',
        target: 'search-bar',
        title_ar: 'البحث',
        body_ar: 'ابحث عن قسم بالاسم.',
        placement: 'bottom',
      },
    ],
  },

  bulk_price_update: {
    title_ar: 'تحديث الأسعار',
    steps: [
      {
        id: 'bpu-filter',
        target: 'category-filter',
        title_ar: 'تحديد النطاق',
        body_ar: 'اختر الفئة أو المورد لتحديد مجموعة الأصناف التي تريد تعديل أسعارها.',
        placement: 'bottom',
      },
      {
        id: 'bpu-method',
        target: 'update-method',
        title_ar: 'طريقة التحديث',
        body_ar: 'حدد طريقة التحديث: نسبة مئوية، قيمة ثابتة، أو سعر محدد لكل صنف.',
        placement: 'bottom',
      },
      {
        id: 'bpu-table',
        target: 'main-table',
        title_ar: 'معاينة التغييرات',
        body_ar: 'راجع الأسعار القديمة والجديدة قبل تطبيق التحديث.',
        placement: 'top',
      },
      {
        id: 'bpu-apply',
        target: 'apply-button',
        title_ar: 'تطبيق التحديث',
        body_ar: 'اضغط هنا لتطبيق التغييرات على جميع الأصناف المحددة دفعةً واحدة.',
        placement: 'bottom',
        highlight_type: 'glow',
      },
    ],
  },

  stock_transfer: {
    title_ar: 'التحويل المخزني',
    steps: [
      {
        id: 'st-new',
        target: 'add-button',
        title_ar: 'تحويل جديد',
        body_ar: 'أنشئ عملية تحويل مخزون بين مستودعين داخل نفس الفرع.',
        placement: 'bottom',
        highlight_type: 'spotlight',
      },
      {
        id: 'st-table',
        target: 'main-table',
        title_ar: 'سجل التحويلات',
        body_ar: 'جميع عمليات التحويل المخزني مع التاريخ والكميات.',
        placement: 'top',
      },
      {
        id: 'st-search',
        target: 'search-bar',
        title_ar: 'البحث',
        body_ar: 'ابحث عن تحويل برقمه أو اسم الصنف.',
        placement: 'bottom',
      },
    ],
  },

  physical_count: {
    title_ar: 'الجرد الفعلي',
    steps: [
      {
        id: 'pc-new',
        target: 'add-button',
        title_ar: 'جلسة جرد جديدة',
        body_ar: 'ابدأ جلسة جرد فعلي لمطابقة المخزون الفعلي مع المخزون في النظام.',
        placement: 'bottom',
        highlight_type: 'spotlight',
      },
      {
        id: 'pc-table',
        target: 'main-table',
        title_ar: 'جلسات الجرد',
        body_ar: 'جميع جلسات الجرد السابقة مع تاريخ الجرد ونتيجته.',
        placement: 'top',
      },
      {
        id: 'pc-diff',
        target: 'differences-section',
        title_ar: 'الفروقات',
        body_ar: 'يعرض الفرق بين الكمية الفعلية والكمية المسجلة لاتخاذ إجراء تصحيحي.',
        placement: 'top',
        highlight_type: 'glow',
      },
      {
        id: 'pc-apply',
        target: 'apply-button',
        title_ar: 'تطبيق التسوية',
        body_ar: 'طبّق نتائج الجرد لتحديث أرصدة المخزون تلقائياً.',
        placement: 'bottom',
      },
    ],
  },

  promotions: {
    title_ar: 'العروض والتخفيضات',
    steps: [
      {
        id: 'promo-new',
        target: 'add-button',
        title_ar: 'عرض جديد',
        body_ar: 'أنشئ عرضاً ترويجياً: خصم بنسبة، اشتري X واحصل على Y، أو سعر خاص.',
        placement: 'bottom',
        highlight_type: 'spotlight',
      },
      {
        id: 'promo-table',
        target: 'main-table',
        title_ar: 'العروض الحالية',
        body_ar: 'جميع العروض مع تواريخ الصلاحية وحالة التفعيل.',
        placement: 'top',
      },
      {
        id: 'promo-toggle',
        target: 'toggle-button',
        title_ar: 'تفعيل أو إيقاف',
        body_ar: 'فعّل أو أوقف أي عرض فورياً دون الحاجة لحذفه.',
        placement: 'bottom',
      },
      {
        id: 'promo-search',
        target: 'search-bar',
        title_ar: 'البحث',
        body_ar: 'ابحث عن عرض باسمه أو الصنف المرتبط به.',
        placement: 'bottom',
      },
    ],
  },

  branches: {
    title_ar: 'الفروع',
    steps: [
      {
        id: 'br-new',
        target: 'add-button',
        title_ar: 'فرع جديد',
        body_ar: 'أضف فرعاً جديداً مع بياناته: الاسم، العنوان، ومعلومات التواصل.',
        placement: 'bottom',
      },
      {
        id: 'br-table',
        target: 'main-table',
        title_ar: 'الفروع المسجلة',
        body_ar: 'جميع فروع المنشأة مع حالة كل فرع.',
        placement: 'top',
      },
      {
        id: 'br-search',
        target: 'search-bar',
        title_ar: 'البحث',
        body_ar: 'ابحث عن فرع بالاسم أو الموقع.',
        placement: 'bottom',
      },
    ],
  },

  customers: {
    title_ar: 'العملاء',
    steps: [
      {
        id: 'cust-new',
        target: 'add-button',
        title_ar: 'عميل جديد',
        body_ar: 'أضف عميلاً جديداً مع بياناته: الاسم، الهاتف، العنوان، وحد الائتمان.',
        placement: 'bottom',
        highlight_type: 'spotlight',
      },
      {
        id: 'cust-search',
        target: 'search-bar',
        title_ar: 'البحث عن عميل',
        body_ar: 'ابحث عن عميل بالاسم أو الهاتف أو الكود للوصول السريع.',
        placement: 'bottom',
      },
      {
        id: 'cust-table',
        target: 'main-table',
        title_ar: 'قائمة العملاء',
        body_ar: 'جميع العملاء مع الرصيد الحالي. اضغط على عميل لعرض ملفه الكامل.',
        placement: 'top',
      },
      {
        id: 'cust-import',
        target: 'import-button',
        title_ar: 'استيراد العملاء',
        body_ar: 'استورد قائمة عملاء من Excel بدلاً من الإدخال اليدوي.',
        placement: 'bottom',
      },
    ],
  },

  suppliers: {
    title_ar: 'الموردين',
    steps: [
      {
        id: 'sup-new',
        target: 'add-button',
        title_ar: 'مورد جديد',
        body_ar: 'أضف مورداً جديداً مع بيانات التواصل والحساب البنكي وشروط الدفع.',
        placement: 'bottom',
        highlight_type: 'spotlight',
      },
      {
        id: 'sup-search',
        target: 'search-bar',
        title_ar: 'البحث',
        body_ar: 'ابحث عن مورد بالاسم أو الهاتف.',
        placement: 'bottom',
      },
      {
        id: 'sup-table',
        target: 'main-table',
        title_ar: 'قائمة الموردين',
        body_ar: 'جميع الموردين مع الرصيد المستحق. اضغط على مورد لعرض حركاته.',
        placement: 'top',
      },
    ],
  },

  warehouses: {
    title_ar: 'المخازن',
    steps: [
      {
        id: 'wh-new',
        target: 'add-button',
        title_ar: 'مخزن جديد',
        body_ar: 'أضف مستودعاً جديداً مع تحديد الفرع التابع له.',
        placement: 'bottom',
      },
      {
        id: 'wh-table',
        target: 'main-table',
        title_ar: 'المخازن المسجلة',
        body_ar: 'جميع المستودعات مع الفرع التابع لكل منها.',
        placement: 'top',
      },
      {
        id: 'wh-search',
        target: 'search-bar',
        title_ar: 'البحث',
        body_ar: 'ابحث عن مستودع بالاسم.',
        placement: 'bottom',
      },
    ],
  },

  banks: {
    title_ar: 'البنوك',
    steps: [
      {
        id: 'bank-new',
        target: 'add-button',
        title_ar: 'حساب بنكي جديد',
        body_ar: 'أضف حساباً بنكياً جديداً مع اسم البنك ورقم الحساب والرصيد الافتراضي.',
        placement: 'bottom',
      },
      {
        id: 'bank-table',
        target: 'main-table',
        title_ar: 'الحسابات البنكية',
        body_ar: 'جميع الحسابات البنكية مع الأرصدة الحالية.',
        placement: 'top',
      },
      {
        id: 'bank-search',
        target: 'search-bar',
        title_ar: 'البحث',
        body_ar: 'ابحث عن حساب باسم البنك.',
        placement: 'bottom',
      },
    ],
  },

  units: {
    title_ar: 'وحدات القياس',
    steps: [
      {
        id: 'units-new',
        target: 'add-button',
        title_ar: 'وحدة جديدة',
        body_ar: 'أضف وحدة قياس جديدة مثل: كيلو، لتر، قطعة، كرتون.',
        placement: 'bottom',
      },
      {
        id: 'units-table',
        target: 'main-table',
        title_ar: 'الوحدات المسجلة',
        body_ar: 'جميع وحدات القياس المستخدمة في الأصناف.',
        placement: 'top',
      },
    ],
  },

  financial_categories: {
    title_ar: 'أقسام الحركات المالية',
    steps: [
      {
        id: 'fc-new',
        target: 'add-button',
        title_ar: 'قسم جديد',
        body_ar: 'أضف تصنيفاً جديداً للإيرادات أو المصروفات لتنظيم تقاريرك المالية.',
        placement: 'bottom',
      },
      {
        id: 'fc-table',
        target: 'main-table',
        title_ar: 'الأقسام المالية',
        body_ar: 'جميع تصنيفات الإيرادات والمصروفات.',
        placement: 'top',
      },
      {
        id: 'fc-search',
        target: 'search-bar',
        title_ar: 'البحث',
        body_ar: 'ابحث عن تصنيف بالاسم.',
        placement: 'bottom',
      },
    ],
  },

  reports: {
    title_ar: 'مركز التقارير',
    steps: [
      {
        id: 'rep-search',
        target: 'search-bar',
        title_ar: 'البحث عن تقرير',
        body_ar: 'ابحث عن أي تقرير بالاسم للوصول إليه مباشرةً.',
        placement: 'bottom',
      },
      {
        id: 'rep-categories',
        target: 'report-categories',
        title_ar: 'تصنيفات التقارير',
        body_ar: 'التقارير مقسّمة حسب المجال: مبيعات، مشتريات، مخزون، مالية. اضغط على أي فئة لاستعراض تقاريرها.',
        placement: 'top',
      },
      {
        id: 'rep-favorite',
        target: 'favorite-button',
        title_ar: 'التقارير المفضلة',
        body_ar: 'احفظ التقارير التي تستخدمها كثيراً في قسم المفضلة للوصول السريع.',
        placement: 'bottom',
      },
      {
        id: 'rep-period',
        target: 'period-filter',
        title_ar: 'تحديد الفترة',
        body_ar: 'حدد الفترة الزمنية للتقرير قبل تشغيله.',
        placement: 'bottom',
      },
      {
        id: 'rep-export',
        target: 'export-button',
        title_ar: 'تصدير التقرير',
        body_ar: 'صدّر نتائج التقرير إلى Excel أو PDF بضغطة واحدة.',
        placement: 'bottom',
        highlight_type: 'glow',
      },
    ],
  },

  users: {
    title_ar: 'المستخدمين',
    steps: [
      {
        id: 'usr-new',
        target: 'add-button',
        title_ar: 'مستخدم جديد',
        body_ar: 'أضف مستخدماً جديداً وحدد دوره وصلاحياته في النظام.',
        placement: 'bottom',
        highlight_type: 'spotlight',
      },
      {
        id: 'usr-table',
        target: 'main-table',
        title_ar: 'قائمة المستخدمين',
        body_ar: 'جميع مستخدمي النظام مع أدوارهم وحالة حساباتهم.',
        placement: 'top',
      },
      {
        id: 'usr-permissions',
        target: 'permissions-section',
        title_ar: 'الصلاحيات',
        body_ar: 'خصّص صلاحيات كل مستخدم بدقة: ماذا يرى وماذا يستطيع تعديله.',
        placement: 'top',
        highlight_type: 'glow',
      },
      {
        id: 'usr-search',
        target: 'search-bar',
        title_ar: 'البحث',
        body_ar: 'ابحث عن مستخدم بالاسم أو اسم المستخدم.',
        placement: 'bottom',
      },
    ],
  },

  employees: {
    title_ar: 'الموظفين',
    steps: [
      {
        id: 'emp-new',
        target: 'add-button',
        title_ar: 'موظف جديد',
        body_ar: 'أضف موظفاً جديداً مع بياناته الشخصية والوظيفية والراتب.',
        placement: 'bottom',
        highlight_type: 'spotlight',
      },
      {
        id: 'emp-table',
        target: 'main-table',
        title_ar: 'قائمة الموظفين',
        body_ar: 'جميع الموظفين مع المسمى الوظيفي والفرع.',
        placement: 'top',
      },
      {
        id: 'emp-search',
        target: 'search-bar',
        title_ar: 'البحث',
        body_ar: 'ابحث عن موظف بالاسم أو الرقم الوظيفي.',
        placement: 'bottom',
      },
    ],
  },

  settings: {
    title_ar: 'الإعدادات العامة',
    steps: [
      {
        id: 'set-tabs',
        target: 'settings-tabs',
        title_ar: 'أقسام الإعدادات',
        body_ar: 'الإعدادات مقسّمة في تبويبات: الشركة، الطباعة، المظهر، الضريبة، والمزيد.',
        placement: 'bottom',
      },
      {
        id: 'set-company',
        target: 'company-section',
        title_ar: 'بيانات الشركة',
        body_ar: 'أدخل اسم منشأتك، الشعار، ومعلومات التواصل التي تظهر على الفواتير.',
        placement: 'top',
      },
      {
        id: 'set-print',
        target: 'print-section',
        title_ar: 'إعدادات الطباعة',
        body_ar: 'خصّص شكل الفاتورة المطبوعة: حجم الورق، الترويسة، التذييل.',
        placement: 'top',
      },
      {
        id: 'set-save',
        target: 'save-button',
        title_ar: 'حفظ الإعدادات',
        body_ar: 'لا تنسَ حفظ التغييرات بعد أي تعديل.',
        placement: 'bottom',
        highlight_type: 'glow',
      },
    ],
  },

  history: {
    title_ar: 'سجل النشاط',
    steps: [
      {
        id: 'hist-table',
        target: 'main-table',
        title_ar: 'سجل العمليات',
        body_ar: 'سجل تفصيلي بجميع العمليات التي أجراها المستخدمون مع التوقيت والمستخدم المسؤول.',
        placement: 'top',
      },
      {
        id: 'hist-filter',
        target: 'search-bar',
        title_ar: 'التصفية',
        body_ar: 'صفّ السجلات حسب المستخدم، نوع العملية، أو الفترة الزمنية.',
        placement: 'bottom',
      },
      {
        id: 'hist-export',
        target: 'export-button',
        title_ar: 'تصدير السجل',
        body_ar: 'صدّر سجل النشاط للمراجعة أو التدقيق.',
        placement: 'bottom',
      },
    ],
  },

  updates: {
    title_ar: 'التحديثات',
    steps: [
      {
        id: 'upd-current',
        target: 'version-section',
        title_ar: 'الإصدار الحالي',
        body_ar: 'يعرض رقم الإصدار المثبّت حالياً وتاريخ آخر تحديث.',
        placement: 'bottom',
      },
      {
        id: 'upd-check',
        target: 'check-button',
        title_ar: 'التحقق من التحديثات',
        body_ar: 'اضغط للبحث عن إصدارات جديدة متاحة للتنزيل.',
        placement: 'bottom',
        highlight_type: 'glow',
      },
      {
        id: 'upd-notes',
        target: 'release-notes',
        title_ar: 'ملاحظات الإصدار',
        body_ar: 'قائمة بالمميزات الجديدة والإصلاحات في كل إصدار.',
        placement: 'top',
      },
    ],
  },
};

export default helpContent;
