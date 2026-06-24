Write-Output "Killing node, electron, retailer processes..."
Get-Process node,electron,retailer -ErrorAction SilentlyContinue | ForEach-Object {
    try {
        Stop-Process $_.Id -Force -ErrorAction Stop
        Write-Output "Killed $($_.ProcessName) PID $($_.Id)"
    } catch {
        Write-Output "Failed $($_.ProcessName) PID $($_.Id): $_"
    }
}
Start-Sleep -Seconds 2
Write-Output "Done killing processes"
