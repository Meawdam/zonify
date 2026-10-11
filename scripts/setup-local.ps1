$ErrorActionPreference = 'Stop'
$taskRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
function New-ZonifySecret {
  $taskBytes = New-Object byte[] 32
  $taskRng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $taskRng.GetBytes($taskBytes) } finally { $taskRng.Dispose() }
  return -join ($taskBytes | ForEach-Object { $_.ToString('x2') })
}
$taskBackendEnv = Join-Path $taskRoot 'backend/.env'
if (!(Test-Path -LiteralPath $taskBackendEnv)) {
  $taskValues = @(
    'BACKEND_PORT=4000', 'MONGO_URI=mongodb://127.0.0.1:27017/zonify',
    'APP_ORIGIN=http://localhost:3000', ('JWT_SECRET=' + (New-ZonifySecret)),
    ('SEED_CUSTOMER_PASSWORD=' + (New-ZonifySecret)),
    ('SEED_MANAGER_PASSWORD=' + (New-ZonifySecret)),
    ('SEED_OWNER_PASSWORD=' + (New-ZonifySecret))
  )
  [System.IO.File]::WriteAllLines($taskBackendEnv, $taskValues)
  Write-Output 'Created backend/.env with random local secrets. Read seed passwords there; never commit this file.'
} else { Write-Output 'Existing backend/.env preserved.' }
$taskFrontendEnv = Join-Path $taskRoot 'frontend/.env.local'
if (!(Test-Path -LiteralPath $taskFrontendEnv)) { [System.IO.File]::WriteAllText($taskFrontendEnv, 'BACKEND_URL=http://localhost:4000'); Write-Output 'Created frontend/.env.local.' }
else { Write-Output 'Existing frontend/.env.local preserved.' }
