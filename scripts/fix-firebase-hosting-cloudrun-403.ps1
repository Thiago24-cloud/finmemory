# Corrige 403 Forbidden quando o Firebase Hosting acessa o Cloud Run.
# O agente do Firebase Hosting precisa da permissão "Cloud Run Invoker" no serviço.

$ErrorActionPreference = "Stop"
$PROJECT_ID = "finmemory-667c3"
$REGION = "southamerica-east1"
$SERVICE_NAME = "finmemory"

Write-Host "Corrigindo permissao: Firebase Hosting -> Cloud Run (finmemory)" -ForegroundColor Cyan
Write-Host "Projeto: $PROJECT_ID | Regiao: $REGION" -ForegroundColor Gray
Write-Host ""

# Obter numero do projeto (necessario para o email do agente do Firebase Hosting)
$PROJECT_NUMBER = gcloud projects describe $PROJECT_ID --format="value(projectNumber)" 2>$null
if (-not $PROJECT_NUMBER) {
    Write-Host "Erro: nao foi possivel obter o numero do projeto. Verifique se gcloud esta configurado e se voce tem acesso ao projeto $PROJECT_ID" -ForegroundColor Red
    exit 1
}

# Tentar primeiro o agente do Firebase Hosting; se nao existir, usar allUsers (acesso publico)
$FIREBASE_HOSTING_AGENT = "serviceAccount:service-$PROJECT_NUMBER@gcp-sa-firebasehosting.iam.gserviceaccount.com"
Write-Host "Concedendo roles/run.invoker no servico Cloud Run '$SERVICE_NAME' (acesso publico)..." -ForegroundColor Yellow
gcloud run services add-iam-policy-binding $SERVICE_NAME `
    --region=$REGION `
    --member="allUsers" `
    --role="roles/run.invoker"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Erro ao aplicar a permissao. Verifique se o projeto e a regiao estao corretos e se voce tem permissao de IAM no projeto." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Permissao aplicada com sucesso." -ForegroundColor Green
Write-Host "Teste novamente: https://finmemory-667c3.web.app e https://finmemory.com.br" -ForegroundColor Cyan
