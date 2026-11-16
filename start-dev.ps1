$ErrorActionPreference = 'Stop'
$backendDir = Join-Path $PSScriptRoot 'backend'
$frontendDir = Join-Path $PSScriptRoot 'frontend'
$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
$msbuild = & $vswhere -latest -requires Microsoft.Component.MSBuild -find 'MSBuild\**\Bin\MSBuild.exe' | Select-Object -First 1
$iisexpress = Join-Path $env:ProgramFiles 'IIS Express\iisexpress.exe'
if (-not $msbuild -or -not (Test-Path -LiteralPath $iisexpress)) {
    throw 'Instala MSBuild e IIS Express con Visual Studio antes de iniciar el ERP.'
}

function Test-LocalPort([int] $Port) {
    $client = New-Object Net.Sockets.TcpClient
    try {
        $connect = $client.ConnectAsync('127.0.0.1', $Port)
        return ($connect.Wait(1000) -and $client.Connected)
    } catch {
        return $false
    } finally {
        $client.Dispose()
    }
}

Write-Host 'Compilando backend...'
& $msbuild (Join-Path $backendDir 'backend.csproj') /t:Build /p:Configuration=Debug /v:minimal /nologo
if ($LASTEXITCODE -ne 0) { throw 'No se pudo compilar el backend.' }

if (-not (Test-LocalPort 5000)) {
    Start-Process -FilePath $iisexpress -ArgumentList "/path:`"$backendDir`"", '/port:5000' -WindowStyle Hidden -RedirectStandardOutput (Join-Path $backendDir 'iisexpress.log') -RedirectStandardError (Join-Path $backendDir 'iisexpress-error.log')
}
$backendReady = $false
for ($attempt = 0; $attempt -lt 20; $attempt++) {
    try {
        $session = Invoke-RestMethod 'http://localhost:5000/Login/Sesion' -TimeoutSec 3
        $backendReady = $true
        break
    } catch {
        # An unauthenticated session can return 401 while the backend is healthy.
        if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 401) {
            $backendReady = $true
            break
        }
        Start-Sleep -Milliseconds 500
    }
}
if (-not $backendReady) { throw 'El backend no responde. Revisa backend/iisexpress-error.log.' }

$env:ERP_BACKEND_URL = 'http://localhost:5000'
$env:NODE_USE_SYSTEM_CA = '1'
if (-not (Test-LocalPort 3000)) {
    Start-Process -FilePath (Get-Command node.exe).Source -ArgumentList '--use-system-ca', 'node_modules/next/dist/bin/next', 'dev', '--port', '3000' -WorkingDirectory $frontendDir -WindowStyle Hidden -RedirectStandardOutput (Join-Path $frontendDir 'dev.log') -RedirectStandardError (Join-Path $frontendDir 'dev-error.log')
}
Write-Host 'ERP disponible en http://localhost:3000. Backend: http://localhost:5000.'
