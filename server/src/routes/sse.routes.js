const express = require("express");
const router = express.Router();
const { authRequired } = require("../middleware/auth");

const clients = [];

function broadcast(event, data) {
  const msg = JSON.stringify({ event, data });
  for (const client of clients) {
    try {
      client.res.write(`event: ${event}\ndata: ${msg}\n\n`);
    } catch {
      // client disconnected
    }
  }
}

// EventSource cannot set an Authorization header, so the client passes the
// JWT as ?token= — promote it to the header authRequired expects.
function tokenFromQuery(req, _res, next) {
  if (!req.headers.authorization && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
}

router.get("/events", tokenFromQuery, authRequired, (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  res.write("event: connected\ndata: {}\n\n");

  const client = { id: Date.now(), res };
  clients.push(client);

  const keepAlive = setInterval(() => {
    try {
      res.write(":keepalive\n\n");
    } catch {
      clearInterval(keepAlive);
    }
  }, 30000);

  req.on("close", () => {
    clearInterval(keepAlive);
    const idx = clients.indexOf(client);
    if (idx !== -1) clients.splice(idx, 1);
  });
});

module.exports = { router, broadcast };
