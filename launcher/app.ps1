Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Add-Type -TypeDefinition @"
using System; using System.Runtime.InteropServices;
public class Dwm3 {
    [DllImport("dwmapi.dll")] public static extern int DwmSetWindowAttribute(IntPtr h, int a, ref int v, int s);
}
"@ -ErrorAction SilentlyContinue

function Set-DarkChrome($hwnd) {
    $v = 1; try { [Dwm3]::DwmSetWindowAttribute($hwnd, 20, [ref]$v, 4) | Out-Null } catch {}
    $v = 2; try { [Dwm3]::DwmSetWindowAttribute($hwnd, 33, [ref]$v, 4) | Out-Null } catch {}
}

function Test-Port($port) {
    try {
        $t = New-Object System.Net.Sockets.TcpClient
        $t.Connect("127.0.0.1", $port)
        $t.Close()
        return $true
    } catch { return $false }
}

# Stronger check: Express must be serving HTTP, not just port open
function Test-HttpReady($url) {
    try {
        $req = [System.Net.HttpWebRequest]::Create($url)
        $req.Timeout = 1000
        $req.Method  = "GET"
        $res = $req.GetResponse()
        $res.Close()
        return $true
    } catch [System.Net.WebException] {
        # Any HTTP response (even 401/404) means Express is up
        if ($null -ne $_.Exception.Response) { return $true }
        return $false
    } catch { return $false }
}

$root        = Split-Path $PSScriptRoot -Parent
$iconPath    = Join-Path $root "electron\assets\icon.ico"
$electronExe = Join-Path $root "node_modules\electron\dist\electron.exe"

$cBg      = [System.Drawing.Color]::FromArgb(15, 23, 42)
$cSurface = [System.Drawing.Color]::FromArgb(30, 41, 59)
$cTeal    = [System.Drawing.Color]::FromArgb(45, 212, 191)
$cWhite   = [System.Drawing.Color]::FromArgb(248, 250, 252)
$cMuted   = [System.Drawing.Color]::FromArgb(100, 116, 139)
$cText    = [System.Drawing.Color]::FromArgb(203, 213, 225)

$form = New-Object System.Windows.Forms.Form
$form.Text            = "ElHegazi Retailer"
$form.Size            = New-Object System.Drawing.Size(520, 270)
$form.StartPosition   = "CenterScreen"
$form.FormBorderStyle = "FixedSingle"
$form.MaximizeBox     = $false
$form.MinimizeBox     = $false
$form.BackColor       = $cBg
if (Test-Path $iconPath) { $form.Icon = New-Object System.Drawing.Icon($iconPath) }

$accent = New-Object System.Windows.Forms.Panel
$accent.Size      = New-Object System.Drawing.Size(520, 4)
$accent.Location  = New-Object System.Drawing.Point(0, 0)
$accent.BackColor = $cTeal
$form.Controls.Add($accent)

if (Test-Path $iconPath) {
    $pic = New-Object System.Windows.Forms.PictureBox
    $pic.Image    = (New-Object System.Drawing.Icon($iconPath, 36, 36)).ToBitmap()
    $pic.Size     = New-Object System.Drawing.Size(36, 36)
    $pic.Location = New-Object System.Drawing.Point(24, 24)
    $pic.SizeMode = "StretchImage"
    $form.Controls.Add($pic)
}

$lblTitle = New-Object System.Windows.Forms.Label
$lblTitle.Text      = "ElHegazi Retailer"
$lblTitle.Font      = New-Object System.Drawing.Font("Segoe UI", 15, [System.Drawing.FontStyle]::Bold)
$lblTitle.ForeColor = $cWhite
$lblTitle.AutoSize  = $true
$lblTitle.Location  = New-Object System.Drawing.Point(70, 24)
$form.Controls.Add($lblTitle)

$lblSub = New-Object System.Windows.Forms.Label
$lblSub.Text      = "DESKTOP APP"
$lblSub.Font      = New-Object System.Drawing.Font("Segoe UI", 9)
$lblSub.ForeColor = $cMuted
$lblSub.AutoSize  = $true
$lblSub.Location  = New-Object System.Drawing.Point(71, 56)
$form.Controls.Add($lblSub)

$sep = New-Object System.Windows.Forms.Panel
$sep.Size      = New-Object System.Drawing.Size(472, 1)
$sep.Location  = New-Object System.Drawing.Point(24, 82)
$sep.BackColor = $cSurface
$form.Controls.Add($sep)

$lblStatus = New-Object System.Windows.Forms.Label
$lblStatus.Text      = "Starting..."
$lblStatus.Font      = New-Object System.Drawing.Font("Segoe UI", 10)
$lblStatus.ForeColor = $cText
$lblStatus.Size      = New-Object System.Drawing.Size(472, 22)
$lblStatus.Location  = New-Object System.Drawing.Point(24, 96)
$form.Controls.Add($lblStatus)

$track = New-Object System.Windows.Forms.Panel
$track.BackColor = $cSurface
$track.Size      = New-Object System.Drawing.Size(472, 10)
$track.Location  = New-Object System.Drawing.Point(24, 128)
$form.Controls.Add($track)

$block = New-Object System.Windows.Forms.Panel
$block.BackColor = $cTeal
$block.Size      = New-Object System.Drawing.Size(130, 10)
$block.Location  = New-Object System.Drawing.Point(-130, 0)
$track.Controls.Add($block)

$fill = New-Object System.Windows.Forms.Panel
$fill.BackColor = $cTeal
$fill.Size      = New-Object System.Drawing.Size(0, 10)
$fill.Location  = New-Object System.Drawing.Point(0, 0)
$track.Controls.Add($fill)

$lblCountdown = New-Object System.Windows.Forms.Label
$lblCountdown.Text      = ""
$lblCountdown.Font      = New-Object System.Drawing.Font("Segoe UI", 9)
$lblCountdown.ForeColor = $cMuted
$lblCountdown.AutoSize  = $true
$lblCountdown.Location  = New-Object System.Drawing.Point(24, 152)
$lblCountdown.Visible   = $false
$form.Controls.Add($lblCountdown)

$btnClose = New-Object System.Windows.Forms.Button
$btnClose.Text      = "Close Now"
$btnClose.Font      = New-Object System.Drawing.Font("Segoe UI", 9)
$btnClose.Size      = New-Object System.Drawing.Size(90, 34)
$btnClose.Location  = New-Object System.Drawing.Point(406, 202)
$btnClose.BackColor = $cSurface
$btnClose.ForeColor = $cMuted
$btnClose.FlatStyle = "Flat"
$btnClose.FlatAppearance.BorderSize = 0
$btnClose.Cursor    = [System.Windows.Forms.Cursors]::Hand
$btnClose.Visible   = $false
$btnClose.Add_Click({ $form.Close() })
$form.Controls.Add($btnClose)

# ── State ─────────────────────────────────────────────────────────────────────
$started        = $false
$tickCnt        = 0
$blockX         = -130
$checkCnt       = 0
$bothReady      = $false
$closeCountdown = 0

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 50

$timer.Add_Tick({
    $script:tickCnt++

    if (-not $script:started) {
        # Kill processes holding dev ports (launcher-specific cleanup, not the general kill script)
        foreach ($port in @(5173, 5000)) {
            try {
                $pids = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
                    Select-Object -ExpandProperty OwningProcess
                foreach ($p in $pids) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue }
            } catch {}
        }
        # Also kill Electron
        Start-Process -FilePath "powershell.exe" `
            -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$root\electron\scripts\kill-retailer-processes.ps1`"" `
            -WorkingDirectory $root -WindowStyle Hidden -Wait
        Start-Sleep -Milliseconds 400
        # Start server (includes electron:rebuild + express)
        Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev:server" `
            -WorkingDirectory $root -WindowStyle Hidden
        # Start Vite client
        Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev:client" `
            -WorkingDirectory $root -WindowStyle Hidden
        $script:started = $true
    }

    $secs = [int]($script:tickCnt * 50 / 1000)

    if (-not $script:bothReady) {
        # Animate marquee
        $script:blockX += 6
        if ($script:blockX -gt 472) { $script:blockX = -130 }
        $block.Left = $script:blockX

        # Real status based on actual service health
        $has5000 = Test-HttpReady "http://127.0.0.1:5000/api/settings"
        $has5173 = Test-Port 5173
        if ($has5000 -and $has5173) {
            $lblStatus.Text = "Services ready - launching Electron..."
        } elseif ($has5173 -and -not $has5000) {
            $lblStatus.Text = "Vite ready - waiting for API server... ($secs s)"
        } elseif ($has5000 -and -not $has5173) {
            $lblStatus.Text = "API ready - compiling frontend... ($secs s)"
        } elseif ($secs -lt 10) {
            $lblStatus.Text = "Rebuilding native modules..."
        } else {
            $lblStatus.Text = "Starting services... ($secs s)"
        }

        # Check every ~1s
        $script:checkCnt++
        if ($script:checkCnt -ge 20) {
            $script:checkCnt = 0
            if ((Test-HttpReady "http://127.0.0.1:5000/api/settings") -and (Test-Port 5173)) {
                $script:bothReady = $true
                $script:tickCnt   = 0

                # Launch Electron directly with the required env var
                $psi = New-Object System.Diagnostics.ProcessStartInfo
                $psi.FileName         = $electronExe
                $psi.Arguments        = "`"$root`""
                $psi.WorkingDirectory = $root
                $psi.UseShellExecute  = $false
                $psi.EnvironmentVariables["VITE_DEV_SERVER_URL"] = "http://127.0.0.1:5173"
                $psi.EnvironmentVariables["ALLOW_DEV_BYPASS"]    = "true"
                [System.Diagnostics.Process]::Start($psi) | Out-Null

                $block.Visible       = $false
                $fill.Width          = 472
                $lblStatus.Text      = "Electron is opening..."
                $lblStatus.ForeColor = $cTeal
                $lblCountdown.Visible = $true
                $btnClose.Visible    = $true
                $script:closeCountdown = 6
            }
        }
    } else {
        if ($script:tickCnt % 20 -eq 0) {
            $script:closeCountdown--
            $lblCountdown.Text = "Closing in $($script:closeCountdown)s..."
            if ($script:closeCountdown -le 0) {
                $timer.Stop()
                $form.Close()
            }
        }
    }
})

$form.Add_Shown({
    Set-DarkChrome $form.Handle
    $timer.Start()
})

[System.Windows.Forms.Application]::Run($form)
