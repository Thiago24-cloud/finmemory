# Atualiza as variáveis de ambiente do Cloud Run a partir do .env.local
# Uso: .\scripts\set-cloud-run-env.ps1
#
# Projeto de produção FinMemory: exalted-entry-480904-s9 (não finmemory-667c3).

$ErrorActionPreference = "Stop"
$FINMEMORY_GCP_PROJECT = "exalted-entry-480904-s9"
$envFile = Join-Path (Get-Location) ".env.local"
if (-not (Test-Path $envFile)) {
    Write-Host "Arquivo .env.local nao encontrado." -ForegroundColor Red
    exit 1
}

# Parse .env.local (ignora comentários e linhas vazias)
$vars = @{}
Get-Content $envFile -Encoding UTF8 | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
        $key = $Matches[1].Trim()
        $val = $Matches[2].Trim().Trim('"').Trim("'").Trim()
        $vars[$key] = $val
    }
}

# NEXTAUTH_SECRET obrigatório
if (-not $vars["NEXTAUTH_SECRET"]) {
    $secret = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
    $vars["NEXTAUTH_SECRET"] = $secret
    Add-Content -Path $envFile -Value "`n# Preenchido automaticamente por set-cloud-run-env.ps1"
    Add-Content -Path $envFile -Value "NEXTAUTH_SECRET=$secret"
    Write-Host "NEXTAUTH_SECRET gerado e adicionado ao .env.local" -ForegroundColor Green
}

# URL canónica do consumer (finmemory.com.br) — nunca usar parceiros neste serviço
$consumerBase = 'https://finmemory.com.br'
$appUrl = $vars['NEXT_PUBLIC_APP_URL']
if ($appUrl -and $appUrl -match '^https?://' -and $appUrl -notmatch 'parceiros\.') {
  $consumerBase = $appUrl.TrimEnd('/')
} elseif ($appUrl -match 'parceiros\.') {
  Write-Host "Aviso: .env.local tem URL parceiros; Cloud Run finmemory usa $consumerBase" -ForegroundColor Yellow
}
$vars['NEXTAUTH_URL'] = $consumerBase
$vars['NEXT_PUBLIC_APP_URL'] = $consumerBase
Write-Host "NEXTAUTH_URL = $consumerBase (servico consumer finmemory)" -ForegroundColor Cyan

# Chaves necessárias para o Cloud Run (auth + Supabase + Mapbox + Stripe)
$required = @(
    "NEXTAUTH_URL", "NEXTAUTH_SECRET",
    "FINMEMORY_ADMIN_EMAILS",
    "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REDIRECT_URI",
    "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN",
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_RETAILER_APP_URL",
    "SUPABASE_JWT_SECRET",
    # Stripe — server-side runtime (não embutidas no bundle)
    "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PLUS_PRICE_ID", "STRIPE_PRO_PRICE_ID", "STRIPE_FAMILIA_PRICE_ID", "STRIPE_ENTERPRISE_PRICE_ID",
    "FINMEMORY_PUBLIC_ACCESS",
    "FINMEMORY_PRIVATE_BETA_EMAILS",
    "FINMEMORY_RESTRICTED_FEATURE_EMAILS",
    "NEXT_PUBLIC_RESTRICTED_FEATURE_EMAILS"
)
# Garantir callback Google = NEXTAUTH_URL + /api/auth/callback/google
$vars["GOOGLE_REDIRECT_URI"] = $vars["NEXTAUTH_URL"].TrimEnd('/') + "/api/auth/callback/google"
# STRIPE_APP_BASE_URL é exclusivo de dev local (aponta para localhost) — nunca enviar para produção
$vars.Remove("STRIPE_APP_BASE_URL") | Out-Null
# App aberto por defeito — evita FINMEMORY_LOCKDOWN_SINGLE_USER bloquear login em produção
if (-not $vars["FINMEMORY_PUBLIC_ACCESS"]) {
    $vars["FINMEMORY_PUBLIC_ACCESS"] = "1"
}
$vars.Remove("FINMEMORY_LOCKDOWN_SINGLE_USER") | Out-Null
# App lojista: Cloud Run (subdomínio custom só após domain mapping no GCP + DNS)
$retailerRunUrl = "https://finmemorycomerciantes-836908221936.southamerica-east1.run.app"
if (-not $vars["NEXT_PUBLIC_RETAILER_APP_URL"] -or $vars["NEXT_PUBLIC_RETAILER_APP_URL"] -match 'parceiros\.finmemory\.com\.br') {
    $vars["NEXT_PUBLIC_RETAILER_APP_URL"] = $retailerRunUrl
    Write-Host "NEXT_PUBLIC_RETAILER_APP_URL = $retailerRunUrl (finmemorycomerciantes)" -ForegroundColor Cyan
}
# Rollout gradual: mapa, lista, missões, código de barras — só allowlist (não depende de PUBLIC_ACCESS)
$vars['FINMEMORY_RESTRICTED_FEATURE_EMAILS'] = 'finmemory.oficial@gmail.com,nickzila2709@gmail.com'
$vars['NEXT_PUBLIC_RESTRICTED_FEATURE_EMAILS'] = $vars['FINMEMORY_RESTRICTED_FEATURE_EMAILS']
$envMap = @{}
foreach ($k in $required) {
    if ($vars[$k]) {
        $envMap[$k] = $vars[$k]
    } else {
        Write-Host "Aviso: $k nao definido no .env.local" -ForegroundColor Yellow
    }
}

# Opcional: Pluggy (Open Finance) — só envia se existir no .env.local
$pluggyOptional = @(
    "PLUGGY_CLIENT_ID", "PLUGGY_CLIENT_SECRET", "PLUGGY_WEBHOOK_SECRET",
    "PLUGGY_WIDGET_SANDBOX_CONNECTOR_ONLY", "PLUGGY_SANDBOX_CONNECTOR_ID"
)
foreach ($k in $pluggyOptional) {
    if ($vars[$k]) { $envMap[$k] = $vars[$k] }
}

# Opcional: Cloudflare R2 (comprovantes OCR) + OpenAI
$r2Optional = @(
    "CLOUDFLARE_R2_ENDPOINT", "CLOUDFLARE_R2_ACCESS_KEY_ID", "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
    "CLOUDFLARE_R2_BUCKET", "CLOUDFLARE_R2_PUBLIC_BASE_URL",
    "CLOUDFLARE_R2_BUCKET_NAME", "CLOUDFLARE_R2_PUBLIC_URL",
    "OPENAI_API_KEY"
)
foreach ($k in $r2Optional) {
    if ($vars[$k]) { $envMap[$k] = $vars[$k] }
}

# Scrapers / crons (Anthropic no servidor — GitHub Actions só chama POST /api/scraper/dia)
$scraperOptional = @(
    "ANTHROPIC_API_KEY",
    "DIA_IMPORT_SECRET",
    "CRON_SECRET",
    "BOT_PROMO_OWNER_USER_ID",
    "DIA_BOT_USER_ID",
    "MAP_QUICK_ADD_BOT_USER_ID",
    "SCRAPER_DIA_REGION",
    "SCRAPER_DIA_BATCH_SIZE",
    "GOOGLE_API_KEY",
    "GOOGLE_CSE_ID",
    "COSMOS_API_TOKEN",
    "COSMOS_LOOKUP_SECRET"
)
foreach ($k in $scraperOptional) {
    if ($vars[$k]) { $envMap[$k] = $vars[$k] }
}
if (-not $envMap["SCRAPER_DIA_REGION"]) {
    $envMap["SCRAPER_DIA_REGION"] = "grande_sp"
}

if ($envMap.Count -eq 0) {
    Write-Host "Nenhuma variavel para atualizar." -ForegroundColor Red
    exit 1
}

# Mesclar com env já no serviço e gravar YAML (suporta vírgulas e @ nos valores)
$merged = @{}
try {
    $desc = gcloud run services describe finmemory --region southamerica-east1 --project $FINMEMORY_GCP_PROJECT --format=json 2>$null | ConvertFrom-Json
    $containerEnv = $desc.spec.template.spec.containers[0].env
    if ($containerEnv) {
        foreach ($item in $containerEnv) {
            if ($item.name -and $null -ne $item.value) {
                $merged[$item.name] = [string]$item.value
            }
        }
    }
} catch {
    Write-Host "Aviso: nao foi possivel ler env atual do Cloud Run; apenas chaves do .env.local serao enviadas." -ForegroundColor Yellow
}
foreach ($entry in $envMap.GetEnumerator()) {
    $merged[$entry.Key] = [string]$entry.Value
}

$envFile = Join-Path $env:TEMP "finmemory-cloud-run-env.yaml"
$lines = @()
foreach ($entry in $merged.GetEnumerator() | Sort-Object Name) {
    $val = [string]$entry.Value
    $escaped = $val -replace '\\', '\\\\' -replace '"', '\"'
    $lines += "$($entry.Key): `"$escaped`""
}
Set-Content -Path $envFile -Value ($lines -join "`n") -Encoding UTF8

Write-Host "Atualizando Cloud Run ($FINMEMORY_GCP_PROJECT) com variaveis de autenticacao e Supabase..." -ForegroundColor Cyan
& gcloud run services update finmemory --region southamerica-east1 --project $FINMEMORY_GCP_PROJECT --env-vars-file $envFile
if ($LASTEXITCODE -ne 0) { exit 1 }
$url = $vars["NEXTAUTH_URL"]
Write-Host "Cloud Run atualizado. Teste o login em: $url" -ForegroundColor Green
