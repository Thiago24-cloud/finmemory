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

# URL canónica: domínio público (checkout/OAuth) tem prioridade sobre *.run.app
$canonicalApp = $vars["NEXT_PUBLIC_APP_URL"]
if ($canonicalApp -and $canonicalApp -match '^https?://') {
    $vars["NEXTAUTH_URL"] = $canonicalApp.TrimEnd('/')
    Write-Host "NEXTAUTH_URL = NEXT_PUBLIC_APP_URL ($($vars['NEXTAUTH_URL']))" -ForegroundColor Cyan
} elseif (-not $vars["NEXTAUTH_URL"]) {
    $runUrl = gcloud run services describe finmemory --region=southamerica-east1 --project=$FINMEMORY_GCP_PROJECT --format="value(status.url)" 2>$null
    if ($runUrl) {
        $vars["NEXTAUTH_URL"] = $runUrl.TrimEnd('/')
    } else {
        $vars["NEXTAUTH_URL"] = "https://finmemory-836908221936.southamerica-east1.run.app"
        Write-Host "Aviso: gcloud describe falhou; usando NEXTAUTH_URL fallback fixo." -ForegroundColor Yellow
    }
}

# Chaves necessárias para o Cloud Run (auth + Supabase + Mapbox + Stripe)
$required = @(
    "NEXTAUTH_URL", "NEXTAUTH_SECRET",
    "FINMEMORY_ADMIN_EMAILS",
    "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REDIRECT_URI",
    "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN",
    "NEXT_PUBLIC_APP_URL",
    # Stripe — server-side runtime (não embutidas no bundle)
    "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PLUS_PRICE_ID", "STRIPE_PRO_PRICE_ID", "STRIPE_FAMILIA_PRICE_ID", "STRIPE_ENTERPRISE_PRICE_ID",
    "FINMEMORY_PUBLIC_ACCESS"
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

if ($envMap.Count -eq 0) {
    Write-Host "Nenhuma variavel para atualizar." -ForegroundColor Red
    exit 1
}

# Escapar vírgulas nos valores para gcloud no Windows (ex.: lista de e-mails admin)
$pairs = @()
foreach ($entry in $envMap.GetEnumerator()) {
    $val = [string]$entry.Value -replace ',', '^,'
    $pairs += "$($entry.Key)=$val"
}
$envVarsStr = $pairs -join ","

Write-Host "Atualizando Cloud Run ($FINMEMORY_GCP_PROJECT) com variaveis de autenticacao e Supabase..." -ForegroundColor Cyan
& gcloud run services update finmemory --region southamerica-east1 --project $FINMEMORY_GCP_PROJECT --update-env-vars $envVarsStr
if ($LASTEXITCODE -ne 0) { exit 1 }
$url = $vars["NEXTAUTH_URL"]
Write-Host "Cloud Run atualizado. Teste o login em: $url" -ForegroundColor Green
