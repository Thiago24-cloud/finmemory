# Segurança operacional (Cloud Run + Auth local)

## 1) Secrets fora do código

Use Secret Manager para guardar segredos e injete no Cloud Run:

```powershell
gcloud secrets create NEXTAUTH_SECRET --replication-policy="automatic"
gcloud secrets versions add NEXTAUTH_SECRET --data-file=-
gcloud run services update finmemory --region=southamerica-east1 --project=exalted-entry-480904-s9 --update-secrets=NEXTAUTH_SECRET=NEXTAUTH_SECRET:latest
```

Repita para `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `PLUGGY_CLIENT_SECRET` e outros segredos.

## 2) Monitoramento de tentativas de login

Os eventos de auth geram logs com prefixo:

- `[auth][signup]`
- `[auth][login] invalid_password`
- `[auth][login] invalid_otp`
- `[auth][login] email_not_verified`

No Logs Explorer, filtre por:

```text
resource.type="cloud_run_revision"
resource.labels.service_name="finmemory"
textPayload:("[auth][login]")
```

## 3) Alertas de pico de erro/login

Crie métrica de logs e alerta no Cloud Monitoring:

1. Logs Router -> Log-based metric:
   - filtro: `textPayload:("[auth][login] invalid_password" OR "[auth][login] invalid_otp")`
2. Alerting -> Create policy:
   - condição: métrica acima de `30` eventos em `5 min`
   - canal: email/telegram/slack

## 4) Rotina mínima recomendada

- Rotacionar `NEXTAUTH_SECRET` e `SUPABASE_SERVICE_ROLE_KEY` trimestralmente.
- Revisar logs de auth semanalmente.
- Manter `NEXTAUTH_DEBUG=0` em produção (ligar só para troubleshooting).
