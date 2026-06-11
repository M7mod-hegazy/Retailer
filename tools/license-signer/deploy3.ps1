$shell = New-Object -ComObject Shell.Application
$myComp = $shell.NameSpace("shell:MyComputerFolder")

$phone = $null
foreach ($item in $myComp.Items()) {
  Write-Host "Item: $($item.Name)"
  if ($item.Name -eq "Medo's A56") { $phone = $item }
}

if (-not $phone) { Write-Host "Phone not found!"; exit 1 }
Write-Host "`nPhone found. Path: $($phone.Path)"

$phNs = $shell.NameSpace($phone.Path)
Write-Host "Phone Namespace: $($phNs.Title)"
Write-Host "Phone Self: $($phNs.Self.Path)"

$storage = $null
foreach ($item in $phNs.Items()) {
  Write-Host "  Phone item: $($item.Name)"
  if ($item.Name -eq "Internal storage") { $storage = $item }
}

if (-not $storage) { Write-Host "Internal storage not found!"; exit 1 }
Write-Host "`nInternal storage item found. Path: $($storage.Path)"

# Try GetFolder
$stFolder = $null
try { $stFolder = $storage.GetFolder } catch { Write-Host "GetFolder error: $_" }
Write-Host "GetFolder result: $stFolder"

if ($stFolder) {
  $exePath = "D:\code\retailer\tools\license-signer\dist\ElHegazi License Signer-1.0.0-portable.exe"
  Write-Host "Copying file..."
  $stFolder.CopyHere($exePath, 16)
  Write-Host "Copy initiated!"
} else {
  Write-Host "`nGetFolder failed. Opening Explorer so you can copy manually..."
  $shell.Open($storage.Path)
  
  # Also copy to Desktop as a convenience
  $desktop = [Environment]::GetFolderPath("Desktop")
  Copy-Item "D:\code\retailer\tools\license-signer\dist\ElHegazi License Signer-1.0.0-portable.exe" "$desktop\ElHegazi License Signer.exe" -Force
  Write-Host "`nFile also copied to your Desktop for easy drag-drop!"
}
