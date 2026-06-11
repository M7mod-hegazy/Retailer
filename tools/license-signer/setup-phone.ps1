$shell = New-Object -ComObject Shell.Application

# Get the phone device
$myComputer = $shell.NameSpace("shell:MyComputerFolder")
$phone = $null
foreach ($item in $myComputer.Items()) {
  if ($item.Name -eq "Medo's A56") {
    $phone = $item
    break
  }
}

if ($phone -eq $null) {
  Write-Host "Phone not found"
  exit 1
}

# Navigate into the phone
$phoneNs = $shell.NameSpace($phone.Path)
Write-Host "Phone contents:"
foreach ($item in $phoneNs.Items()) {
  Write-Host ("  " + $item.Name + " | Path: " + $item.Path)
}

# Navigate into Internal storage
foreach ($item in $phoneNs.Items()) {
  if ($item.Name -eq "Internal storage") {
    $storage = $item
    $storageNs = $shell.NameSpace($storage.Path)
    Write-Host "`nInternal storage contents:"
    foreach ($sub in $storageNs.Items()) {
      Write-Host ("  " + $sub.Name)
    }

    # Check/create win 7 folder
    $win7 = $null
    foreach ($sub in $storageNs.Items()) {
      if ($sub.Name -eq "win 7") {
        $win7 = $sub
        break
      }
    }
    if ($win7) {
      $win7Ns = $shell.NameSpace($win7.Path)
      Write-Host "`nwin 7 contents:"
      foreach ($sub in $win7Ns.Items()) {
        Write-Host ("  " + $sub.Name)
      }
    } else {
      Write-Host "`nwin 7 folder does not exist yet"
    }
    break
  }
}
