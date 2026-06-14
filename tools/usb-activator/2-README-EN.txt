═══════════════════════════════════════════════════════════════
   ElHegazi Retailer — Offline License Activation Tool
   Windows only. No internet. No install. No dependencies.
═══════════════════════════════════════════════════════════════


■ Files on this USB stick:
   1. activator.exe          ← The activation program
   2. license-private.pem    ← Your SECRET private key (never share it)
   3. 1-README-AR.txt        ← Arabic instructions
   4. 2-README-EN.txt        ← This file (English)

═══════════════════════════════════════════════════════════════
■ Step-by-step usage:
═══════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────┐
│ STEP 1: Open the retailer app on the customer's PC          │
│                                                             │
│   - Launch ElHegazi Retailer                                │
│   - The activation screen ("Activation Required") appears   │
│   - You will see a MACHINE CODE like:                      │
│       7F3A-9C21-BE65-DE21-8A11-...                         │
│                                                             │
│   ⚠  COPY the Machine Code — you'll need it next 👇       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ STEP 2: Run the activator from the USB stick                │
│                                                             │
│   - Insert the USB stick into the customer's PC             │
│   - Open the "usb-activator" folder                         │
│   - Double-click activator.exe                             │
│                                                             │
│   ⚠  If Windows Defender shows a warning:                   │
│       Click "More info" → "Run anyway"                      │
│       (It's safe — the .exe is a Node.js SEA build)         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ STEP 3: Enter the machine code                              │
│                                                             │
│   - Paste the Machine Code when prompted                    │
│   - Press Enter                                             │
│                                                             │
│   Example:                                                  │
│     Enter machine code: 7F3A-9C21-BE65-DE21-8A11-...      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ STEP 4: Enter the customer / shop name                      │
│                                                             │
│   - Type the customer or shop name (any language)           │
│   - Press Enter                                             │
│                                                             │
│   Example:                                                  │
│     Customer/shop name: Ahmed's Electronics                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ STEP 5: Choose license type                                 │
│                                                             │
│   - Type "full" for perpetual license (never expires)       │
│   - Type "trial" for time-limited license                   │
│   - Leave empty and press Enter for default (full)          │
│                                                             │
│   Example:                                                  │
│     Features (full/trial) [full]: full                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ STEP 6: (Optional) Set expiration date                      │
│                                                             │
│   - If you chose "trial", enter an expiry date as:          │
│       YYYY-MM-DD                                            │
│     Example: 2025-12-31                                     │
│                                                             │
│   - If you chose "full", leave empty and press Enter        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ STEP 7: Copy the activation code                            │
│                                                             │
│   - The tool displays the ACTIVATION CODE prominently       │
│   - It starts with RTL2.XXXXX XXXXX XXXXX...               │
│   - Select it with your mouse → Ctrl+C (copy)               │
│                                                             │
│   ⚠  The code is ALSO saved to a file:                      │
│       licenses\[name]-license.key                           │
│       Open it in Notepad and copy the contents              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ STEP 8: Paste the code into the app                         │
│                                                             │
│   - Go back to the activation screen in the retailer app    │
│   - Paste the code into the input box (Ctrl+V)              │
│   - Click "Activate"                                        │
│                                                             │
│   ✅ Done! License activated successfully.                  │
└─────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════
■ Troubleshooting:
═══════════════════════════════════════════════════════════════

Problem: "Invalid license" error in the app
    Fix:
    - Make sure you copied the ENTIRE activation code
      (it must start with RTL2.)
    - Make sure there are no extra spaces before or after
    - Try opening the .key file from licenses\ folder in
      Notepad and copying the content directly
    - If it still fails, the private key is outdated —
      contact the developer

Problem: Double-clicking activator.exe does nothing
    Fix:
    - Right-click → "Run as administrator"
    - Or open CMD in the folder and type: activator.exe

Problem: "Private key not found"
    Fix:
    - Make sure license-private.pem is in the SAME folder
      as activator.exe


═══════════════════════════════════════════════════════════════
★  For developers:  To rebuild activator.exe from source:
   Open CMD in tools\offline-activator\ and run:
        npm run build
═══════════════════════════════════════════════════════════════
