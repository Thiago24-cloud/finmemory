# Funcionalidades do Smart Receipt Scanner integradas ao FinMemory

Este documento lista o que foi trazido do repositório [smart-receipt-scanner](https://github.com/Thiago24-cloud/smart-receipt-scanner.git) para o FinMemory (Next.js).

## Novas tabelas / schema (Supabase)

- **partnerships** – Parceria entre dois usuários (convite por código, status: pending | active | rejected | cancelled).
- **shopping_list_items** – Lista de compras compartilhada por parceria (nome, quantidade, unidade, checked, added_by, partnership_id).
- **profiles** (opcional) – Se usar Supabase Auth: perfil com nome, email, avatar_url, last_sync.
- **price_points** – Coluna opcional `image_url` e bucket de storage `price-photos` para fotos ao compartilhar preço.

Funções Supabase (se usar migrations):

- `is_partner(user_id_a, user_id_b)` – Retorna se os dois usuários são parceiros ativos.
- `get_partner_id(user_id)` – Retorna o user_id do parceiro.

## Novas páginas

| Rota | Descrição |
|------|-----------|
| `/share-price` | Compartilhar um preço no mapa: produto, preço, loja, categoria, foto opcional, geolocalização. |
| `/manual-entry` | Lançamento manual de gasto (estabelecimento, valor, data, categoria) + criação de price_points com geolocalização do navegador. |
| `/partnership` | Criar parceria (gerar código de convite) ou entrar com código do parceiro. |
| `/shopping-list` | Lista de compras da parceria: adicionar itens, marcar como comprado. |

## Lógica reutilizada

- **autoPricePoints (cliente)** – Após salvar um gasto manual (ou quando o usuário permitir localização), usar `navigator.geolocation` e inserir pontos em `price_points` com lat/lng reais. Ver `lib/autoPricePoints.js`.
- **Save transaction (servidor)** – O FinMemory já insere em `price_points` com geocode do endereço no `save-transaction`. Mantido como está.

## Quick Actions (dashboard)

Foram adicionados links para:

- Mapa de preços
- Compartilhar preço
- Gasto manual
- Parceria
- Lista de compras

## Migrações SQL

Arquivo: `supabase/supabase-migrations-smart-receipt.sql`

Execute no Supabase (SQL Editor) na ordem indicada no arquivo. Se o FinMemory usar apenas NextAuth (e não Supabase Auth), as políticas RLS que usam `auth.uid()` podem não se aplicar; nesse caso as APIs do Next.js usam `SUPABASE_SERVICE_ROLE_KEY` e validam `userId` da sessão.

## Referência do repositório original

- Repo: https://github.com/Thiago24-cloud/smart-receipt-scanner
- Stack do repo: Vite, React, TypeScript, shadcn-ui, Tailwind, Supabase Auth.
