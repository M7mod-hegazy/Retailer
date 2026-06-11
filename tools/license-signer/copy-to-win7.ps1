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
$items = $stFolder.Items()

# Find win 7 folder
$win7 = $null
foreach ($it in $items) {
  if ($it.Name -eq "win 7") { $win7 = $it; break }
}

if (-not $win7) {
  Write-Host "win 7 folder not found!"
  exit 1
}

Write-Host "Found 'win 7' folder"
$win7Folder = $win7.GetFolder
$win7Items = $win7Folder.Items()

Write-Host "win 7 contents:"
foreach ($it in $win7Items) {
  Write-Host "  $($it.Name)"
}

# Find or create license-signer inside win 7
$ls = $null
foreach ($it in $win7Items) {
  if ($it.Name -eq "license-signer") { $ls = $it; break }
}

if ($ls) {
  Write-Host "Found 'license-signer' folder inside win 7"
  $lsFolder = $ls.GetFolder
  $exeSource = "D:\code\retailer\tools\license-signer\dist\ElHegazi License Signer-1.0.0-portable.exe"
  Write-Host "Copying .exe to Internal storage/win 7/license-signer/ ..."
  $lsFolder.CopyHere($exeSource, 16)
  Write-Host "Copy initiated!"
} else {
  Write-Host "'license-signer' folder not found inside win 7"
  Write-Host "Copying .exe directly to win 7 folder instead..."
  $exeSource = "D:\code\retailer\tools\license-signer\dist\ElHegazi License Signer-1.0.0-portable.exe"
  $win7Folder.CopyHere($exeSource, 16)
  Write-Host "Copy initiated!"
}

Write-Host "`nWaiting 10 seconds for transfer..."
Start-Sleep -Seconds 10
Write-Host "Done. Check your phone in Internal storage/win 7/"
