// The embedded Ed25519 PUBLIC key used to VERIFY license tokens.
//
// This key is SAFE to ship inside the customer app: a public key can only
// verify signatures, never create them. Only the seller's matching PRIVATE key
// (kept outside this repo) can mint licenses.
//
// SETUP: run `node tools/license-signer/keygen.js` once. It writes your private
// key to a safe folder OUTSIDE the repo and overwrites the PUBLIC_KEY_PEM below
// with your real public key. Until then the constant is empty and the app will
// report that licensing is not configured.
//
// You can also override at runtime with the RETAILER_LICENSE_PUBKEY env var
// (handy for tests / staged builds).

const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAiZPgMUK9AXEl9mjWpEDPTxgZUavDUZUvss83F0J0Ka8=
-----END PUBLIC KEY-----
`; // <-- keygen overwrites this line's value

function getPublicKeyPem() {
  const fromEnv = process.env.RETAILER_LICENSE_PUBKEY;
  if (fromEnv && fromEnv.trim()) {
    // Allow \n-escaped single-line env values.
    return fromEnv.includes("BEGIN")
      ? fromEnv.replace(/\\n/g, "\n")
      : Buffer.from(fromEnv, "base64").toString("utf8");
  }
  return PUBLIC_KEY_PEM;
}

function isConfigured() {
  return Boolean(getPublicKeyPem().trim());
}

module.exports = { PUBLIC_KEY_PEM, getPublicKeyPem, isConfigured };
