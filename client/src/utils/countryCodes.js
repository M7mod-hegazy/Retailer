/**
 * Country dial-code list.
 * Each entry:
 *   code:           ISO 3166-1 alpha-2
 *   dial:           country dial code string without + (e.g. "20")
 *   flag:           emoji flag
 *   name:           Arabic country name
 *   localLen:       expected local number length WITHOUT leading zero
 *                   (e.g. Egypt: 10 means 1012345678 is 10 digits after stripping 0)
 *   hasLeadingZero: true if the country conventionally writes local numbers with a 0 prefix
 *                   (e.g. Egypt 010..., UK 07..., Turkey 05...)
 */

/**
 * Convert a raw E.164 (or any stored phone) to the local display string.
 * For countries with hasLeadingZero, prepends 0 to the local portion.
 *
 * Examples:
 *   rawE164ToLocal("201032440775", EG_country) → "01032440775"
 *   rawE164ToLocal("966501234567", SA_country) → "501234567"
 */
export function rawE164ToLocal(fullPhone, country) {
  if (!fullPhone) return "";
  const d = String(fullPhone).replace(/\D/g, "");
  let local = d;
  if (d.startsWith(country.dial)) {
    local = d.slice(country.dial.length);
  }
  // Prepend 0 for countries that use leading-zero local format
  if (country.hasLeadingZero && local && !local.startsWith("0")) {
    local = "0" + local;
  }
  return local;
}

/**
 * @deprecated use rawE164ToLocal instead
 */
export function toLocalDisplay(fullPhone, dialCode) {
  if (!fullPhone) return "";
  const d = String(fullPhone).replace(/\D/g, "");
  if (d.startsWith(dialCode)) return d.slice(dialCode.length);
  return d;
}

/**
 * Convert local input typed by the user to E.164 (digits only, no + prefix).
 * Smart — accepts both leading-zero and non-leading-zero local format:
 *   EG: "01032440775" OR "1032440775" → "201032440775"
 *   SA: "501234567"                   → "966501234567"
 * Also handles pastes of full international numbers.
 */
export function localPhoneToE164(localInput, country) {
  if (!localInput) return "";
  let d = String(localInput).trim();

  // Strip international prefixes if user pasted a full number
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("00")) d = d.slice(2);

  // Strip all non-digits
  d = d.replace(/\D/g, "");

  if (!d) return "";

  // Already full international (starts with dial code and has correct total length)
  const fullLen = country.dial.length + country.localLen;
  if (d.startsWith(country.dial) && d.length >= fullLen) return d;

  // Strip leading zero (e.g. Egypt 010... → 10...)
  if (d.startsWith("0") && d.length === country.localLen + 1) {
    d = d.slice(1);
  }

  // Prepend dial code
  return country.dial + d;
}

export const COUNTRIES = [
  { code: "EG", dial: "20",   flag: "🇪🇬", name: "مصر",             localLen: 10, hasLeadingZero: true  },
  { code: "SA", dial: "966",  flag: "🇸🇦", name: "السعودية",         localLen: 9                        },
  { code: "AE", dial: "971",  flag: "🇦🇪", name: "الإمارات",         localLen: 9                        },
  { code: "KW", dial: "965",  flag: "🇰🇼", name: "الكويت",           localLen: 8                        },
  { code: "QA", dial: "974",  flag: "🇶🇦", name: "قطر",              localLen: 8                        },
  { code: "BH", dial: "973",  flag: "🇧🇭", name: "البحرين",          localLen: 8                        },
  { code: "OM", dial: "968",  flag: "🇴🇲", name: "عُمان",            localLen: 8                        },
  { code: "JO", dial: "962",  flag: "🇯🇴", name: "الأردن",           localLen: 9,  hasLeadingZero: true  },
  { code: "LB", dial: "961",  flag: "🇱🇧", name: "لبنان",            localLen: 8                        },
  { code: "SY", dial: "963",  flag: "🇸🇾", name: "سوريا",            localLen: 9,  hasLeadingZero: true  },
  { code: "IQ", dial: "964",  flag: "🇮🇶", name: "العراق",           localLen: 10, hasLeadingZero: true  },
  { code: "YE", dial: "967",  flag: "🇾🇪", name: "اليمن",            localLen: 9,  hasLeadingZero: true  },
  { code: "LY", dial: "218",  flag: "🇱🇾", name: "ليبيا",            localLen: 10, hasLeadingZero: true  },
  { code: "TN", dial: "216",  flag: "🇹🇳", name: "تونس",             localLen: 8                        },
  { code: "DZ", dial: "213",  flag: "🇩🇿", name: "الجزائر",          localLen: 9,  hasLeadingZero: true  },
  { code: "MA", dial: "212",  flag: "🇲🇦", name: "المغرب",           localLen: 9,  hasLeadingZero: true  },
  { code: "SD", dial: "249",  flag: "🇸🇩", name: "السودان",          localLen: 9,  hasLeadingZero: true  },
  { code: "SO", dial: "252",  flag: "🇸🇴", name: "الصومال",          localLen: 8                        },
  { code: "MR", dial: "222",  flag: "🇲🇷", name: "موريتانيا",        localLen: 8                        },
  { code: "PS", dial: "970",  flag: "🇵🇸", name: "فلسطين",           localLen: 9,  hasLeadingZero: true  },
  { code: "TR", dial: "90",   flag: "🇹🇷", name: "تركيا",            localLen: 10, hasLeadingZero: true  },
  { code: "IN", dial: "91",   flag: "🇮🇳", name: "الهند",            localLen: 10, hasLeadingZero: true  },
  { code: "PK", dial: "92",   flag: "🇵🇰", name: "باكستان",          localLen: 10, hasLeadingZero: true  },
  { code: "NG", dial: "234",  flag: "🇳🇬", name: "نيجيريا",          localLen: 10, hasLeadingZero: true  },
  { code: "ET", dial: "251",  flag: "🇪🇹", name: "إثيوبيا",          localLen: 9,  hasLeadingZero: true  },
  { code: "KE", dial: "254",  flag: "🇰🇪", name: "كينيا",            localLen: 9,  hasLeadingZero: true  },
  { code: "GH", dial: "233",  flag: "🇬🇭", name: "غانا",             localLen: 9,  hasLeadingZero: true  },
  { code: "US", dial: "1",    flag: "🇺🇸", name: "الولايات المتحدة", localLen: 10                        },
  { code: "GB", dial: "44",   flag: "🇬🇧", name: "المملكة المتحدة",  localLen: 10, hasLeadingZero: true  },
  { code: "FR", dial: "33",   flag: "🇫🇷", name: "فرنسا",            localLen: 9,  hasLeadingZero: true  },
  { code: "DE", dial: "49",   flag: "🇩🇪", name: "ألمانيا",          localLen: 10, hasLeadingZero: true  },
  { code: "IT", dial: "39",   flag: "🇮🇹", name: "إيطاليا",          localLen: 10, hasLeadingZero: true  },
  { code: "ES", dial: "34",   flag: "🇪🇸", name: "إسبانيا",          localLen: 9                        },
  { code: "CN", dial: "86",   flag: "🇨🇳", name: "الصين",            localLen: 11                       },
  { code: "RU", dial: "7",    flag: "🇷🇺", name: "روسيا",            localLen: 10, hasLeadingZero: true  },
  { code: "BR", dial: "55",   flag: "🇧🇷", name: "البرازيل",         localLen: 11                       },
  { code: "ZA", dial: "27",   flag: "🇿🇦", name: "جنوب أفريقيا",    localLen: 9,  hasLeadingZero: true  },
  { code: "AU", dial: "61",   flag: "🇦🇺", name: "أستراليا",         localLen: 9,  hasLeadingZero: true  },
  { code: "CA", dial: "1",    flag: "🇨🇦", name: "كندا",             localLen: 10                       },
  { code: "NL", dial: "31",   flag: "🇳🇱", name: "هولندا",           localLen: 9,  hasLeadingZero: true  },
  { code: "SE", dial: "46",   flag: "🇸🇪", name: "السويد",           localLen: 9,  hasLeadingZero: true  },
  { code: "NO", dial: "47",   flag: "🇳🇴", name: "النرويج",          localLen: 8,  hasLeadingZero: true  },
  { code: "CH", dial: "41",   flag: "🇨🇭", name: "سويسرا",           localLen: 9                        },
  { code: "BE", dial: "32",   flag: "🇧🇪", name: "بلجيكا",           localLen: 9,  hasLeadingZero: true  },
  { code: "PL", dial: "48",   flag: "🇵🇱", name: "بولندا",           localLen: 9,  hasLeadingZero: true  },
  { code: "ID", dial: "62",   flag: "🇮🇩", name: "إندونيسيا",        localLen: 10, hasLeadingZero: true  },
  { code: "MY", dial: "60",   flag: "🇲🇾", name: "ماليزيا",          localLen: 10, hasLeadingZero: true  },
  { code: "BD", dial: "880",  flag: "🇧🇩", name: "بنغلاديش",         localLen: 10, hasLeadingZero: true  },
  { code: "PH", dial: "63",   flag: "🇵🇭", name: "الفلبين",          localLen: 10, hasLeadingZero: true  },
  { code: "ER", dial: "291",  flag: "🇪🇷", name: "إريتريا",          localLen: 7,  hasLeadingZero: true  },
  { code: "DJ", dial: "253",  flag: "🇩🇯", name: "جيبوتي",           localLen: 8                        },
  { code: "KM", dial: "269",  flag: "🇰🇲", name: "جزر القمر",        localLen: 7                        },
];

/** Map from ISO code → entry */
export const COUNTRY_MAP = Object.fromEntries(COUNTRIES.map((c) => [c.code, c]));

/** Default country (Egypt) */
export const DEFAULT_COUNTRY = COUNTRIES[0];

/**
 * @deprecated use localPhoneToE164 instead. Kept for backward compatibility.
 */
export function normalizePhone(raw, dialCode = "20", localLen = 10) {
  if (!raw) return "";
  let d = String(raw).trim();

  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("00")) d = d.slice(2);

  d = d.replace(/\D/g, "");

  if (!d) return "";

  if (d.startsWith(dialCode)) return d;

  if (d.startsWith("0") && d.length === localLen + 1) {
    d = d.slice(1);
  }

  if (d.length === localLen) {
    d = dialCode + d;
  }

  return d;
}
