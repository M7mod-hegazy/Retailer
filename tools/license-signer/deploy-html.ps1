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

$htmlSource = "D:\code\retailer\tools\license-signer\signer-gui\standalone.html"

Write-Host "Copying standalone HTML (small file) to phone..."
$stFolder.CopyHere($htmlSource, 16)
Start-Sleep -Seconds 5

Write-Host "Verifying..."
foreach ($it in $stFolder.Items()) {
  if ($it.Name -like "*standalone*" -or $it.Name -like "*html*" -or $it.Name -like "*Signer*") {
    Write-Host "  $($it.Name)"
  }
}
