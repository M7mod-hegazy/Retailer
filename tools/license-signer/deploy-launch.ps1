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

# Delete old LAUNCH from root if exists
foreach ($it in $stFolder.Items()) {
  if ($it.Name -eq "LAUNCH") {
    Write-Host "Deleting old LAUNCH at root..."
    $it.InvokeVerb("delete")
    Start-Sleep -Seconds 2
    break
  }
}

# Also delete from win 7/license-signer
$win7 = $null
foreach ($it in $stFolder.Items()) {
  if ($it.Name -eq "win 7") { $win7 = $it; break }
}
if ($win7) {
  $win7Folder = $win7.GetFolder
  foreach ($it in $win7Folder.Items()) {
    if ($it.Name -eq "license-signer") { $ls = $it; break }
  }
  if ($ls) {
    $lsFolder = $ls.GetFolder
    foreach ($it in $lsFolder.Items()) {
      if ($it.Name -eq "LAUNCH") {
        Write-Host "Deleting old LAUNCH from win 7/license-signer..."
        $it.InvokeVerb("delete")
        Start-Sleep -Seconds 2
        break
      }
    }
  }
}

# Copy new LAUNCH.bat to phone root
$batSource = "D:\code\retailer\tools\license-signer\LAUNCH.bat"
Write-Host "Copying new LAUNCH.bat to phone root..."
$stFolder.CopyHere($batSource, 16)
Start-Sleep -Seconds 5

Write-Host "`nPhone Internal storage root (matching files):"
foreach ($it in $stFolder.Items()) {
  if ($it.Name -like "*LAUNCH*" -or $it.Name -like "*portable*" -or $it.Name -like "*Setup*") {
    Write-Host "  $($it.Name)"
  }
}
Write-Host "`nDONE"
