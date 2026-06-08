#!/usr/bin/env node
// CLI: sign a license for a customer's machine code.
//
//   node tools/license-signer/sign-license.js <machine-code> --name "Ahmed Market"
//   node tools/license-signer/sign-license.js <machine-code> --name "Shop" --expires 2027-01-01
//   node tools/license-signer/sign-license.js <machine-code> --name "Trial" --features trial --expires 2026-07-01
//
// Writes tools/license-signer/out/<shop>/license.key (+ license.png) and prints
// the pasteable blob. Send license.key (or the QR) back to the customer.

const { generate, keysExist } = require("./signEngine");

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i += 1;
      } else {
        args[key] = true;
      }
    } else {
      args._.push(a);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const fingerprint = args._[0];

  if (!fingerprint) {
    console.error('Usage: node sign-license.js <machine-code> --name "Shop" [--expires YYYY-MM-DD] [--features full|trial]');
    process.exit(1);
  }
  if (!keysExist()) {
    console.error('✖ No keypair found. Run "node tools/license-signer/keygen.js" first.');
    process.exit(1);
  }

  try {
    const result = await generate({
      fingerprint,
      name: args.name || "",
      expiresAt: args.expires || null,
      features: args.features || "full",
      licenseId: args.id || undefined,
    });

    const kind = result.payload.expiresAt
      ? `expires ${result.payload.expiresAt}`
      : "perpetual";

    console.log(`✔ Verified fingerprint`);
    console.log(`✔ Signed license  (id: ${result.licenseId}, ${kind}, features: ${result.payload.features})`);
    console.log(`✔ Wrote: ${result.keyPath}`);
    console.log(`✔ Wrote QR:  ${result.qrPath}`);
    const { formatActivationCode } = require("../../shared/licensing/tokenCodec");
    const code = result.activationCode || formatActivationCode(result.blob);
    console.log(`\nSend license.key (best) or license.png QR to the customer.`);
    console.log(`Activation code (${code.length} chars, paste fallback):\n${code}`);
  } catch (error) {
    console.error(`✖ ${error.message}`);
    process.exit(1);
  }
}

main();
