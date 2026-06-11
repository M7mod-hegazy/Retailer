$shell = New-Object -ComObject Shell.Application

# Phone's internal storage path
$storagePath = "::{20D04FE0-3AEA-1069-A2D8-08002B30309D}\\\?\usb#vid_04e8&pid_6860&ms_comp_mtp&samsung_android#6&21b9f2bd&1&0000#{6ac27878-a6fa-4155-ba85-f98f491d4f33}\SID-{10001,,239052259328}"

$exeSource = "D:\code\retailer\tools\license-signer\dist\ElHegazi License Signer-1.0.0-portable.exe"

# Method 1: Open the window and copy via Windows Shell
Write-Host "Opening phone storage in Explorer..."
$shell.Open($storagePath)
Start-Sleep -Seconds 2

# Method 2: Try CopyHere on the phone root namespace
Write-Host "Trying CopyHere to the phone root namespace..."
try {
  # Get the phone's namespace
  $myComputer = $shell.NameSpace("shell:MyComputerFolder")
  $phone = $null
  foreach ($item in $myComputer.Items()) {
    if ($item.Name -eq "Medo's A56") { $phone = $item; break }
  }
  
  if ($phone) {
    Write-Host "Copying directly to phone root..."
    $phoneNs = $shell.NameSpace($phone.Path)
    $phoneNs.CopyHere($exeSource, 16)
    Write-Host "Copy initiated!"
  }
} catch {
  Write-Host "Method 1 failed: $_"
}

Start-Sleep -Seconds 10

# Method 3: use cmd.exe mklink or copy with explorer
Write-Host ""
Write-Host "Also copying to Desktop for easy drag-drop..."
Copy-Item $exeSource "$env:USERPROFILE\Desktop\ElHegazi License Signer.exe" -Force

Write-Host ""
Write-Host "DONE. Now in the Explorer window that opened:"
Write-Host "1. Navigate to Internal storage -> win 7"
Write-Host "2. Create folder 'license-signer' inside win 7"
Write-Host "3. Paste the file from your Desktop"
Write-Host ""
Write-Host "Or from phone: Use your file manager app to move the file from Internal storage root to Internal storage/win 7/license-signer/"
