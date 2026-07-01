# Team-Task-Hub (referência)

Cópia local do projeto Replit **Team-Task-Hub**, usada como referência para portar telas ao app Parceiros (`apps/retailer`).

## Origem

Projeto Replit com:

- `artifacts/pm-app` — UI React (Vite)
- `artifacts/api-server` — API Express + Drizzle (Postgres próprio)

## Port para FinMemory

| Replit | FinMemory Parceiros |
|--------|---------------------|
| `GET /api/v1/vendas` | `GET /api/parceiros/painel/vendas` |
| `GET /api/v1/vendas/resumo` | `GET /api/parceiros/painel/vendas/resumo` |
| `POST /api/v1/payments/webhook` | `POST /api/parceiros/painel/payments/webhook` |
| `POST /api/v1/payments/simulate` | `POST /api/parceiros/painel/payments/simulate` |
| Tabela `produtos` | `public.produtos_loja` (com `loja_id`) |
| Tabelas `vendas` / `venda_items` | `public.vendas_terminal` / `venda_terminal_itens` |

A aba **Vendas** no painel está em `apps/retailer/components/merchant/MerchantVendasSection.jsx`.

Próximas portas possíveis: Tasks/Team, Scanner, Produtos PM (se distintos de Ofertas).
