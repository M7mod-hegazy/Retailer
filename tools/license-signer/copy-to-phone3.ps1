$phoneName = "Medo's A56"

$shell = New-Object -ComObject Shell.Application
$myComputer = $shell.NameSpace("shell:MyComputerFolder")

$phone = $null
foreach ($item in $myComputer.Items()) {
  if ($item.Name -eq $phoneName) {
    $phone = $item
    break
  }
}
if (-not $phone) { Write-Host "Phone not found"; exit 1 }

# Navigate into phone
$phoneNs = $shell.NameSpace($phone.Path)
$storage = $null
foreach ($item in $phoneNs.Items()) {
  if ($item.Name -eq "Internal storage") {
    $storage = $item
    break
  }
}
if (-not $storage) { Write-Host "Internal storage not found"; exit 1 }
Write-Host "Found Internal storage"

# Navigate into Internal storage
$storagePath = $storage.Path
Write-Host "Storage path: $storagePath"
$storageNs = $shell.NameSpace($storagePath)
Write-Host "Storage namespace title: $($storageNs.Title)"

# List top-level folders
Write-Host "`nInternal storage folders (first 50):"
$count = 0
foreach ($item in $storageNs.Items()) {
  if ($count -ge 50) { break }
  Write-Host "  $($item.Name)"
  $count++
}

# Look for win 7
$win7 = $null
foreach ($item in $storageNs.Items()) {
  if ($item.Name -eq "win 7") {
    $win7 = $item
    break
  }
}

if ($win7) {
  Write-Host "`nFound 'win 7' folder!"
  # List win 7 contents
  $win7Ns = $shell.NameSpace($win7.Path)
  Write-Host "win 7 contents:"
  foreach ($item in $win7Ns.Items()) {
    Write-Host "  $($item.Name)"
  }
} else {
  Write-Host "`n'win 7' folder not found on phone"
  Write-Host "Creating 'win 7' folder by using a workaround..."
  
  # MTP doesn't support direct folder creation. Copy a file to force folder creation.
  # Actually we can use the Shell to create a folder in MTP by using the verbs
  $folder = $storageNs.Self
  Write-Host "Need to create 'win 7' manually. Opening Explorer at that location..."
  $shell.Open($storagePath)
}

$exeSource = "D:\code\retailer\tools\license-signer\dist\ElHegazi License Signer-1.0.0-portable.exe"
Write-Host "`nPortable exe size: $([math]::Round((Get-Item $exeSource).Length/1MB, 1)) MB"
Write-Host "Path: $exeSource"

Write-Host "`n=== NEXT STEPS ==="
Write-Host "1. In the Explorer window that opened, create 'win 7' folder if needed"
Write-Host "2. Inside 'win 7', create 'license-signer' folder"
Write-Host "3. Copy this .exe from your D: drive into it:"
Write-Host "   D:\code\retailer\tools\license-signer\dist\ElHegazi License Signer-1.0.0-portable.exe"
