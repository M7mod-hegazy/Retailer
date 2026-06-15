#!/usr/bin/env node
const { execFileSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const ROOT_MARKER = ROOT.replace(/\\/g, '\\\\');

function killPort(port) {
  try {
    const out = execFileSync('netstat', ['-ano'], { encoding: 'utf8' });
    for (const line of out.split('\n')) {
      if (line.includes(`:${port} `) && line.includes('LISTENING')) {
        const pid = line.trim().split(/\s+/).pop();
        if (pid && pid !== '0') {
          try { execFileSync('taskkill', ['/F', '/PID', pid], { stdio: 'ignore' }); } catch {}
        }
      }
    }
  } catch {}
}

function killRetailerProcessesWindows() {
  // wmic was removed on recent Windows builds; use CIM via PowerShell instead.
  const ps = `
$root = '${ROOT_MARKER}'
Get-CimInstance Win32_Process |
  Where-Object {
  ($_.Name -eq 'ElHegazi-Retailer.exe') -or
  ($_.Name -eq 'electron.exe' -and (
    $_.ExecutablePath -like "*$root*" -or
    $_.ExecutablePath -like "*\\\\release\\\\win7\\\\*"
  )) -or
  ($_.Name -eq 'node.exe' -and $_.CommandLine -like "*electron\\\\cli.js*" -and $_.CommandLine -like "*$root*")
} | ForEach-Object {
  Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}
`;
  try {
    execFileSync(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', ps],
      { stdio: 'ignore' }
    );
  } catch {}
}

if (process.platform === 'win32') {
  killRetailerProcessesWindows();
  killPort(5000);
  killPort(5173);
}

process.exit(0);
