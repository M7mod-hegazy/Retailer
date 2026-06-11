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

# Delete old LAUNCH
foreach ($it in $stFolder.Items()) {
  if ($it.Name -eq "LAUNCH") { $it.InvokeVerb("delete"); Start-Sleep -Seconds 2; break }
}

# Copy new LAUNCH.bat
$batSource = "D:\code\retailer\tools\license-signer\LAUNCH.bat"
$stFolder.CopyHere($batSource, 16)
Start-Sleep -Seconds 5

Write-Host "Deployed LAUNCH.bat"
Write-Host "Files on phone root:"
foreach ($it in $stFolder.Items()) {
  if ($it.Name -like "*LAUNCH*" -or $it.Name -like "*portable*") {
    Write-Host "  $($it.Name)"
  }
}
