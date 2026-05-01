param(
  [string]$ClientId,
  [string]$ClientSecret,
  [string]$RedirectUri = "http://localhost:3000/api/broker-connections/oauth/tradovate/callback",
  [string]$AppUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"

function Read-RequiredValue([string]$Prompt, [string]$CurrentValue) {
  if ($CurrentValue) {
    return $CurrentValue.Trim()
  }

  $value = Read-Host $Prompt

  if (-not $value.Trim()) {
    throw "$Prompt is required."
  }

  return $value.Trim()
}

$ClientId = Read-RequiredValue "Tradovate OAuth client id" $ClientId
$ClientSecret = Read-RequiredValue "Tradovate OAuth client secret" $ClientSecret

$envPath = Join-Path (Get-Location) ".env.local"
$existing = @{}

if (Test-Path $envPath) {
  Get-Content $envPath | ForEach-Object {
    if ($_ -match "^\s*([^#][^=]+)=(.*)$") {
      $existing[$matches[1].Trim()] = $matches[2].Trim()
    }
  }
}

$existing["NEXT_PUBLIC_APP_URL"] = "`"$AppUrl`""
$existing["TRADOVATE_OAUTH_CLIENT_ID"] = "`"$ClientId`""
$existing["TRADOVATE_OAUTH_CLIENT_SECRET"] = "`"$ClientSecret`""
$existing["TRADOVATE_OAUTH_REDIRECT_URI"] = "`"$RedirectUri`""

$orderedKeys = @(
  "NEXT_PUBLIC_APP_URL",
  "TRADOVATE_OAUTH_CLIENT_ID",
  "TRADOVATE_OAUTH_CLIENT_SECRET",
  "TRADOVATE_OAUTH_REDIRECT_URI"
)

$lines = @(
  "# Local secrets for Trade Pilot. This file is ignored by git.",
  "# Restart the dev server after changing these values."
)

foreach ($key in $orderedKeys) {
  $lines += "$key=$($existing[$key])"
}

foreach ($key in ($existing.Keys | Sort-Object)) {
  if ($orderedKeys -notcontains $key) {
    $lines += "$key=$($existing[$key])"
  }
}

Set-Content -Path $envPath -Value $lines -Encoding UTF8

Write-Host ""
Write-Host "Tradovate OAuth env saved to .env.local"
Write-Host "Redirect URI to register in Tradovate:"
Write-Host "  $RedirectUri"
Write-Host ""
Write-Host "Restart the app, then click Log in with Tradovate."
