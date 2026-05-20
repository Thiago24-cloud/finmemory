# Onboarding guiado (UX Tutorial) — Engenharia de contexto

Documento de referência para implementação e manutenção do fluxo de onboarding inspirado em jogos como **Clash of Clans / Clash Royale**: overlay escuro, alvo iluminado, mãozinha animada e popups explicativos premium.

**Implementação no repo:** `GuidedOnboarding`, `OnboardingGuideGate` (`_app.js`), `OnboardingFocusOverlay`, `OnboardingHandPointer`, `OnboardingPremiumModal`, `lib/onboarding/featureTourSteps.js`, `contexts/OnboardingTourContext.jsx`, rota `/dashboard`.

---

## 1. Comportamento global do guia

| Regra | Especificação |
|-------|----------------|
| Overlay | Tela com fundo escuro (ex.: **opacity 0.6** / `rgba(0,0,0,0.6)`) cobrindo toda a interface. |
| Bloqueio de cliques | Cliques **fora** do botão alvo não devem interagir com a UI subjacente. |
| Destaque do alvo | Apenas o botão alvo permanece “iluminado” (buraco no overlay + halo opcional). |
| Mãozinha | Indicador animado com efeito **bounce** (pulinho), posicionado acima ou ao lado do botão alvo, apontando para ele. |
| Interação no alvo | Ao **clicar no botão iluminado**: a mãozinha **some** e abre um **Popup/Modal Premium** com título, texto explicativo e botão **"Próximo"**. |
| Avanço | **"Próximo"** fecha o modal e passa ao próximo passo do fluxo (nova mãozinha + novo alvo), até o último passo. |
| Persistência | Ao concluir o último passo do fluxo aplicável ao tipo de conta, gravar estado no banco (`users.onboarding_progress.home_intro`) + fallback `localStorage` para não reexibir o tutorial. |
| Tipo de conta | O app deve identificar **Consumidor Final** vs **Varejista** e carregar apenas o fluxo de passos correspondente. |

### Sequência UX (máquina de estados)

```
[IDLE] → (primeira visita + showTour) → [SPOTLIGHT: overlay + mãozinha no alvo N]
       → (clique no alvo N) → [MODAL: título + texto + Próximo]  (mãozinha oculta)
       → (Próximo) → [SPOTLIGHT: alvo N+1] …
       → (último passo + Próximo) → [DONE: persistir + fechar]
```

### Alvos no DOM

- Cada botão do tutorial deve expor `data-tour-id="<id>"` (ou wrapper `TourTarget`).
- IDs sugeridos para consumidor: `dashboard-mapa`, `dashboard-scan`, `dashboard-simulador`, `dashboard-missions`.
- IDs sugeridos para varejista: `dashboard-mapa`, `dashboard-lista`, `dashboard-relatorios`.

---

## 2. Fluxo 1 — Consumidor final (conta usuário)

**Perfil:** `account_type = consumidor` / `userRole = consumer`.

**Ordem sugerida dos passos:** Caça-Preço → Escanear → Simulador → Missões.

| Ordem | Botão alvo | `data-tour-id` (sugerido) | Título do modal | Texto do modal |
|-------|------------|---------------------------|-----------------|----------------|
| 1 | Caça-Preço | `dashboard-mapa` | 🗺️ Mapa Caça-Preço | Economize tempo e dinheiro! Veja em tempo real quais supermercados e lojas da sua região estão com os menores preços para os produtos que você quer comprar hoje. Não gaste a mais à toa! |
| 2 | Escanear | `dashboard-scan` | 📸 Entrada por Foto | Esqueça a digitação manual. Tire uma foto de qualquer nota fiscal e nossa inteligência artificial puxará automaticamente todos os produtos, preços e datas para organizar suas finanças num piscar de olhos. |
| 3 | Simulador | `dashboard-simulador` | 🧠 Simulador de Poder de Compra | Entenda seu dinheiro de verdade. O simulador cruza o valor das suas faturas de cartão com o seu saldo atual via Pix e débito, te mostrando seu poder de compra real para você nunca mais se endividar. |
| 4 | Missões | `dashboard-missions` | ⚔️ O Jogo da Vida Real | Transforme suas finanças em um jogo! Cumpra missões diárias de economia, acompanhe seu progresso, suba de nível e ganhe recompensas reais enquanto cuida do seu bolso. |

### Copy exata (consumidor)

#### Passo 1 — Caça-Preço

- **Título:** `🗺️ Mapa Caça-Preço`
- **Texto:** `Economize tempo e dinheiro! Veja em tempo real quais supermercados e lojas da sua região estão com os menores preços para os produtos que você quer comprar hoje. Não gaste a mais à toa!`

#### Passo 2 — Escanear

- **Título:** `📸 Entrada por Foto`
- **Texto:** `Esqueça a digitação manual. Tire uma foto de qualquer nota fiscal e nossa inteligência artificial puxará automaticamente todos os produtos, preços e datas para organizar suas finanças num piscar de olhos.`

#### Passo 3 — Simulador

- **Título:** `🧠 Simulador de Poder de Compra`
- **Texto:** `Entenda seu dinheiro de verdade. O simulador cruza o valor das suas faturas de cartão com o seu saldo atual via Pix e débito, te mostrando seu poder de compra real para você nunca mais se endividar.`

#### Passo 4 — Missões

- **Título:** `⚔️ O Jogo da Vida Real`
- **Texto:** `Transforme suas finanças em um jogo! Cumpra missões diárias de economia, acompanhe seu progresso, suba de nível e ganhe recompensas reais enquanto cuida do seu bolso.`

---

## 3. Fluxo 2 — Varejista (conta parceiro / admin)

**Perfil:** `account_type = varejista` / `userRole = retailer`.

**Ordem sugerida dos passos:** Caça-Preço → Lista → Relatórios.

| Ordem | Botão alvo | `data-tour-id` (sugerido) | Título do modal | Texto do modal |
|-------|------------|---------------------------|-----------------|----------------|
| 1 | Caça-Preço | `dashboard-mapa` | 📊 Inteligência de Mercado | Acompanhe seus concorrentes. Veja em tempo real o preço praticado pela concorrência na sua região e ajuste suas ofertas de forma estratégica para atrair mais clientes para a sua loja. |
| 2 | Lista | `dashboard-lista` | 🛒 Vitrine de Ofertas | Gerencie os produtos cadastrados da sua loja que aparecem no mapa. Itens enviados por usuários vão para uma fila de aprovação pendente para você ter controle total sobre a veracidade dos seus preços na plataforma. |
| 3 | Relatórios | `dashboard-relatorios` | 📉 Análise de Retenção e Vendas | Monitore o comportamento dos consumidores da sua região. Descubra quais produtos são mais buscados, quais dias têm maior volume de procura e crie estratégias para reter clientes locais. |

### Copy exata (varejista)

#### Passo 1 — Caça-Preço

- **Título:** `📊 Inteligência de Mercado`
- **Texto:** `Acompanhe seus concorrentes. Veja em tempo real o preço praticado pela concorrência na sua região e ajuste suas ofertas de forma estratégica para atrair mais clientes para a sua loja.`

#### Passo 2 — Lista

- **Título:** `🛒 Vitrine de Ofertas`
- **Texto:** `Gerencie os produtos cadastrados da sua loja que aparecem no mapa. Itens enviados por usuários vão para uma fila de aprovação pendente para você ter controle total sobre a veracidade dos seus preços na plataforma.`

#### Passo 3 — Relatórios

- **Título:** `📉 Análise de Retenção e Vendas`
- **Texto:** `Monitore o comportamento dos consumidores da sua região. Descubra quais produtos são mais buscados, quais dias têm maior volume de procura e crie estratégias para reter clientes locais.`

---

## 4. Mapeamento código ↔ produto

| Conceito produto | Arquivo / componente |
|------------------|----------------------|
| Definição dos passos | `lib/onboarding/featureTourSteps.js` |
| Tipo de conta | `contexts/UserRoleContext.js`, `lib/userType.js` |
| Estado + persistência | `contexts/OnboardingTourContext.jsx`, `pages/api/user/onboarding.js` |
| Overlay + bloqueio | `components/onboarding/OnboardingFocusOverlay.jsx` |
| Mãozinha | `components/onboarding/OnboardingHandPointer.jsx` |
| Modal premium | `components/onboarding/OnboardingPremiumModal.jsx` |
| Orquestrador | `components/onboarding/GuidedOnboarding.jsx` |
| Porta global (rotas + API) | `components/onboarding/OnboardingGuideGate.jsx`, `lib/onboarding/guidedOnboardingRoutes.js` |
| Montagem | `pages/_app.js` (após `PageTransitionLayout`) |
| Atalhos com `data-tour-id` | `components/dashboard/DashboardQuickAccess.js`, `components/dashboard/DashboardMissionsStrip.js` |

### Estrutura sugerida de um passo (TypeScript/JSDoc)

```javascript
{
  id: 'caca-preco',
  targetId: 'dashboard-mapa',
  modalTitle: '🗺️ Mapa Caça-Preço',
  modalBody: '...',
  handPlacement: 'top', // 'top' | 'bottom' | 'left' | 'right'
}
```

---

## 5. Persistência e API

| Ação | Detalhe |
|------|---------|
| Chave JSONB | `home_intro: true` em `users.onboarding_progress` |
| GET | `/api/user/onboarding` → `showTour: !has_seen_onboarding` |
| POST | `/api/user/onboarding` body `{ key: 'home_intro', value: true }` |
| Local | `finmemory_dash_onboarding_v1_{userId}` = `"1"` |

---

## 6. Checklist de implementação / QA

- [ ] Overlay com opacidade ~0.6 e cliques bloqueados fora do alvo
- [ ] Mãozinha visível apenas na fase spotlight (some com modal aberto)
- [ ] Clique no alvo abre modal com título e texto **exatos** da tabela do fluxo
- [ ] Botão **Próximo** avança sem pular passos
- [ ] Consumidor vê fluxo 1; varejista vê fluxo 2
- [ ] Tutorial não reaparece após conclusão (API + localStorage)
- [ ] Todos os `data-tour-id` dos passos existem no DOM do dashboard

---

## 7. Notas de design

- Paleta alinhada ao app: fundo escuro (`#050508` / `#0a0a12`), acento `#00E676`.
- Modal: card escuro, borda fina verde, CTA **Próximo** em verde neon.
- Respeitar `prefers-reduced-motion` na animação da mãozinha quando possível.

---

*Última atualização: especificação de produto para UX Tutorial FinMemory — fonte da verdade para Cursor e engenharia.*
