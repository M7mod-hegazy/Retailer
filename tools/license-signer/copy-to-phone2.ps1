$phoneName = "Medo's A56"

$shell = New-Object -ComObject Shell.Application
$myComputer = $shell.NameSpace("shell:MyComputerFolder")

# Enumerate all items to find the phone
$phone = $null
foreach ($item in $myComputer.Items()) {
  Write-Host "Found item: $($item.Name)"
  if ($item.Name -eq $phoneName) {
    $phone = $item
  }
}

if (-not $phone) {
  Write-Host "Phone not found"
  exit 1
}

Write-Host "`nPhone path: $($phone.Path)"

# Try opening the phone's namespace
try {
  $phoneNs = $shell.NameSpace($phone.Path)
  Write-Host "Phone namespace opened: $($phoneNs.Title)"
  
  # List all items in phone root
  Write-Host "`nPhone contents:"
  foreach ($item in $phoneNs.Items()) {
    $kind = 'FILE'; if ($item.IsFolder) { $kind = 'DIR' }
    Write-Host "  [$kind] $($item.Name)"
  }
} catch {
  Write-Host "Error: $_"
}

# The target exe
$exeSource = "D:\code\retailer\tools\license-signer\dist\ElHegazi License Signer-1.0.0-portable.exe"
$fileSize = (Get-Item $exeSource).Length
Write-Host "`nPortable exe size: $([math]::Round($fileSize/1MB, 1)) MB"
Write-Host "Source: $exeSource"

Write-Host "`n=== MANUAL INSTRUCTIONS ==="
Write-Host "1. Open This PC in File Explorer"
Write-Host "2. Open Medo's A56 → Internal storage → win 7"
Write-Host "3. Create a folder named 'license-signer' if it doesn't exist"
Write-Host "4. Copy this file into it:"
Write-Host "   $exeSource"
Write-Host "5. On the Windows 7 machine, double-click the .exe to run"
