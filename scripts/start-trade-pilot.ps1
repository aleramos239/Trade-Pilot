$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$url = "http://localhost:3000"
$nodeModules = Join-Path $projectRoot "node_modules"

function Test-AppReady {
  try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

Set-Location $projectRoot

if (-not (Test-Path $nodeModules)) {
  Write-Host "Installing dependencies..."
  npm.cmd install
}

if (-not (Test-AppReady)) {
  Write-Host "Starting Trade Pilot at $url ..."
  Start-Process -FilePath "npm.cmd" -ArgumentList "run", "dev" -WorkingDirectory $projectRoot -WindowStyle Hidden
}

$deadline = (Get-Date).AddSeconds(30)
while ((Get-Date) -lt $deadline) {
  if (Test-AppReady) {
    Start-Process $url
    Write-Host "Trade Pilot is running at $url"
    exit 0
  }

  Start-Sleep -Seconds 1
}

Write-Host "Trade Pilot is still starting. Opening browser anyway..."
Start-Process $url
