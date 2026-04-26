# Script de Deploy para Cloud Run
# Execute este script apos configurar gcloud CLI
# Deploy vai para o projeto de producao (exalted-entry-480904-s9)

# Projeto de producao - Cloud Run
$PROJECT_ID = "exalted-entry-480904-s9"

Write-Host "Iniciando deploy do FinMemory para Cloud Run..." -ForegroundColor Cyan

# Verificar se gcloud esta instalado
try {
    $gcloudVersion = gcloud --version 2>&1
    Write-Host "[OK] gcloud encontrado" -ForegroundColor Green
} catch {
    Write-Host "[ERRO] gcloud nao encontrado. Instale o Google Cloud SDK:" -ForegroundColor Red
    Write-Host "   https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    exit 1
}

# Usar projeto de producao
Write-Host "`nConfiguracao do projeto:" -ForegroundColor Cyan
gcloud config set project $PROJECT_ID 2>&1 | Out-Null
Write-Host "   Project ID: $PROJECT_ID [producao]" -ForegroundColor Green

# Verificar se esta autenticado
Write-Host "`nVerificando autenticacao..." -ForegroundColor Cyan
$authStatus = gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>&1
if (-not $authStatus) {
    Write-Host "[ERRO] Nao autenticado. Execute: gcloud auth login" -ForegroundColor Red
    exit 1
}
Write-Host "   [OK] Autenticado como: $authStatus" -ForegroundColor Green

# Verificar se Docker esta disponivel (para build local opcional)
$useDocker = $false
try {
    docker --version | Out-Null
    $useDocker = $true
    Write-Host "`nDocker encontrado (build local disponivel)" -ForegroundColor Green
} catch {
    Write-Host "`n[AVISO] Docker nao encontrado. Usando Cloud Build..." -ForegroundColor Yellow
}

# Obter COMMIT_SHA (ou usar timestamp)
$COMMIT_SHA = git rev-parse --short HEAD 2>&1
if ($LASTEXITCODE -ne 0) {
    $COMMIT_SHA = "manual-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
}
Write-Host "`nTag da imagem: $COMMIT_SHA" -ForegroundColor Cyan

# Ler NEXT_PUBLIC_* do .env depois .env.local (ultimo sobrescreve - igual ao Node/dotenv)
$SUPABASE_URL = ""
$SUPABASE_ANON = ""
$MAPBOX_TOKEN = ""
$STRIPE_PK = ""
foreach ($envFile in @(".env", ".env.local")) {
    if (-not (Test-Path $envFile)) { continue }
    Get-Content $envFile | ForEach-Object {
        $line = $_
        if ($line -match '^\s*NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.+)$') {
            $SUPABASE_URL = $Matches[1].Trim().Trim('"').Trim("'")
        }
        if ($line -match '^\s*NEXT_PUBLIC_SUPABASE_ANON_KEY\s*=\s*(.+)$') {
            $SUPABASE_ANON = $Matches[1].Trim().Trim('"').Trim("'")
        }
        if ($line -match '^\s*NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN\s*=\s*(.+)$') {
            $MAPBOX_TOKEN = $Matches[1].Trim().Trim('"').Trim("'")
        }
        if ($line -match '^\s*NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY\s*=\s*(.+)$') {
            $STRIPE_PK = $Matches[1].Trim().Trim('"').Trim("'")
        }
    }
}
if (-not $SUPABASE_URL -or -not $SUPABASE_ANON) {
    Write-Host "[ERRO] Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no .env ou .env.local" -ForegroundColor Red
    exit 1
}
Write-Host "   [OK] Supabase (URL + anon) carregado do .env" -ForegroundColor Green
if ($MAPBOX_TOKEN) {
    Write-Host "   [OK] Token Mapbox encontrado" -ForegroundColor Green
} else {
    Write-Host "   [AVISO] NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN vazio -- mapa pode falhar no build" -ForegroundColor Yellow
}
if ($STRIPE_PK) {
    Write-Host "   [OK] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY encontrado" -ForegroundColor Green
} else {
    Write-Host "[ERRO] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY vazio -- checkout vai sumir/falhar no cliente." -ForegroundColor Red
    Write-Host "       Defina NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY no .env.local antes do deploy." -ForegroundColor Yellow
    exit 1
}

# Cloud Build (recomendado - nao precisa Docker local)
Write-Host "`nIniciando build via Cloud Build..." -ForegroundColor Cyan
Write-Host "   Isso pode levar alguns minutos..." -ForegroundColor Yellow

# Inclui Supabase + Mapbox + Stripe publishable key (baked no bundle pelo Dockerfile)
$subs = "_COMMIT_SHA=$COMMIT_SHA,_NEXT_PUBLIC_SUPABASE_URL=`"$SUPABASE_URL`",_NEXT_PUBLIC_SUPABASE_ANON_KEY=`"$SUPABASE_ANON`",_MAPBOX_ACCESS_TOKEN=`"$MAPBOX_TOKEN`",_NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=`"$STRIPE_PK`""
Write-Host "`nExecutando: gcloud builds submit --project $PROJECT_ID --config cloudbuild.yaml --substitutions=..." -ForegroundColor Gray

try {
    & gcloud builds submit --project $PROJECT_ID --config cloudbuild.yaml "--substitutions=$subs"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n[OK] Deploy concluido com sucesso!" -ForegroundColor Green
        $PROJECT_NUMBER = gcloud projects describe $PROJECT_ID --format="value(projectNumber)" 2>$null
        if ($PROJECT_NUMBER) {
            Write-Host "`nAplicacao disponivel em:" -ForegroundColor Cyan
            Write-Host "   https://finmemory-$PROJECT_NUMBER.southamerica-east1.run.app" -ForegroundColor Yellow
        } else {
            Write-Host "`nVeja a URL do servico em: Console Cloud Run (projeto $PROJECT_ID)" -ForegroundColor Cyan
        }
    } else {
        Write-Host "`n[ERRO] Deploy falhou. Verifique os logs acima." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "`n[ERRO] Erro durante o deploy:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

Write-Host "`nPronto! Deploy concluido." -ForegroundColor Green