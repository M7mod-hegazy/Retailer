const ones = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة", "عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
const tens = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
const hundreds = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

function convertGroup(num) {
  let str = "";
  const h = Math.floor(num / 100);
  const t = Math.floor((num % 100) / 10);
  const o = num % 10;

  if (h > 0) {
    str += hundreds[h];
  }

  if (t === 0 && o > 0) {
    if (str !== "") str += " و ";
    str += ones[o];
  } else if (t === 1) {
    if (str !== "") str += " و ";
    str += ones[10 + o];
  } else if (t > 1) {
    if (str !== "") str += " و ";
    if (o > 0) {
      str += ones[o] + " و " + tens[t];
    } else {
      str += tens[t];
    }
  }
  return str.trim();
}

export function tafqeet(amount, currency = "ر.س") {
  if (amount === 0) return "صفر";
  const num = Math.abs(amount);
  const parts = num.toFixed(2).split(".");
  const integerPart = parseInt(parts[0], 10);
  const fractionPart = parseInt(parts[1], 10);

  let words = "";

  const billions = Math.floor(integerPart / 1000000000);
  const millions = Math.floor((integerPart % 1000000000) / 1000000);
  const thousands = Math.floor((integerPart % 1000000) / 1000);
  const remaining = integerPart % 1000;

  if (billions > 0) {
    words += (billions === 1 ? "مليار" : billions === 2 ? "ملياران" : convertGroup(billions) + " مليارات") + " ";
  }
  if (millions > 0) {
    if (words !== "") words += "و ";
    words += (millions === 1 ? "مليون" : millions === 2 ? "مليونان" : convertGroup(millions) + " ملايين") + " ";
  }
  if (thousands > 0) {
    if (words !== "") words += "و ";
    words += (thousands === 1 ? "ألف" : thousands === 2 ? "ألفان" : convertGroup(thousands) + " آلاف") + " ";
  }
  if (remaining > 0) {
    if (words !== "") words += "و ";
    words += convertGroup(remaining) + " ";
  }

  let currencyName = "ريال سعودي";
  let fractionName = "هللة";
  
  const curLower = String(currency).toLowerCase().trim();
  if (curLower === "egp" || curLower === "ج.م") {
    currencyName = "جنيه مصري";
    fractionName = "قرش";
  } else if (curLower === "usd" || curLower === "$") {
    currencyName = "دولار أمريكي";
    fractionName = "سنت";
  } else if (curLower === "eur" || curLower === "€") {
    currencyName = "يورو";
    fractionName = "سنت";
  } else if (currency) {
    // If it's a generic currency symbol like ر.س, map to friendly text
    if (currency === "ر.س") {
      currencyName = "ريال سعودي";
      fractionName = "هللة";
    } else {
      currencyName = currency;
      fractionName = "جزء";
    }
  }

  let result = "فقط " + words.trim() + " " + currencyName;
  if (fractionPart > 0) {
    result += " و " + convertGroup(fractionPart) + " " + fractionName;
  }
  result += " لا غير";
  return result;
}
