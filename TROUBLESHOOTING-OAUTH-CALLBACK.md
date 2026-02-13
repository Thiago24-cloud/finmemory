# OAUTH_CALLBACK_ERROR no login com Google (Cloud Run)

## O que fazer quando aparece `[next-auth][error][OAUTH_CALLBACK_ERROR]`

### 1. Ver o erro real nos logs do Cloud Run

- No [Google Cloud Console](https://console.cloud.google.com/run?project=exalted-entry-480904-s9) → serviço **finmemory** → aba **Logs**.
- Procure por `[next-auth][OAUTH_ERROR]` – a mensagem e o detalhe do erro aparecem ali.
- Para ainda mais detalhe, defina no Cloud Run a variável **NEXTAUTH_DEBUG=1**, faça um novo deploy (ou atualize env vars do serviço), tente login de novo e confira os logs.

### 2. Conferir Redirect URI no Google Cloud Console

O erro costuma ser **redirect_uri_mismatch** quando a URI de retorno não bate com a configurada.

1. Acesse [APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials?project=exalted-entry-480904-s9).
2. Abra o **OAuth 2.0 Client ID** usado pelo app (tipo “Web application”).
3. Em **Authorized redirect URIs** deve existir **exatamente** (sem barra no final):
   ```text
   https://finmemory-836908221936.southamerica-east1.run.app/api/auth/callback/google
   ```
4. Em **Authorized JavaScript origins** (se existir), inclua:
   ```text
   https://finmemory-836908221936.southamerica-east1.run.app
   ```
5. Salve e espere alguns minutos antes de testar de novo.

### 3. Conferir variáveis no Cloud Run

No Cloud Run → **Edit & deploy new revision** → **Variables & Secrets**:

| Variável | Valor esperado |
|----------|----------------|
| **NEXTAUTH_URL** | `https://finmemory-836908221936.southamerica-east1.run.app` (sem barra no final) |
| **NEXTAUTH_SECRET** | Chave longa (ex.: gerada com `openssl rand -base64 32`) |
| **GOOGLE_CLIENT_ID** | `....apps.googleusercontent.com` |
| **GOOGLE_CLIENT_SECRET** | `GOCSPX-...` |

O NextAuth monta a URL de callback com `NEXTAUTH_URL + '/api/auth/callback/google'`. Se **NEXTAUTH_URL** estiver errada ou com barra no final, o callback pode falhar.

### 4. Atualizar variáveis com o script

Na raiz do projeto (com `.env.local` preenchido):

```powershell
.\scripts\set-cloud-run-env.ps1
```

Isso atualiza as env vars do serviço finmemory a partir do `.env.local` (incluindo NEXTAUTH_URL e NEXTAUTH_SECRET).

### 5. Depois de corrigir

- Remova **NEXTAUTH_DEBUG** do Cloud Run se tiver adicionado só para debug.
- Tente login em aba anônima ou com cookies do site limpos.
