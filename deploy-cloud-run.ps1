# Script de Deploy para Cloud Run
# Execute este script após configurar gcloud CLI
# Deploy vai para o projeto de produção (exalted-entry-480904-s9)

# Projeto de produção — Cloud Run + 100 usuários
$PROJECT_ID = "exalted-entry-480904-s9"

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

# Usar projeto de produção
Write-Host "`n📋 Configuração do projeto:" -ForegroundColor Cyan
gcloud config set project $PROJECT_ID 2>&1 | Out-Null
Write-Host "   Project ID: $PROJECT_ID [producao]" -ForegroundColor Green

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
    $content = Get-Content ".env.local" -Raw
    if ($content -match 'NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN\s*=\s*(.+)') {
        $MAPBOX_TOKEN = $Matches[1].Trim().Trim('"').Trim("'").Trim()
    }
    if ($MAPBOX_TOKEN) {
        Write-Host "   🗺️  Token Mapbox encontrado no .env.local" -ForegroundColor Green
    }
}
if (-not $MAPBOX_TOKEN) {
    Write-Host "   ⚠️  NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN não encontrado no .env.local - mapa ficará desabilitado no deploy" -ForegroundColor Yellow
}

# Opção 1: Cloud Build (recomendado - não precisa Docker local)
Write-Host "`n🔨 Iniciando build via Cloud Build..." -ForegroundColor Cyan
Write-Host "   Isso pode levar alguns minutos..." -ForegroundColor Yellow

# Token entre aspas duplas para que = ou vírgula no valor não quebrem o parsing do gcloud
$subs = "_COMMIT_SHA=$COMMIT_SHA,_MAPBOX_ACCESS_TOKEN=`"$MAPBOX_TOKEN`""
Write-Host "`nExecutando: gcloud builds submit --project $PROJECT_ID --config cloudbuild.yaml --substitutions=..." -ForegroundColor Gray

try {
    & gcloud builds submit --project $PROJECT_ID --config cloudbuild.yaml "--substitutions=$subs"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✅ Deploy concluído com sucesso!" -ForegroundColor Green
        $PROJECT_NUMBER = gcloud projects describe $PROJECT_ID --format="value(projectNumber)" 2>$null
        if ($PROJECT_NUMBER) {
            Write-Host "`n🌐 Sua aplicação está disponível em:" -ForegroundColor Cyan
            Write-Host "   https://finmemory-$PROJECT_NUMBER.southamerica-east1.run.app" -ForegroundColor Yellow
        } else {
            Write-Host "`n🌐 Veja a URL do serviço em: Console Cloud Run (projeto $PROJECT_ID)" -ForegroundColor Cyan
        }
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
