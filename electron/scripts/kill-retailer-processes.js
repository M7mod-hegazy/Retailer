#!/usr/bin/env node
const { execFileSync, execSync } = require('child_process');

function wmic(query) {
  try {
    execFileSync('wmic', ['process', 'where', query, 'delete'], { stdio: 'ignore' });
  } catch {}
}

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

// Kill Retailer electron/node processes
wmic("name='electron.exe' and executablepath like '%Retailer%'");
wmic("name='node.exe' and commandline like '%electron\\\\cli.js%' and commandline like '%Retailer%'");

// Kill dev server and Vite ports
killPort(5000);
killPort(5173);

process.exit(0);
