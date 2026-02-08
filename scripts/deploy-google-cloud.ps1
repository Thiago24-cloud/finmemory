# Deploy FinMemory para Google Cloud Run (manual: build + push + deploy)
# Use este script no terminal do Cursor depois de conectar o gcloud (veja GOOGLE-CLOUD-CURSOR.md)

$ErrorActionPreference = "Stop"
$PROJECT_ID = "finmemory-836908221936"
$REGION = "southamerica-east1"
$IMAGE_NAME = "gcr.io/$PROJECT_ID/finmemory"

Write-Host "Projeto: $PROJECT_ID | Região: $REGION" -ForegroundColor Cyan
Write-Host ""

# 1. Configurar projeto padrão
Write-Host "[1/4] Configurando projeto gcloud..." -ForegroundColor Yellow
gcloud config set project $PROJECT_ID
if ($LASTEXITCODE -ne 0) { exit 1 }

# 2. Docker: configurar para usar GCR
Write-Host "[2/4] Configurando Docker para GCR..." -ForegroundColor Yellow
gcloud auth configure-docker gcr.io --quiet
if ($LASTEXITCODE -ne 0) { exit 1 }

# 3. Build da imagem (na raiz do projeto)
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Push-Location $root
try {
    Write-Host "[3/4] Build da imagem Docker..." -ForegroundColor Yellow
    docker build -t "${IMAGE_NAME}:latest" .
    if ($LASTEXITCODE -ne 0) { exit 1 }

    # 4. Push para GCR
    Write-Host "[4/4] Push para Google Container Registry..." -ForegroundColor Yellow
    docker push "${IMAGE_NAME}:latest"
    if ($LASTEXITCODE -ne 0) { exit 1 }
} finally {
    Pop-Location
}

# 5. Deploy no Cloud Run
Write-Host "Fazendo deploy no Cloud Run..." -ForegroundColor Yellow
gcloud run deploy finmemory `
  --image "${IMAGE_NAME}:latest" `
  --region $REGION `
  --platform managed `
  --allow-unauthenticated `
  --memory 1Gi `
  --timeout 60s `
  --max-instances 10 `
  --cpu 1

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Deploy concluído. URL: https://finmemory-836908221936.southamerica-east1.run.app" -ForegroundColor Green
    Write-Host "Lembrete: as variáveis de ambiente são configuradas no Console do Cloud Run (Variáveis e segredos)." -ForegroundColor Gray
} else {
    exit 1
}
