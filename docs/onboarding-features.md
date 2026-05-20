# UX Tutorial — Onboarding guiado (estilo Clash of Clans)

Especificação do fluxo de onboarding por tipo de conta. Implementação: `FeatureOnboardingTour`, `OnboardingFocusOverlay`, `OnboardingHandPointer`, `OnboardingPremiumModal`.

## Mecânica

1. Overlay escuro (~72% opacidade) bloqueia cliques fora do alvo.
2. Alvo iluminado com halo verde (`#00E676`).
3. Mãozinha animada (bounce) aponta para o botão.
4. Toque no alvo → abre **Modal Premium** (título + texto do passo) → botão **Próximo** avança.
5. Último passo → `POST /api/user/onboarding` com `key: home_intro` + localStorage.

## Consumidor final (`consumidor`)

| # | `targetId` | Título modal | Texto modal |
|---|------------|--------------|-------------|
| 1 | `dashboard-mapa` | Caça-Preço | Economize de verdade! Encontre os menores preços da sua região validados pela comunidade. |
| 2 | `dashboard-missions` | Missões do dia | Complete suas missões diárias para evoluir suas finanças e ganhar XP! |
| 3 | `dashboard-month-carousel` | Histórico por mês | Altere entre os meses para acompanhar seu histórico e planejar seu fluxo de caixa. |

## Varejista (`varejista`)

| # | `targetId` | Título modal | Texto modal |
|---|------------|--------------|-------------|
| 1 | `dashboard-scan` | Escanear nota | Cadastre compras e produtos da sua loja escaneando NF-e — tudo entra no seu inventário. |
| 2 | `dashboard-barcode` | Código de barras | Atualize preços e estoque pelo código de barras em segundos. |
| 3 | `dashboard-mapa` | Caça-Preço | Publique ofertas e apareça no mapa para consumidores perto da sua loja. |

## Persistência

- Supabase: `users.onboarding_progress.home_intro = true`
- Browser: `finmemory_dash_onboarding_v1_{userId}`

## Novo passo

1. Marcar alvo com `data-tour-id="meu-alvo"` (ou `TourTarget`).
2. Adicionar entrada em `lib/onboarding/featureTourSteps.js` no array do perfil correto.
