param(
  [Parameter(Mandatory = $true)]
  [string]$InstallPath,

  [Parameter(Mandatory = $true)]
  [string]$DataPath,

  [Parameter(Mandatory = $true)]
  [string]$OwnerUser,

  [string[]]$OperatorUsers = @()
)

$ErrorActionPreference = "Stop"

function Grant-OwnerAndSystemAcl {
  param([string]$PathToSecure)
  if (-not (Test-Path -LiteralPath $PathToSecure)) {
    New-Item -ItemType Directory -Path $PathToSecure -Force | Out-Null
  }

  icacls $PathToSecure /inheritance:r | Out-Null
  icacls $PathToSecure /grant:r "SYSTEM:(OI)(CI)(F)" "Administrators:(OI)(CI)(F)" "$OwnerUser:(OI)(CI)(F)" | Out-Null
}

function Grant-OperatorRunOnlyOnInstallPath {
  param([string]$PathToSecure)
  foreach ($user in $OperatorUsers) {
    if ([string]::IsNullOrWhiteSpace($user)) { continue }
    # RX only on binaries, no delete/modify.
    icacls $PathToSecure /grant:r "$user:(OI)(CI)(RX)" | Out-Null
  }
}

function Grant-OperatorDataAccess {
  param([string]$PathToSecure)
  foreach ($user in $OperatorUsers) {
    if ([string]::IsNullOrWhiteSpace($user)) { continue }
    # Operators can run app data transactions but cannot modify install binaries.
    icacls $PathToSecure /grant:r "$user:(OI)(CI)(M)" | Out-Null
  }
}

Write-Host "Applying Windows hardening policy..." -ForegroundColor Cyan
Write-Host "Install path: $InstallPath"
Write-Host "Data path:    $DataPath"
Write-Host "Owner user:   $OwnerUser"
Write-Host "Operators:    $($OperatorUsers -join ', ')"

Grant-OwnerAndSystemAcl -PathToSecure $InstallPath
Grant-OperatorRunOnlyOnInstallPath -PathToSecure $InstallPath

Grant-OwnerAndSystemAcl -PathToSecure $DataPath
Grant-OperatorDataAccess -PathToSecure $DataPath

Write-Host "Hardening policy applied successfully." -ForegroundColor Green
Write-Host "Note: uninstall/update should be performed by $OwnerUser or local Administrators only."

