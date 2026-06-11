$srcExe = "D:\code\retailer\tools\license-signer\dist\ElHegazi License Signer-1.0.0-portable.exe"
$srcLaunch = "D:\code\retailer\tools\license-signer\LAUNCH.bat"
$srcBuild = "D:\code\retailer\tools\license-signer\BUILD_PORTABLE.bat"

$shell = New-Object -ComObject Shell.Application
$phone = $shell.NameSpace('shell:MyComputerFolder').Items() | Where-Object { $_.Name -eq "Medo's A56" }
$storage = $shell.NameSpace($phone.Path).Items() | Where-Object { $_.Name -eq 'Internal storage' }
$stFolder = $storage.GetFolder()
$win7 = $stFolder.Items() | Where-Object { $_.Name -eq 'win 7' }
$win7Folder = $win7.GetFolder()
$ls = $win7Folder.Items() | Where-Object { $_.Name -eq 'license-signer' }
$lsFolder = $ls.GetFolder()

Write-Host "Copying to: Medo's A56\Internal storage\win 7\license-signer\"
Write-Host ""

Write-Host "1. Copying portable exe (68MB)..."
$lsFolder.CopyHere($srcExe, 16)
Start-Sleep -Seconds 10
Write-Host "   Done."

Write-Host "2. Copying LAUNCH.bat..."
$lsFolder.CopyHere($srcLaunch, 16)
Start-Sleep -Seconds 3

Write-Host "3. Copying BUILD_PORTABLE.bat..."
$lsFolder.CopyHere($srcBuild, 16)
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "Verifying..."
$updated = @()
foreach ($i in $lsFolder.Items()) { $updated += $i.Name }
Write-Host ("Contents: " + ($updated -join ", "))
Write-Host ""
Write-Host "ALL DONE."
