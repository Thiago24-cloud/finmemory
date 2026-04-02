#!/usr/bin/env bash
# Mesmo fluxo que setup-promo-scheduler.ps1 (Linux / Cloud Shell).
set -euo pipefail
PROJECT="${GCLOUD_PROJECT:-exalted-entry-480904-s9}"
REGION="${PROMO_JOB_REGION:-southamerica-east1}"
SCHEDULER_LOCATION="$REGION"
JOB_NAME="${PROMO_JOB_NAME:-finmemory-promo-agent-all}"
SA_ID="finmemory-promo-scheduler"
SA_EMAIL="${SA_ID}@${PROJECT}.iam.gserviceaccount.com"
URI="https://run.googleapis.com/v2/projects/${PROJECT}/locations/${REGION}/jobs/${JOB_NAME}:run"

echo "[setup-promo-scheduler] Projeto=$PROJECT regiao=$REGION job=$JOB_NAME"

if ! gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT" &>/dev/null; then
  gcloud iam service-accounts create "$SA_ID" \
    --display-name="FinMemory executor do job de promocoes" \
    --project="$PROJECT"
fi

gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/run.developer" \
  --quiet

ensure_job() {
  local id="$1" schedule="$2" desc="$3"
  if gcloud scheduler jobs describe "$id" --location="$SCHEDULER_LOCATION" --project="$PROJECT" &>/dev/null; then
    echo "  Atualizando scheduler: $id"
    gcloud scheduler jobs update http "$id" \
      --location="$SCHEDULER_LOCATION" \
      --project="$PROJECT" \
      --schedule="$schedule" \
      --time-zone="America/Sao_Paulo" \
      --uri="$URI" \
      --http-method=POST \
      --headers="Content-Type=application/json" \
      --message-body="{}" \
      --oauth-service-account-email="$SA_EMAIL" \
      --oauth-token-scope="https://www.googleapis.com/auth/cloud-platform" \
      --attempt-deadline=600s \
      --quiet
  else
    echo "  Criando scheduler: $id"
    gcloud scheduler jobs create http "$id" \
      --location="$SCHEDULER_LOCATION" \
      --project="$PROJECT" \
      --schedule="$schedule" \
      --time-zone="America/Sao_Paulo" \
      --uri="$URI" \
      --http-method=POST \
      --headers="Content-Type=application/json" \
      --message-body="{}" \
      --oauth-service-account-email="$SA_EMAIL" \
      --oauth-token-scope="https://www.googleapis.com/auth/cloud-platform" \
      --attempt-deadline=600s \
      --description="$desc" \
      --quiet
  fi
}

ensure_job finmemory-promo-all-am "30 7 * * *" "FinMemory promocoes todas as redes (manha)"
ensure_job finmemory-promo-all-pm "0 19 * * *" "FinMemory promocoes todas as redes (noite)"

echo ""
echo "Concluído. Testar: gcloud run jobs execute $JOB_NAME --region=$REGION --project=$PROJECT --wait"
