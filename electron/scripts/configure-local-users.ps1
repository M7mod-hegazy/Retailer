param(
  [Parameter(Mandatory = $true)]
  [string]$OwnerUser,

  [Parameter(Mandatory = $true)]
  [string]$OwnerPassword,

  [string[]]$OperatorUsers = @(),

  [string]$OperatorDefaultPassword = "ChangeMe-123!"
)

$ErrorActionPreference = "Stop"

function Ensure-LocalUser {
  param(
    [string]$UserName,
    [string]$Password,
    [bool]$IsAdmin
  )

  $securePassword = ConvertTo-SecureString $Password -AsPlainText -Force
  $existing = Get-LocalUser -Name $UserName -ErrorAction SilentlyContinue

  if (-not $existing) {
    New-LocalUser -Name $UserName -Password $securePassword -FullName $UserName -PasswordNeverExpires:$true | Out-Null
    Write-Host "Created local user: $UserName"
  } else {
    Set-LocalUser -Name $UserName -Password $securePassword
    Write-Host "Updated password for local user: $UserName"
  }

  if ($IsAdmin) {
    Add-LocalGroupMember -Group "Administrators" -Member $UserName -ErrorAction SilentlyContinue
    Write-Host "Ensured admin membership for: $UserName"
  } else {
    Remove-LocalGroupMember -Group "Administrators" -Member $UserName -ErrorAction SilentlyContinue
    Write-Host "Ensured standard-user role for: $UserName"
  }
}

Write-Host "Configuring local users..." -ForegroundColor Cyan

Ensure-LocalUser -UserName $OwnerUser -Password $OwnerPassword -IsAdmin $true

foreach ($operator in $OperatorUsers) {
  if ([string]::IsNullOrWhiteSpace($operator)) { continue }
  Ensure-LocalUser -UserName $operator -Password $OperatorDefaultPassword -IsAdmin $false
}

Write-Host "Local user configuration completed." -ForegroundColor Green

