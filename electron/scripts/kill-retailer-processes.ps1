$ErrorActionPreference = "SilentlyContinue"

try {
  $processes = Get-CimInstance Win32_Process |
    Where-Object {
      ($_.Name -eq "electron.exe" -and $_.ExecutablePath -like "*Retailer*") -or
      (
        $_.Name -eq "node.exe" -and
        $_.CommandLine -like "*electron\\cli.js*" -and
        $_.CommandLine -like "*Retailer*"
      )
    }

  foreach ($proc in $processes) {
    Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
  }
} catch {
}

exit 0
