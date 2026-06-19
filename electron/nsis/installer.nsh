; ── customInit ─────────────────────────────────────────────────────────────
; Kills any running instance BEFORE NSIS checks — prevents "close app" dialog.
; On silent (auto-update) mode also hides the installer window.
!macro customInit
  ExecWait 'taskkill /F /IM "ElHegazi-Retailer.exe" /T'
  Sleep 600
  IfSilent +1 +2
  HideWindow
!macroend

; ── customInstall ───────────────────────────────────────────────────────────
; Step progress labels + writes the first-run flag so Electron shows the
; welcome wizard on next launch.
!macro customInstall
  DetailPrint ""
  DetailPrint "[ 1 / 2 ]  جاري إزالة الملفات القديمة..."
  DetailPrint "[ 2 / 2 ]  جاري تثبيت الملفات الجديدة..."
  DetailPrint ""
  ; Write first-run flag to userData so Electron shows the welcome wizard
  CreateDirectory "$APPDATA\ElHegazi Retailer"
  FileOpen $0 "$APPDATA\ElHegazi Retailer\first-run.flag" w
  FileWrite $0 "1"
  FileClose $0
  ; Write update-complete sentinel LAST (all files are now in place). The
  ; detached relaunch helper spawned by the app before quitAndInstall polls
  ; for this file, then relaunches the exe and deletes the flag. Lets the app
  ; auto-reopen on Win7 where the NSIS "run after finish" checkbox is disabled.
  FileOpen $0 "$APPDATA\ElHegazi Retailer\update-complete.flag" w
  FileWrite $0 "${VERSION}"
  FileClose $0
!macroend

; ── customUnInstall ─────────────────────────────────────────────────────────
; Warns about data before uninstalling.
!macro customUnInstall
  MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION \
    "تحذير: تأكد من تصدير نسخة احتياطية من بياناتك قبل الإلغاء.$\n$\nالإعدادات ← النسخ الاحتياطي$\n$\nهل تريد المتابعة؟" \
    IDOK +2
  Abort
!macroend
