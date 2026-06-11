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

Write-Host "Copying installer to phone..."
$installer = "D:\code\retailer\tools\license-signer\dist\ElHegazi License Signer-1.0.0-Setup.exe"
$lsFolder.CopyHere($installer, 16)
Write-Host "Copy initiated!"
Start-Sleep -Seconds 10

Write-Host "Contents of phone license-signer folder:"
foreach ($it in $lsFolder.Items()) {
  Write-Host "  $($it.Name)"
}
