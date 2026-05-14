# ElHegazi Retailer

## Quickstart

1. Install dependencies:
   `npm install`
2. Start the full desktop development stack:
   `npm run dev`
3. Run backend tests:
   `npm test --prefix server`
4. Build the frontend:
   `npm run build --prefix client`
5. Build the Windows package:
   `npm run dist`

## Notes

- The system is Arabic-first and files should stay UTF-8 encoded.
- Backups are written under `backups/<year>/<month>/<day>/` unless a custom path is configured in settings.
- Production packaging targets Windows through Electron Builder.

## Windows Managed Protection Mode

- Set `APP_PROTECTION_MODE=windows_managed` to disable license activation flow while keeping license code dormant.
- Optional owner maintenance gate in Electron IPC: `OWNER_MAINTENANCE_PASSWORD` (defaults to `275757` if not set).
- In this mode, access enforcement is expected to be handled by Windows accounts + ACL policy.
- Recommended hardening scripts:
  - `electron/scripts/configure-local-users.ps1`
  - `electron/scripts/harden-windows-policy.ps1`

Example:

```powershell
powershell -ExecutionPolicy Bypass -File .\electron\scripts\configure-local-users.ps1 `
  -OwnerUser "m7mod" `
  -OwnerPassword "275757" `
  -OperatorUsers @("cashier1","cashier2")

powershell -ExecutionPolicy Bypass -File .\electron\scripts\harden-windows-policy.ps1 `
  -InstallPath "C:\Program Files\ElHegazi Retailer" `
  -DataPath "C:\ProgramData\ElHegaziRetailer\data" `
  -OwnerUser "m7mod" `
  -OperatorUsers @("cashier1","cashier2")
```
