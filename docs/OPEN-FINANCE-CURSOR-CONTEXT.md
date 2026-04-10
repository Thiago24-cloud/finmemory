# Contexto para o Cursor — Open Finance (Pluggy)

Cole o bloco abaixo no início da conversa ao implementar integração Pluggy / Open Finance.

---

## Bloco principal

```
Projeto: FinMemory — finanças pessoais.
Stack: Next.js 15 com Pages Router (pasta pages/), Supabase, Cloud Run.
APIs: pages/api/*.js — seguir o mesmo estilo das rotas existentes.
Auth: NextAuth em pages/api/auth/[...nextauth].js (Google + adapter Supabase).
Open Finance via Pluggy (middleware).
Implementar em pages/api/pluggy/... e componentes em components/ — NÃO usar app/api/ nem App Router para isso.
Não alterar arquivos fora do escopo sem eu pedir.
```

---

## Detalhes do padrão de API neste repo

- Export default: `async function handler(req, res)` com checagem de `req.method`.
- Rotas expostas como `/api/...` (ex.: `pages/api/pluggy/connect-token.js` → `POST /api/pluggy/connect-token`).
- Para rotas que exigem usuário logado: usar `getServerSession` com `authOptions` importado de `./auth/[...nextauth]` (ajustar caminho relativo conforme a pasta).

## Variáveis de ambiente (exemplo)

Definir no `.env.local` e no Cloud Run quando existir integração:

- `PLUGGY_CLIENT_ID`
- `PLUGGY_CLIENT_SECRET`
- `PLUGGY_WIDGET_SANDBOX_CONNECTOR_ONLY=false` — produção com bancos reais (omitir ou `true` só para trial / Pluggy Bank)
- `PLUGGY_WEBHOOK_SECRET` (opcional, recomendado com webhook HTTPS)

Para sincronizar o `.env.local` → Cloud Run (inclui chaves Pluggy acima quando preenchidas): `.\scripts\set-cloud-run-env.ps1`

**Webhook:** `https://finmemory.com.br/api/pluggy/webhook` — implementação em `pages/api/pluggy/webhook.js` (Pages Router, não `app/api/...`). Validação do segredo: `X-Pluggy-Signature`, `X-Pluggy-Webhook-Secret`, `Authorization: Bearer` ou `?secret=` (testes).

(Documentação oficial: [Pluggy](https://docs.pluggy.ai).)

---

## Fluxo de dados (contas e transações no Supabase)

1. **Tabelas** (`supabase/migrations/20260410200000_bank_accounts_bank_transactions.sql`):
   - `bank_accounts` — uma linha por conta Pluggy (`pluggy_account_id`), com `user_id`, `item_id`, nome, tipo, saldo, moeda.
   - `bank_transactions` — movimentos com `pluggy_transaction_id` único por `user_id`; FK para `bank_accounts.id`.

2. **Sincronização** (servidor, chaves Pluggy só no backend):
   - `lib/pluggySyncOpenFinance.js` — `syncOpenFinanceForItem(supabase, pluggy, userId, itemId)` faz `fetchAccounts` + `fetchAllTransactions` por conta e faz upsert nas duas tabelas.
   - Em paralelo com `syncTransactionsForItem` (import para `transacoes`), é chamado em:
     - `pages/api/pluggy/webhook.js` após upsert de `bank_connections` nos eventos `item/created`, `item/updated`, `item/login_succeeded`, e nos eventos `transactions/*`;
     - `POST /api/pluggy/sync-transactions` (corpo `{ itemId }`).
   - Em `item/deleted`, apaga-se `bank_accounts` com esse `item_id` (cascata remove `bank_transactions`) e depois `bank_connections`.

3. **Leitura para o app**:
   - `GET /api/open-finance/summary` — sessão NextAuth (`session.user.supabaseId`), Supabase com **service role** no servidor. Devolve contas, últimas 50 transações, totais de receitas/despesas do **mês civil em `America/Sao_Paulo`**, e `syncing` se alguma `bank_connections.status` for `UPDATING` ou `SYNCING`.
   - Query opcional: `?accountId=<uuid interno de bank_accounts>` para filtrar as 50 transações por conta.

4. **Cliente React**:
   - `hooks/useOpenFinance.js` — `useOpenFinanceSummary({ enabled })`, `useBankAccounts`, `useBankTransactions(accountId, { enabled })`.
   - `components/OpenFinance/TransactionList.jsx` — lista agrupada por data (crédito verde / débito vermelho, skeleton).

5. **Dashboard** — bloco “Open Finance” após o cartão de saldo (`pages/dashboard.js`), com link para Configurações.

**Segurança:** não expor `PLUGGY_CLIENT_ID` / `PLUGGY_CLIENT_SECRET` no client; rotas de escrita usam `SUPABASE_SERVICE_ROLE_KEY` no servidor.
