// Provider-agnostic AI abstraction for the optional help-assistant fallback.
//
// Built now, intentionally UNWIRED: with no env configured, `isConfigured()` is
// false and the `/ai/help` endpoint short-circuits — so it costs nothing until
// you choose a model. Because most hosted/free models (OpenRouter free tier,
// Groq, Together, local Ollama, OpenAI, …) expose an OpenAI-compatible
// `/chat/completions` API, one adapter covers nearly all of them: swap models
// by changing env vars, no code change.
//
// Env:
//   AI_PROVIDER     default "openai-compatible" (the only adapter for now)
//   AI_BASE_URL     e.g. https://openrouter.ai/api/v1  (no trailing /chat/...)
//   AI_API_KEY      bearer token for the chosen provider
//   AI_MODEL        e.g. "meta-llama/llama-3.1-8b-instruct:free"
//   AI_SYSTEM_PROMPT optional override of the Arabic system prompt
//   AI_TIMEOUT_MS   default 20000

const DEFAULT_SYSTEM_PROMPT = [
  "أنت خبير متخصص في برنامج نقاط البيع وإدارة المحلات ElHegazi Retailer (عربي).",
  "أجب دائمًا باللغة العربية الفصيحة المبسطة بأسلوب عملي واضح.",
  "اعتمد على المعلومات المرفقة من دليل البرنامج إن وُجدت، ولا تخترع خطوات غير موجودة.",
  "قدم إجابة مفصلة بثلاثة أجزاء:",
  "1. شرح الخطوات بالترتيب مع تحديد مكان كل زر أو شاشة.",
  "2. مثال واقعي بأرقام محددة (أسعار, كميات, أسماء) يوضح التطبيق العملي.",
  "3. خلاصة أو ملاحظة مهمة.",

  "يجب أن تحتوي كل إجابة على الأقل مثال واحد بأرقام حقيقية. مثال: لو السؤال عن خصم, اذكر سعر محدد ونسبة خصم. لو عن مشتريات, اذكر كميات وأسعار.",

  "أمثلة على الإجابات الجيدة:",

  "مثال 1: الخصم نوعين. خصم على صنف: لو عميل عايز تيشرت بـ 200 ج ينزل لـ 150 ج, اضغط على سطر التيشيرت, اختار خصم, اكتب 50 ج او 25%, السعر يتغير مباشرة. خصم على الفاتورة: لو الفاتورة 1200 ج وعايز تحسم 100 ج, من تحت الاجمالي قبل الدفع اكتب 100 ج. ملاحظة: الخصم محتاج صلاحية.",

  "مثال 2: من نقطة البيع, دور على الصنف بالاسم او الباركود وهيتضاف. مثال: عميل عايز 3 تيشرت بـ 100 ج ومروحة بـ 400 ج, دور على تيشرت ظبط الكمية 3, ضيف مروحة, اضغط دفع. بعد الدفع الفاتورة بتتطبع تلقائي. لو البيع آجل, اختار العميل اولا.",

  "مثال 3: من المشتريات ضيف فاتورة جديدة. مثال: اشتريت 20 كرتونة مياه من المورد عبدالله بـ 75 ج للكرتونة, ضيف صنف مياه كميه 20 سعر 75 ج, الاجمالي 1500 ج. بعد الحفظ المخزون يزيد والمستحق لعبدالله يتحدث.",

  "لو السؤال خارج نطاق البرنامج, وضح ذلك بأدب.",
  "لا تستخدم رموزا او Markdown او ايموجيز في الاجابة.",
].join(" ");

function buildContextBlock(context) {
  if (!Array.isArray(context) || context.length === 0) return "";
  const items = context
    .slice(0, 6)
    .map((c, i) => `(${i + 1}) ${String(c.title || "").trim()}: ${String(c.body || "").trim()}`)
    .join("\n");
  return `\n\nمقتطفات من دليل البرنامج قد تساعد:\n${items}`;
}

/**
 * Create an AI provider from a config object (defaults to process.env) and an
 * injectable fetch (defaults to global fetch — Node 18+). Injectable for tests.
 */
function createAiProvider(env = process.env, fetchImpl = globalThis.fetch) {
  const provider = String(env.AI_PROVIDER || "openai-compatible");
  const baseUrl = String(env.AI_BASE_URL || "").replace(/\/+$/, "");
  const apiKey = String(env.AI_API_KEY || "");
  const model = String(env.AI_MODEL || "");
  const systemPrompt = String(env.AI_SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT);
  const timeoutMs = Number(env.AI_TIMEOUT_MS || 20000);

  function isConfigured() {
    return Boolean(baseUrl && apiKey && model && typeof fetchImpl === "function");
  }

  async function ask(question, context) {
    if (!isConfigured()) {
      const err = new Error("AI provider not configured");
      err.code = "ai_unavailable";
      err.status = 503;
      throw err;
    }
    const userContent = `${String(question || "").trim()}${buildContextBlock(context)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const err = new Error(`AI provider error (${res.status})`);
        err.code = "ai_provider_error";
        err.status = 502;
        throw err;
      }
      const data = await res.json();
      const answer = data?.choices?.[0]?.message?.content?.trim();
      if (!answer) {
        const err = new Error("Empty AI response");
        err.code = "ai_empty";
        err.status = 502;
        throw err;
      }
      return { answer, provider, model };
    } finally {
      clearTimeout(timer);
    }
  }

  return { isConfigured, ask };
}

// Default singleton from process.env.
const defaultProvider = createAiProvider();

module.exports = { createAiProvider, defaultProvider, DEFAULT_SYSTEM_PROMPT };
