$shell = New-Object -ComObject Shell.Application
$myComp = $shell.NameSpace("shell:MyComputerFolder")

$phone = $null
foreach ($item in $myComp.Items()) {
  if ($item.Name -eq "Medo's A56") { $phone = $item; break }
}
$phNs = $shell.NameSpace($phone.Path)

$storage = $null
foreach ($item in $phNs.Items()) {
  if ($item.Name -eq "Internal storage") { $storage = $item; break }
}
$stFolder = $storage.GetFolder

# 1) Copy fresh portable exe
$exeSource = "D:\code\retailer\tools\license-signer\dist\ElHegazi License Signer-1.0.0-portable.exe"
Write-Host "Step 1/2: Copying portable exe (68MB)..."
$stFolder.CopyHere($exeSource, 16)
Start-Sleep -Seconds 40

# 2) Create LAUNCH.bat using temp file
$batContent = "@echo off`r`ntitle ElHegazi License Signer`r`ncopy `"%~dp0ElHegazi License Signer-1.0.0-portable.exe`" `"%TEMP%\license-signer.exe`" /y >nul`r`nstart `"`" `"%TEMP%\license-signer.exe`"`r`n"
$tempBat = "$env:TEMP\LAUNCH.bat"
[System.IO.File]::WriteAllText($tempBat, $batContent)
Write-Host "Step 2/2: Copying LAUNCH.bat..."
$stFolder.CopyHere($tempBat, 16)
Start-Sleep -Seconds 5

# Verify
Write-Host "`nPhone Internal storage root:"
$count = 0
foreach ($it in $stFolder.Items()) {
  if ($it.Name -like "*Signer*" -or $it.Name -like "*LAUNCH*" -or $it.Name -like "*Setup*" -or $it.Name -like "*standalone*") {
    Write-Host "  $($it.Name)"
    $count++
  }
}
if ($count -eq 0) {
  Write-Host "  (no matching files found - copy may have failed)"
  exit 1
}
Write-Host "`nDONE. On target PC:"
Write-Host "1. Open Internal storage"
Write-Host "2. Double-click LAUNCH.bat"
Write-Host "   (it copies the app to PC temp and runs it)"
