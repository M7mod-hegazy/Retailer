#!/usr/bin/env node
// One-time setup: generate the seller's Ed25519 license keypair.
//
//   node tools/license-signer/keygen.js          # create keys (refuses if they exist)
//   node tools/license-signer/keygen.js --force   # regenerate (INVALIDATES all licenses)
//
// The PRIVATE key is written to ~/.retailer-keys (outside the repo). The PUBLIC
// key is embedded into shared/licensing/publicKey.js so the app can verify.

const { runKeygen, keysExist, PRIVATE_KEY_PATH } = require("./signEngine");

const force = process.argv.includes("--force");

try {
  if (keysExist() && !force) {
    console.error(`✖ Keys already exist at:\n    ${PRIVATE_KEY_PATH}`);
    console.error("  Re-running would invalidate every license already issued.");
    console.error("  Pass --force only if you really want to start over.");
    process.exit(1);
  }

  const { privateKeyPath, publicKeyPath } = runKeygen({ force });

  console.log("✔ License keypair generated.\n");
  console.log(`  Private key (KEEP SECRET, back this up): ${privateKeyPath}`);
  console.log(`  Public key  (copy in keys folder):       ${publicKeyPath}`);
  console.log("\n✔ Public key embedded into shared/licensing/publicKey.js");
  console.log("\nNext steps:");
  console.log("  1. Back up the private key to a safe place (encrypted USB, etc.).");
  console.log("  2. NEVER commit or share the private key.");
  console.log("  3. Rebuild the app so it ships with the new public key.");
} catch (error) {
  console.error(`✖ ${error.message}`);
  process.exit(1);
}
