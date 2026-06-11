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

# Find win 7/license-signer
$win7 = $null
foreach ($it in $stFolder.Items()) {
  if ($it.Name -eq "win 7") { $win7 = $it; break }
}
$win7Folder = $win7.GetFolder

$ls = $null
foreach ($it in $win7Folder.Items()) {
  if ($it.Name -eq "license-signer") { $ls = $it; break }
}
$lsFolder = $ls.GetFolder

# Copy LAUNCH.bat (tiny file, fast)
$batSource = "D:\code\retailer\tools\license-signer\LAUNCH.bat"
Write-Host "Copying LAUNCH.bat to phone..."
$lsFolder.CopyHere($batSource, 16)
Start-Sleep -Seconds 3

# Copy portable exe to root of Internal storage too (for easy access)
$exeSource = "D:\code\retailer\tools\license-signer\dist\ElHegazi License Signer-1.0.0-portable.exe"
Write-Host "Copying portable exe to phone root..."
$stFolder.CopyHere($exeSource, 16)
Start-Sleep -Seconds 3

# Verify
Write-Host "`nContents of win 7/license-signer/:"
foreach ($it in $lsFolder.Items()) {
  Write-Host "  $($it.Name)"
}
Write-Host "`nContents of Internal storage root (filtered):"
foreach ($it in $stFolder.Items()) {
  if ($it.Name -like "*Signer*" -or $it.Name -like "*Setup*" -or $it.Name -like "*LAUNCH*" -or $it.Name -like "*standalone*") {
    Write-Host "  $($it.Name)"
  }
}
