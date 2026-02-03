# Checklist: variáveis no Cloud Run (comparar com quando estava funcionando)

Use esta lista no **Cloud Run → finmemory → Editar e implantar nova revisão → Variáveis e segredos** e confira se **todas** estão com o mesmo valor que você tinha quando o app funcionava.

---

## Variáveis obrigatórias (o app usa no código)

| Variável | Onde o app usa | Valor esperado (exemplo) |
|----------|----------------|--------------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Dashboard, NextAuth, Gmail sync, OCR | `https://SEU_PROJETO.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Dashboard, add-receipt, Supabase client no browser | `eyJ...` (chave anon do Supabase) |
| `SUPABASE_SERVICE_ROLE_KEY` | NextAuth (session), Gmail sync, OCR save/process | `eyJ...` (chave service_role do Supabase) |
| `NEXTAUTH_URL` | NextAuth (obrigatório em produção) | `https://finmemory-836908221936.southamerica-east1.run.app` |
| `NEXTAUTH_SECRET` | NextAuth (criptografia de sessão) | Uma chave longa (ex.: `openssl rand -base64 32`) |
| `GOOGLE_CLIENT_ID` | NextAuth + Gmail sync (renovação de token) | `....apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | NextAuth + Gmail sync (renovação de token) | `GOCSPX-...` |
| `GOOGLE_REDIRECT_URI` | Gmail sync (ao renovar token) | `https://finmemory-836908221936.southamerica-east1.run.app/api/auth/callback/google` |
| `OPENAI_API_KEY` | Gmail sync (extração de NF) + OCR process-receipt | `sk-...` |

---

## Como conferir no Cloud Run

1. Acesse: **https://console.cloud.google.com/run**
2. Projeto correto → região **southamerica-east1** → serviço **finmemory**
3. Clique em **finmemory** → aba **"Variáveis e segredos"** (ou edite uma revisão para ver as variáveis)
4. Para cada linha da tabela acima, verifique:
   - O **nome** está igual? (incluindo `NEXT_PUBLIC_` onde tem)
   - O **valor** é o mesmo que você usa no `.env.local` quando roda em localhost?

---

## Pontos que costumam sumir ou mudar

- **Nova revisão sem variáveis:** ao fazer deploy (build novo), às vezes a nova revisão não herda as variáveis; é preciso preencher de novo na revisão atual.
- **`GOOGLE_REDIRECT_URI`:** o código do Gmail sync usa essa variável na renovação do token. Se não existir no Cloud Run, a renovação pode falhar. Valor correto:  
  `https://finmemory-836908221936.southamerica-east1.run.app/api/auth/callback/google`
- **`NEXTAUTH_URL`:** tem que ser exatamente a URL do app no Cloud Run (sem barra no final):  
  `https://finmemory-836908221936.southamerica-east1.run.app`

---

## Depois de conferir

Se alguma variável estiver faltando ou diferente, corrija no Cloud Run, salve (nova revisão) e teste de novo. Não é preciso mudar nada no código se os valores forem os mesmos que você já usava quando estava tudo ok.
