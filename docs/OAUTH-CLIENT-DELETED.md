# Erros de OAuth no login com Google

**Projeto GCP de produção:** `exalted-entry-480904-s9`. Não uses `finmemory-667c3` para credenciais nem Cloud Run.

## Erro 400: redirect_uri_mismatch

**"Acesso bloqueado: a solicitação desse app é inválida"** — a URL de retorno que o app envia ao Google **não está** na lista de "URIs de redirecionamento autorizados" do cliente OAuth.

**O que fazer:**

1. Abra **[Credenciais](https://console.cloud.google.com/apis/credentials?project=exalted-entry-480904-s9)** (projeto **exalted-entry-480904-s9**).
2. Clique no **cliente OAuth 2.0** usado pelo app (tipo "Aplicativo da Web").
3. Em **"URIs de redirecionamento autorizados"**, inclua **todas** as URLs que usas em produção, por exemplo:

   - `https://finmemory.com.br/api/auth/callback/google`
   - `https://www.finmemory.com.br/api/auth/callback/google`
   - `https://finmemory-836908221936.southamerica-east1.run.app/api/auth/callback/google` *(URL direto Cloud Run no projeto exalted, se aplicável)*
   - `http://localhost:3000/api/auth/callback/google` *(dev)*

   Confirma o URL exato do serviço com:
   `gcloud run services describe finmemory --region=southamerica-east1 --project=exalted-entry-480904-s9 --format="value(status.url)"`
   e acrescenta `/api/auth/callback/google` se for diferente do acima.

4. Em **"Origens JavaScript autorizadas"**, as origens correspondentes (sem `/api/...`).

5. **SALVAR**. Aguardar propagação e tentar de novo.

---

## Erro: "The OAuth client was deleted" (401 deleted_client)

Cria um **novo** cliente OAuth e atualiza `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` no `.env.local` e no Cloud Run.

## 1. Criar novo cliente OAuth no projeto exalted-entry-480904-s9

1. **[APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials?project=exalted-entry-480904-s9)** — confirma o projeto no topo.
2. **CREATE CREDENTIALS** → **OAuth client ID** → tipo **Web application**.
3. Origens e redirect URIs como na secção acima (domínio + Cloud Run + localhost se precisares).

---

## 2. Atualizar variáveis

### Cloud Run (produção)

1. Atualiza **.env.local** com o novo Client ID e Secret.
2. PowerShell, na pasta do repo:
   ```powershell
   gcloud config set project exalted-entry-480904-s9
   .\scripts\set-cloud-run-env.ps1
   ```
   O script atualiza o serviço **finmemory** no projeto **exalted-entry-480904-s9**.

Ou manual: [Cloud Run](https://console.cloud.google.com/run?project=exalted-entry-480904-s9) → **finmemory** → variáveis.

---

## 3. Testar

- Limpa cookies ou aba anónima.
- Abre **https://finmemory.com.br** (ou o URL `*.run.app` que usas) e testa o login.
