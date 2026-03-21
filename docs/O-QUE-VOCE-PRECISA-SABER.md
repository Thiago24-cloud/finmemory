# O que você precisa saber – FinMemory

Resumo do que importa para deploy, auth e manutenção.

---

## 1. Deploy

- **Cloud Run:** `.\deploy-cloud-run.ps1` (projeto `exalted-entry-480904-s9`, região `southamerica-east1`).
- **Firebase Hosting:** `firebase deploy --only hosting` — faz o proxy de `finmemory.com.br` para o Cloud Run.
- **URLs:**
  - App público: **https://finmemory.com.br**
  - Cloud Run direto: **https://finmemory-836908221936.southamerica-east1.run.app**

---

## 2. Autenticação (NextAuth + Google)

- **Estratégia de sessão:** `database` (sessões no Supabase, não JWT).
- **Adapter:** `@next-auth/supabase-adapter` — usa o schema **`next_auth`** no Supabase (tabelas `users`, `sessions`, `accounts`, `verification_tokens`).
- **Schema no Supabase:** Se ainda não rodou, execute o SQL em **`docs/next-auth-supabase-schema.sql`** no Supabase → SQL Editor. Sem isso, login com “database” pode falhar ou travar em “Carregando…”.

---

## 3. Variáveis de ambiente (Cloud Run)

No Cloud Run, o app precisa de:

| Variável | Uso |
|----------|-----|
| `NEXTAUTH_URL` | **https://finmemory.com.br** (domínio que o usuário vê; obrigatório para cookies e callback). |
| `NEXTAUTH_SECRET` | Chave secreta do NextAuth. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth Google. |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase. |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service role (adapter + APIs server-side). |

Para atualizar env no Cloud Run: `.\scripts\set-cloud-run-env.ps1` (ajuste o script se precisar de outras vars).

---

## 4. Google Cloud Console – OAuth

- **Credenciais:** [APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials?project=exalted-entry-480904-s9).
- **Authorized redirect URIs** do client “Web application” usado pelo app:
  - **https://finmemory.com.br/api/auth/callback/google** (obrigatório).
  - Opcional para testes diretos no Cloud Run: `https://finmemory-836908221936.southamerica-east1.run.app/api/auth/callback/google`.
- **Não use** URIs antigas de outros domínios (ex.: `finmemory-n7rmjs3dia-rj.a.run.app`). Se estiverem lá, o callback pode ir para outro host e dar “State cookie was missing”.

---

## 5. Cookies e domínio

- Cookies do NextAuth estão configurados com **`domain: '.finmemory.com.br'`** para funcionar atrás do proxy (Firebase Hosting → Cloud Run).
- Por isso **NEXTAUTH_URL** deve ser **https://finmemory.com.br** em produção. Se o usuário acessar por outra URL, a sessão pode não persistir.

---

## 6. Página inicial “Carregando…”

- A `/` mostra “Carregando…” enquanto o NextAuth resolve a sessão.
- Se **/api/auth/session** falhar ou demorar (ex.: adapter sem tabelas no Supabase), a página pode ficar travada. Por isso foi adicionado um **timeout de 5 segundos**: depois disso a tela de login (botão “Entrar com Google”) aparece mesmo assim.
- Se isso acontecer sempre, confira: schema `next_auth` no Supabase e env `SUPABASE_SERVICE_ROLE_KEY` no Cloud Run.

---

## 7. Onde ver logs e docs

- **Logs Cloud Run:** [Console Cloud Run → finmemory → Logs](https://console.cloud.google.com/run?project=exalted-entry-480904-s9) ou ver **`docs/VER-LOGS-CLOUD-RUN.md`**.
- **Schema NextAuth no Supabase:** **`docs/next-auth-supabase-schema.sql`**.
- **Problemas de OAuth/callback:** **`docs/FIX-OAUTH-STATE-COOKIE.md`** (se existir).

---

## 8. Duas “users” no Supabase

- **`next_auth.users`** (schema `next_auth`): usada pelo NextAuth para sessão e adapter. Não edite direto no seu fluxo de negócio.
- **`public.users`** (sua tabela): e-mail, nome, `google_id`, tokens do Gmail, etc. É a tabela do seu app; o callback de sign-in faz upsert nela por e-mail.

As duas convivem: NextAuth gerencia login/sessão; seu código usa `public.users` para dados do FinMemory.
