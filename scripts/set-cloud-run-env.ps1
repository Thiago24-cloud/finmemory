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

# URL do app: por padrão usa o URL canónico do serviço finmemory neste projeto
if (-not $vars["NEXTAUTH_URL"]) {
    $runUrl = gcloud run services describe finmemory --region=southamerica-east1 --project=$FINMEMORY_GCP_PROJECT --format="value(status.url)" 2>$null
    if ($runUrl) {
        $vars["NEXTAUTH_URL"] = $runUrl.TrimEnd('/')
    } else {
        $vars["NEXTAUTH_URL"] = "https://finmemory-836908221936.southamerica-east1.run.app"
        Write-Host "Aviso: gcloud describe falhou; usando NEXTAUTH_URL fallback fixo." -ForegroundColor Yellow
    }
}

# Chaves necessárias para o Cloud Run (auth + Supabase + Mapbox)
$required = @(
    "NEXTAUTH_URL", "NEXTAUTH_SECRET",
    "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REDIRECT_URI",
    "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN"
)
# Garantir callback Google = NEXTAUTH_URL + /api/auth/callback/google
$vars["GOOGLE_REDIRECT_URI"] = $vars["NEXTAUTH_URL"].TrimEnd('/') + "/api/auth/callback/google"
$pairs = @()
foreach ($k in $required) {
    if ($vars[$k]) {
        $v = $vars[$k] -replace '"', '\"'
        $pairs += "$k=$v"
    } else {
        Write-Host "Aviso: $k nao definido no .env.local" -ForegroundColor Yellow
    }
}
$envVarsStr = $pairs -join ","
if (-not $envVarsStr) {
    Write-Host "Nenhuma variavel para atualizar." -ForegroundColor Red
    exit 1
}

Write-Host "Atualizando Cloud Run ($FINMEMORY_GCP_PROJECT) com variaveis de autenticacao e Supabase..." -ForegroundColor Cyan
& gcloud run services update finmemory --region southamerica-east1 --project $FINMEMORY_GCP_PROJECT --update-env-vars $envVarsStr
if ($LASTEXITCODE -ne 0) { exit 1 }
$url = $vars["NEXTAUTH_URL"]
Write-Host "Cloud Run atualizado. Teste o login em: $url" -ForegroundColor Green
