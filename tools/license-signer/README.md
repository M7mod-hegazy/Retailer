# License Signer (seller-only tool)

Offline Ed25519 license signing for ElHegazi Retailer. **Never ships to customers.**

## One-time setup

```bash
node tools/license-signer/keygen.js
```

- Writes your **private key** to `~/.retailer-keys/license-private.pem` (keep it secret, back it up).
- Embeds the matching **public key** into `shared/licensing/publicKey.js`.
- Rebuild the app afterwards so it ships with the public key.

## Sign a license (per sale)

CLI:

```bash
node tools/license-signer/sign-license.js <machine-code> --name "Ahmed Market"
# subscription:
node tools/license-signer/sign-license.js <machine-code> --name "Ahmed Market" --expires 2027-01-01
# trial:
node tools/license-signer/sign-license.js <machine-code> --name "Trial" --features trial --expires 2026-07-01
```

GUI:

```bash
npm run sign:gui
```

Both write `out/<shop>/license.key` (+ a QR) and append to `registry.json`.

**Delivering to the customer (especially offline PCs):**

1. **USB / file** — send `license.key`; the customer picks it on the activation screen. Easiest.
2. **QR image** — send `license.png`; scan or transfer the image.
3. **Paste code** — shorter `RTL2` activation code (~170 chars). Dashes/spaces are ignored.

Old `RTL1` licenses still work if you issued them before the compact format.

## Files

| File | Role |
|---|---|
| `signEngine.js` | shared signing engine (CLI + GUI both call it) |
| `keygen.js` | one-time keypair generation |
| `sign-license.js` | CLI front-end |
| `signer-gui/` | desktop GUI front-end |
| `registry.json` | issued-licenses log (gitignored) |
| `out/` | generated `license.key` / QR (gitignored) |

The private key never lives in the repo. `registry.json`, `out/`, and any `*.pem`
are gitignored.
