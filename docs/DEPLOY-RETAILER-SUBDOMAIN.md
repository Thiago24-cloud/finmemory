# Deploy do app retailer com subdomínio

Este guia publica o app `@finmemory/retailer` no Cloud Run e liga `parceiros.finmemory.com.br`.

## 1) Deploy do serviço retailer

Da raiz do monorepo:

```bash
npm run deploy:cloud-run:retailer
```

Esse comando usa:
- `Dockerfile.retailer`
- `cloudbuild.retailer.yaml`
- serviço Cloud Run: `finmemory-retailer` (região `southamerica-east1`)

## 2) Variáveis obrigatórias no serviço retailer

Da raiz do monorepo (lê `.env.local` e força URLs `https://parceiros.finmemory.com.br`):

```powershell
.\scripts\set-cloud-run-env-retailer.ps1
```

Ou configure manualmente no Cloud Run (`finmemory-retailer`):

- `NEXTAUTH_URL=https://parceiros.finmemory.com.br`
- `NEXT_PUBLIC_APP_URL=https://parceiros.finmemory.com.br`
- `NEXT_PUBLIC_RETAILER_APP_URL=https://parceiros.finmemory.com.br`
- `NEXT_PUBLIC_SUPABASE_URL=...`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=...`
- `SUPABASE_SERVICE_ROLE_KEY=...`
- `SUPABASE_JWT_SECRET=...`
- `NEXTAUTH_SECRET=...`
- `GOOGLE_CLIENT_ID=...`
- `GOOGLE_CLIENT_SECRET=...`

## 3) Domínio customizado + DNS

**URL atual do serviço (sem DNS):**

```text
https://finmemory-retailer-836908221936.southamerica-east1.run.app
```

### 3a) Mapear domínio no GCP (recomendado)

1. [Cloud Run → finmemory-retailer](https://console.cloud.google.com/run/detail/southamerica-east1/finmemory-retailer?project=exalted-entry-480904-s9)
2. Aba **Integrações** → **Domínios personalizados** → **Adicionar mapeamento**
3. Domínio: `parceiros.finmemory.com.br`
4. O console mostra os registros DNS (geralmente **CNAME** ou **A/AAAA** para o Google). Copie e crie no provedor do `finmemory.com.br`.

Via CLI (requer `gcloud beta`):

```bash
gcloud beta run domain-mappings create \
  --service=finmemory-retailer \
  --domain=parceiros.finmemory.com.br \
  --region=southamerica-east1 \
  --project=exalted-entry-480904-s9
```

### 3b) DNS no provedor (ex.: Cloudflare)

Se `https://parceiros.finmemory.com.br` devolve **404** mas o Cloud Run responde em `https://finmemory-retailer-836908221936.southamerica-east1.run.app/parceiros`, o DNS/proxy está apontando para o serviço errado (ex.: consumer). Corrija:

| Campo | Valor |
|--------|--------|
| Tipo | `CNAME` (ou o que o GCP indicar no mapeamento) |
| Nome | `parceiros` |
| Destino | host indicado pelo GCP **ou** `finmemory-retailer-n7rmjs3dia-rj.a.run.app` |
| Proxy | Desligado no primeiro teste (DNS only), depois pode ligar |

Enquanto o subdomínio não estiver certo, `finmemory.com.br/parceiros` redireciona para a URL do Cloud Run `finmemory-retailer` (ver `next.config.ts` do consumer).

Após propagação:

```text
https://parceiros.finmemory.com.br/api/health
```

## 3c) Consumer (`finmemory.com.br`)

No Cloud Run **finmemory**, defina também:

- `NEXT_PUBLIC_RETAILER_APP_URL=https://parceiros.finmemory.com.br`

```powershell
gcloud run services update finmemory --region southamerica-east1 --project exalted-entry-480904-s9 --update-env-vars "NEXT_PUBLIC_RETAILER_APP_URL=https://parceiros.finmemory.com.br"
```

Ou rode `.\scripts\set-cloud-run-env.ps1` (já inclui essa chave).

## 6) Supabase Realtime (migration)

No [SQL Editor](https://supabase.com/dashboard/project/faxqrkxqfwjdavorxien/sql) do projeto, execute o conteúdo de:

`supabase/migrations/20260527120000_pedidos_loja_realtime.sql`

Ou, com CLI linkada: `npx supabase db push`

## 4) Google OAuth

No cliente OAuth (Google Cloud Console), adicionar:

- **Authorized JavaScript origins**:
  - `https://parceiros.finmemory.com.br`
- **Authorized redirect URIs**:
  - `https://parceiros.finmemory.com.br/api/auth/callback/google`

## 5) Smoke test (run.app ou domínio)

1. Abrir `https://parceiros.finmemory.com.br/login`
2. Login Google/email
3. Abrir `https://parceiros.finmemory.com.br/parceiros/painel`
4. Health: `https://parceiros.finmemory.com.br/api/health` deve retornar `200`
