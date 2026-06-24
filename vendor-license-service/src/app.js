const express = require("express");
const crypto = require("crypto");
const {
  activateLicense,
  createLicense,
  deleteLicense,
  getAppApiKey,
  getIssuer,
  getPublicKey,
  getSignedLicenseById,
  listActivations,
  listLicenses,
  refreshActivationToken,
  rebindActivation,
  setLicenseStatus,
  updateLicense,
} = require("./licenseVendorService");
const { defaultProvider } = require("./aiProvider");
const { bucketFromReq, consume } = require("./aiUsage");
const { registerCommsRoutes } = require("./commsRoutes");

const OWNER_EMAIL = String(process.env.OWNER_EMAIL || "m7mod");
const OWNER_PASSWORD = String(process.env.OWNER_PASSWORD || "275757");
const OWNER_SESSION_SECRET = String(process.env.OWNER_SESSION_SECRET || "owner-session-secret");
const OWNER_SESSION_TTL_HOURS = Math.max(1, Number(process.env.OWNER_SESSION_TTL_HOURS || 12));

function parseCookies(req) {
  const raw = String(req.headers.cookie || "");
  return raw.split(";").reduce((acc, part) => {
    const idx = part.indexOf("=");
    if (idx <= 0) return acc;
    const key = part.slice(0, idx).trim();
    const value = decodeURIComponent(part.slice(idx + 1).trim());
    acc[key] = value;
    return acc;
  }, {});
}

function issueOwnerToken() {
  const exp = Date.now() + OWNER_SESSION_TTL_HOURS * 60 * 60 * 1000;
  const payload = `${OWNER_EMAIL}|${exp}`;
  const sig = crypto.createHmac("sha256", OWNER_SESSION_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}|${sig}`, "utf8").toString("base64url");
}

function verifyOwnerToken(token) {
  if (!token) return false;
  let decoded = "";
  try {
    decoded = Buffer.from(String(token), "base64url").toString("utf8");
  } catch (_error) {
    return false;
  }
  const [email, expRaw, sig] = decoded.split("|");
  if (!email || !expRaw || !sig) return false;
  if (email !== OWNER_EMAIL) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  const payload = `${email}|${exp}`;
  const expected = crypto.createHmac("sha256", OWNER_SESSION_SECRET).update(payload).digest("hex");
  const sigBuf = Buffer.from(sig, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  if (sigBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expectedBuf);
}

function authOwner(req, _res, next) {
  // Accept a bearer token (used by the desktop app cross-origin, where the
  // SameSite=Strict cookie can't be sent) OR the dashboard's owner cookie.
  const header = String(req.headers.authorization || "");
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const cookies = parseCookies(req);
  const token = bearer || cookies.owner_session;
  if (!verifyOwnerToken(token)) {
    const err = new Error("Owner authentication required");
    err.status = 401;
    return next(err);
  }
  return next();
}

function authApp(req, _res, next) {
  const key = String(req.headers["x-app-key"] || "");
  if (key !== getAppApiKey()) {
    const err = new Error("Unauthorized app key");
    err.status = 401;
    return next(err);
  }
  return next();
}

function createVendorApp() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.post("/owner/login", (req, res, next) => {
    try {
      const email = String(req.body?.email || "").trim();
      const password = String(req.body?.password || "");
      if (email !== OWNER_EMAIL || password !== OWNER_PASSWORD) {
        const err = new Error("بيانات الدخول غير صحيحة");
        err.status = 401;
        throw err;
      }
      const token = issueOwnerToken();
      const secure = String(process.env.NODE_ENV || "").toLowerCase() === "production";
      res.setHeader(
        "Set-Cookie",
        `owner_session=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${OWNER_SESSION_TTL_HOURS * 60 * 60}${secure ? "; Secure" : ""}`,
      );
      res.json({ success: true, data: { owner: OWNER_EMAIL, token } });
    } catch (error) {
      next(error);
    }
  });

  app.post("/owner/logout", (_req, res) => {
    res.setHeader("Set-Cookie", "owner_session=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0");
    res.json({ success: true, data: { logged_out: true } });
  });

  app.get("/owner/me", (req, res) => {
    const cookies = parseCookies(req);
    const ok = verifyOwnerToken(cookies.owner_session);
    if (!ok) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }
    return res.json({ success: true, data: { owner: OWNER_EMAIL } });
  });

  app.get("/", (_req, res) => {
    res.type("html").send(`<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>لوحة إدارة التراخيص</title>
  <style>
    :root {
      --bg: #f5f7fb;
      --surface: #ffffff;
      --border: #d6deea;
      --text: #10233b;
      --muted: #5f7088;
      --primary: #0d9488;
      --primary-dark: #0f766e;
      --danger: #dc2626;
      --shadow: 0 10px 28px rgba(2, 12, 27, 0.07);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: radial-gradient(1000px 460px at 30% -5%, #d8f4ec 0%, transparent 55%), var(--bg);
      color: var(--text);
      font-family: "Segoe UI", Tahoma, sans-serif;
      min-height: 100vh;
    }
    .container { max-width: 1180px; margin: 0 auto; padding: 22px; }
    .hero {
      border-radius: 22px;
      background: linear-gradient(135deg, #0f172a 0%, #12344c 60%, #124f67 100%);
      color: #fff;
      padding: 20px;
      box-shadow: var(--shadow);
      margin-bottom: 14px;
    }
    .hero h1 { margin: 0; font-size: 28px; }
    .hero p { margin: 8px 0 0; opacity: .9; }
    .layout { display: grid; grid-template-columns: 360px 1fr; gap: 14px; }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 18px;
      box-shadow: var(--shadow);
      padding: 16px;
    }
    h2 { margin: 0 0 12px; font-size: 20px; }
    .muted { color: var(--muted); font-size: 12px; }
    .stack { display: grid; gap: 10px; }
    label { display: grid; gap: 6px; font-weight: 700; color: #42566f; font-size: 13px; }
    input {
      width: 100%;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 11px 12px;
      font-size: 14px;
      outline: none;
    }
    input:focus {
      border-color: #91dfd3;
      box-shadow: 0 0 0 4px rgba(13, 148, 136, 0.15);
    }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .switch {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border-radius: 10px;
      background: #f2f7fd;
      border: 1px solid var(--border);
      font-weight: 700;
      color: #3e536d;
    }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
    button {
      border: 0;
      border-radius: 12px;
      padding: 10px 14px;
      font-weight: 700;
      cursor: pointer;
      color: #fff;
      background: var(--primary);
    }
    button:hover { background: var(--primary-dark); }
    button.ghost {
      background: transparent;
      color: var(--text);
      border: 1px solid var(--border);
    }
    button.secondary { background: #475569; }
    button.danger { background: var(--danger); }
    .msg { margin-top: 8px; display: none; padding: 10px; border-radius: 10px; font-size: 13px; }
    .msg.show { display: block; }
    .msg.ok { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
    .msg.err { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
    .toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .table-wrap { overflow: auto; border: 1px solid var(--border); border-radius: 12px; max-height: calc(100vh - 260px); }
    table { width: 100%; border-collapse: collapse; min-width: 760px; }
    th, td { padding: 10px; border-bottom: 1px solid #e9eff6; text-align: right; font-size: 13px; }
    th { background: #f8fbff; position: sticky; top: 0; z-index: 1; }
    .pill { padding: 4px 9px; border-radius: 999px; font-size: 11px; font-weight: 700; display: inline-block; }
    .pill.active { background: #dcfce7; color: #166534; }
    .pill.suspended { background: #fff7ed; color: #9a3412; }
    .pill.revoked { background: #fee2e2; color: #991b1b; }
    code { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12px; }
    .auth-wrap { max-width: 420px; margin: 90px auto; }
    @media (max-width: 1000px) {
      .layout { grid-template-columns: 1fr; }
      .table-wrap { max-height: 440px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="hero">
      <h1>إدارة تراخيص العملاء</h1>
      <p>واجهة بسيطة: إنشاء، تعديل، إيقاف، أو حذف الترخيص بدون تعقيد.</p>
    </div>

    <div class="layout">
      <div class="card">
        <h2 id="formTitle">ترخيص جديد</h2>
        <div class="stack">
          <div class="muted">المالك: <strong>${OWNER_EMAIL}</strong></div>
          <label>اسم المتجر
            <input id="storeName" placeholder="مثال: الحجازي ماركت" />
          </label>
          <label>رقم الهاتف
            <input id="storePhone" placeholder="01000000000" />
          </label>
          <div class="row">
            <label style="margin:0; flex:1;">تاريخ الانتهاء
              <input id="expiresAt" type="date" />
            </label>
            <label class="switch">
              <input id="isUnlimited" type="checkbox" />
              غير محدود
            </label>
          </div>
          <div class="actions">
            <button id="saveBtn">حفظ الترخيص</button>
            <button id="cancelBtn" class="ghost" type="button">إلغاء التعديل</button>
            <button id="logoutBtn" class="ghost" type="button">تسجيل خروج</button>
          </div>
          <div id="msg" class="msg"></div>
        </div>
      </div>

      <div class="card">
        <div class="toolbar">
          <div>
            <h2 style="margin:0">كل التراخيص</h2>
            <div class="muted">مربوطة بالتطبيق مباشرة وتدعم التفعيل على جهاز العميل.</div>
          </div>
          <button id="reloadBtn" class="secondary" type="button">تحديث</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>المعرف</th>
                <th>اسم المتجر</th>
                <th>الهاتف</th>
                <th>الانتهاء</th>
                <th>الحالة</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody id="tableBody"></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <script>
    const state = { editingId: null };
    const ids = {
      logoutBtn: document.getElementById("logoutBtn"),
      storeName: document.getElementById("storeName"),
      storePhone: document.getElementById("storePhone"),
      expiresAt: document.getElementById("expiresAt"),
      isUnlimited: document.getElementById("isUnlimited"),
      formTitle: document.getElementById("formTitle"),
      saveBtn: document.getElementById("saveBtn"),
      cancelBtn: document.getElementById("cancelBtn"),
      msg: document.getElementById("msg"),
      tableBody: document.getElementById("tableBody"),
      reloadBtn: document.getElementById("reloadBtn"),
    };

    function setMsg(kind, text) {
      ids.msg.className = "msg show " + (kind === "ok" ? "ok" : "err");
      ids.msg.textContent = text;
    }

    function clearMsg() {
      ids.msg.className = "msg";
      ids.msg.textContent = "";
    }

    function encodeActivationKey(signedLicense) {
      return "ELH1-" + btoa(unescape(encodeURIComponent(JSON.stringify(signedLicense))));
    }

    function clearForm() {
      state.editingId = null;
      ids.formTitle.textContent = "ترخيص جديد";
      ids.saveBtn.textContent = "حفظ الترخيص";
      ids.storeName.value = "";
      ids.storePhone.value = "";
      ids.expiresAt.value = "";
      ids.isUnlimited.checked = false;
      clearMsg();
    }

    function dateInputToIso(value) {
      if (!value) return null;
      return new Date(value + "T00:00:00.000Z").toISOString();
    }

    function isoToDateInput(value) {
      if (!value) return "";
      return String(value).slice(0, 10);
    }

    function readPayload() {
      const unlimited = ids.isUnlimited.checked;
      return {
        customer_name: ids.storeName.value.trim(),
        customer_phone: ids.storePhone.value.trim(),
        expires_at: unlimited ? null : dateInputToIso(ids.expiresAt.value),
      };
    }

    async function api(path, method, body) {
      const res = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.message || "فشل الطلب");
      return json.data;
    }

    function pill(status) {
      const labels = { active: "نشط", suspended: "موقوف", revoked: "ملغي" };
      return '<span class="pill ' + status + '">' + (labels[status] || status) + "</span>";
    }

    function escapeHtml(text) {
      return String(text || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
    }

    function fmtExpiry(isoValue) {
      if (!isoValue) return "غير محدود";
      try {
        return new Date(isoValue).toLocaleDateString("ar-EG");
      } catch (_error) {
        return isoValue;
      }
    }

    async function loadTable() {
      ids.tableBody.innerHTML = '<tr><td colspan="6" class="muted">جاري التحميل...</td></tr>';
      try {
        const rows = await api("/licenses", "GET");
        if (!rows.length) {
          ids.tableBody.innerHTML = '<tr><td colspan="6" class="muted">لا توجد تراخيص بعد.</td></tr>';
          return;
        }
        ids.tableBody.innerHTML = rows.map((row) => {
          const safe = encodeURIComponent(JSON.stringify(row));
          return '<tr>' +
            '<td><code>' + escapeHtml(row.id) + '</code></td>' +
            '<td>' + escapeHtml(row.customer_name || "-") + '</td>' +
            '<td>' + escapeHtml(row.customer_phone || "-") + '</td>' +
            '<td>' + escapeHtml(fmtExpiry(row.expires_at)) + '</td>' +
            '<td>' + pill(row.status) + '</td>' +
            '<td class="actions">' +
              '<button class="ghost" onclick="editRow(\\'' + safe + '\\')">تعديل</button>' +
              '<button class="ghost" onclick="copyKey(\\'' + row.id + '\\')">نسخ المفتاح</button>' +
              (row.status === "active"
                ? '<button class="secondary" onclick="changeStatus(\\'' + row.id + '\\', \\'suspend\\')">إيقاف</button>'
                : '<button class="secondary" onclick="changeStatus(\\'' + row.id + '\\', \\'resume\\')">تفعيل</button>') +
              '<button class="secondary" onclick="changeStatus(\\'' + row.id + '\\', \\'revoke\\')">إلغاء</button>' +
              '<button class="danger" onclick="deleteRow(\\'' + row.id + '\\')">حذف</button>' +
            '</td>' +
          '</tr>';
        }).join("");
      } catch (error) {
        ids.tableBody.innerHTML = '<tr><td colspan="6" class="muted">فشل تحميل البيانات.</td></tr>';
        setMsg("err", error.message);
      }
    }

    window.editRow = function(raw) {
      const row = JSON.parse(decodeURIComponent(raw));
      state.editingId = row.id;
      ids.formTitle.textContent = "تعديل الترخيص";
      ids.saveBtn.textContent = "حفظ التعديلات";
      ids.storeName.value = row.customer_name || "";
      ids.storePhone.value = row.customer_phone || "";
      ids.expiresAt.value = isoToDateInput(row.expires_at);
      ids.isUnlimited.checked = !row.expires_at;
      clearMsg();
    };

    window.changeStatus = async function(id, action) {
      try {
        await api("/licenses/" + encodeURIComponent(id) + "/" + action, "POST");
        setMsg("ok", "تم تحديث حالة الترخيص.");
        await loadTable();
      } catch (error) {
        setMsg("err", error.message);
      }
    };

    window.deleteRow = async function(id) {
      if (!confirm("هل تريد حذف هذا الترخيص نهائيا؟")) return;
      try {
        await api("/licenses/" + encodeURIComponent(id), "DELETE");
        setMsg("ok", "تم حذف الترخيص.");
        if (state.editingId === id) clearForm();
        await loadTable();
      } catch (error) {
        setMsg("err", error.message);
      }
    };

    window.copyKey = async function(id) {
      try {
        const data = await api("/licenses/" + encodeURIComponent(id) + "/signed", "GET");
        const key = encodeActivationKey(data.signed_license);
        await navigator.clipboard.writeText(key);
        setMsg("ok", "تم نسخ مفتاح التفعيل.");
      } catch (error) {
        setMsg("err", error.message);
      }
    };

    ids.isUnlimited.addEventListener("change", () => {
      ids.expiresAt.disabled = ids.isUnlimited.checked;
      if (ids.isUnlimited.checked) ids.expiresAt.value = "";
    });

    ids.saveBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      const payload = readPayload();
      if (!payload.customer_name || !payload.customer_phone) {
        setMsg("err", "اسم المتجر ورقم الهاتف مطلوبان.");
        return;
      }
      try {
        await (state.editingId
          ? api("/licenses/" + encodeURIComponent(state.editingId), "PUT", payload)
          : api("/licenses", "POST", payload));
        setMsg("ok", state.editingId ? "تم تحديث الترخيص." : "تم إنشاء الترخيص.");
        clearForm();
        await loadTable();
      } catch (error) {
        setMsg("err", error.message);
      }
    });

    ids.cancelBtn.addEventListener("click", clearForm);
    ids.reloadBtn.addEventListener("click", loadTable);

    async function ensureAuth() {
      const check = await fetch("/owner/me", { credentials: "include" });
      if (check.ok) return true;

      document.body.innerHTML =
        '<div class="container">' +
          '<div class="card auth-wrap">' +
            '<h2>دخول المالك</h2>' +
            '<div class="stack">' +
              '<label>البريد<input id="ownerEmail" value="${OWNER_EMAIL}" /></label>' +
              '<label>كلمة المرور<input id="ownerPassword" type="password" /></label>' +
              '<div class="actions"><button id="ownerLoginBtn">دخول</button></div>' +
              '<div id="ownerMsg" class="msg"></div>' +
            "</div>" +
          "</div>" +
        "</div>";
      const ownerLoginBtn = document.getElementById("ownerLoginBtn");
      const ownerMsg = document.getElementById("ownerMsg");
      ownerLoginBtn.addEventListener("click", async () => {
        ownerMsg.className = "msg";
        try {
          const res = await fetch("/owner/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              email: document.getElementById("ownerEmail").value.trim(),
              password: document.getElementById("ownerPassword").value,
            }),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok || !json.success) throw new Error(json.message || "فشل تسجيل الدخول");
          window.location.reload();
        } catch (err) {
          ownerMsg.className = "msg show err";
          ownerMsg.textContent = err.message;
        }
      });
      return false;
    }

    ids.logoutBtn.addEventListener("click", async () => {
      await fetch("/owner/logout", { method: "POST", credentials: "include" });
      window.location.reload();
    });

    ensureAuth().then((ok) => {
      if (ok) loadTable();
    });
  </script>
</body>
</html>`);
  });

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      issuer: getIssuer(),
      public_key: getPublicKey(),
    });
  });

  app.post("/licenses", authOwner, (req, res, next) => {
    try {
      const data = createLicense(req.body || {}, "admin");
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  });

  app.put("/licenses/:id", authOwner, (req, res, next) => {
    try {
      const data = updateLicense(req.params.id, req.body || {}, "admin");
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  });

  app.get("/licenses", authOwner, (_req, res, next) => {
    try {
      res.json({ success: true, data: listLicenses() });
    } catch (error) {
      next(error);
    }
  });

  app.get("/licenses/:id/activations", authOwner, (req, res, next) => {
    try {
      res.json({ success: true, data: listActivations(req.params.id) });
    } catch (error) {
      next(error);
    }
  });

  app.get("/licenses/:id/signed", authOwner, (req, res, next) => {
    try {
      const signedLicense = getSignedLicenseById(req.params.id);
      res.json({ success: true, data: { signed_license: signedLicense } });
    } catch (error) {
      next(error);
    }
  });

  app.post("/licenses/:id/suspend", authOwner, (req, res, next) => {
    try {
      setLicenseStatus(req.params.id, "suspended", "admin");
      res.json({ success: true, data: { id: req.params.id, status: "suspended" } });
    } catch (error) {
      next(error);
    }
  });

  app.post("/licenses/:id/resume", authOwner, (req, res, next) => {
    try {
      setLicenseStatus(req.params.id, "active", "admin");
      res.json({ success: true, data: { id: req.params.id, status: "active" } });
    } catch (error) {
      next(error);
    }
  });

  app.post("/licenses/:id/revoke", authOwner, (req, res, next) => {
    try {
      setLicenseStatus(req.params.id, "revoked", "admin");
      res.json({ success: true, data: { id: req.params.id, status: "revoked" } });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/licenses/:id", authOwner, (req, res, next) => {
    try {
      deleteLicense(req.params.id, "admin");
      res.json({ success: true, data: { id: req.params.id, deleted: true } });
    } catch (error) {
      next(error);
    }
  });

  // Optional, provider-agnostic help-assistant fallback. Inert until an AI
  // provider is configured via env (see aiProvider.js). Store-side auth.
  app.post("/ai/help", authApp, async (req, res, next) => {
    try {
      if (!defaultProvider.isConfigured()) {
        return res.status(503).json({ success: false, code: "ai_unavailable", message: "AI fallback not configured" });
      }
      const question = String(req.body?.question || "").trim();
      if (!question) {
        const err = new Error("question is required");
        err.status = 400;
        throw err;
      }
      const bucket = bucketFromReq(req);
      const quota = consume(bucket);
      if (!quota.allowed) {
        return res.status(429).json({ success: false, code: "ai_daily_limit", message: "Daily AI limit reached", data: quota });
      }
      const result = await defaultProvider.ask(question, req.body?.context);
      res.json({ success: true, data: { ...result, usage: quota } });
    } catch (error) {
      next(error);
    }
  });

  app.post("/activations", authApp, (req, res, next) => {
    try {
      const data = activateLicense(req.body?.signed_license, req.body?.device_id, "app");
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  });

  app.post("/activations/refresh", authApp, (req, res, next) => {
    try {
      const data = refreshActivationToken(req.body?.activation_token, "app");
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  });

  app.post("/activations/rebind", authOwner, (req, res, next) => {
    try {
      rebindActivation(req.body?.license_id, req.body?.old_device_id, req.body?.new_device_id, "admin");
      res.json({ success: true, data: { rebind: true } });
    } catch (error) {
      next(error);
    }
  });

  // Phase 2 dev↔store communication routes (store via authApp, dev via authOwner).
  registerCommsRoutes(app, { authApp, authOwner, verifyOwnerToken });

  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({
      success: false,
      message: err.message || "Unexpected error",
    });
  });

  return app;
}

module.exports = { createVendorApp };
