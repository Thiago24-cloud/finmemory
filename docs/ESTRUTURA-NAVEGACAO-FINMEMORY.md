# Estrutura de Navegação – FinMemory (estilo Notion / Maps / Wash)

Objetivo: **tudo ao alcance dos olhos** no primeiro nível; o que complementa fica **uma camada abaixo**, como “subpasta” – um toque para abrir, sem poluição visual.

---

## 1. Nível principal – “Sempre à mão”

O que o usuário vê assim que abre o app ou na barra inferior.

```
┌─────────────────────────────────────────────────────────────────┐
│  BARRA INFERIOR (BottomNav) – 4 itens fixos                      │
├─────────────────────────────────────────────────────────────────┤
│   🗺️ Mapa    │   📊 Gastos   │   ➕ Adicionar   │   👤 Perfil   │
│   /mapa      │   /dashboard  │   (sheet)        │   /settings   │
└─────────────────────────────────────────────────────────────────┘
```

| Aba | Função | O que fica “na cara” |
|-----|--------|----------------------|
| **Mapa** | Primeira tela do app. Onde está mais barato; comunidade. | Mapa tela cheia, pins de preço e perguntas. Header: Buscar, Perguntar, Compartilhar, link Gastos. |
| **Gastos** | Centro da análise de custos. | Saldo do período, filtro mês, 3 botões grandes (Sincronizar, Escanear, Mapa), lista de transações. FAB “Escanear” no canto. |
| **Adicionar** | Um toque no + abre o sheet. | Escanear Nota · Gasto Manual · Compartilhar Preço. |
| **Perfil** | Ajustes e conta. | Privacidade, Termos, Sair. E-mail conectado. |

Nenhuma função importante fica escondida em menu hambúrguer: as quatro abas são a “pasta principal”.

---

## 2. Nível secundário – “Subpastas” (um toque)

Funcionalidades que **complementam** a tela principal. Você toca uma vez e entra; dentro, tudo funciona como esperado (editar, usar, voltar).

### 2.1 A partir de **Gastos** (Dashboard)

| Onde | Ação | Leva a (subpasta) |
|------|------|-------------------|
| Lista de transações | Toque em uma compra | **Detalhe da transação** – estabelecimento, total, data, **preços e produtos que você pagou**, foto da nota. Editar / Remover foto. |
| Detalhe da transação | “Editar” | **Editar transação** – estabelecimento, total, data, remover foto. |
| QuickActions (scroll horizontal) | Preço | **Compartilhar preço** – produto, preço, loja, categoria, GPS. |
| QuickActions | Gasto | **Gasto manual** – lançar compra digitando. |
| QuickActions | Parceria | **Parceria** – criar código ou entrar com código (lista compartilhada). |
| QuickActions | Lista | **Lista de compras** – itens compartilhados com o parceiro. |
| QuickActions | Relatórios | **Relatórios** – total por período, gráfico por categoria. |
| QuickActions | Categorias | **Categorias** – quanto gastou por categoria. |
| QuickActions | Ajustes | **Ajustes** (mesmo que Perfil). |
| Header (sino) | Toque | **Notificações** – lembretes (contas, metas). |

### 2.2 A partir do **Mapa**

| Onde | Ação | Leva a (subpasta) |
|------|------|-------------------|
| Header | “Compartilhar” | **Compartilhar preço** – mesmo fluxo; ao salvar volta ao mapa com banner “Preço compartilhado!”. |
| Header | “Perguntar” | **Modal** – pergunta + local opcional + “Usar minha localização”. Publica no mapa (pin ?). |
| Pin de preço ($) | Toque | **Popup** – loja, produto, preço, “há X”, Explorador #. |
| Pin de pergunta (?) | Toque | **Popup** – pergunta, respostas, “Responder”, “Obrigado” em cada resposta. |
| Header | “Gastos” | **Dashboard** (Gastos). |

### 2.3 A partir de **Adicionar** (sheet)

| Opção no sheet | Leva a |
|-----------------|--------|
| Escanear Nota | **Escanear nota** – câmera/galeria → OCR → editar dados → salvar (transação + produtos + opcional mapa). |
| Gasto Manual | **Gasto manual** – formulário de lançamento. |
| Compartilhar Preço | **Compartilhar preço** – produto, preço, loja, GPS. |

### 2.4 A partir de **Perfil / Ajustes**

| Link | Leva a |
|------|--------|
| Política de Privacidade | **Privacidade** – página estática. |
| Termos de Uso | **Termos** – página estática. |
| Sair da conta | Logout e redirecionamento. |

---

## 3. Fluxos que “não aparecem” mas estão interligados

- **Login** – Página inicial (/) ou /login → Google → redireciona para /mapa. Quem não está cadastrado vê mensagem e link para solicitar acesso.
- **Auth error** – /auth-error com mensagem amigável (conta não vinculada, etc.) e link para tentar de novo.
- **404** – Página “não encontrada”.
- **Erro inesperado** – ErrorBoundary: “Algo deu errado” + Recarregar + Voltar ao Dashboard.

Tudo isso é **uma camada atrás**: o usuário só vê quando algo falha ou quando está entrando/saindo.

---

## 4. Resumo visual – hierarquia

```
Nível 0 (entrada)
  /  ou  /login  →  Google  →  /mapa

Nível 1 – Abas (sempre visíveis)
  Mapa     →  tela do mapa + header
  Gastos   →  dashboard (saldo, ações, lista)
  Adicionar →  sheet (Escanear, Gasto manual, Preço)
  Perfil   →  Ajustes (Privacidade, Termos, Sair)

Nível 2 – Subpastas (um toque a partir do nível 1)
  Da lista de Gastos:
    → Transação [id] (detalhe: preços e produtos)
      → Editar transação
  Do dashboard (QuickActions):
    → Compartilhar preço · Gasto manual · Parceria · Lista · Relatórios · Categorias · Ajustes
  Do header Gastos:
    → Notificações (sino)
  Do Mapa:
    → Compartilhar preço (tela) · Modal Perguntar · Popups (pin $ e ?)
  Do sheet Adicionar:
    → Escanear nota · Gasto manual · Compartilhar preço
  De Ajustes:
    → Privacidade · Termos
```

---

## 5. Princípios aplicados (Notion / Maps / Wash)

| Princípio | Como o FinMemory aplica |
|-----------|--------------------------|
| **Tudo ao alcance** | 4 abas fixas; em Gastos, 3 ações principais + scroll de ações; no Mapa, Buscar/Perguntar/Compartilhar no header. |
| **Subpastas complementam** | Detalhe da transação, Editar, Relatórios, Categorias, Parceria, Lista, Compartilhar preço, Notificações – um toque a partir da tela principal. |
| **Um toque para usar** | Abre a “subpasta”; dentro, editar/usar/salvar funciona sem surpresas (ex.: detalhe → editar → salvar → volta ao detalhe ou lista). |
| **Sem poluição visual** | Sem menu hambúrguer com 15 itens; sem informação empilhada. Ações secundárias em scroll horizontal ou em telas dedicadas. |
| **Backend interligado** | Gmail → transações + produtos; OCR nota → transação + produtos + price_points; compartilhar preço → mapa; parceria → lista compartilhada; sessão → userId em todas as telas. |

---

## 6. Sugestões de evolução (mantendo a estrutura)

- **Mapa**: tornar “Buscar produto” funcional (filtrar pins por texto).
- **Notificações**: conectar a lembretes reais (contas, metas) e talvez push.
- **Relatórios/Categorias**: manter como subpastas de Gastos; garantir que abrem rápido e que “Voltar” leva ao dashboard.
- **Onboarding**: dicas uma vez (Gmail, Mapa) já existem; evitar novos modais fixos para não poluir.

Este documento serve como referência para manter a organização “Notion/Maps/Wash” em novas features e refators.
