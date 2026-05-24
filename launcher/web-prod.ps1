Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Add-Type -TypeDefinition @"
using System; using System.Runtime.InteropServices;
public class DwmProd {
    [DllImport("dwmapi.dll")] public static extern int DwmSetWindowAttribute(IntPtr h, int a, ref int v, int s);
}
"@ -ErrorAction SilentlyContinue

function Set-DarkChrome($hwnd) {
    $v = 1; try { [DwmProd]::DwmSetWindowAttribute($hwnd, 20, [ref]$v, 4) | Out-Null } catch {}
    $v = 2; try { [DwmProd]::DwmSetWindowAttribute($hwnd, 33, [ref]$v, 4) | Out-Null } catch {}
}

function Test-Port($port) {
    try {
        $t = New-Object System.Net.Sockets.TcpClient
        $t.Connect("127.0.0.1", $port)
        $t.Close()
        return $true
    } catch { return $false }
}

function Get-LanIp {
    $ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -notlike "127.*" -and $_.PrefixOrigin -ne "WellKnown" } |
        Select-Object -First 1 -ExpandProperty IPAddress
    return $ip
}

$root        = Split-Path $PSScriptRoot -Parent
$iconPath    = Join-Path $root "electron\assets\icon.ico"
$clientDist  = Join-Path $root "client\dist\index.html"
$serverEntry = Join-Path $root "server\src\index.js"
$nodeCmd     = (Get-Command node -ErrorAction SilentlyContinue)

# ── Pre-flight checks ──────────────────────────────────────────────────────────
if (-not $nodeCmd) {
    [System.Windows.Forms.MessageBox]::Show(
        "Node.js is not installed on this machine.`nDownload it from: https://nodejs.org",
        "ElHegazi Retailer - Error", "OK", "Error") | Out-Null
    exit 1
}

if (-not (Test-Path $clientDist)) {
    [System.Windows.Forms.MessageBox]::Show(
        "The app has not been built yet.`n`nRun this command on the developer machine:`n  npm run build`n`nThen copy the full project folder here.",
        "ElHegazi Retailer - Error", "OK", "Error") | Out-Null
    exit 1
}

# ── Colors ────────────────────────────────────────────────────────────────────
$cBg      = [System.Drawing.Color]::FromArgb(15, 23, 42)
$cSurface = [System.Drawing.Color]::FromArgb(30, 41, 59)
$cTeal    = [System.Drawing.Color]::FromArgb(45, 212, 191)
$cTealBtn = [System.Drawing.Color]::FromArgb(13, 148, 136)
$cWhite   = [System.Drawing.Color]::FromArgb(248, 250, 252)
$cMuted   = [System.Drawing.Color]::FromArgb(100, 116, 139)
$cText    = [System.Drawing.Color]::FromArgb(203, 213, 225)

# ── Form ──────────────────────────────────────────────────────────────────────
$form = New-Object System.Windows.Forms.Form
$form.Text            = "ElHegazi Retailer"
$form.Size            = New-Object System.Drawing.Size(520, 300)
$form.StartPosition   = "CenterScreen"
$form.FormBorderStyle = "FixedSingle"
$form.MaximizeBox     = $false
$form.MinimizeBox     = $false
$form.BackColor       = $cBg
if (Test-Path $iconPath) { $form.Icon = New-Object System.Drawing.Icon($iconPath) }

$accent = New-Object System.Windows.Forms.Panel
$accent.Size = New-Object System.Drawing.Size(520, 4); $accent.Location = New-Object System.Drawing.Point(0, 0); $accent.BackColor = $cTeal
$form.Controls.Add($accent)

if (Test-Path $iconPath) {
    $pic = New-Object System.Windows.Forms.PictureBox
    $pic.Image = (New-Object System.Drawing.Icon($iconPath, 36, 36)).ToBitmap()
    $pic.Size = New-Object System.Drawing.Size(36, 36); $pic.Location = New-Object System.Drawing.Point(24, 24); $pic.SizeMode = "StretchImage"
    $form.Controls.Add($pic)
}

$lblTitle = New-Object System.Windows.Forms.Label
$lblTitle.Text = "ElHegazi Retailer"; $lblTitle.Font = New-Object System.Drawing.Font("Segoe UI", 15, [System.Drawing.FontStyle]::Bold)
$lblTitle.ForeColor = $cWhite; $lblTitle.AutoSize = $true; $lblTitle.Location = New-Object System.Drawing.Point(70, 24)
$form.Controls.Add($lblTitle)

$lblSub = New-Object System.Windows.Forms.Label
$lblSub.Text = "WEB VERSION  -  Production Mode"; $lblSub.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$lblSub.ForeColor = $cMuted; $lblSub.AutoSize = $true; $lblSub.Location = New-Object System.Drawing.Point(71, 56)
$form.Controls.Add($lblSub)

$sep = New-Object System.Windows.Forms.Panel
$sep.Size = New-Object System.Drawing.Size(472, 1); $sep.Location = New-Object System.Drawing.Point(24, 82); $sep.BackColor = $cSurface
$form.Controls.Add($sep)

$lblStatus = New-Object System.Windows.Forms.Label
$lblStatus.Text = "Starting..."; $lblStatus.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$lblStatus.ForeColor = $cText; $lblStatus.Size = New-Object System.Drawing.Size(472, 22); $lblStatus.Location = New-Object System.Drawing.Point(24, 96)
$form.Controls.Add($lblStatus)

$track = New-Object System.Windows.Forms.Panel
$track.BackColor = $cSurface; $track.Size = New-Object System.Drawing.Size(472, 10); $track.Location = New-Object System.Drawing.Point(24, 128)
$form.Controls.Add($track)

$fill = New-Object System.Windows.Forms.Panel
$fill.BackColor = $cTeal; $fill.Size = New-Object System.Drawing.Size(0, 10); $fill.Location = New-Object System.Drawing.Point(0, 0)
$track.Controls.Add($fill)

$lblLan = New-Object System.Windows.Forms.Label
$lblLan.Text = ""; $lblLan.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$lblLan.ForeColor = $cTeal; $lblLan.AutoSize = $true; $lblLan.Location = New-Object System.Drawing.Point(24, 152); $lblLan.Visible = $false
$form.Controls.Add($lblLan)

$lblCountdown = New-Object System.Windows.Forms.Label
$lblCountdown.Text = ""; $lblCountdown.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$lblCountdown.ForeColor = $cMuted; $lblCountdown.AutoSize = $true; $lblCountdown.Location = New-Object System.Drawing.Point(24, 175); $lblCountdown.Visible = $false
$form.Controls.Add($lblCountdown)

$btnOpen = New-Object System.Windows.Forms.Button
$btnOpen.Text = "Open in Browser"; $btnOpen.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$btnOpen.Size = New-Object System.Drawing.Size(140, 34); $btnOpen.Location = New-Object System.Drawing.Point(24, 228)
$btnOpen.BackColor = $cTealBtn; $btnOpen.ForeColor = $cWhite; $btnOpen.FlatStyle = "Flat"
$btnOpen.FlatAppearance.BorderSize = 0; $btnOpen.Cursor = [System.Windows.Forms.Cursors]::Hand; $btnOpen.Visible = $false
$form.Controls.Add($btnOpen)

$btnClose = New-Object System.Windows.Forms.Button
$btnClose.Text = "Close Now"; $btnClose.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$btnClose.Size = New-Object System.Drawing.Size(90, 34); $btnClose.Location = New-Object System.Drawing.Point(406, 228)
$btnClose.BackColor = $cSurface; $btnClose.ForeColor = $cMuted; $btnClose.FlatStyle = "Flat"
$btnClose.FlatAppearance.BorderSize = 0; $btnClose.Cursor = [System.Windows.Forms.Cursors]::Hand; $btnClose.Visible = $false
$btnClose.Add_Click({ $form.Close() })
$form.Controls.Add($btnClose)

# ── State ─────────────────────────────────────────────────────────────────────
$started        = $false
$tickCnt        = 0
$closeCountdown = 0
$lanIp          = ""

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 500

$timer.Add_Tick({
    $script:tickCnt++

    if (-not $script:started) {
        $fill.Width = 5
        $lblStatus.Text = "Stopping previous server..."

        # Kill any existing process on port 5000
        try {
            $pids = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue |
                Select-Object -ExpandProperty OwningProcess | Select-Object -Unique
            foreach ($p in $pids) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue }
        } catch {}
        Start-Sleep -Milliseconds 400

        $fill.Width = 20
        $lblStatus.Text = "Preparing native modules..."

        # Rebuild better-sqlite3 for system Node.js (not Electron)
        # This is needed because dev mode compiles it for Electron's Node version
        $rebuildProc = Start-Process -FilePath "cmd.exe" `
            -ArgumentList "/c npm rebuild better-sqlite3" `
            -WorkingDirectory $root -WindowStyle Hidden -PassThru -Wait
        # Ignore rebuild errors — if it was already correct it still exits 0

        $fill.Width = 80
        $lblStatus.Text = "Starting server..."

        # Get LAN IP
        $script:lanIp = Get-LanIp

        # Start Express directly — no Vite, no Electron, no dev tools
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName         = $nodeCmd.Source
        $psi.Arguments        = "`"$serverEntry`""
        $psi.WorkingDirectory = (Join-Path $root "server")
        $psi.UseShellExecute  = $false
        $psi.WindowStyle      = [System.Diagnostics.ProcessWindowStyle]::Hidden
        $psi.CreateNoWindow   = $true
        $psi.EnvironmentVariables["HOST"]     = "0.0.0.0"
        $psi.EnvironmentVariables["NODE_ENV"] = "production"
        [System.Diagnostics.Process]::Start($psi) | Out-Null

        $script:started = $true
    }

    # Animate progress while waiting
    if ($fill.Width -lt 440) { $fill.Width = [Math]::Min(440, $fill.Width + 5) }

    $secs = [int]($script:tickCnt * 0.5)
    if ($secs -lt 5) {
        $lblStatus.Text = "Starting server..."
    } else {
        $lblStatus.Text = "Waiting for server... ($secs s)"
    }

    if (Test-Port 5000) {
        $timer.Stop()

        $fill.Width = 472
        $url = "http://127.0.0.1:5000"

        $lblStatus.Text = "Server ready!"
        $lblStatus.ForeColor = $cTeal

        if ($script:lanIp) {
            $lblLan.Text    = "Other devices on your network:  http://$($script:lanIp):5000"
            $lblLan.Visible = $true
        }

        $btnOpen.Add_Click({ Start-Process $url })
        $btnOpen.Visible  = $true
        $btnClose.Visible = $true
        $lblCountdown.Visible = $true
        $script:closeCountdown = 6

        # Countdown timer to auto-close
        $ctimer = New-Object System.Windows.Forms.Timer
        $ctimer.Interval = 1000
        $ctimer.Add_Tick({
            $script:closeCountdown--
            $lblCountdown.Text = "Closing in $($script:closeCountdown)s..."
            if ($script:closeCountdown -le 0) { $ctimer.Stop(); $form.Close() }
        })
        $ctimer.Start()

        Start-Process $url
    }
})

$form.Add_Shown({
    Set-DarkChrome $form.Handle
    $timer.Start()
})

[System.Windows.Forms.Application]::Run($form)
