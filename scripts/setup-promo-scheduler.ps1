# Cria conta de serviço + 2 Cloud Schedulers (manhã / fim de tarde) para executar o job
# finmemory-promo-agent-all (todas as redes do mapa).
#
# Pré-requisito: npm run deploy:promo-agent-all já executado pelo menos uma vez.
# Uso (PowerShell, na raiz do repo):
#   .\scripts\setup-promo-scheduler.ps1
#
# Variáveis opcionais: $env:GCLOUD_PROJECT, $env:PROMO_JOB_REGION (default southamerica-east1)

# Continue: gcloud escreve em stderr mesmo em sucesso; "Stop" quebrava no `describe` quando a SA ainda não existe.
$ErrorActionPreference = "Continue"
$PROJECT = if ($env:GCLOUD_PROJECT) { $env:GCLOUD_PROJECT } else { "exalted-entry-480904-s9" }
$REGION = if ($env:PROMO_JOB_REGION) { $env:PROMO_JOB_REGION } else { "southamerica-east1" }
$SCHEDULER_LOCATION = $REGION
$JOB_NAME = if ($env:PROMO_JOB_NAME) { $env:PROMO_JOB_NAME } else { "finmemory-promo-agent-all" }
$SA_ID = "finmemory-promo-scheduler"
$SA_EMAIL = "${SA_ID}@${PROJECT}.iam.gserviceaccount.com"
$URI = "https://run.googleapis.com/v2/projects/${PROJECT}/locations/${REGION}/jobs/${JOB_NAME}:run"

Write-Host "[setup-promo-scheduler] Projeto=$PROJECT regiao=$REGION job=$JOB_NAME"

gcloud iam service-accounts describe $SA_EMAIL --project=$PROJECT 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  gcloud iam service-accounts create $SA_ID `
    --display-name="FinMemory executor do job de promocoes" `
    --project=$PROJECT
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

gcloud projects add-iam-policy-binding $PROJECT `
  --member="serviceAccount:${SA_EMAIL}" `
  --role="roles/run.developer" `
  --quiet

function Ensure-SchedulerJob($JobId, $Schedule, $Description) {
  gcloud scheduler jobs describe $JobId --location=$SCHEDULER_LOCATION --project=$PROJECT 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "  Atualizando scheduler existente: $JobId"
    gcloud scheduler jobs update http $JobId `
      --location=$SCHEDULER_LOCATION `
      --project=$PROJECT `
      --schedule=$Schedule `
      --time-zone="America/Sao_Paulo" `
      --uri=$URI `
      --http-method=POST `
      --headers="Content-Type=application/json" `
      --message-body="{}" `
      --oauth-service-account-email=$SA_EMAIL `
      --oauth-token-scope="https://www.googleapis.com/auth/cloud-platform" `
      --attempt-deadline=600s `
      --quiet
  } else {
    Write-Host "  Criando scheduler: $JobId"
    gcloud scheduler jobs create http $JobId `
      --location=$SCHEDULER_LOCATION `
      --project=$PROJECT `
      --schedule=$Schedule `
      --time-zone="America/Sao_Paulo" `
      --uri=$URI `
      --http-method=POST `
      --headers="Content-Type=application/json" `
      --message-body="{}" `
      --oauth-service-account-email=$SA_EMAIL `
      --oauth-token-scope="https://www.googleapis.com/auth/cloud-platform" `
      --attempt-deadline=600s `
      --description=$Description `
      --quiet
  }
}

Ensure-SchedulerJob -JobId "finmemory-promo-all-am" -Schedule "30 7 * * *" -Description "FinMemory promocoes todas as redes (manha)"
Ensure-SchedulerJob -JobId "finmemory-promo-all-pm" -Schedule "0 19 * * *" -Description "FinMemory promocoes todas as redes (noite)"

Write-Host ""
Write-Host "Concluido. Listar: gcloud scheduler jobs list --location=$SCHEDULER_LOCATION --project=$PROJECT"
Write-Host "Testar job manualmente: gcloud run jobs execute $JOB_NAME --region=$REGION --project=$PROJECT --wait"
