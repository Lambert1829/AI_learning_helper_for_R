$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$pythonExe = Join-Path $projectRoot '.venv\Scripts\python.exe'
$serverScript = Join-Path $projectRoot 'scripts\serve.py'
$runtimeDir = Join-Path $projectRoot '.runtime'
if (-not (Test-Path -LiteralPath $pythonExe)) { throw 'Run setup.cmd first to install the project environment.' }
$probe = New-Object System.Net.Sockets.TcpClient
try {
    $connected = $probe.ConnectAsync('127.0.0.1',8000).Wait(700)
    if ($connected -and $probe.Connected) { throw 'Port 8000 is already in use. No process was stopped. Check http://127.0.0.1:8000 or close the existing service yourself.' }
} catch [System.AggregateException] {
    # Connection refused means this local port is available.
} finally { $probe.Dispose() }
New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
$server = Start-Process -FilePath $pythonExe -ArgumentList ('"' + $serverScript + '"') -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimeDir 'server.out.log') -RedirectStandardError (Join-Path $runtimeDir 'server.err.log')
@{ pid=$server.Id; started=$server.StartTime.ToUniversalTime().ToString('o'); script=$serverScript } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $runtimeDir 'server.json') -Encoding UTF8
for ($attempt=0; $attempt -lt 30; $attempt++) {
    Start-Sleep -Milliseconds 500
    if ($server.HasExited) { throw 'Service exited. Check .runtime/server.err.log.' }
    try {
        $health = Invoke-RestMethod 'http://127.0.0.1:8000/api/health' -TimeoutSec 2
        if ($health.mode -eq 'mock') {
            Write-Output 'Ready: http://127.0.0.1:8000'
            Write-Output 'API docs: http://127.0.0.1:8000/docs'
            Write-Output 'Use stop.cmd to stop this project service.'
            exit 0
        }
    } catch { }
}
throw 'Startup timed out. Check .runtime/server.err.log and use stop.cmd before retrying.'
