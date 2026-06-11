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

# Delete old portable file from phone if it exists
foreach ($it in $stFolder.Items()) {
  if ($it.Name -like "*License Signer*portable*") {
    Write-Host "Deleting old portable exe from phone root..."
    $it.InvokeVerb("delete")
    Start-Sleep -Seconds 2
  }
}

# Copy installer to phone root (simpler location)
Write-Host "Copying installer to Internal storage root..."
$installer = "D:\code\retailer\tools\license-signer\dist\ElHegazi License Signer-1.0.0-Setup.exe"
$stFolder.CopyHere($installer, 16)
Write-Host "Copy initiated! Waiting 20 seconds for transfer..."
Start-Sleep -Seconds 20

Write-Host "`nVerifying files on phone (root of Internal storage):"
$count = 0
foreach ($it in $stFolder.Items()) {
  if ($it.Name -like "*License*" -or $it.Name -like "*Setup*" -or $it.Name -like "*Signer*") {
    Write-Host "  $($it.Name)"
    $count++
  }
}
if ($count -eq 0) {
  Write-Host "  (no matching files found - transfer may have failed)"
} else {
  Write-Host "`n$count file(s) found!"
}
