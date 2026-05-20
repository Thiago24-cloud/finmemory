# Jornada contínua do consumidor (coach)

Complementa `onboarding-features.md` — narrativa progressiva, não “tour de uma vez”.

## Princípios

1. **Um passo por visita** na introdução (7 passos no total, ordem fixa).
2. **Reengajamento** após **48h+** sem abrir o app: uma dica sobre a feature **menos usada** há 7+ dias (alinhado ao Welcome Back).
3. **Cooldown 24h** entre dicas coach (não spammar).
4. **Mascote** no modal (`showMascot` + `mascotLine`) e passo final apontando o `CharacterWidget`.
5. **Welcome Back (48h)** tem prioridade — o gate espera o `session-check` antes de mostrar a mãozinha.

## Introdução (ordem)

| # | id | Alvo |
|---|-----|------|
| 1 | caca-preco | Caça-Preço |
| 2 | escanear | Escanear NF-e |
| 3 | barcode | Código de barras |
| 4 | missoes | Missões |
| 5 | extrato | Extrato |
| 6 | simulador | Simulador |
| 7 | mascot | Widget do mascote |

`home_intro` no Supabase só vira `true` quando os 7 passos estão em `coach_journey.intro_completed`.

## API

- `GET /api/user/coach-journey` → `{ show, mode, step, reason }`
- `POST` `complete_step` | `dismiss` | `record_feature`

## Dados

- Coluna `users.coach_journey` (JSONB) — migração `20260520120000_coach_journey.sql`
- Tracking de rotas: `FeatureUsageRecorder` em `_app.js`

## Motor

`lib/onboarding/coachJourneyEngine.js` + `lib/onboarding/coachConsumerSteps.js`
