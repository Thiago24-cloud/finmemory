# components/ui

Componentes de UI reutilizáveis. Podem ser criados no **Lovable** e o código colado aqui.

## Dica de Ouro (Lovable)

1. No Lovable, crie:
   - **DashboardCard** – card para métricas
   - **MonthPicker** – seletor de mês
   - **ComparisonChart** – gráfico de comparação
   - **PricePin** – pin customizado para o mapa
   - **TransactionRow** – linha da tabela de transações

2. Exporte o código do Lovable.

3. Substitua os arquivos nesta pasta (ou cole em novos e ajuste imports).

4. Conecte com seus hooks/dados:
   - `DashboardCard` → saldo/transações (ex.: `BalanceCard` em `components/dashboard/`)
   - `MonthPicker` → estado de mês/ano no dashboard ou relatórios
   - `ComparisonChart` → dados agregados por mês/categoria (Supabase)
   - `PricePin` → markers do mapa (`PriceMap.js`, pontos de `price_points`)
   - `TransactionRow` → lista em `TransactionList.js` ou tabela no dashboard

## Placeholders atuais

Os arquivos nesta pasta são **placeholders** com a interface de props documentada. Eles funcionam sozinhos para você não quebrar o app ao importar. Quando trouxer o código do Lovable, mantenha as mesmas props (ou adapte onde o componente for usado).
