Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Add-Type -TypeDefinition @"
using System; using System.Runtime.InteropServices;
public class Dwm2 {
    [DllImport("dwmapi.dll")] public static extern int DwmSetWindowAttribute(IntPtr h, int a, ref int v, int s);
}
"@ -ErrorAction SilentlyContinue

function Set-DarkChrome($hwnd) {
    $v = 1; try { [Dwm2]::DwmSetWindowAttribute($hwnd, 20, [ref]$v, 4) | Out-Null } catch {}
    $v = 2; try { [Dwm2]::DwmSetWindowAttribute($hwnd, 33, [ref]$v, 4) | Out-Null } catch {}
}

function Test-Port($port) {
    try {
        $t = New-Object System.Net.Sockets.TcpClient
        $t.Connect("127.0.0.1", $port)
        $t.Close()
        return $true
    } catch { return $false }
}

$root     = Split-Path $PSScriptRoot -Parent
$iconPath = Join-Path $root "electron\assets\icon.ico"

$cBg      = [System.Drawing.Color]::FromArgb(15, 23, 42)
$cSurface = [System.Drawing.Color]::FromArgb(30, 41, 59)
$cTeal    = [System.Drawing.Color]::FromArgb(45, 212, 191)
$cTealBtn = [System.Drawing.Color]::FromArgb(13, 148, 136)
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
$lblSub.Text      = "WEB VERSION  -  http://127.0.0.1:5173"
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
$lblStatus.Text      = "Starting API server..."
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

$btnOpen = New-Object System.Windows.Forms.Button
$btnOpen.Text      = "Open in Browser"
$btnOpen.Font      = New-Object System.Drawing.Font("Segoe UI", 9)
$btnOpen.Size      = New-Object System.Drawing.Size(140, 34)
$btnOpen.Location  = New-Object System.Drawing.Point(24, 202)
$btnOpen.BackColor = $cTealBtn
$btnOpen.ForeColor = $cWhite
$btnOpen.FlatStyle = "Flat"
$btnOpen.FlatAppearance.BorderSize = 0
$btnOpen.Cursor    = [System.Windows.Forms.Cursors]::Hand
$btnOpen.Visible   = $false
$btnOpen.Add_Click({ Start-Process "http://127.0.0.1:5173" })
$form.Controls.Add($btnOpen)

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

$phase          = 0
$tickCnt        = 0
$closeCountdown = 0

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 500

$timer.Add_Tick({
    $script:tickCnt++

    switch ($script:phase) {
        0 {
            $fill.Width = 5
            $lblStatus.Text = "Stopping previous processes..."
            # Kill processes holding dev ports (launcher-specific, not the general kill script)
            foreach ($port in @(5173, 5000)) {
                try {
                    $pids = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
                        Select-Object -ExpandProperty OwningProcess
                    foreach ($p in $pids) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue }
                } catch {}
            }
            Start-Sleep -Milliseconds 400
            $fill.Width = 12
            Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev:server" `
                -WorkingDirectory $root -WindowStyle Hidden
            $script:phase = 1
        }
        1 {
            $fill.Width = [Math]::Min(188, 12 + $script:tickCnt * 6)
            if (Test-Port 5000) {
                $fill.Width     = 200
                $lblStatus.Text = "API ready  -  Starting Vite..."
                $script:tickCnt = 0
                $script:phase   = 2
            }
        }
        2 {
            Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev:client" `
                -WorkingDirectory $root -WindowStyle Hidden
            $script:phase = 3
        }
        3 {
            $fill.Width     = [Math]::Min(460, 200 + $script:tickCnt * 8)
            $lblStatus.Text = "Compiling... ($([int]($script:tickCnt * 0.5)) s)"
            if (Test-Port 5173) { $script:phase = 4 }
        }
        4 {
            # Browser opened - start auto-close countdown
            Start-Process "http://127.0.0.1:5173"
            $fill.Width          = 472
            $lblStatus.Text      = "Ready  -  browser opened"
            $lblStatus.ForeColor = $cTeal
            $btnOpen.Visible     = $true
            $btnClose.Visible    = $true
            $lblCountdown.Visible = $true
            $script:closeCountdown = 5
            $script:tickCnt       = 0
            $script:phase         = 5
        }
        5 {
            # One tick = 500ms, so countdown in seconds
            if ($script:tickCnt % 2 -eq 0) {
                $script:closeCountdown--
                $lblCountdown.Text = "Closing in $($script:closeCountdown)s..."
                if ($script:closeCountdown -le 0) {
                    $timer.Stop()
                    $form.Close()
                }
            }
        }
    }
})

$form.Add_Shown({
    Set-DarkChrome $form.Handle
    $timer.Start()
})

[System.Windows.Forms.Application]::Run($form)
