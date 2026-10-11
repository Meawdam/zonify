param(
  [ValidateSet('start', 'stop', 'status')][string]$Action = 'start',
  [string]$MongodPath = $env:MONGOD_PATH
)
$ErrorActionPreference = 'Stop'
$taskRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskData = [System.IO.Path]::GetFullPath((Join-Path $taskRoot '.data/mongodb'))
if (!$taskData.StartsWith($taskRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Data path must stay in this workspace.' }
$taskProcesses = @(Get-CimInstance Win32_Process -Filter "name = 'mongod.exe' OR name LIKE 'mongod-%'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($taskData) })
if ($Action -eq 'status') {
  if ($taskProcesses.Count) { Write-Output "Zonify MongoDB running: PID $($taskProcesses[0].ProcessId), port 27017" } else { Write-Output 'Zonify MongoDB is stopped.' }
  exit 0
}
if ($Action -eq 'stop') {
  foreach ($taskProcess in $taskProcesses) { Stop-Process -Id $taskProcess.ProcessId }
  Write-Output 'Stopped this workspace MongoDB. Persistent data preserved.'
  exit 0
}
if ($taskProcesses.Count) { Write-Output 'This workspace MongoDB is already running.'; exit 0 }
if (Get-NetTCPConnection -State Listen -LocalPort 27017 -ErrorAction SilentlyContinue) { throw 'Port 27017 is in use by another service. Use that MongoDB or stop it explicitly.' }
if (!$MongodPath) {
  $taskInstalled = Get-Command mongod -ErrorAction SilentlyContinue
  if ($taskInstalled) { $MongodPath = $taskInstalled.Source }
}
if (!$MongodPath) {
  $taskCached = Get-ChildItem -LiteralPath (Join-Path $env:USERPROFILE '.cache/mongodb-binaries') -Filter 'mongod-*.exe' -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
  if ($taskCached) { $MongodPath = $taskCached.FullName }
}
if (!$MongodPath -or !(Test-Path -LiteralPath $MongodPath -PathType Leaf)) { throw 'Set MONGOD_PATH to your installed mongod.exe, or use backend/docker-compose.yml.' }
New-Item -ItemType Directory -Path $taskData -Force | Out-Null
$taskLog = Join-Path $taskData 'mongod.log'
Start-Process -FilePath $MongodPath -ArgumentList @('--dbpath', ('"' + $taskData + '"'), '--bind_ip', '127.0.0.1', '--port', '27017', '--logpath', ('"' + $taskLog + '"'), '--logappend') -WindowStyle Hidden | Out-Null
for ($taskTry = 0; $taskTry -lt 40; $taskTry++) {
  if (Get-NetTCPConnection -State Listen -LocalPort 27017 -ErrorAction SilentlyContinue) {
    Write-Output "MongoDB ready on 127.0.0.1:27017. Data: $taskData"
    exit 0
  }
  Start-Sleep -Milliseconds 250
}
throw "MongoDB did not start. Inspect $taskLog"
