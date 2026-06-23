// Custom-protocol bridge: renderer ↔ embedded server WITHOUT a TCP loopback socket.
//
// WHY: the embedded Express server normally listens on http://127.0.0.1:<port>.
// Some hardened PCs (notably ones running Kaspersky / aggressive antivirus or a
// proxy) silently block or drop connections to 127.0.0.1, which surfaces in the
// app as a persistent "connection error" / "فشل تحميل الإعدادات" even though the
// app is purely local. Disabling the AV from its tray does not help because its
// kernel network-filter driver stays loaded.
//
// FIX: register a privileged `retailer://` scheme. The renderer talks to
// `retailer://local/...` (handled entirely inside Electron — no OS network stack
// is involved), and this handler forwards each request to the server over a local
// NAMED PIPE (Windows) / unix socket — which is not TCP and therefore invisible to
// antivirus network filters. The full Express stack (auth, permissions, audit,
// /uploads static) is reused untouched.

const http = require("http");
const { Readable } = require("stream");

// Hop-by-hop headers must not be forwarded across the bridge (RFC 7230 §6.1).
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

/**
 * Register the `retailer://` protocol handler. Must be called after app `ready`.
 * The handler reads process.env.RETAILER_PIPE lazily on every request, so it keeps
 * working across server restarts (the pipe name changes each start).
 *
 * @param {import("electron").Protocol} protocol  Electron's protocol module
 */
function registerApiProtocol(protocol) {
  protocol.handle("retailer", async (request) => {
    const pipe = process.env.RETAILER_PIPE;
    if (!pipe) {
      // Server not ready yet (or pipe listen failed). The renderer's axios layer
      // treats this as a transient failure and retries.
      return new Response("server pipe not ready", { status: 503 });
    }

    let url;
    try {
      url = new URL(request.url);
    } catch (_e) {
      return new Response("bad request url", { status: 400 });
    }
    // retailer://local/api/settings?x=1  →  /api/settings?x=1
    const reqPath = `${url.pathname}${url.search}`;
    const method = request.method || "GET";

    // Body (only for methods that carry one).
    let bodyBuffer = null;
    if (method !== "GET" && method !== "HEAD") {
      try {
        const ab = await request.arrayBuffer();
        if (ab && ab.byteLength) bodyBuffer = Buffer.from(ab);
      } catch (_e) {
        /* no body */
      }
    }

    // Forward headers (Authorization, Content-Type, …) minus hop-by-hop + host.
    const headers = {};
    request.headers.forEach((value, key) => {
      const k = key.toLowerCase();
      if (HOP_BY_HOP.has(k) || k === "host" || k === "origin" || k === "content-length") return;
      headers[key] = value;
    });
    headers.host = "local";
    if (bodyBuffer) headers["content-length"] = String(bodyBuffer.length);

    return await new Promise((resolve) => {
      const upstream = http.request(
        { socketPath: pipe, path: reqPath, method, headers },
        (res) => {
          const resHeaders = new Headers();
          for (const [k, v] of Object.entries(res.headers)) {
            if (v == null || HOP_BY_HOP.has(k.toLowerCase())) continue;
            if (Array.isArray(v)) v.forEach((vv) => resHeaders.append(k, String(vv)));
            else resHeaders.set(k, String(v));
          }
          const status = res.statusCode || 200;
          // 204/304 must not carry a body stream.
          const noBody = status === 204 || status === 304 || method === "HEAD";
          if (noBody) {
            res.resume();
            resolve(new Response(null, { status, headers: resHeaders }));
            return;
          }
          resolve(new Response(Readable.toWeb(res), { status, headers: resHeaders }));
        },
      );
      upstream.on("error", (err) => {
        resolve(new Response(`bridge error: ${err.message}`, { status: 502 }));
      });
      if (bodyBuffer) upstream.write(bodyBuffer);
      upstream.end();
    });
  });
}

module.exports = { registerApiProtocol };
