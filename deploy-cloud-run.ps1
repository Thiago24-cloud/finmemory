# Script de Deploy para Cloud Run
# Execute este script após configurar gcloud CLI

Write-Host "🚀 Iniciando deploy do FinMemory para Cloud Run..." -ForegroundColor Cyan

# Verificar se gcloud está instalado
try {
    $gcloudVersion = gcloud --version 2>&1
    Write-Host "✅ gcloud encontrado" -ForegroundColor Green
} catch {
    Write-Host "❌ gcloud não encontrado. Instale o Google Cloud SDK:" -ForegroundColor Red
    Write-Host "   https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    exit 1
}

# Obter PROJECT_ID
Write-Host "`n📋 Configuração do projeto:" -ForegroundColor Cyan
$PROJECT_ID = gcloud config get-value project 2>&1
if (-not $PROJECT_ID -or $PROJECT_ID -match "unset") {
    Write-Host "❌ Nenhum projeto configurado. Configure com:" -ForegroundColor Red
    Write-Host "   gcloud config set project SEU_PROJECT_ID" -ForegroundColor Yellow
    exit 1
}
Write-Host "   Project ID: $PROJECT_ID" -ForegroundColor Green

# Verificar se está autenticado
Write-Host "`n🔐 Verificando autenticação..." -ForegroundColor Cyan
$authStatus = gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>&1
if (-not $authStatus) {
    Write-Host "❌ Não autenticado. Execute:" -ForegroundColor Red
    Write-Host "   gcloud auth login" -ForegroundColor Yellow
    exit 1
}
Write-Host "   ✅ Autenticado como: $authStatus" -ForegroundColor Green

# Verificar se Docker está disponível (para build local opcional)
$useDocker = $false
try {
    docker --version | Out-Null
    $useDocker = $true
    Write-Host "`n🐳 Docker encontrado (build local disponível)" -ForegroundColor Green
} catch {
    Write-Host "`n⚠️  Docker não encontrado. Usando Cloud Build..." -ForegroundColor Yellow
}

# Obter COMMIT_SHA (ou usar timestamp)
$COMMIT_SHA = git rev-parse --short HEAD 2>&1
if ($LASTEXITCODE -ne 0) {
    $COMMIT_SHA = "manual-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
}
Write-Host "`n📦 Tag da imagem: $COMMIT_SHA" -ForegroundColor Cyan

# Ler token Mapbox do .env.local (para o mapa funcionar no Cloud Run)
$MAPBOX_TOKEN = ""
if (Test-Path ".env.local") {
    $line = Get-Content ".env.local" | Where-Object { $_ -match '^\s*NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=(.+)$' } | Select-Object -First 1
    if ($line) {
        $MAPBOX_TOKEN = $line -replace '^\s*NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=', '' -replace '^["'']|["'']$', ''
        if ($MAPBOX_TOKEN) { Write-Host "   🗺️  Token Mapbox encontrado no .env.local" -ForegroundColor Green }
    }
}
if (-not $MAPBOX_TOKEN) {
    Write-Host "   ⚠️  NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN não encontrado no .env.local - mapa ficará desabilitado no deploy" -ForegroundColor Yellow
}

# Opção 1: Cloud Build (recomendado - não precisa Docker local)
Write-Host "`n🔨 Iniciando build via Cloud Build..." -ForegroundColor Cyan
Write-Host "   Isso pode levar alguns minutos..." -ForegroundColor Yellow

$subs = "_COMMIT_SHA=$COMMIT_SHA,_MAPBOX_ACCESS_TOKEN=$MAPBOX_TOKEN"
$buildCmd = "gcloud builds submit --config cloudbuild.yaml --substitutions=$subs"
Write-Host "`nExecutando: $buildCmd" -ForegroundColor Gray

try {
    Invoke-Expression $buildCmd
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✅ Deploy concluído com sucesso!" -ForegroundColor Green
        Write-Host "`n🌐 Sua aplicação está disponível em:" -ForegroundColor Cyan
        Write-Host "   https://finmemory-836908221936.southamerica-east1.run.app" -ForegroundColor Yellow
    } else {
        Write-Host "`n❌ Deploy falhou. Verifique os logs acima." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "`n❌ Erro durante o deploy:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

Write-Host "`n✨ Pronto! As correções do sync estão no ar." -ForegroundColor Green
