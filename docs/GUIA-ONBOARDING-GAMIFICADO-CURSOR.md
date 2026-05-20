# Guia de Implementação: Motor de Onboarding Gamificado (FinMemory)

Este documento contém o **prompt estruturado para colar no Cursor IDE** (Composer `Ctrl+I` / `Cmd+I`) e tudo que o FinMemory já usa em produção: **SQL Supabase**, componentes **React/Next.js** (PWA web — não React Native) e integração na Home (`/dashboard`).

> **Status no repositório:** a implementação spotlight (estilo Clash Royale) já existe nos arquivos listados na seção 4. Use este guia para replicar, estender ou pedir ao Cursor que ajuste o fluxo.

---

## 1. Prompt para o Cursor IDE / Composer

*Copie o bloco abaixo e cole no Composer ou no chat do Cursor:*

```text
Contexto: FinMemory é um app Next.js 15 (Pages Router) + Supabase + Tailwind. Dark mode premium (#050508, acento #39FF14 / #00E676). Já existe CharacterWidget (mascote) e tour antigo modal — substituir/estender por tutorial SPOTLIGHT na primeira visita ao /dashboard.

Objetivo: Onboarding guiado estilo Clash Royale:
- Overlay escuro (~88%) com “buraco” no componente alvo (box-shadow trick).
- Card de diálogo escuro, borda fina, tipografia limpa, botões em verde neon.
- Seta apontando para o alvo.
- O fluxo SÓ avança quando o usuário faz a ação (clique no alvo ou botão Próximo).
- Persistir conclusão: localStorage + POST /api/user/onboarding → users.onboarding_dashboard_completed_at (has_seen_onboarding).

PASSOS (dashboard):
1) data-tour-id="dashboard-missions" — Missões hoje (0/6). Texto: "Complete suas missões diárias para evoluir suas finanças e ganhar XP!" — advance: click_target, blockNavigation: true (não sair da home).
2) data-tour-id="dashboard-month-carousel" — Carrossel de meses. Texto: "Altere entre os meses para acompanhar seu histórico e planejar seu fluxo de caixa." — advance: next_button.
3) data-tour-id="dashboard-mapa" — Atalho Caça-Preço (mapa). Texto: "Economize de verdade! Encontre os menores preços da sua regiário validados pela comunidade." — advance: click_target, finishOnAdvance: true (permite navegar para /mapa).

Arquitetura obrigatória:
- lib/onboarding/dashboardSpotlightSteps.js — array de passos.
- components/onboarding/SpotlightOnboarding.jsx — motor reutilizável (portal, measure rect, resize/scroll).
- components/onboarding/DashboardSpotlightTour.jsx — orquestra passos + finish API.
- components/onboarding/TourTarget.js — wrapper opcional data-tour-id.
- lib/dashboardOnboardingStorage.js — localStorage finmemory_dash_onboarding_v1_{userId}.
- pages/api/user/onboarding.js — GET showTour / POST marcar visto.
- pages/dashboard.js — abrir tour após auth se !has_seen_onboarding, delay ~700ms para layout.

Requisitos técnicos:
- Usar createPortal(document.body) z-index ~250.
- Não quebrar layout mobile (max-w-md dashboard).
- Missões sempre visíveis no BalanceCard (0/6 se API ainda não carregou).
- Renomear atalho do mapa para "Caça-Preço" no DashboardQuickAccess.
- Não usar React Native — só React web.
- Seguir convenções do repo (cn de lib/utils, lucide-react, 'use client' onde necessário).

Entregáveis: revisar/ajustar arquivos existentes; não criar duplicata de tour modal; testar skip e conclusão; documentar como adicionar novo passo (data-tour-id + entrada em dashboardSpotlightSteps.js).
```

---

## 2. SQL (Supabase)

### 2.1 Migração principal (já no repo)

Arquivo: `supabase/migrations/20260403120000_users_onboarding_dashboard.sql`

```sql
-- Tour de boas-vindas no dashboard: NULL = ainda não concluiu o guia.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS onboarding_dashboard_completed_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.users.onboarding_dashboard_completed_at IS
  'Preenchido quando o utilizador conclui ou ignora o tour do dashboard; NULL = mostrar tour.';

-- Utilizadores antigos: não ver de novo (rodar só na primeira deploy da feature).
UPDATE public.users
SET onboarding_dashboard_completed_at = COALESCE(onboarding_dashboard_completed_at, now())
WHERE onboarding_dashboard_completed_at IS NULL;
```

### 2.2 Rodar no SQL Editor (se a coluna ainda não existir)

Cole o script acima em **Supabase → SQL Editor → New query → Run**.

### 2.3 Verificar / resetar para testar

```sql
-- Ver quem ainda veria o tour
SELECT id, email, onboarding_dashboard_completed_at
FROM public.users
WHERE onboarding_dashboard_completed_at IS NULL
LIMIT 20;

-- Resetar um usuário de teste (volta a ver o tutorial)
UPDATE public.users
SET onboarding_dashboard_completed_at = NULL
WHERE email = 'seu-email@exemplo.com';
```

### 2.4 (Opcional) Flag explícita `has_seen_onboarding`

O app já expõe `has_seen_onboarding` na API como espelho de `onboarding_dashboard_completed_at`. **Não é obrigatório** nova coluna. Se quiser coluna dedicada no futuro:

```sql
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS has_seen_onboarding boolean NOT NULL DEFAULT false;

UPDATE public.users
SET has_seen_onboarding = (onboarding_dashboard_completed_at IS NOT NULL);
```

---

## 3. API de persistência

| Método | Rota | Comportamento |
|--------|------|----------------|
| GET | `/api/user/onboarding` | `{ showTour: true/false, has_seen_onboarding: false/true }` |
| POST | `/api/user/onboarding` | Grava `onboarding_dashboard_completed_at = now()` |

**localStorage (fallback offline):** chave `finmemory_dash_onboarding_v1_{userId}` valor `"1"`.

Arquivo: `lib/dashboardOnboardingStorage.js`

---

## 4. Código no repositório (Next.js / React)

### 4.1 Mapa de arquivos

```
lib/onboarding/dashboardSpotlightSteps.js   ← definição dos 3 passos
lib/dashboardOnboardingStorage.js         ← localStorage

components/onboarding/SpotlightOnboarding.jsx    ← motor spotlight (reutilizável)
components/onboarding/DashboardSpotlightTour.jsx ← tour do dashboard
components/onboarding/TourTarget.js              ← wrapper opcional

components/dashboard/DashboardMissionsStrip.js   ← data-tour-id="dashboard-missions"
components/dashboard/DashboardMonthCarousel.js   ← data-tour-id="dashboard-month-carousel"
components/dashboard/DashboardQuickAccess.js       ← data-tour-id="dashboard-mapa" + label Caça-Preço

pages/dashboard.js                        ← monta tour se showTour
pages/api/user/onboarding.js              ← GET/POST persistência
```

### 4.2 Passos (`lib/onboarding/dashboardSpotlightSteps.js`)

```javascript
export const DASHBOARD_SPOTLIGHT_STEPS = [
  {
    id: 'missions',
    targetId: 'dashboard-missions',
    title: 'Missões do dia',
    body: 'Complete suas missões diárias para evoluir suas finanças e ganhar XP!',
    advance: 'click_target',
    blockNavigation: true,
    placement: 'bottom',
  },
  {
    id: 'month-carousel',
    targetId: 'dashboard-month-carousel',
    title: 'Histórico por mês',
    body: 'Altere entre os meses para acompanhar seu histórico e planejar seu fluxo de caixa.',
    advance: 'next_button',
    placement: 'bottom',
  },
  {
    id: 'mapa',
    targetId: 'dashboard-mapa',
    title: 'Caça-Preço',
    body: 'Economize de verdade! Encontre os menores preços da sua região validados pela comunidade.',
    advance: 'click_target',
    finishOnAdvance: true,
    placement: 'top',
  },
];
```

### 4.3 Como envelopar um novo alvo

**Opção A — atributo direto (recomendado em links/botões):**

```jsx
<Link href="/missoes" data-tour-id="dashboard-missions">
  …
</Link>
```

**Opção B — componente `TourTarget`:**

```jsx
import { TourTarget } from '../components/onboarding/TourTarget';

<TourTarget id="meu-novo-passo" className="relative">
  <MeuComponente />
</TourTarget>
```

Depois adicione um objeto em `DASHBOARD_SPOTLIGHT_STEPS` com o mesmo `targetId`.

### 4.4 Integração na Home (`pages/dashboard.js`)

Padrão já aplicado:

```javascript
import { DashboardSpotlightTour } from '../components/onboarding/DashboardSpotlightTour';
import { isDashboardOnboardingDoneLocal, setDashboardOnboardingDoneLocal } from '../lib/dashboardOnboardingStorage';

// state: onboardingTourOpen, onboardingTourReady

useEffect(() => {
  if (status !== 'authenticated' || !userId) return;
  if (isDashboardOnboardingDoneLocal(userId)) return;
  (async () => {
    const r = await fetch('/api/user/onboarding', { credentials: 'include' });
    if (r.ok) {
      const j = await r.json();
      if (j.showTour) {
        setOnboardingTourOpen(true);
        setTimeout(() => setOnboardingTourReady(true), 700);
      }
    }
  })();
}, [userId, status]);

// No JSX (fora do loading):
{onboardingTourOpen && onboardingTourReady && (
  <DashboardSpotlightTour
    userId={userId}
    onComplete={() => {
      setDashboardOnboardingDoneLocal(userId);
      setOnboardingTourOpen(false);
      setOnboardingTourReady(false);
    }}
  />
)}
```

### 4.5 Tipos de avanço (`SpotlightOnboarding`)

| `advance` | UX |
|-----------|-----|
| `click_target` | Card mostra “Toque no destaque ↑”; listener em capture no alvo chama `onNext`. |
| `next_button` | Botão verde **Próximo** no card. |

Props extras no passo:

- `blockNavigation: true` — `preventDefault` no clique (passo 1, ficar na home).
- `finishOnAdvance: true` — último passo; ao clicar, POST onboarding + fecha (passo 3 → `/mapa`).

---

## 5. Design system do tutorial

| Token | Valor |
|-------|--------|
| Overlay | `rgba(0,0,0,0.88)` via box-shadow 9999px |
| Halo do alvo | `border-[#39FF14]/70`, `box-shadow` verde suave |
| Card | `bg-[#0a0a12]/95`, `border-white/10` |
| CTA | `bg-[#39FF14]`, texto `#050508` |
| Título do passo | uppercase tracking, `#39FF14` |

---

## 6. Personagem tutor (opcional / fase 2)

O **mascote** já existe em `components/gamification/CharacterWidget.tsx` + `lib/gamification/characterStateConfig.js`.

Para combinar com o spotlight (estilo Duolingo/Clash):

1. No passo 1, renderizar mini `MascotImage` ou emoji dentro do card do `SpotlightOnboarding`.
2. Ou posicionar `CharacterWidget` compacto acima do card via prop `mascotSlot` no motor.

Prompt extra para o Cursor:

```text
Adicione prop opcional mascotEmoji ou mascotState ao SpotlightOnboarding; no passo 1 do dashboard usar estado 'coach' do character engine; não bloquear cliques no alvo.
```

---

## 7. Teste manual

1. Reset SQL + apagar `finmemory_dash_onboarding_v1_*` no DevTools → Application → Local Storage.
2. Login → abrir `/dashboard`.
3. Passo 1: tocar em **Missões hoje** → passo 2.
4. Passo 2: **Próximo** → passo 3.
5. Passo 3: tocar **Caça-Preço** → vai para `/mapa`, tour não reaparece.
6. Recarregar dashboard → tour não deve voltar.

---

## 8. Deploy

Após alterações:

```bash
npm run build
npm run deploy:cloud-run
```

Não é necessária migração SQL extra se `20260403120000_users_onboarding_dashboard.sql` já foi aplicada.

---

## 9. Nota sobre React Native

Este repositório FinMemory web **não usa React Native** para o dashboard. Se no futuro houver app Capacitor/React Native:

- Reimplementar `SpotlightOnboarding` com `Modal` + `react-native-svg` ou lib `react-native-copilot`.
- Persistência: `AsyncStorage` com a mesma chave lógica + mesma API `/api/user/onboarding`.
- Os `data-tour-id` viram `testID` ou refs nativas.

---

*Gerado para o ecossistema FinMemory — onboarding spotlight v1.*
