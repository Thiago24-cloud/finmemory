# Checklist: erros de redirecionamento e loop após login

Siga esta linha de raciocínio para evitar loops ou falhas de redirecionamento após o login com Google. O FinMemory usa **NextAuth.js** (Google) + **Supabase como banco** (não Supabase Auth para login).

---

## 1. Redirect URI no Google Cloud Console

**Problema comum:** a URL que o app envia e a autorizada no console não batem.

**O que fazer:**

1. Acesse **Google Cloud Console** → **APIs e Serviços** → **Credenciais**.
2. Abra o **Client ID OAuth 2.0** (tipo “Aplicativo da Web”) usado pelo FinMemory.
3. Em **URIs de redirecionamento autorizados**, adicione **todas as variações** que o app pode usar (copie e cole uma por linha):

   ```
   https://finmemory-836908221936.southamerica-east1.run.app/api/auth/callback/google
   https://finmemory.com.br/api/auth/callback/google
   http://localhost:3000/api/auth/callback/google
   ```

   - **Cloud Run:** produção (acesso pelo link do Google).
   - **finmemory.com.br:** se usar domínio customizado.
   - **localhost:** desenvolvimento e testes locais.

4. Em **Origens JavaScript autorizadas**, adicione **todas as origens** de onde o app roda (sem barra no final; uma por linha):

   ```
   https://finmemory-836908221936.southamerica-east1.run.app
   https://finmemory.com.br
   http://localhost:3000
   ```

   Assim o Google aceita requisições OAuth vindas do Cloud Run, do domínio customizado e do localhost.

5. **Remova** URIs e origens antigas que não usa mais (ex.: Vercel, outro Cloud Run, `*.web.app` se não usar Firebase Hosting).

**Importante:** O callback do NextAuth é sempre `{NEXTAUTH_URL}/api/auth/callback/google`. O valor de `NEXTAUTH_URL` no Cloud Run deve ser exatamente a URL pela qual o usuário acessa o app (Cloud Run ou domínio customizado).

---

## 2. Supabase (Site URL e Redirect URLs)

No FinMemory o **login é feito pelo NextAuth (Google)**, não pelo Supabase Auth. O Supabase é usado como:

- banco de sessões/usuários do NextAuth (adapter),
- tabela `users` e demais dados do app.

Por isso, **Authentication → URL Configuration** no painel do Supabase **não afeta** o fluxo de login com Google. Só seria relevante se você passasse a usar Supabase Auth (ex.: login por e-mail do Supabase).

**O que conferir no Supabase (opcional, para outros fluxos):**

- Se no futuro usar **Supabase Auth** (magic link, OAuth pelo Supabase, etc.) ou quiser deixar já configurado:
  - **Authentication** → **URL Configuration**
  - **Site URL:** domínio principal (ex.: `https://finmemory-836908221936.southamerica-east1.run.app` ou `https://finmemory.com.br`).
  - **Redirect URLs:** adicione **todas as variações** que o app pode usar (uma por linha):

    ```
    https://finmemory-836908221936.southamerica-east1.run.app
    https://finmemory-836908221936.southamerica-east1.run.app/
    https://finmemory.com.br
    https://finmemory.com.br/
    http://localhost:3000
    http://localhost:3000/
    ```

  Assim o Supabase aceita redirect para Cloud Run, domínio customizado e localhost em testes.

Para o cenário atual (só NextAuth + Google), essa configuração não afeta o login; pode fazer para evitar bloqueios se um dia usar Supabase Auth.

---

## 3. Variáveis de ambiente no Cloud Run

As variáveis precisam estar corretas no serviço **finmemory** (Cloud Run), não só no `.env.local` local.

**Variáveis críticas para auth e redirect:**

| Variável | Uso | Exemplo (só Cloud Run) |
|----------|-----|-------------------------|
| `NEXTAUTH_URL` | URL base do app (onde o usuário acessa). Define o host dos redirects e cookies. | `https://finmemory-836908221936.southamerica-east1.run.app` |
| `NEXTAUTH_SECRET` | Assinatura de cookies/session. | string longa e aleatória |
| `GOOGLE_CLIENT_ID` | Client ID OAuth do Google. | do Console do Google |
| `GOOGLE_CLIENT_SECRET` | Client secret OAuth do Google. | do Console do Google |
| `GOOGLE_REDIRECT_URI` | Opcional; o script `set-cloud-run-env.ps1` monta como `NEXTAUTH_URL` + `/api/auth/callback/google`. | igual ao redirect URI cadastrado no Google |

**Variáveis Supabase (dados do app + adapter do NextAuth):**

| Variável | Uso |
|----------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase (build e runtime). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave anônima (pública). |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de serviço (só no servidor; adapter e APIs). |

**Observação:** O FinMemory **não usa** `NEXT_PUBLIC_SITE_URL`. A “URL base do app” é controlada por **NEXTAUTH_URL**. Se você usar domínio customizado (ex.: finmemory.com.br), defina `NEXTAUTH_URL=https://finmemory.com.br` no Cloud Run e inclua o redirect URI correspondente no Google (item 1).

**Como atualizar no Cloud Run:**

- Rode `.\scripts\set-cloud-run-env.ps1` (a partir do `.env.local`) para enviar as variáveis ao serviço, ou
- No Console: **Cloud Run** → serviço **finmemory** → **Editar e implantar nova revisão** → **Variáveis e segredos**.

---

## 4. Middleware e rota /auth/callback (Next.js)

**Middleware:** O projeto **não tem** `middleware.ts` / `middleware.js`. Redirecionamentos de auth são feitos pelo NextAuth e pelas páginas (ex.: `getServerSideProps` com redirect para login). Não há middleware interferindo no redirect pós-login.

**Rota `/auth/callback`:** Existe em `pages/auth/callback.js`. Ela **só redireciona** para o callback correto do NextAuth:

- Requisições a `/auth/callback?...` são redirecionadas para `/api/auth/callback/google?...`
- Útil se algum cliente (ex.: app mobile) usar `/auth/callback` em vez de `/api/auth/callback/google`.

O fluxo “code → session” e cookies são tratados pelo **NextAuth** em `/api/auth/[...nextauth]`. Se a troca falhar (ex.: cookie bloqueado, domínio errado, PKCE em outro provedor), o usuário não fica autenticado. O que já foi feito no projeto:

- **NEXTAUTH_URL** forçada em produção para a URL do Cloud Run (evita base errada).
- Callback **redirect** que não chama `new URL()` com valor inválido (evita `TypeError: Invalid URL` quando o cookie `callbackUrl` vem corrompido ou com token).
- Cookies sem `domain` fixo para funcionar no host atual (link do Cloud Run).

Se ainda houver loop ou redirect errado:

1. Confirme os itens **1** e **3** (Google + NEXTAUTH_URL).
2. Limpe os cookies do site (domínio do Cloud Run ou finmemory.com.br).
3. Ative logs: no Cloud Run defina `NEXTAUTH_DEBUG=1` e veja os logs da revisão para o erro exato.

---

## Resumo rápido

| Onde | O que verificar |
|------|-----------------|
| **Google Console** | Redirect URIs com exatamente a URL do app + `/api/auth/callback/google`; remover URIs antigas. |
| **Supabase** | Não afeta login Google atual; só importa se usar Supabase Auth. |
| **Cloud Run** | `NEXTAUTH_URL` = URL que o usuário usa; `NEXTAUTH_SECRET`, `GOOGLE_*`, Supabase e Mapbox preenchidos. |
| **Next.js** | Sem middleware de auth; `/auth/callback` só redireciona para NextAuth. Problemas de “code → session” e cookies já mitigados no NextAuth. |

Depois de ajustar, limpe os cookies do domínio do app e teste o login de novo.
