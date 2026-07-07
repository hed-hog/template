const { execFileSync } = require('child_process');
const path = require('path');

function escapeForWmi(value) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function killStaleApiDevProcesses() {
  if (process.platform !== 'win32') {
    return;
  }

  const workspaceRoot = path.resolve(__dirname, '..');
  const apiMainPath = `${workspaceRoot}\\apps\\api\\src\\main.ts`;
  const apiBinPath = `${workspaceRoot}\\apps\\api\\node_modules\\.bin\\..\\ts-node-dev\\lib\\bin.js`;
  const patterns = [escapeForWmi(apiMainPath), escapeForWmi(apiBinPath)];

  const command = [
    '$processes = Get-CimInstance Win32_Process -Filter "name = \'node.exe\'"',
    '$currentPid = $PID',
    '$targets = $processes | Where-Object {',
    '  $_.ProcessId -ne $currentPid -and (',
    patterns.map((pattern) => `    $_.CommandLine -like '*${pattern}*'`).join(' -or\n'),
    '  )',
    '}',
    'if ($targets) {',
    "  $targets | ForEach-Object { Write-Host \"Stopping stale API dev process $($_.ProcessId)\" }",
    '  $targets | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }',
    '}',
  ].join('\n');

  execFileSync('powershell', ['-NoProfile', '-Command', command], {
    stdio: 'inherit',
  });
}

killStaleApiDevProcesses();
