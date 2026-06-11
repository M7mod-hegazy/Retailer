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

# Write LAUNCH.bat content as text (can't copy from local because MTP might strip extension)
# Instead, use a trick: create the content via PowerShell
$batContent = "@echo off`r`ntitle ElHegazi License Signer`r`ncd /d `"%~dp0`"`r`necho Copying app to local temp...`r`ncopy `"%~dp0ElHegazi License Signer-1.0.0-portable.exe`" `"%TEMP%\license-signer-portable.exe`" /y >nul`r`necho Launching...`r`nstart `"`" `"%TEMP%\license-signer-portable.exe`"`r`n"

Write-Host "Creating LAUNCH.bat on phone root..."
$tempFile = "$env:TEMP\LAUNCH.bat"
[System.IO.File]::WriteAllText($tempFile, $batContent)
$stFolder.CopyHere($tempFile, 16)
Start-Sleep -Seconds 3

# Also create one in win 7/license-signer/
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
$lsFolder.CopyHere($tempFile, 16)
Start-Sleep -Seconds 3

Write-Host "Done. LAUNCH.bat added to both locations."
Write-Host "On target PC: open phone, double-click LAUNCH.bat (in win 7/license-signer/ or root)"
