$shell = New-Object -ComObject Shell.Application
$phone = $shell.NameSpace('shell:MyComputerFolder').Items() | Where-Object { $_.Name -eq "Medo's A56" }
if (-not $phone) { Write-Host "PHONE_NOT_FOUND"; exit 1 }
Write-Host ("Phone: " + $phone.Name + " Path: " + $phone.Path)

$storage = $shell.NameSpace($phone.Path).Items() | Where-Object { $_.Name -eq 'Internal storage' }
if (-not $storage) { Write-Host "STORAGE_NOT_FOUND"; exit 1 }
Write-Host ("Storage Path: " + $storage.Path)

$stFolder = $storage.GetFolder()
$names = @()
foreach ($i in $stFolder.Items()) { $names += $i.Name }
Write-Host ("Root items: " + ($names -join ", "))

$win7 = $stFolder.Items() | Where-Object { $_.Name -eq 'win 7' }
if ($win7) {
    Write-Host "WIN7_FOLDER_EXISTS"
    $win7Folder = $win7.GetFolder()
    $subs = @()
    foreach ($i in $win7Folder.Items()) { $subs += $i.Name }
    Write-Host ("win 7 contents: " + ($subs -join ", "))
    
    $ls = $win7Folder.Items() | Where-Object { $_.Name -eq 'license-signer' }
    if ($ls) {
        Write-Host "LICENSE_SIGNER_FOLDER_EXISTS"
        $lsFolder = $ls.GetFolder()
        $lsItems = @()
        foreach ($i in $lsFolder.Items()) { $lsItems += $i.Name }
        Write-Host ("license-signer contents: " + ($lsItems -join ", "))
    } else {
        Write-Host "LICENSE_SIGNER_FOLDER_NOT_FOUND"
    }
} else {
    Write-Host "WIN7_FOLDER_NOT_FOUND"
}
