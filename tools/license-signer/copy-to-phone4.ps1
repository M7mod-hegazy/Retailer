$shell = New-Object -ComObject Shell.Application
$myComputer = $shell.NameSpace("shell:MyComputerFolder")

# Find phone
$phone = $null
foreach ($item in $myComputer.Items()) {
  if ($item.Name -eq "Medo's A56") { $phone = $item; break }
}
if (-not $phone) { Write-Host "Phone not found"; exit 1 }

# Navigate to Internal storage  
$phoneNs = $shell.NameSpace($phone.Path)
$storage = $null
foreach ($item in $phoneNs.Items()) {
  if ($item.Name -eq "Internal storage") { $storage = $item; break }
}
if (-not $storage) { Write-Host "Internal storage not found"; exit 1 }

$sPath = $storage.Path
$exeSource = "D:\code\retailer\tools\license-signer\dist\ElHegazi License Signer-1.0.0-portable.exe"

Write-Host "Phone internal storage path:"
Write-Host "  $sPath"

# Try using the path syntax directly with CopyHere
# First, build the target path
$targetPath = $sPath + "\win 7"
Write-Host "`nTarget: $targetPath"

# Try to parse the target as a folder
try {
  $targetNs = $shell.NameSpace($targetPath)
  if ($targetNs) {
    Write-Host "Target namespace opened: $($targetNs.Title)"
    Write-Host "Copying file (64MB, this may take a moment)..."
    $targetNs.CopyHere($exeSource, 16)
    Write-Host "Copy initiated successfully!"
    Start-Sleep -Seconds 3
    Write-Host "Check your phone at This PC\Medo's A56\Internal storage\win 7\ for the .exe"
  }
} catch {
  Write-Host "Could not copy directly: $_"
  Write-Host ""
  Write-Host "Manual steps:"
  Write-Host "1. Open File Explorer → This PC → Medo's A56 → Internal storage"
  Write-Host "2. Create folder 'win 7' then inside it 'license-signer'"
  Write-Host "3. Copy this file there:"
  Write-Host "   $exeSource"
}
