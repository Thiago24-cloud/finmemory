# Explicação dos logs do Cloud Run

## 1. Qual serviço está gerando esses logs?

Os logs que você colou mostram requisições para:

- **`https://finmemory-n7rmjs3dia-rj.a.run.app`**

O deploy atual do FinMemory está no serviço:

- **`https://finmemory-836908221936.southamerica-east1.run.app`**
- Produção (Firebase Hosting): **https://finmemory.com.br**

Ou seja: **finmemory-n7rmjs3dia-rj.a.run.app** é outro serviço (projeto ou revisão antiga). Para ver o que está acontecendo no app em produção, abra os logs do serviço **finmemory** no projeto **exalted-entry-480904-s9**, região **southamerica-east1**. No Console, confira se o filtro de serviço/URL está apontando para o serviço correto.

---

## 2. "window is not defined" / unhandledRejection

- **O que é:** algum código (ou dependência) acessa `window` ou `document` durante a execução no **servidor** (Node), onde esses objetos não existem.
- **O que fazemos:** o `instrumentation.js` do projeto escuta `unhandledRejection` e registra o aviso; com isso o processo **não cai**.
- **Impacto:** a página continua sendo servida; pode haver um aviso nos logs. Se quiser eliminar por completo, é preciso encontrar o trecho que usa `window`/`document` no servidor (por exemplo em código que roda em todas as páginas ou em algum layout) e protegê-lo com `typeof window !== 'undefined'` ou mover para código que só rode no cliente.

---

## 3. 404 em POST para /api/upwload, /api/uploads, etc.

- **O que é:** as requisições são **POST** com **curl 8.7.1** para vários caminhos de “upload” (ex.: `/api/upwload`, `/api/uploads`, `/api/files/upload`, `/api/v1/upload`, …). O FinMemory **não** implementa essas rotas.
- **Quem faz:** normalmente são **scanners/bots** (segurança ou crawlers) testando endpoints comuns de upload.
- **Resposta do app:** 404 (e mensagem do Next.js do tipo “Failed to find Server Action”). Isso é **esperado** e não indica bug no app.
- **Ação:** nenhuma necessária; pode ignorar ou filtrar esses 404 nos logs se quiser reduzir ruído.

---

## 4. Redirect do login indo para a URL errada (n7rmjs3dia)

Nos logs aparece: você acessa **finmemory-836908221936.southamerica-east1.run.app**, clica em “Entrar com Google”, e o **redirect** depois do signin vai para **finmemory-n7rmjs3dia-rj.a.run.app**. Isso mistura dois serviços e quebra o fluxo (cookies/estado em um host, callback em outro).

**O que fazer:**

1. **Cloud Run (serviço que serve finmemory-836908221936):**  
   Variável **NEXTAUTH_URL** deve ser **exatamente**  
   `https://finmemory-836908221936.southamerica-east1.run.app`  
   (e não finmemory.com.br nem finmemory-n7rmjs3dia-rj.a.run.app).

2. **Google Cloud Console → Credentials → OAuth 2.0 Client ID (Web):**  
   Em **Authorized redirect URIs**:
   - **Remova** qualquer URI com `finmemory-n7rmjs3dia-rj.a.run.app`.
   - Deixe apenas:  
     `https://finmemory-836908221936.southamerica-east1.run.app/api/auth/callback/google`  
   (e, se for usar, `https://finmemory.com.br/api/auth/callback/google`).

3. **Usar sempre o mesmo link:**  
   Abra o app só por **https://finmemory-836908221936.southamerica-east1.run.app**.  
   Não use finmemory-n7rmjs3dia-rj.a.run.app (se for outro serviço, pode pausar ou apagar para não confundir).

4. **callbackUrl:**  
   Se aparecer `?callbackUrl=https://finmemory.com.br` na URL, é porque em algum lugar o app ou o usuário está pedindo callback para o domínio. Para “só link do Cloud Run”, o callback deve ser a própria URL do Run; depois de ajustar NEXTAUTH_URL e OAuth acima, o NextAuth usa esse valor.

---

## Resumo

| Log / Comportamento | Causa | Ação |
|---------------------|--------|------|
| Requisições em **finmemory-n7rmjs3dia-rj.a.run.app** | Serviço/URL antigo ou diferente | Usar só **finmemory-836908221936.southamerica-east1.run.app**; remover redirect URI n7rmjs3dia no Google OAuth |
| Redirect após “Entrar com Google” vai para n7rmjs3dia | NEXTAUTH_URL errada ou OAuth com URI antiga | Ajustar NEXTAUTH_URL no Cloud Run e redirect URIs no Google (ver secção 4 acima) |
| `window is not defined` / unhandledRejection | Código ou lib acessando `window`/`document` no servidor | Já mitigado pelo instrumentation; opcional: localizar e proteger o trecho no código |
| 404 em POST para vários `/api/...upload...` | Bots testando endpoints de upload | Esperado; nenhuma ação obrigatória |
| **TypeError: Invalid URL** em /api/auth/providers ou /api/auth/error | Cookie `callbackUrl` com valor errado (token/CSRF) era passado ao `redirect` e o default fazia `new URL(url)`. | O callback **redirect** foi sobrescrito para não chamar `new URL()` com valor inválido. Limpar cookies do domínio do Cloud Run e testar de novo. |
| **`[next-auth] Invalid URL caught, redirecting to error page`** | O handler do NextAuth capturou o erro e redirecionou para `/auth-error?error=Configuration`. | Significa que ainda há cookie corrompido ou valor inválido. **Limpe todos os cookies** do site `finmemory-836908221936.southamerica-east1.run.app` (Chrome: Configurações → Cookies → ver dados do site → remover). Depois acesse de novo e tente o login. |
| **POST signin/google → depois GET `/api/auth/signin?csrf=true` → volta para `/`** | Validação CSRF falhou. | Use o login por formulário (já no código). Limpe os cookies e teste. |
| **`adapter_error_getUserByAccount` / PGRST106: The schema must be one of the following: public, graphql_public** | O adapter do NextAuth usa o schema `next_auth` no Supabase, mas a API PostgREST não expõe esse schema. | No **Supabase**: SQL Editor → execute `ALTER ROLE authenticator SET pgrst.db_schemas = 'public, graphql_public, next_auth';` e depois `NOTIFY pgrst;`. Ver `docs/next-auth-supabase-schema.sql` (final do arquivo). |
| **permission denied for schema next_auth (42501)** | A role que executa as queries (ex.: authenticator) não tem USAGE no schema nem nas tabelas. | No **Supabase**: SQL Editor → execute o conteúdo de `docs/supabase-next-auth-grant-permissions.sql` para dar GRANT USAGE no schema e GRANT nas tabelas a service_role e authenticator. |
| **adapter_error_linkAccount / PGRST204: Could not find the 'refresh_token_expires_in' column of 'accounts'** | A tabela `next_auth.accounts` não tem a coluna que o NextAuth envia ao salvar a conta OAuth. | No **Supabase**: SQL Editor → execute `docs/supabase-next-auth-accounts-add-column.sql` (ALTER TABLE next_auth.accounts ADD COLUMN refresh_token_expires_in integer). Depois NOTIFY pgrst; se precisar. |
| **error=OAuthAccountNotLinked** (User saved mas redirect para /?error=OAuthAccountNotLinked) | Usuário já existe em `next_auth.users` (mesmo email) mas a conta Google não está em `next_auth.accounts`; NextAuth por padrão não vincula automaticamente. | No código: `allowDangerousEmailAccountLinking: true` (já aplicado). Se ainda falhar: no Supabase execute `docs/supabase-next-auth-clean-user-by-email.sql` (apaga o usuário órfão); em seguida faça login de novo para criar user + account do zero. |
