const { getDb } = require("../config/database");

const META_API_VERSION = "v19.0";
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

function getConfig() {
  const db = getDb();
  try {
    return db.prepare("SELECT * FROM meta_ads_config WHERE id = 1").get() || {};
  } catch { return {}; }
}

function saveConfig(data) {
  const db = getDb();
  const existing = getConfig();
  if (existing.id) {
    const fields = [];
    const params = [];
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) { fields.push(`${k} = ?`); params.push(v); }
    }
    if (fields.length) db.prepare(`UPDATE meta_ads_config SET ${fields.join(", ")} WHERE id = 1`).run(...params);
  } else {
    db.prepare(`INSERT INTO meta_ads_config (id, access_token, app_id, app_secret, pixel_id, business_id, ad_account_id, enabled) VALUES (1, ?, ?, ?, ?, ?, ?, ?)`)
      .run(data.access_token, data.app_id, data.app_secret, data.pixel_id, data.business_id, data.ad_account_id, data.enabled ? 1 : 0);
  }
}

async function metaFetch(path, token, params = {}) {
  const url = new URL(`${META_API_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (token) url.searchParams.set("access_token", token);
  const res = await fetch(url.toString());
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || "Meta API error");
  return json;
}

async function testConnection() {
  const cfg = getConfig();
  if (!cfg.access_token) throw new Error("access_token غير موجود");
  const me = await metaFetch("/me", cfg.access_token, { fields: "id,name" });
  return { connected: true, name: me.name, id: me.id };
}

async function syncAudiences() {
  const cfg = getConfig();
  if (!cfg.access_token || !cfg.ad_account_id) throw new Error("الإعدادات غير مكتملة");
  const res = await metaFetch(`/${cfg.ad_account_id}/customaudiences`, cfg.access_token, {
    fields: "id,name,description,size,delivery_info",
    limit: "100",
  });
  const db = getDb();
  const audiences = res.data || [];
  for (const aud of audiences) {
    db.prepare(`INSERT OR REPLACE INTO meta_ads_audiences (meta_audience_id, name, description, size, status, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`)
      .run(aud.id, aud.name, aud.description || null, aud.size || 0, "ready");
  }
  db.prepare("UPDATE meta_ads_config SET last_sync_at = datetime('now') WHERE id = 1").run();
  return { synced: audiences.length };
}

async function createCustomAudience(name, description, emails) {
  const cfg = getConfig();
  if (!cfg.access_token || !cfg.ad_account_id) throw new Error("الإعدادات غير مكتملة");
  const res = await metaFetch(`/${cfg.ad_account_id}/customaudiences`, cfg.access_token, {
    name,
    description: description || "",
    subtype: "CUSTOM",
    customer_file_source: "USER_PROVIDED",
  });
  const audienceId = res.id;
  // Upload emails as audience members
  if (emails?.length) {
    const schema = ["EMAIL"];
    const data = emails.map(e => [e]);
    await metaFetch(`/${audienceId}/users`, cfg.access_token, {
      payload: JSON.stringify({ schema, data }),
    });
  }
  const db = getDb();
  db.prepare(`INSERT INTO meta_ads_audiences (meta_audience_id, name, description, size, status) VALUES (?, ?, ?, ?, 'ready')`)
    .run(audienceId, name, description || null, emails?.length || 0);
  return { audience_id: audienceId, name, size: emails?.length || 0 };
}

async function getLeadForms() {
  const cfg = getConfig();
  if (!cfg.access_token || !cfg.business_id) throw new Error("الإعدادات غير مكتملة");
  const pages = await metaFetch(`/${cfg.business_id}/owned_pages`, cfg.access_token, {
    fields: "id,name",
    limit: "50",
  });
  const allForms = [];
  for (const page of pages.data || []) {
    const forms = await metaFetch(`/${page.id}/leadgen_forms`, cfg.access_token, {
      fields: "id,name,status,created_time",
      limit: "50",
    });
    for (const f of forms.data || []) {
      allForms.push({ ...f, page_id: page.id, page_name: page.name });
    }
  }
  const db = getDb();
  for (const f of allForms) {
    db.prepare(`INSERT OR REPLACE INTO meta_lead_forms (meta_form_id, page_id, page_name, form_name, status) VALUES (?, ?, ?, ?, ?)`)
      .run(f.id, f.page_id, f.page_name, f.name, f.status);
  }
  return { forms: allForms };
}

async function syncLeads(formId) {
  const cfg = getConfig();
  if (!cfg.access_token) throw new Error("الإعدادات غير مكتملة");
  const leads = await metaFetch(`/${formId}/leads`, cfg.access_token, {
    fields: "id,created_time,field_data",
    limit: "100",
  });
  const db = getDb();
  let synced = 0;
  for (const lead of leads.data || []) {
    const fieldMap = {};
    for (const f of lead.field_data || []) {
      fieldMap[f.name] = f.values?.[0] || "";
    }
    const phone = fieldMap.phone_number || fieldMap.phone || "";
    const email = fieldMap.email || "";
    const name = fieldMap.full_name || fieldMap.name || "";
    if (phone || email) {
      try {
        db.prepare(`INSERT OR IGNORE INTO leads (name, phone_raw, phone_normalized, email, source, tags, opted_out, created_at) VALUES (?, ?, ?, ?, 'meta_lead', '[]', 0, ?)`)
          .run(name, phone, phone, email, lead.created_time);
        synced++;
      } catch (_) {}
    }
  }
  db.prepare("UPDATE meta_lead_forms SET last_sync_at = datetime('now'), leads_count = leads_count + ? WHERE meta_form_id = ?").run(synced, formId);
  return { synced };
}

async function pushAudience(audienceId) {
  const cfg = getConfig();
  if (!cfg.access_token) throw new Error("الإعدادات غير مكتملة");
  const db = getDb();
  const emails = db.prepare(`SELECT email FROM customers WHERE email IS NOT NULL AND email != '' AND email LIKE '%@%'`).all().map(r => r.email);
  if (!emails.length) return { pushed: 0 };
  const schema = ["EMAIL"];
  const data = emails.map(e => [e]);
  await metaFetch(`/${audienceId}/users`, cfg.access_token, {
    payload: JSON.stringify({ schema, data }),
  });
  return { pushed: emails.length };
}

module.exports = { getConfig, saveConfig, testConnection, syncAudiences, createCustomAudience, getLeadForms, syncLeads, pushAudience };
