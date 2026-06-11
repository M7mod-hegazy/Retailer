const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAiZPgMUK9AXEl9mjWpEDPTxgZUavDUZUvss83F0J0Ka8=
-----END PUBLIC KEY-----
`;

function getPublicKeyPem() {
  const fromEnv = process.env.RETAILER_LICENSE_PUBKEY;
  if (fromEnv && fromEnv.trim()) {
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
