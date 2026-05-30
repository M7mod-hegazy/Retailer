import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useHelpStore } from '../../stores/helpStore';
import helpContent from '../../help/helpContent';
import autoHelpContent from '../../help/autoHelpContent';

const SPOTLIGHT_PAD = 8;
const POPUP_W       = 320;
const POPUP_H_EST   = 240;
const GAP           = 12;
const EDGE_PAD      = 16;
const RETRY_DELAYS  = [200, 500, 1000]; // ms — for late-mounting async elements

function resolvePlacement(rect, preferred, isRTL) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let px = preferred;
  if (preferred === 'start') px = isRTL ? 'right' : 'left';
  if (preferred === 'end')   px = isRTL ? 'left'  : 'right';

  const space = {
    bottom: vh - rect.bottom - GAP,
    top:    rect.top - GAP,
    right:  vw - rect.right - GAP,
    left:   rect.left - GAP,
  };

  const fallbacks = {
    bottom: ['bottom', 'top', 'right', 'left'],
    top:    ['top', 'bottom', 'right', 'left'],
    right:  ['right', 'left', 'bottom', 'top'],
    left:   ['left', 'right', 'bottom', 'top'],
  };

  const minSpace = (dir) =>
    (dir === 'bottom' || dir === 'top') ? POPUP_H_EST + 20 : POPUP_W + 20;

  for (const candidate of (fallbacks[px] ?? fallbacks.bottom)) {
    if (space[candidate] >= minSpace(candidate)) return candidate;
  }
  return 'bottom';
}

function buildPopupStyle(rect, placement) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top  + rect.height / 2;

  const clampX = (x) => Math.max(EDGE_PAD, Math.min(x, vw - POPUP_W - EDGE_PAD));
  const clampY = (y) => Math.max(EDGE_PAD, Math.min(y, vh - POPUP_H_EST - EDGE_PAD));

  const base = { position: 'fixed', width: POPUP_W, zIndex: 9999 };

  switch (placement) {
    case 'bottom': return { ...base, top: rect.bottom + GAP, left: clampX(cx - POPUP_W / 2) };
    case 'top':    return { ...base, bottom: vh - rect.top + GAP, left: clampX(cx - POPUP_W / 2) };
    case 'right':  return { ...base, left: rect.right + GAP, top: clampY(cy - POPUP_H_EST / 2) };
    case 'left':   return { ...base, right: vw - rect.left + GAP, top: clampY(cy - POPUP_H_EST / 2) };
    default:       return { ...base, top: rect.bottom + GAP, left: clampX(cx - POPUP_W / 2) };
  }
}

function buildCenteredStyle() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return {
    position: 'fixed',
    width: POPUP_W,
    zIndex: 9999,
    top: vh / 2 - POPUP_H_EST / 2,
    left: vw / 2 - POPUP_W / 2,
  };
}

const ARROW_CSS = {
  bottom: 'before:absolute before:content-[\'\'] before:-top-[8px] before:left-1/2 before:-translate-x-1/2 before:border-[8px] before:border-transparent before:border-b-[color:var(--bg-elevated)]',
  top:    'before:absolute before:content-[\'\'] before:-bottom-[8px] before:left-1/2 before:-translate-x-1/2 before:border-[8px] before:border-transparent before:border-t-[color:var(--bg-elevated)]',
  right:  'before:absolute before:content-[\'\'] before:top-1/2 before:-translate-y-1/2 before:-left-[8px] before:border-[8px] before:border-transparent before:border-r-[color:var(--bg-elevated)]',
  left:   'before:absolute before:content-[\'\'] before:top-1/2 before:-translate-y-1/2 before:-right-[8px] before:border-[8px] before:border-transparent before:border-l-[color:var(--bg-elevated)]',
};

const AUTO_CONTROL_SELECTOR = [
  'button',
  'a[href]',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  '[role="button"]',
  '[role="tab"]',
  '[role="switch"]',
  '[role="checkbox"]',
].join(',');

;

function getHelpRoot() {
  return document.querySelector('[data-help-root]') ?? document.querySelector('main') ?? document.body;
}

function getStepElement(step) {
  if (!step) return null;
  if (step.selector) return document.querySelector(step.selector);
  if (step.target) return document.querySelector(`[data-help="${step.target}"]`);
  return null;
}

function isElementVisible(el) {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width < 4 || rect.height < 4) return false;
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}

function isStepVisible(step) {
  if (!step?.target && !step?.selector) return true;
  return isElementVisible(getStepElement(step));
}

function cleanLabel(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s#./:%+-]/gu, '')
    .trim()
    .slice(0, 80);
}

function normalizeHelpKey(value) {
  return cleanLabel(value)
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function lookupSpecificHelp(pageKey, section, key) {
  const normalizedKey = normalizeHelpKey(key);
  const pageEntries = autoHelpContent[pageKey]?.[section] || {};
  const globalEntries = autoHelpContent.global?.[section] || {};
  return pageEntries[normalizedKey] || globalEntries[normalizedKey] || null;
}

function specificAutoStepCopy(pageKey, label) {
  return lookupSpecificHelp(pageKey, 'controls', label);
}

function specificTargetStep(pageKey, target) {
  return lookupSpecificHelp(pageKey, 'targets', target);
}

function getPageTitle(pageKey) {
  return helpContent[pageKey]?.title_ar || 'الصفحة الحالية';
}

function targetStepCopy(pageKey, target) {
  const specific = specificTargetStep(pageKey, target);
  if (specific) return specific;

  const pageTitle = getPageTitle(pageKey);
  const targetText = cleanLabel(String(target).replace(/[-_]/g, ' '));
  const commonTargets = {
    'search-bar': {
      title_ar: `بحث ${pageTitle}`,
      body_ar: `استخدم البحث هنا لتضييق بيانات ${pageTitle} والوصول للسطر المطلوب بسرعة بدل مراجعة كل النتائج يدويًا.`,
    },
    'main-table': {
      title_ar: `جدول ${pageTitle}`,
      body_ar: `ده المكان الأساسي لمراجعة سجلات ${pageTitle}. راجع الأعمدة، الحالة، والمبالغ قبل فتح السطر أو تنفيذ أي تعديل.`,
    },
    'add-button': {
      title_ar: `إضافة داخل ${pageTitle}`,
      body_ar: `يفتح إنشاء سجل جديد مرتبط بصفحة ${pageTitle}. راجع الحقول المطلوبة قبل الحفظ عشان البيانات تدخل في المكان الصح.`,
    },
    'stats-cards': {
      title_ar: `ملخص ${pageTitle}`,
      body_ar: `الكروت دي بتديك قراءة سريعة لأهم أرقام ${pageTitle}. لو رقم مش منطقي افتح الجدول أو التفاصيل اللي تحته.`,
    },
    'period-filter': {
      title_ar: `فترة ${pageTitle}`,
      body_ar: `غيّر الفترة من هنا عشان الأرقام والجداول في ${pageTitle} تتحسب على الأيام اللي محتاج تراجعها.`,
    },
    'payment-section': {
      title_ar: 'الدفع والتحصيل',
      body_ar: 'هنا بتحدد طريقة الدفع أو التحصيل والمبلغ. الجزء ده بيأثر على الخزنة والحسابات، فراجعه قبل التأكيد.',
    },
    'pagination': {
      title_ar: 'تقليب الصفحات',
      body_ar: `استخدم السابق والتالي لما نتائج ${pageTitle} تكون أكتر من صفحة. البحث أسرع لو أنت عارف رقم أو اسم معين.`,
    },
    'filter-btn': {
      title_ar: `فلاتر ${pageTitle}`,
      body_ar: `الفلاتر بتخليك تعرض نوع معين من بيانات ${pageTitle} بدل كل السجلات مرة واحدة.`,
    },
    'category-filter': {
      title_ar: 'فلتر القسم',
      body_ar: 'اختار قسم محدد عشان تعرض الأصناف أو السجلات التابعة له فقط.',
    },
    'save-button': {
      title_ar: 'حفظ التغييرات',
      body_ar: `بعد تعديل بيانات ${pageTitle} استخدم الحفظ عشان التغييرات تتسجل فعليًا.`,
    },
    'print-section': {
      title_ar: 'إعدادات الطباعة',
      body_ar: 'الجزء ده بيحدد شكل الورق والبيانات اللي تظهر في الفواتير أو التقارير المطبوعة.',
    },
    'settings-tabs': {
      title_ar: 'أقسام الإعدادات',
      body_ar: 'بدّل من هنا بين إعدادات الشركة والطباعة وباقي أقسام الضبط من غير ما تخرج من صفحة الإعدادات.',
    },
  };

  return commonTargets[target] || {
    title_ar: targetText || pageTitle,
    body_ar: `الجزء ده من صفحة ${pageTitle}. راجعه لأنه مرتبط بالبيانات الظاهرة في مكانه، ولو فيه زر أو اختيار جواه استخدمه حسب عنوانه الظاهر.`,
  };
}

function controlStepCopy(pageKey, kind, label) {
  const specific = specificAutoStepCopy(pageKey, label);
  if (specific) return specific;

  const pageTitle = getPageTitle(pageKey);
  const text = String(label || '').trim();

  if (kind === 'field') {
    if (/بحث|search/i.test(text)) {
      return {
        title_ar: text || `بحث ${pageTitle}`,
        body_ar: `اكتب هنا كلمة البحث الخاصة بصفحة ${pageTitle}: اسم، رقم، كود، أو وصف حسب الجدول الحالي.`,
      };
    }
    return {
      title_ar: text || `حقل في ${pageTitle}`,
      body_ar: `الحقل ده بيأثر على بيانات ${pageTitle}. اكتب القيمة المطلوبة بوضوح وراجعها قبل الحفظ أو التطبيق.`,
    };
  }

  if (kind === 'tab') {
    return {
      title_ar: text || `تبويب ${pageTitle}`,
      body_ar: `التبويب ده يغير الجزء المعروض داخل ${pageTitle} عشان تراجع نوع بيانات مختلف من نفس الشاشة.`,
    };
  }

  if (/بحث متقدم في المخزون/i.test(text)) {
    return {
      title_ar: 'بحث متقدم في المخزون',
      body_ar: 'يفتح نافذة بحث أوسع عن الأصناف داخل المخزون. استخدمه لما البحث السريع مش كفاية: تقدر تدور بالصنف وتشوف المتاح قبل إضافة السطر للفاتورة أو الحركة.',
    };
  }
  if (/بحث متقدم|البحث التفصيلي بالأصناف/i.test(text)) {
    return {
      title_ar: text,
      body_ar: 'يفتح نافذة بحث تفصيلي بدل البحث السريع. مفيد لما تحتاج توصل لمستند أو صنف من بيانات أكتر زي رقم المستند، اسم الصنف، العميل، المورد، أو الفترة.',
    };
  }
  if (/بحث برقم المستند/i.test(text)) {
    return {
      title_ar: 'بحث برقم المستند',
      body_ar: 'يصفّي القائمة على مستند محدد برقم الفاتورة أو المرتجع أو أمر الشراء. استخدمه لما معاك رقم المستند وعايز تفتحه بسرعة.',
    };
  }
  if (/بحث صنف/i.test(text)) {
    return {
      title_ar: 'بحث داخل الأصناف',
      body_ar: 'يبحث داخل بنود المستندات عن صنف معين. استخدمه لما عايز تعرف الصنف ظهر في أي فاتورة أو مرتجع أو حركة.',
    };
  }
  if (/معاينة سريعة|معاينة الفاتورة|معاينة المرتجع|معاينة أمر الشراء|معاينة صورة الصنف/i.test(text)) {
    return {
      title_ar: text,
      body_ar: 'يفتح معاينة للبيانات من غير تعديل مباشر. استخدمه للمراجعة السريعة قبل ما تفتح المستند للتعديل أو تعمل طباعة أو تأكيد.',
    };
  }
  if (/فتح الفاتورة|فتح المستند وتعديله/i.test(text)) {
    return {
      title_ar: text,
      body_ar: 'يفتح المستند المحفوظ في شاشة التحرير أو التفاصيل. استخدمه لما تحتاج تراجع البنود، المدفوعات، أو تعدل بيانات المستند حسب الصلاحيات.',
    };
  }
  if (/إنشاء مرتجع/i.test(text)) {
    return {
      title_ar: 'إنشاء مرتجع',
      body_ar: 'يبدأ مرتجع من الفاتورة أو المستند المحدد. بعد الضغط هتختار الكميات الراجعة، وبعد الحفظ المخزون والحسابات يتعدلوا.',
    };
  }
  if (/تأكيد التحديث/i.test(text)) {
    return {
      title_ar: 'تأكيد التحديث',
      body_ar: 'يطبّق التحديثات اللي اتراجعت في شاشة التحديث الذكي. بعد الضغط هتتغير بيانات الأصناف المطابقة للملف، فراجع المعاينة قبلها.',
    };
  }
  if (/تأكيد وحفظ|نعم، احفظ|نعم، حفظ المرتجع|حفظ المرتجع|حفظ التعديلات/i.test(text)) {
    return {
      title_ar: text,
      body_ar: 'يحفظ المستند أو التعديلات الحالية نهائيًا. بعد الحفظ بتتحدث الأرصدة والحسابات والمخزون حسب نوع العملية.',
    };
  }
  if (/حفظ الحالية وإنشاء جديدة/i.test(text)) {
    return {
      title_ar: 'حفظ الحالية وإنشاء جديدة',
      body_ar: 'يحفظ الفاتورة أو المستند المفتوح حاليًا، وبعد نجاح الحفظ يفتح نموذج جديد فارغ عشان تبدأ عملية تانية بسرعة.',
    };
  }
  if (/حفظ ثم تغيير/i.test(text)) {
    return {
      title_ar: 'حفظ ثم تغيير',
      body_ar: 'يحفظ البيانات الحالية الأول، وبعدها يسمح بتغيير المستند أو أمر الشراء المرتبط من غير فقد الشغل اللي اتكتب.',
    };
  }
  if (/نعم، إلغاء/i.test(text)) {
    return {
      title_ar: 'تأكيد الإلغاء',
      body_ar: 'يلغي العملية الحالية بعد رسالة التأكيد. أي بيانات غير محفوظة في النموذج الحالي ممكن تضيع.',
    };
  }
  if (/نعم، تعديل/i.test(text)) {
    return {
      title_ar: 'فتح التعديل',
      body_ar: 'يفتح المستند المحفوظ للتعديل. استخدمه فقط لما تكون محتاج تغير بيانات عملية مسجلة قبل كده.',
    };
  }
  if (/رجوع/i.test(text)) {
    return {
      title_ar: 'رجوع',
      body_ar: 'يرجعك للشاشة السابقة أو يقفل نافذة الاختيار الحالية من غير تسجيل اختيار جديد.',
    };
  }
  if (/إلغاء/i.test(text)) {
    return {
      title_ar: text,
      body_ar: 'يقفل النافذة أو يلغي خطوة التأكيد الحالية. لو فيه بيانات غير محفوظة، راجع هل الشاشة هتحتفظ بها قبل الخروج.',
    };
  }
  if (/اختيار|اختر/i.test(text)) {
    return {
      title_ar: text,
      body_ar: 'يحدد السجل أو المستند المعروض ويستخدمه في الشاشة الحالية. بعد الاختيار غالبًا هترجع للنموذج الأصلي بالبيانات المرتبطة.',
    };
  }
  if (/تحديد الكمية المتاحة كاملة/i.test(text)) {
    return {
      title_ar: 'تحديد الكمية المتاحة كاملة',
      body_ar: 'يملأ كمية السطر بأقصى كمية متاحة في المخزن الحالي. مفيد في التحويل أو التسوية لما عايز تنقل كل المتاح.',
    };
  }
  if (/اعتماد التسوية/i.test(text)) {
    return {
      title_ar: 'اعتماد التسوية',
      body_ar: 'يسجل فرق المخزون كحركة تسوية. بعد الاعتماد الكمية المسجلة للصنف هتتغير حسب الرقم اللي أدخلته.',
    };
  }
  if (/تأكيد النقل/i.test(text)) {
    return {
      title_ar: 'تأكيد النقل',
      body_ar: 'يثبت حركة نقل المخزون بين المخازن. بعد التأكيد الكمية تقل من المخزن المصدر وتزيد في المخزن المستلم.',
    };
  }
  if (/وسائل دفع|أضف وسائل دفع/i.test(text)) {
    return {
      title_ar: 'وسائل الدفع',
      body_ar: 'يفتح إعداد وسائل الدفع عشان تضيف نقدي أو فيزا أو تحويل قبل تسجيل المدفوعات داخل الفواتير.',
    };
  }
  if (/طباعة|PDF|Print/i.test(text)) {
    return {
      title_ar: text || 'طباعة',
      body_ar: `يطبع البيانات المعروضة حاليًا في ${pageTitle}. راجع البحث والفلاتر الأول لأن الطباعة بتطلع حسب المعروض.`,
    };
  }
  if (/Excel|تصدير|تحميل|Export|Download/i.test(text)) {
    return {
      title_ar: text || 'تصدير',
      body_ar: `يصدر بيانات ${pageTitle} للملف المطلوب. التصدير يعتمد على النتائج والفترة الظاهرة حاليًا.`,
    };
  }
  if (/السابق|التالي|Previous|Next/i.test(text)) {
    return {
      title_ar: text,
      body_ar: `ينقلك بين صفحات نتائج ${pageTitle}. استخدمه لما الجدول فيه سجلات أكتر من الصفحة الحالية.`,
    };
  }
  if (/ترتيب|Sort/i.test(text)) {
    return {
      title_ar: text,
      body_ar: `يغير ترتيب عرض بيانات ${pageTitle} حسب الاختيار المتاح، زي الأحدث أو الاسم أو الحالة.`,
    };
  }
  if (/عرض\s*\d+|\b\d+\b/.test(text)) {
    return {
      title_ar: text,
      body_ar: `يحدد عدد السجلات الظاهرة في الصفحة الواحدة داخل ${pageTitle}. زوده لو محتاج تراجع بيانات أكتر مرة واحدة.`,
    };
  }
  if (/حفظ|Save/i.test(text)) {
    return {
      title_ar: text || 'حفظ',
      body_ar: `يسجل تعديلات ${pageTitle}. قبل الحفظ راجع القيم لأن بعدها البيانات هتتطبق على النظام.`,
    };
  }
  if (/تعديل|Edit/i.test(text)) {
    return {
      title_ar: text || 'تعديل',
      body_ar: `يفتح تعديل السجل المحدد في ${pageTitle}. استخدمه لما تكون متأكد إن السطر ده هو المطلوب.`,
    };
  }
  if (/حذف|مسح|Delete/i.test(text)) {
    return {
      title_ar: text || 'حذف',
      body_ar: `يحذف أو يلغي سجل من ${pageTitle}. راجع السطر كويس لأن الحذف ممكن يأثر على التقارير أو الحسابات.`,
    };
  }
  if (/عرض|تفاصيل|View|Details/i.test(text)) {
    return {
      title_ar: text || 'عرض التفاصيل',
      body_ar: `يفتح تفاصيل السجل المحدد في ${pageTitle} من غير ما تبدأ إدخال جديد.`,
    };
  }
  if (/إضافة|جديد|New|Add/i.test(text)) {
    return {
      title_ar: text || `إضافة ${pageTitle}`,
      body_ar: `يبدأ إنشاء سجل جديد في ${pageTitle}. كمل البيانات الأساسية ثم احفظ بعد المراجعة.`,
    };
  }
  if (/تأكيد|اعتماد|تطبيق|Confirm|Apply/i.test(text)) {
    return {
      title_ar: text || 'تأكيد',
      body_ar: `ينفذ التغيير في ${pageTitle}. راجع الأرقام والاختيارات الظاهرة قبل التأكيد.`,
    };
  }
  if (/تحويل|Convert|Transfer/i.test(text)) {
    return {
      title_ar: text || 'تحويل',
      body_ar: `يحوّل السجل أو الكمية في ${pageTitle} للخطوة التالية. راجع المصدر والوجهة أو المستند قبل التنفيذ.`,
    };
  }
  if (/دفع|سداد|تحصيل|Pay|Collect/i.test(text)) {
    return {
      title_ar: text || 'دفع أو تحصيل',
      body_ar: `يسجل حركة فلوس مرتبطة بصفحة ${pageTitle}. اختار الطرف وطريقة الدفع والمبلغ بدقة قبل الحفظ.`,
    };
  }
  if (/إغلاق|خروج|Close|Cancel|×|X/i.test(text)) {
    return {
      title_ar: text || 'إغلاق',
      body_ar: `يقفل النافذة أو يرجعك من غير ما تكمل الإجراء الحالي في ${pageTitle}.`,
    };
  }

  return {
    title_ar: text || `إجراء في ${pageTitle}`,
    body_ar: `ينفذ إجراء "${text || 'بدون اسم'}" في ${pageTitle}. لو فتح نافذة، راجع البيانات اللي فيها؛ ولو طلب تأكيد، متأكدش غير بعد مراجعة الأرقام والاختيارات.`,
  };
}

function getElementLabel(el) {
  const directLabel = cleanLabel(
    el.getAttribute('aria-label') ||
    el.getAttribute('title') ||
    el.getAttribute('placeholder') ||
    el.getAttribute('data-help-label')
  );
  if (directLabel) return directLabel;

  if (el.id) {
    const label = document.querySelector(`label[for="${el.id}"]`);
    const labelText = cleanLabel(label?.innerText || label?.textContent);
    if (labelText) return labelText;
  }

  const nestedLabel = cleanLabel(el.closest('label')?.innerText);
  if (nestedLabel) return nestedLabel;

  const text = cleanLabel(el.innerText || el.textContent || el.value);
  return text;
}

function classifyElement(el) {
  const tag = el.tagName.toLowerCase();
  const role = el.getAttribute('role');
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return 'field';
  if (role === 'tab') return 'tab';
  if (role === 'switch' || role === 'checkbox') return 'toggle';
  if (tag === 'a') return 'link';
  return 'button';
}

function collectHelpSteps(pageKey) {
  const pageConfig = helpContent[pageKey];
  const explicitSteps = pageConfig?.steps ?? [];
  if (typeof document === 'undefined') return explicitSteps;

  const root = getHelpRoot();
  const explicitTargets = new Set(explicitSteps.map((step) => step.target).filter(Boolean));
  const explicitElements = new Set(explicitSteps.map(getStepElement).filter(Boolean));
  const autoSteps = [];
  const seenAutoLabels = new Set();

  root.querySelectorAll('[data-help]').forEach((el) => {
    const target = el.getAttribute('data-help');
    if (!target || explicitTargets.has(target) || !isElementVisible(el)) return;
    const copy = targetStepCopy(pageKey, target);
    autoSteps.push({
      id: `auto-target-${pageKey}-${target}`,
      target,
      placement: 'bottom',
      auto: true,
      ...copy,
    });
  });

  root.querySelectorAll(AUTO_CONTROL_SELECTOR).forEach((el, index) => {
    if (!isElementVisible(el)) return;
    if (explicitElements.has(el)) return;
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') return;

    const label = getElementLabel(el);
    if (!label || label.length < 2) return;

    const kind = classifyElement(el);
    const copy = controlStepCopy(pageKey, kind, label);

    const dedupeKey = `${kind}:${label}`;
    if (seenAutoLabels.has(dedupeKey)) return;
    seenAutoLabels.add(dedupeKey);

    const autoId = `${pageKey}-${kind}-${index}`;
    el.setAttribute('data-help-auto', autoId);
    autoSteps.push({
      id: `auto-control-${autoId}`,
      selector: `[data-help-auto="${autoId}"]`,
      placement: kind === 'field' ? 'bottom' : 'top',
      auto: true,
      ...copy,
    });
  });

  return [...explicitSteps, ...autoSteps];
}

// ─── Topic Picker ─────────────────────────────────────────────────────────────
function TopicPicker({ pageKey, onSelect, onClose }) {
  const pageConfig = helpContent[pageKey];
  const steps = useMemo(() => (pageConfig ? collectHelpSteps(pageKey) : []), [pageKey, pageConfig]);
  if (!pageConfig) return null;
  const visibleSteps = steps
    .map((step, index) => ({ step, index }))
    .filter(({ step }) => isStepVisible(step));

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9990]"
        style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />

      {/* Picker card */}
      <div
        dir="rtl"
        className="fixed z-[9999] rounded-2xl overflow-hidden"
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%,-50%)',
          width: 360,
          maxHeight: '80vh',
          background: 'var(--bg-elevated)',
          boxShadow: 'var(--shadow-modal)',
          animation: 'modalEnter 250ms cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--border-normal)' }}
        >
          <div>
            <p className="text-xs font-black" style={{ color: 'var(--text-muted)' }}>
              محتاج مساعدة في إيه؟
            </p>
            <h3 className="text-sm font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>
              {pageConfig.title_ar}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-bg)'; e.currentTarget.style.color = 'var(--danger-text)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            ✕
          </button>
        </div>

        {/* Step list */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(80vh - 130px)' }}>
          {visibleSteps.map(({ step, index }, i) => (
            <button
              key={step.id}
              onClick={() => onSelect(index)}
              className="w-full flex items-center gap-3 px-5 py-3.5 text-right transition-all border-b"
              style={{ borderColor: 'var(--border-subtle)', background: 'transparent' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-overlay)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span
                className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black"
                style={{ background: 'var(--primary)', color: '#fff' }}
              >
                {i + 1}
              </span>
              <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                {step.title_ar}
              </span>
            </button>
          ))}
          {visibleSteps.length === 0 && (
            <div className="px-5 py-8 text-center text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
              مفيش أجزاء ظاهرة للشرح في الشاشة دي دلوقتي
            </div>
          )}
        </div>

        {/* Full tour button */}
        <div className="p-4" style={{ borderTop: '1px solid var(--border-normal)' }}>
          <button
            onClick={() => onSelect(visibleSteps[0]?.index ?? 0)}
            disabled={visibleSteps.length === 0}
            className="w-full h-10 rounded-xl text-xs font-black text-white transition-all"
            style={{
              background: 'linear-gradient(135deg, var(--primary), var(--primary-600))',
              boxShadow: 'var(--shadow-glow)',
              opacity: visibleSteps.length === 0 ? 0.5 : 1,
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; }}
          >
            ابدأ الشرح من الأول
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Main PageTour ─────────────────────────────────────────────────────────────
export function PageTour() {
  const isRTL = document.documentElement.dir === 'rtl';

  const {
    isTourVisible,
    isPickerVisible,
    activeTourPageKey,
    activeTourStepIndex,
    completeTour,
    disableAllTours,
    startTourAtStep,
    closePicker,
  } = useHelpStore();

  const [popupStyle,     setPopupStyle]     = useState({});
  const [spotlightStyle, setSpotlightStyle] = useState(null);
  const [resolvedDir,    setResolvedDir]    = useState('bottom');
  const [isCentered,     setIsCentered]     = useState(false);
  const popupRef    = useRef(null);
  const retryRef    = useRef([]);

  const pageConfig  = helpContent[activeTourPageKey];
  const steps       = useMemo(
    () => (activeTourPageKey ? collectHelpSteps(activeTourPageKey) : []),
    [activeTourPageKey, isTourVisible, isPickerVisible],
  );
  const currentStep = steps[activeTourStepIndex];
  const visibleStepIndexes = steps
    .map((step, index) => ({ step, index }))
    .filter(({ step }) => isStepVisible(step))
    .map(({ index }) => index);
  const currentVisiblePosition = visibleStepIndexes.indexOf(activeTourStepIndex);
  const isLast = currentVisiblePosition >= visibleStepIndexes.length - 1;
  const highlightType = currentStep?.highlight_type ?? 'spotlight';
  const visibleStepNumber = Math.max(1, visibleStepIndexes.indexOf(activeTourStepIndex) + 1);
  const visibleStepCount = visibleStepIndexes.length || steps.length;

  const goNextStep = useCallback(() => {
    const position = visibleStepIndexes.indexOf(activeTourStepIndex);
    const nextIndex = visibleStepIndexes[position + 1] ?? visibleStepIndexes[0];
    if (position >= 0 && position < visibleStepIndexes.length - 1 && typeof nextIndex === 'number') {
      useHelpStore.setState({ activeTourStepIndex: nextIndex });
    } else {
      completeTour();
    }
  }, [activeTourStepIndex, completeTour, visibleStepIndexes]);

  const goPrevStep = useCallback(() => {
    const position = visibleStepIndexes.indexOf(activeTourStepIndex);
    const prevIndex = visibleStepIndexes[Math.max(0, position - 1)];
    if (typeof prevIndex === 'number') {
      useHelpStore.setState({ activeTourStepIndex: prevIndex });
    }
  }, [activeTourStepIndex, visibleStepIndexes]);

  const applyRect = useCallback((el, step) => {
    const rect = el.getBoundingClientRect();
    setIsCentered(false);
    setSpotlightStyle({
      top:    rect.top    - SPOTLIGHT_PAD,
      left:   rect.left   - SPOTLIGHT_PAD,
      width:  rect.width  + SPOTLIGHT_PAD * 2,
      height: rect.height + SPOTLIGHT_PAD * 2,
    });
    const dir = resolvePlacement(rect, step.placement ?? 'bottom', isRTL);
    setResolvedDir(dir);
    setPopupStyle(buildPopupStyle(rect, dir));
  }, [isRTL]);

  // Fallback: anchor popup to page root so it's never floating dead-center
  const applyPageFallback = useCallback(() => {
    if (import.meta.env.DEV && currentStep?.target) {
      console.warn(`[PageTour] missing data-help="${currentStep.target}" on page "${activeTourPageKey}"`);
    }
    const root = document.querySelector('[data-help-root]') ?? document.querySelector('main') ?? document.body;
    const rect = root.getBoundingClientRect();
    // Spotlight covers the top portion of the page content area
    setIsCentered(false);
    setSpotlightStyle({
      top:    rect.top    - SPOTLIGHT_PAD,
      left:   rect.left   - SPOTLIGHT_PAD,
      width:  rect.width  + SPOTLIGHT_PAD * 2,
      height: Math.min(rect.height, 120) + SPOTLIGHT_PAD * 2,
    });
    setResolvedDir('bottom');
    setPopupStyle(buildPopupStyle({
      top: rect.top, bottom: rect.top + Math.min(rect.height, 120),
      left: rect.left, right: rect.right, width: rect.width, height: Math.min(rect.height, 120),
    }, 'bottom'));
  }, [currentStep, activeTourPageKey]);

  const findNextVisibleStepIndex = useCallback((fromIndex) => {
    if (!steps.length) return -1;
    for (let offset = 1; offset < steps.length; offset += 1) {
      const index = (fromIndex + offset) % steps.length;
      const step = steps[index];
      if (isStepVisible(step)) return index;
    }
    return -1;
  }, [steps]);

  const tryFind = useCallback((step, retriesLeft) => {
    if (!step?.target && !step?.selector) {
      applyPageFallback();
      return;
    }
    const el = getStepElement(step);
    if (!el) {
      if (retriesLeft > 0) {
        const delay = RETRY_DELAYS[RETRY_DELAYS.length - retriesLeft];
        const t = setTimeout(() => tryFind(step, retriesLeft - 1), delay);
        retryRef.current.push(t);
      } else {
        const nextIndex = findNextVisibleStepIndex(activeTourStepIndex);
        if (nextIndex >= 0) {
          useHelpStore.setState({ activeTourStepIndex: nextIndex });
          return;
        }
        applyPageFallback();
      }
      return;
    }
    const rect = el.getBoundingClientRect();
    const inView = rect.top >= 0 && rect.bottom <= window.innerHeight;
    if (!inView) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      const t = setTimeout(() => applyRect(el, step), 350);
      retryRef.current.push(t);
    } else {
      applyRect(el, step);
    }
  }, [activeTourStepIndex, applyRect, applyPageFallback, findNextVisibleStepIndex]);

  const recalculate = useCallback(() => {
    if (!isTourVisible || !currentStep) return;
    // Cancel pending retries
    retryRef.current.forEach(clearTimeout);
    retryRef.current = [];
    tryFind(currentStep, RETRY_DELAYS.length);
  }, [isTourVisible, currentStep, tryFind]);

  useEffect(() => {
    recalculate();
    window.addEventListener('resize', recalculate);
    window.addEventListener('scroll', recalculate, true);
    return () => {
      window.removeEventListener('resize', recalculate);
      window.removeEventListener('scroll', recalculate, true);
      retryRef.current.forEach(clearTimeout);
      retryRef.current = [];
    };
  }, [recalculate]);

  // Show picker
  if (isPickerVisible && activeTourPageKey) {
    return (
      <TopicPicker
        pageKey={activeTourPageKey}
        onSelect={(stepIndex) => startTourAtStep(stepIndex)}
        onClose={closePicker}
      />
    );
  }

  if (!isTourVisible || !pageConfig || !currentStep) return null;

  const spotlightBoxShadow =
    highlightType === 'glow'
      ? '0 0 0 9999px rgba(0,0,0,0.6), 0 0 0 3px var(--primary), 0 0 24px var(--primary)'
      : '0 0 0 9999px rgba(0,0,0,0.6)';

  const spotlightBorder =
    highlightType === 'glow' ? '2px solid var(--primary)' : '2px solid rgba(255,255,255,0.6)';

  return (
    <>
      {/* Full-screen dim */}
      <div
        className="fixed inset-0 z-[9990]"
        style={{ background: isCentered ? 'rgba(0,0,0,0.5)' : 'transparent' }}
        onClick={completeTour}
      />

      {/* Spotlight cutout (only when target found) */}
      {spotlightStyle && (
        <div
          className="fixed z-[9991] rounded-lg pointer-events-none transition-all duration-300 ease-out"
          style={{
            ...spotlightStyle,
            boxShadow: spotlightBoxShadow,
            border: spotlightBorder,
          }}
        />
      )}

      {/* Tour popup card */}
      <div
        ref={popupRef}
        dir="rtl"
        className={`
          relative z-[9999] rounded-2xl p-5 text-text-primary
          border border-border-normal
          ${!isCentered ? (ARROW_CSS[resolvedDir] ?? '') : ''}
        `}
        style={{
          ...popupStyle,
          background: 'var(--bg-elevated)',
          boxShadow: 'var(--shadow-modal)',
          animation: 'modalEnter 250ms cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        {/* Step counter + topic picker trigger + close */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => {
              // Go back to picker to switch topic
              useHelpStore.setState({ isTourVisible: false, isPickerVisible: true, activeTourStepIndex: 0 });
            }}
            className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg transition-all"
            style={{ color: 'var(--text-muted)', background: 'var(--bg-overlay)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
            title="غير الموضوع"
          >
            <span>{visibleStepNumber} / {visibleStepCount}</span>
            <span style={{ fontSize: 9 }}>▾</span>
          </button>
          <button
            onClick={completeTour}
            className="w-6 h-6 rounded-full flex items-center justify-center text-sm transition-all duration-150"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-bg)'; e.currentTarget.style.color = 'var(--danger-text)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            ✕
          </button>
        </div>

        {/* Step dots */}
        <div className="flex justify-center gap-1.5 mb-3">
          {steps.map((step, i) => {
            if (!isStepVisible(step)) return null;
            return (
              <button
                key={i}
                onClick={() => useHelpStore.setState({ activeTourStepIndex: i })}
                className="h-1.5 rounded-full transition-all duration-200 cursor-pointer"
                style={{
                  width: i === activeTourStepIndex ? '16px' : '6px',
                  background: i === activeTourStepIndex ? 'var(--primary)' : 'var(--border-strong)',
                }}
              />
            );
          })}
        </div>

        {/* Content */}
        <h3 className="font-bold text-sm mb-2" style={{ color: 'var(--text-primary)' }}>
          {currentStep.title_ar}
        </h3>
        <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
          {currentStep.body_ar}
        </p>

        {Array.isArray(currentStep.demo_ar) && currentStep.demo_ar.length > 0 && (
          <div
            className="mb-4 rounded-xl border p-3"
            style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-overlay)' }}
          >
            <p className="mb-2 text-[10px] font-black" style={{ color: 'var(--text-muted)' }}>
              مثال سريع
            </p>
            <ol className="space-y-1.5">
              {currentStep.demo_ar.map((line, index) => (
                <li key={index} className="flex gap-2 text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  <span className="font-black" style={{ color: 'var(--primary)' }}>{index + 1}</span>
                  <span>{line}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={disableAllTours}
            className="text-xs underline transition-colors duration-150"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger-text)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            ما تظهرش تاني
          </button>

          <div className="flex gap-2">
            {currentVisiblePosition > 0 && (
              <button
                onClick={goPrevStep}
                className="px-3 py-1.5 text-xs rounded-lg border transition-all duration-150"
                style={{
                  border: '1px solid var(--border-normal)',
                  color: 'var(--text-secondary)',
                  background: 'transparent',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-overlay)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                السابق
              </button>
            )}
            <button
              onClick={goNextStep}
              className="px-4 py-1.5 text-xs rounded-lg font-medium transition-all duration-150"
              style={{
                background: 'linear-gradient(135deg, var(--primary), var(--primary-600))',
                color: '#fff',
                boxShadow: 'var(--shadow-glow)',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; }}
            >
              {isLast ? 'خلصت ✓' : 'التالي'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
