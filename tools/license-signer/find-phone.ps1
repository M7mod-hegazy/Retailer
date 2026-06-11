$shell = New-Object -ComObject Shell.Application
$ns = $shell.NameSpace("shell:MyComputerFolder")
$items = $ns.Items()
foreach ($item in $items) {
  Write-Host ("Name: " + $item.Name + " | Path: " + $item.Path)
}
