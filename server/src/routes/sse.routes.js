const express = require("express");
const router = express.Router();

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

router.get("/events", (req, res) => {
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
