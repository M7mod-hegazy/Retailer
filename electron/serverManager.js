let serverRef = null;

/**
 * Starts the embedded Express server and returns a Promise that resolves
 * only when the server is actually listening and ready to accept requests.
 * This prevents the Electron main window from opening before the API is up.
 */
function startEmbeddedServer() {
  if (serverRef) return Promise.resolve(serverRef);

  return new Promise((resolve, reject) => {
    let mod;
    try {
      mod = require("../server/src/index");
    } catch (err) {
      return reject(new Error(`Failed to load server module: ${err.message}`));
    }

    mod
      .startServer()
      .then((server) => {
        serverRef = server;
        resolve(server);
      })
      .catch((err) => {
        reject(err);
      });
  });
}

function stopEmbeddedServer() {
  if (!serverRef) return Promise.resolve();
  return new Promise((resolve, reject) => {
    serverRef.close((err) => {
      if (err) return reject(err);
      serverRef = null;
      return resolve();
    });
  });
}

module.exports = { startEmbeddedServer, stopEmbeddedServer };
