// HTTP routes for Phase 2 dev↔store communication.
//
// Store side (authApp): the app authenticates with the shared x-app-key and
// identifies its store via headers (x-license-id is required; the conversation
// is keyed by it). Dev side (authOwner): the owner session from the existing
// license dashboard auth — so "developer mode" can't be spoofed by a client.
//
// Note: media attachment upload (multipart) is intentionally not wired here yet
// — the schema + service support it; the upload endpoint comes in the next
// sub-step (needs multer + an uploads dir). Text messaging + announcements are
// complete and verifiable now.

const path = require("path");
const fs = require("fs");
const multer = require("multer");
const comms = require("./commsService");
const { getAppApiKey } = require("./licenseVendorService");

// Uploads live next to the vendor DB (writable), overridable via env.
function uploadsDir() {
  const dbPath = process.env.VENDOR_DB_PATH || path.join(process.cwd(), "vendor-license-service", "data", "vendor-licenses.db");
  const dir = process.env.VENDOR_UPLOADS_DIR || path.join(path.dirname(dbPath), "uploads");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function kindFromMime(mime) {
  const m = String(mime || "");
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("audio/")) return "voice";
  return "file";
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir()),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "") || "";
      cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 6 }, // 10 MB/file, up to 6 files
});

function storeCtx(req) {
  const licenseId = String(req.headers["x-license-id"] || "").trim();
  if (!licenseId) {
    const err = new Error("x-license-id header is required");
    err.status = 400;
    throw err;
  }
  // ASCII-safe identifiers travel in headers; human names (often Arabic) travel
  // in the JSON body — HTTP header values must be latin1 only.
  return {
    licenseId,
    appVersion: String(req.headers["x-app-version"] || "").trim() || null,
    deviceId: String(req.headers["x-device-id"] || "").trim() || null,
    storeName: String(req.body?.storeName || "").trim() || null,
    senderName: String(req.body?.senderName || "").trim() || null,
  };
}

function maxId(rows) {
  return rows.reduce((m, r) => Math.max(m, r.id), 0);
}

function registerCommsRoutes(app, { authApp, authOwner, verifyOwnerToken }) {
  // ──────────────────────────── Store side ────────────────────────────
  app.post("/comms/messages", authApp, (req, res, next) => {
    try {
      const ctx = storeCtx(req);
      const message = comms.addMessage({
        licenseId: ctx.licenseId,
        senderType: "store",
        senderName: ctx.senderName,
        storeName: ctx.storeName,
        channel: req.body?.channel,
        body: String(req.body?.body || ""),
        appVersion: ctx.appVersion,
        deviceId: ctx.deviceId,
      });
      res.status(201).json({ success: true, data: message });
    } catch (error) {
      next(error);
    }
  });

  // Send a message with attachments (multipart). Text fields ride alongside
  // the files; names (Arabic) come in the body, ids in headers.
  app.post("/comms/messages/upload", authApp, upload.array("files", 6), (req, res, next) => {
    try {
      const ctx = storeCtx(req);
      const message = comms.addMessage({
        licenseId: ctx.licenseId,
        senderType: "store",
        senderName: ctx.senderName,
        storeName: ctx.storeName,
        channel: req.body?.channel,
        body: String(req.body?.body || ""),
        appVersion: ctx.appVersion,
        deviceId: ctx.deviceId,
      });
      for (const f of req.files || []) {
        comms.addAttachment(message.id, {
          kind: kindFromMime(f.mimetype),
          filename: f.originalname,
          mime: f.mimetype,
          size: f.size,
          path: f.path,
        });
      }
      res.status(201).json({ success: true, data: comms.getMessage(message.id) });
    } catch (error) {
      next(error);
    }
  });

  // Serve an attachment. The client fetches the bytes with auth headers and
  // wraps them in a blob URL (so no secret ever rides in the URL). Access is
  // scoped: the owner (dev) may read any attachment; a store may read only
  // attachments in its own conversation (cross-tenant guard).
  app.get("/comms/attachments/:id", (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const bearer = (() => {
        const h = String(req.headers.authorization || "");
        return h.startsWith("Bearer ") ? h.slice(7).trim() : "";
      })();
      const isOwner = typeof verifyOwnerToken === "function" && verifyOwnerToken(bearer);

      let att = null;
      if (isOwner) {
        att = comms.getAttachment(id);
      } else {
        if (String(req.headers["x-app-key"] || "") !== getAppApiKey()) {
          return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const licenseId = String(req.headers["x-license-id"] || "").trim();
        if (!licenseId) return res.status(401).json({ success: false, message: "Unauthorized" });
        att = comms.getAttachmentForLicense(id, licenseId);
      }
      if (!att || !fs.existsSync(att.path)) {
        return res.status(404).json({ success: false, message: "Not found" });
      }

      // Never trust the uploaded MIME for active types: only allowlisted media
      // is served inline; everything else is forced to a download as octet-stream.
      const INLINE_OK = /^(image\/(png|jpe?g|gif|webp|bmp)|audio\/(webm|mpeg|ogg|wav|mp4|x-m4a)|video\/(mp4|webm)|application\/pdf)$/i;
      res.setHeader("X-Content-Type-Options", "nosniff");
      const safeName = encodeURIComponent(att.filename || "file");
      if (att.mime && INLINE_OK.test(att.mime)) {
        res.type(att.mime);
        res.setHeader("Content-Disposition", `inline; filename="${safeName}"`);
      } else {
        res.type("application/octet-stream");
        res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
      }
      res.sendFile(path.resolve(att.path));
    } catch (error) {
      next(error);
    }
  });

  app.get("/comms/messages", authApp, (req, res, next) => {
    try {
      const ctx = storeCtx(req);
      const messages = comms.listMessages(ctx.licenseId, req.query.since);
      // Store reading the thread marks the dev's messages as seen.
      comms.markSeen(ctx.licenseId, "store", maxId(messages));
      res.json({ success: true, data: { messages, cursor: maxId(messages) } });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/comms/messages/:id", authApp, (req, res, next) => {
    try {
      const ctx = storeCtx(req);
      const message = comms.editMessage(Number(req.params.id), "store", String(req.body?.body || ""), ctx.licenseId);
      res.json({ success: true, data: message });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/comms/messages/:id", authApp, (req, res, next) => {
    try {
      const ctx = storeCtx(req);
      const message = comms.deleteMessage(Number(req.params.id), "store", ctx.licenseId);
      res.json({ success: true, data: message });
    } catch (error) {
      next(error);
    }
  });

  app.post("/comms/messages/:id/react", authApp, (req, res, next) => {
    try {
      const ctx = storeCtx(req);
      const message = comms.toggleReaction(Number(req.params.id), "store", String(req.body?.emoji || "👍"), ctx.licenseId);
      res.json({ success: true, data: message });
    } catch (error) {
      next(error);
    }
  });

  app.get("/comms/announcements", authApp, (req, res, next) => {
    try {
      const ctx = storeCtx(req);
      const items = comms.listAnnouncementsForStore(ctx.licenseId, ctx.appVersion, req.query.since);
      res.json({ success: true, data: { announcements: items, cursor: maxId(items) } });
    } catch (error) {
      next(error);
    }
  });

  app.post("/comms/announcements/:id/read", authApp, (req, res, next) => {
    try {
      const ctx = storeCtx(req);
      comms.markAnnouncementRead(Number(req.params.id), ctx.licenseId);
      res.json({ success: true, data: { read: true } });
    } catch (error) {
      next(error);
    }
  });

  // ──────────────────────────── Dev side ──────────────────────────────
  app.get("/comms/dev/conversations", authOwner, (_req, res, next) => {
    try {
      res.json({ success: true, data: comms.listConversations() });
    } catch (error) {
      next(error);
    }
  });

  app.get("/comms/dev/conversations/:licenseId/messages", authOwner, (req, res, next) => {
    try {
      const { licenseId } = req.params;
      const messages = comms.listMessages(licenseId, req.query.since);
      comms.markSeen(licenseId, "dev", maxId(messages)); // dev read => store sees receipts
      res.json({ success: true, data: { messages, cursor: maxId(messages) } });
    } catch (error) {
      next(error);
    }
  });

  app.post("/comms/dev/conversations/:licenseId/reply", authOwner, (req, res, next) => {
    try {
      const message = comms.addMessage({
        licenseId: req.params.licenseId,
        senderType: "dev",
        senderName: String(req.body?.senderName || "الدعم"),
        channel: "support",
        body: String(req.body?.body || ""),
      });
      res.status(201).json({ success: true, data: message });
    } catch (error) {
      next(error);
    }
  });

  app.post("/comms/dev/conversations/:licenseId/status", authOwner, (req, res, next) => {
    try {
      const conv = comms.setConversationStatus(req.params.licenseId, String(req.body?.status || "seen"));
      res.json({ success: true, data: conv });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/comms/dev/messages/:id", authOwner, (req, res, next) => {
    try {
      const message = comms.editMessage(Number(req.params.id), "dev", String(req.body?.body || ""));
      res.json({ success: true, data: message });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/comms/dev/messages/:id", authOwner, (req, res, next) => {
    try {
      const message = comms.deleteMessage(Number(req.params.id), "dev");
      res.json({ success: true, data: message });
    } catch (error) {
      next(error);
    }
  });

  app.post("/comms/dev/messages/:id/react", authOwner, (req, res, next) => {
    try {
      const message = comms.toggleReaction(Number(req.params.id), "dev", String(req.body?.emoji || "👍"));
      res.json({ success: true, data: message });
    } catch (error) {
      next(error);
    }
  });

  app.get("/comms/dev/announcements", authOwner, (_req, res, next) => {
    try {
      res.json({ success: true, data: comms.listAnnouncements() });
    } catch (error) {
      next(error);
    }
  });

  app.post("/comms/dev/announcements", authOwner, (req, res, next) => {
    try {
      const b = req.body || {};
      const ann = comms.createAnnouncement({
        title: b.title,
        body: String(b.body || ""),
        type: b.type,
        targetKind: b.targetKind,
        targetLicenseId: b.targetLicenseId,
        versionMin: b.versionMin,
        versionMax: b.versionMax,
      });
      res.status(201).json({ success: true, data: ann });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/comms/dev/announcements/:id", authOwner, (req, res, next) => {
    try {
      const ann = comms.updateAnnouncement(Number(req.params.id), {
        title: req.body?.title,
        body: req.body?.body,
        type: req.body?.type,
      });
      if (!ann) return res.status(404).json({ success: false, message: "not_found" });
      res.json({ success: true, data: ann });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/comms/dev/announcements/:id", authOwner, (req, res, next) => {
    try {
      const ann = comms.deleteAnnouncement(Number(req.params.id));
      if (!ann) return res.status(404).json({ success: false, message: "not_found" });
      res.json({ success: true, data: ann });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/comms/dev/announcements/:id/toggle", authOwner, (req, res, next) => {
    try {
      const ann = comms.toggleAnnouncement(Number(req.params.id));
      if (!ann) return res.status(404).json({ success: false, message: "not_found" });
      res.json({ success: true, data: ann });
    } catch (error) {
      next(error);
    }
  });
}

module.exports = { registerCommsRoutes };
