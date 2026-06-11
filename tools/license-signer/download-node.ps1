$url = "https://nodejs.org/dist/v22.14.0/node-v22.14.0-win-x64.zip"
$zip = "$env:TEMP\node-portable.zip"
$outExe = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "win-node.exe"

Write-Host "  Downloading (~30MB)..."
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$wc = New-Object System.Net.WebClient
$wc.DownloadFile($url, $zip)

Write-Host "  Extracting..."
$extractDir = "$env:TEMP\node-extracted"
Expand-Archive -Path $zip -DestinationPath $extractDir -Force
Copy-Item "$extractDir\node-v22.14.0-win-x64\node.exe" $outExe -Force
Remove-Item $zip -Force
Remove-Item $extractDir -Recurse -Force
Write-Host "  Done!"
