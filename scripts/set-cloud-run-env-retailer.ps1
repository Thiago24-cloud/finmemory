# Atualiza variáveis do Cloud Run finmemory-retailer a partir do .env.local
# Uso: .\scripts\set-cloud-run-env-retailer.ps1

$ErrorActionPreference = "Stop"
$FINMEMORY_GCP_PROJECT = "exalted-entry-480904-s9"
$SERVICE = "finmemory-retailer"
$REGION = "southamerica-east1"
$RETAILER_BASE = "https://parceiros.finmemory.com.br"

$envLocalPath = Join-Path (Get-Location) ".env.local"
if (-not (Test-Path $envLocalPath)) {
    Write-Host "Arquivo .env.local nao encontrado." -ForegroundColor Red
    exit 1
}

$vars = @{}
Get-Content $envLocalPath -Encoding UTF8 | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
        $key = $Matches[1].Trim()
        $val = $Matches[2].Trim().Trim('"').Trim("'").Trim()
        $vars[$key] = $val
    }
}

function Ensure-Https([string]$url) {
    $u = if ($url) { $url.Trim() } else { "" }
    if (-not $u) { return $RETAILER_BASE }
    if ($u -match '^http://' -and $u -notmatch 'localhost|127\.0\.0\.1') {
        return "https://" + $u.Substring(7).TrimEnd('/')
    }
    return $u.TrimEnd('/')
}

$retailerUrl = Ensure-Https($vars["NEXT_PUBLIC_RETAILER_APP_URL"])
if (-not $retailerUrl) { $retailerUrl = $RETAILER_BASE }

$vars["NEXTAUTH_URL"] = $retailerUrl
$vars["NEXT_PUBLIC_APP_URL"] = $retailerUrl
$vars["NEXT_PUBLIC_RETAILER_APP_URL"] = $retailerUrl
$vars["GOOGLE_REDIRECT_URI"] = "$retailerUrl/api/auth/callback/google"
$vars.Remove("STRIPE_APP_BASE_URL") | Out-Null
if (-not $vars["FINMEMORY_PUBLIC_ACCESS"]) {
    $vars["FINMEMORY_PUBLIC_ACCESS"] = "1"
}

$required = @(
    "NEXTAUTH_URL", "NEXTAUTH_SECRET",
    "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI",
    "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_JWT_SECRET",
    "NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_RETAILER_APP_URL",
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET",
    "FINMEMORY_PUBLIC_ACCESS",
    "FINMEMORY_ADMIN_EMAILS"
)

$optional = @(
    "NEXT_PUBLIC_POSTHOG_KEY", "NEXT_PUBLIC_POSTHOG_HOST",
    "CLOUDFLARE_R2_ENDPOINT", "CLOUDFLARE_R2_ACCESS_KEY_ID", "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
    "CLOUDFLARE_R2_BUCKET", "CLOUDFLARE_R2_PUBLIC_BASE_URL",
    "ONESIGNAL_APP_ID", "ONESIGNAL_REST_API_KEY",
    "OPENAI_API_KEY"
)

$envMap = @{}
foreach ($k in $required) {
    if ($vars[$k]) {
        $envMap[$k] = $vars[$k]
    } else {
        Write-Host "Aviso: $k nao definido no .env.local" -ForegroundColor Yellow
    }
}

if (-not $envMap["SUPABASE_JWT_SECRET"]) {
    try {
        $consumer = gcloud run services describe finmemory --region $REGION --project $FINMEMORY_GCP_PROJECT --format=json 2>$null | ConvertFrom-Json
        $jwt = ($consumer.spec.template.spec.containers[0].env | Where-Object { $_.name -eq "SUPABASE_JWT_SECRET" }).value
        if ($jwt) {
            $envMap["SUPABASE_JWT_SECRET"] = [string]$jwt
            Write-Host "SUPABASE_JWT_SECRET copiado do servico finmemory (consumer)." -ForegroundColor Cyan
        }
    } catch {
        Write-Host "Aviso: nao foi possivel copiar SUPABASE_JWT_SECRET do consumer." -ForegroundColor Yellow
    }
}
foreach ($k in $optional) {
    if ($vars[$k]) { $envMap[$k] = $vars[$k] }
}

if ($envMap.Count -eq 0) {
    Write-Host "Nenhuma variavel para atualizar." -ForegroundColor Red
    exit 1
}

$merged = @{}
try {
    $desc = gcloud run services describe $SERVICE --region $REGION --project $FINMEMORY_GCP_PROJECT --format=json 2>$null | ConvertFrom-Json
    $containerEnv = $desc.spec.template.spec.containers[0].env
    if ($containerEnv) {
        foreach ($item in $containerEnv) {
            if ($item.name -and $null -ne $item.value) {
                $merged[$item.name] = [string]$item.value
            }
        }
    }
} catch {
    Write-Host "Aviso: nao foi possivel ler env atual do servico retailer." -ForegroundColor Yellow
}
foreach ($entry in $envMap.GetEnumerator()) {
    $merged[$entry.Key] = [string]$entry.Value
}

$yamlPath = Join-Path $env:TEMP "finmemory-retailer-cloud-run-env.yaml"
$lines = @()
foreach ($entry in $merged.GetEnumerator() | Sort-Object Name) {
    $val = [string]$entry.Value
    $escaped = $val -replace '\\', '\\\\' -replace '"', '\"'
    $lines += "$($entry.Key): `"$escaped`""
}
Set-Content -Path $yamlPath -Value ($lines -join "`n") -Encoding UTF8

Write-Host "Atualizando $SERVICE ($FINMEMORY_GCP_PROJECT)..." -ForegroundColor Cyan
& gcloud run services update $SERVICE --region $REGION --project $FINMEMORY_GCP_PROJECT --env-vars-file $yamlPath
if ($LASTEXITCODE -ne 0) { exit 1 }

$runUrl = gcloud run services describe $SERVICE --region $REGION --project $FINMEMORY_GCP_PROJECT --format="value(status.url)" 2>$null
Write-Host "Cloud Run retailer atualizado." -ForegroundColor Green
Write-Host "  URL run.app: $runUrl" -ForegroundColor Green
Write-Host "  URL publica (apos DNS): $retailerUrl" -ForegroundColor Green
Write-Host "  Health: $runUrl/api/health" -ForegroundColor Green
