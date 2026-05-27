$ErrorActionPreference = "Stop"
$p = "exalted-entry-480904-s9"
$r = "southamerica-east1"
$desc = gcloud run services describe finmemory --region $r --project $p --format=json | ConvertFrom-Json
$jwt = ($desc.spec.template.spec.containers[0].env | Where-Object { $_.name -eq "SUPABASE_JWT_SECRET" }).value
if (-not $jwt) {
    Write-Host "SUPABASE_JWT_SECRET nao encontrado no servico finmemory." -ForegroundColor Red
    exit 1
}
& gcloud run services update finmemory-retailer --region $r --project $p --update-env-vars "SUPABASE_JWT_SECRET=$jwt" --quiet
Write-Host "SUPABASE_JWT_SECRET copiado para finmemory-retailer." -ForegroundColor Green
