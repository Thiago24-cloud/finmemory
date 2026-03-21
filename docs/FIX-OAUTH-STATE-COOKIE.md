# Corrigir "State cookie was missing" no OAuth

## Causa (pelos logs)

- **Signin** ocorre em: `https://finmemory-836908221936.southamerica-east1.run.app`
- **Callback** do Google vai para: `https://finmemory-n7rmjs3dia-rj.a.run.app`

São **dois hosts diferentes**. O cookie de state é definido no primeiro e não é enviado no segundo → "State cookie was missing".

O redirect do Google segue o **redirect_uri** que está registrado no **Google OAuth Client** (e que o NextAuth envia na autorização). Se esse URI for o da URL antiga `finmemory-n7rmjs3dia-rj.a.run.app`, o callback sempre cai lá e o cookie falha.

## O que fazer

### 1. Google Cloud Console – Redirect URIs

1. Acesse: [APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials?project=exalted-entry-480904-s9)
2. Abra o **OAuth 2.0 Client ID** usado pelo app (tipo "Web application").
3. Em **Authorized redirect URIs**:
   - **Remova** qualquer URI com `finmemory-n7rmjs3dia-rj.a.run.app` (URL antiga/outra região).
   - Deixe **apenas**:
     - `https://finmemory.com.br/api/auth/callback/google`
     - Se quiser testar direto no Cloud Run: `https://finmemory-836908221936.southamerica-east1.run.app/api/auth/callback/google`
4. Salve.

Assim o Google só redireciona para um dos hosts que você usa, e o cookie de state passa a bater.

### 2. NEXTAUTH_URL no Cloud Run

O app precisa usar o **mesmo host** que o usuário usa para abrir o site, para que o redirect_uri e os cookies coincidam.

- Se o acesso é por **https://finmemory.com.br** (recomendado):
  - **NEXTAUTH_URL** = `https://finmemory.com.br` (sem barra no final)
- Se for só para testar na URL do Run:
  - **NEXTAUTH_URL** = `https://finmemory-836908221936.southamerica-east1.run.app`

Para definir no projeto **exalted-entry-480904-s9** (sem NEXTAUTH_URL no .env.local):

```powershell
.\scripts\set-cloud-run-env.ps1
```

Ou no Console: Cloud Run → serviço **finmemory** → Edit & deploy new revision → Variables → `NEXTAUTH_URL` = `https://finmemory.com.br`.

### 3. Sempre acessar pelo mesmo host

- Em produção: abrir **https://finmemory.com.br** (Firebase Hosting + proxy para o Cloud Run).
- Evitar misturar: abrir em finmemory.com.br e ter callback em run.app, ou o contrário.

## Resumo

| Onde | O que fazer |
|------|-------------|
| Google OAuth Client | Redirect URIs só com `https://finmemory.com.br/api/auth/callback/google` (e opcionalmente o da 836908221936). **Remover** `finmemory-n7rmjs3dia-rj.a.run.app`. |
| Cloud Run (NEXTAUTH_URL) | `https://finmemory.com.br` |
| Usuário | Acessar o app por **https://finmemory.com.br** |

Depois disso, faça um novo login em https://finmemory.com.br e confira se o callback e a sessão funcionam.
