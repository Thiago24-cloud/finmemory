# Assinaturas detectadas (Pluggy / Open Finance)

## Fluxo

1. Pluggy sincroniza transações → `bank_transactions` (webhook `/api/pluggy/webhook` ou sync manual).
2. `GET /api/finance/detected-subscriptions` lê débitos dos últimos 120 dias e executa `detectSubscriptions()`.
3. O dashboard mostra o banner **Assinaturas detectadas** (acima de Cobranças do mês).
4. O utilizador confirma → `POST /api/finance/detected-subscriptions` cria linhas em `cobrancas` (`recorrencia: mensal`).

## Código

| Ficheiro | Função |
|----------|--------|
| `lib/finance/detectSubscriptions.ts` | `detectSubscriptions(transactions)` — lógica pura, TypeScript |
| `lib/finance/subscriptionKeywords.ts` | Keywords Netflix, Spotify, etc. |
| `pages/api/finance/detected-subscriptions.js` | API GET/POST |
| `components/dashboard/DetectedSubscriptionsPanel.jsx` | UI de validação |

## Formato de saída (`DetectedSubscription`)

- `nome_amigavel` — nome do serviço
- `valor` — último valor capturado
- `dia_cobranca_esperado` — dia do mês (moda das datas)
- `sugestao_assinatura` — `true` quando keyword conhecida ou repetição em ≥2 meses
- `confianca` — `alta` | `media` | `baixa`
- `ja_cadastrada` — já existe título parecido em `cobrancas`

## Testes

```bash
npx vitest run --project lib
```

## Edge Function (opcional)

O projeto usa **Next.js API Routes** com sessão NextAuth. A mesma função TS pode ser importada numa Supabase Edge Function no futuro; hoje o endpoint canónico é `/api/finance/detected-subscriptions`.
