Start-Sleep -Seconds 10

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
foreach ($it in $stFolder.Items()) {
  if ($it.Name -eq "win 7") {
    $win7 = $it; break
  }
}

$win7Folder = $win7.GetFolder
foreach ($it in $win7Folder.Items()) {
  if ($it.Name -eq "license-signer") {
    $ls = $it; break
  }
}

$lsFolder = $ls.GetFolder
Write-Host "Contents of Internal storage/win 7/license-signer/:"
$count = 0
foreach ($it in $lsFolder.Items()) {
  Write-Host "  $($it.Name)  (modified: $($it.ModifyDate))"
  $count++
}

if ($count -eq 0) {
  Write-Host "  (empty - copy may still be in progress or failed)"
}

Write-Host "`nTotal items: $count"
