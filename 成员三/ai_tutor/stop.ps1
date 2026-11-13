$ErrorActionPreference = 'Stop'
$stateFile = Join-Path $PSScriptRoot '.runtime\server.json'
if (-not (Test-Path -LiteralPath $stateFile)) { Write-Output 'No project service record.'; exit 0 }
$state = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
$server = Get-Process -Id $state.pid -ErrorAction SilentlyContinue
if (-not $server) { Write-Output 'Project service is already stopped.'; exit 0 }
$actual = $server.StartTime.ToUniversalTime().ToString('o')
$command = (Get-CimInstance Win32_Process -Filter "ProcessId = $($state.pid)").CommandLine
$expectedScript = Join-Path $PSScriptRoot 'scripts\serve.py'
if ($actual -ne $state.started -or -not $command -or -not $command.Contains($expectedScript)) {
    throw 'Process identity does not match this project. Nothing was stopped.'
}
Stop-Process -Id $state.pid
Remove-Item -LiteralPath $stateFile
Write-Output 'Project service stopped.'
