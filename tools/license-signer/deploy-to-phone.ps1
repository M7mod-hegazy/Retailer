$shell = New-Object -ComObject Shell.Application
$myComputer = $shell.NameSpace("shell:MyComputerFolder")

# Find phone
$phone = $null
foreach ($item in $myComputer.Items()) {
  if ($item.Name -eq "Medo's A56") { $phone = $item; break }
}
if (-not $phone) { Write-Host "Phone not found"; exit 1 }

$phoneNs = $shell.NameSpace($phone.Path)

# Find Internal storage
$storage = $null
foreach ($item in $phoneNs.Items()) {
  if ($item.Name -eq "Internal storage") { $storage = $item; break }
}
if (-not $storage) { Write-Host "Internal storage not found"; exit 1 }

$storagePath = $storage.Path
Write-Host "Storage path: $storagePath"

# The exe to copy
$exeSource = "D:\code\retailer\tools\license-signer\dist\ElHegazi License Signer-1.0.0-portable.exe"

# Try to directly use CopyHere on the storage namespace
try {
  $storageNs = $shell.NameSpace($storagePath)
  Write-Host "Copying to phone's Internal storage..."
  # 16 = silent, no progress dialog
  $storageNs.CopyHere($exeSource, 16)
  Write-Host "Copy initiated! File should appear in Internal storage root."
  Write-Host "Wait 10 seconds then check your phone."
} catch {
  Write-Host "Error: $_"
}
