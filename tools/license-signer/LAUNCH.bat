@echo off
title ElHegazi License Signer — MTP Launcher
powershell -ExecutionPolicy Bypass -Command ^
$shell = New-Object -ComObject Shell.Application; ^
$phone = ($shell.NameSpace('shell:MyComputerFolder').Items() | Where-Object { $_.Name -eq \"Medo's A56\" }); ^
if (-not $phone) { Write-Host 'Phone not found.'; pause; exit 1 }; ^
$storage = ($shell.NameSpace($phone.Path).Items() | Where-Object { $_.Name -eq 'Internal storage' }); ^
if (-not $storage) { Write-Host 'Internal storage not found.'; pause; exit 1 }; ^
$stFolder = $storage.GetFolder(); ^
$exe = ($stFolder.Items() | Where-Object { $_.Name -like '*portable*' }); ^
if (-not $exe) { Write-Host 'Portable exe not found on phone.'; pause; exit 1 }; ^
Write-Host ('Found: ' + $exe.Path); ^
Write-Host 'Copying to temp...'; ^
Copy-Item $exe.Path ($env:TEMP + '\license-signer.exe') -Force; ^
Write-Host 'Copied. Launching...'; ^
Start-Process ($env:TEMP + '\license-signer.exe')
