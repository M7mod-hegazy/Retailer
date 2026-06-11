# License Signer (standalone seller tool)

Offline Ed25519 license signing for ElHegazi Retailer. **Never ships to customers.**

Now fully **self-contained** — copy the built `.exe` to a USB stick and run on any Windows PC with no dependencies.

## Quick start (USB stick)

1. Download or build `ElHegazi License Signer-1.0.0-portable.exe`
2. Copy the `.exe` to your USB stick
3. Double-click it — runs immediately, no install needed
4. On first run, generate a keypair (Tools → Generate keypair)
5. **Back up `%USERPROFILE%\.retailer-keys\`** — losing your private key invalidates all licenses

## Building the portable .exe

Requires Node.js on any PC:

```
cd tools/license-signer
npm install
npm run build:portable
```

Output: `dist\ElHegazi License Signer-1.0.0-portable.exe` (~150 MB with Electron)

Or double-click `BUILD_PORTABLE.bat`.

## Running from source (no build)

```
cd tools/license-signer
npm install
npm start              # GUI
node keygen.js         # one-time keypair
node sign-license.js <machine-code> --name "Shop"   # CLI
```

Or double-click `Sign-License-GUI.bat`.

## One-time setup (keypair)

```bash
node keygen.js
```

- Writes your **private key** to `%USERPROFILE%\.retailer-keys\license-private.pem` (keep secret, back it up)
- Writes the matching **public key** into `shared/publicKey.js`

## Sign a license

CLI:
```bash
node sign-license.js <machine-code> --name "Ahmed Market"                              # perpetual
node sign-license.js <machine-code> --name "Ahmed Market" --expires 2027-01-01          # subscription
node sign-license.js <machine-code> --name "Trial" --features trial --expires 2026-07-01  # trial
```

GUI: `npm start` or double-click `Sign-License-GUI.bat`

Both write `out/<shop>/license.key` (+ a QR) and append to `registry.json`.

## Delivering to the customer

| Method | How |
|---|---|
| **license.key** | Copy the file — easiest for offline PCs |
| **license.png** | QR image — scan or transfer |
| **Activation code** | ~170 char `RTL2` code — dashes/spaces ignored on import |

## Files

| File | Role |
|---|---|
| `signEngine.js` | shared signing engine (CLI + GUI) |
| `shared/signLicense.js` | Ed25519 signing (vendored from main project) |
| `shared/tokenCodec.js` | token encode/decode (vendored) |
| `shared/publicKey.js` | embedded public key (overwritten by keygen) |
| `signer-gui/` | Electron desktop GUI |
| `keygen.js` | one-time keypair generation |
| `sign-license.js` | CLI front-end |
| `registry.json` | issued-licenses log (gitignored) |
| `out/` | generated licenses / QR (gitignored) |
| `package.json` | standalone app manifest |
| `BUILD_PORTABLE.bat` | one-click portable `.exe` build |
