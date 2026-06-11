$f = Get-ChildItem "D:\code\retailer\tools\license-signer\dist\win-unpacked" -Recurse
$cnt = $f.Count
$s = ($f | Measure-Object -Property Length -Sum).Sum
Write-Host ("Files: " + $cnt + "  Size: " + [math]::Round($s/1MB, 1) + " MB")
