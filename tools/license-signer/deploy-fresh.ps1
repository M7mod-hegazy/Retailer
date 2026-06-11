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

# Copy fresh portable exe to root
$exeSource = "D:\code\retailer\tools\license-signer\dist\ElHegazi License Signer-1.0.0-portable.exe"
Write-Host "Copying rebuilt portable exe (68MB) to phone root..."
$stFolder.CopyHere($exeSource, 16)

Write-Host "Waiting 30 seconds for transfer..."
Start-Sleep -Seconds 30

# Verify
Write-Host "Files on phone root:"
foreach ($it in $stFolder.Items()) {
  if ($it.Name -like "*Signer*" -or $it.Name -like "*Setup*" -or $it.Name -like "*LAUNCH*" -or $it.Name -like "*standalone*") {
    Write-Host "  $($it.Name)"
  }
}
