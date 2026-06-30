# Cielo — gateway de pagamentos FinMemory

Integração REST com a [API eCommerce Cielo](https://docs.cielo.com.br/ecommerce-cielo/).

## Credenciais (MerchantId + MerchantKey)

**Não use** o cadastro sandbox legado (`cadastrosandbox.cieloecommerce.cielo.com.br`) como caminho principal.

### Produção (FinMemory)

1. Acesse o **portal do lojista**: [cielo.com.br](https://www.cielo.com.br) (login da conta contratada).
2. Menu **E-commerce** → **API E-commerce Cielo** → **Acessar**.
3. No painel (Braspag/Cielo): **Cielo** → **Credenciais**.
4. Copie o **Merchant ID**; clique em **Visualizar Merchant Key** (código por e-mail).
5. No `.env.local` / Cloud Run:

```env
CIELO_MERCHANT_ID=seu-guid
CIELO_MERCHANT_KEY=sua-chave-40-caracteres
CIELO_ENV=production
```

Documentação oficial: [docs.cielo.com.br/ecommerce-cielo](https://docs.cielo.com.br/ecommerce-cielo/)  
Portal desenvolvedores: [desenvolvedores.cielo.com.br](https://desenvolvedores.cielo.com.br/api-portal/pt-br/content/api-ecommerce)

### Sandbox (opcional, só para testes)

- Credenciais de teste vêm pelo **portal de desenvolvedores** ou suporte Cielo (`cieloecommerce@cielo.com.br`).
- **Pix no sandbox** costuma exigir habilitação manual com a Cielo.
- URLs de API sandbox (já configuradas no código quando `CIELO_ENV=sandbox`):
  - Transação: `https://apisandbox.cieloecommerce.cielo.com.br`
  - Consulta: `https://apiquerysandbox.cieloecommerce.cielo.com.br`

## Arquitetura

```
packages/shared/src/payments/cielo/
  config.ts           → CIELO_* env, URLs sandbox/produção
  cieloService.ts     → createPayment, getPaymentStatus
  paymentStatus.ts    → mapa Status 0–20 → estado FinMemory
  types.ts

apps/consumer/
  pages/api/payments/cielo/create.js
  pages/api/payments/cielo/status/[paymentId].js
  lib/cielo/persistCieloPayment.js   → auditoria Supabase
  hooks/useCieloCheckout.js
  components/payments/CieloCheckoutPanel.js
  pages/pagamento.js                  → demo Pix (?amount=&description=)
```

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `CIELO_MERCHANT_ID` | Sim | GUID da loja |
| `CIELO_MERCHANT_KEY` | Sim | Chave de autenticação |
| `CIELO_ENV` | Não | `sandbox` (padrão) ou `production` |
| `CIELO_TRANSACTION_URL` | Não | Override URL de transação |
| `CIELO_QUERY_URL` | Não | Override URL de consulta |

## Status Cielo → FinMemory

| Status | Cielo | FinMemory | Confirmado? |
|--------|-------|-----------|-------------|
| 0 | Não finalizado | pending | Não |
| 1 | Autorizado | authorized | **Sim** |
| 2 | Pago | paid | **Sim** |
| 3 | Negado | denied | Não |
| 12 | Pendente (Pix QR) | pending | Não |
| 10/11/13 | Cancelado/estorno/aborto | — | Não |

## Migration

Execute no Supabase:

`supabase/migrations/20260626120000_cielo_payments.sql`

## Teste local

1. Credenciais do **portal Cielo** (produção) ou sandbox habilitado pela Cielo no `.env.local`
2. `npm run dev`
3. Login → `/pagamento?amount=1000&description=Teste%20FinMemory`
4. Ou `POST /api/payments/cielo/create` com sessão autenticada

## Segurança

- `userId` sempre da sessão NextAuth — nunca do body
- Cartão (quando habilitado) deve migrar para tokenização Cielo; evite PCI no servidor
- Tabela `cielo_payments` grava `PaymentId`, `ReturnCode` e JSON bruto para auditoria
