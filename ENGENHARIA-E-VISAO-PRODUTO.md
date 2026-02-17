# FinMemory – Engenharia e visão de produto

Este documento descreve **com quem falar**, a **visão de produto e engenharia** e as **decisões de design** (cores, hierarquia, Mapas) para levar o app ao nível de referências como Notion, Maps e Wash.

---

## 1. Com quem falar

**Perfil desejado:** um **desenvolvedor especialista em aplicativos**, com anos de experiência de mercado, que:

- Não se limita a “prompts genéricos” ou uso superficial de IA.
- Domina um **arcabouço de testes, qualidade e oportunidades** que a IA pode amplificar (testes automatizados, acessibilidade, performance, segurança).
- Consegue aplicar **máxima engenhosidade** no produto: arquitetura clara, código sustentável, UX consistente e funcionalidades que se encaixam como “subpastas” da experiência principal.

Ou seja: alguém que entende **produto + engenharia + IA** de forma integrada, não só “programação reativa”.

---

## 2. Visão de produto: organização tipo Notion / Maps / Wash

- **Tudo ao alcance dos olhos:** as funções principais ficam visíveis e acessíveis (Mapas, Gastos, Adicionar, Perfil).
- **O que não está na frente fica “atrás”, como subpasta:** ao clicar (ex.: **Mapas**), abre-se o conteúdo que **complementa** a tela principal (tons do mapa, estilos). Clique → abre; usar ou alterar funciona de forma direta.
- **Backend interligado:** dados (Supabase, APIs, mapa, transações) conversam entre si; nenhuma tela é uma “ilha”.
- **Sem poluição visual:** uma informação não fica em cima da outra; hierarquia clara, ações óbvias.

**No FinMemory hoje:**

- **Mapas** = pasta principal: primeiro item da navegação; ao abrir o mapa, o botão **Mapas** no header abre a “subpasta” com os **tons do mapa** (Claro, Ruas, Escuro, Verde, Azul, Satélite). A escolha é salva.
- **Gastos** = outra pasta principal: dashboard, transações, relatórios, categorias.
- **Adicionar** = ação central (escanear nota, gasto manual, compartilhar preço, etc.) sem empilhar telas.

---

## 3. Engenharia do app

- **Rápido e sem travas** no celular (iPhone, Android ou qualquer dispositivo): carregamento otimizado, lazy loading onde fizer sentido, evitar trabalho pesado na thread principal.
- **Informação não empilhada:** uma ideia por tela ou por bloco; transições claras entre mapa → Mapas (tons) → Gastos → detalhe.
- **App da comunidade:** mapa colaborativo, perguntas/respostas, compartilhamento de preços; a engenharia (APIs, realtime, cache) deve sustentar essa experiência sem travar.

---

## 4. Design: encantador, colorido, comunitário

- **Cores vivas** que se destacam de forma estratégica para cada tipo de comércio (restaurante, lanchonete, mercado, farmácia, posto, etc.).
- **Paleta em `lib/colors.js`:** `CATEGORY_COLORS` define a cor principal e o fundo por categoria; usada no mapa (pins), em listas e relatórios.
- **Mapas como pasta principal:** o usuário entra em **Mapas** (aba ou tela do mapa) e, ao clicar em **Mapas** no header, vê os **tons do mapa** (Claro, Ruas, Escuro, Verde, Azul, Satélite). A escolha fica salva (localStorage) para a próxima vez.

---

## 5. Cores do app (resumo)

| Tipo de comércio   | Uso no app                          |
|--------------------|-------------------------------------|
| Supermercado/Mercado | Vermelho vivo (#D32F2F)           |
| Restaurante        | Laranja (#F57C00)                   |
| Lanchonete         | Laranja claro (#FF9800)             |
| Farmácia           | Teal (#00796B)                      |
| Bar                | Roxo (#512DA8)                      |
| Padaria            | Marrom (#795548)                    |
| Açougue            | Vermelho escuro (#B71C1C)           |
| Posto/Combustível  | Azul (#0D47A1)                      |
| Eletrônicos        | Azul (#01579B)                      |
| Roupas/Vestuário   | Rosa escuro (#880E4F)               |
| Serviços           | Roxo (#4A148C)                      |
| Outros             | Verde marca (#2E7D32)               |

**Tons do mapa (pasta Mapas):** Claro, Ruas, Escuro, Verde, Azul (água), Satélite – cada um com uma cor de preview no seletor.

---

## 6. Referências de produto

- **Notion:** hierarquia clara; pastas e subpastas que “abrem” sem poluir.
- **Maps:** mapa como tela principal; opções (estilo, camadas) a um toque.
- **Wash:** funções principais à mão; o resto organizado em etapas ou telas complementares.

O FinMemory segue a mesma lógica: **Mapas** é a primeira “pasta”; dentro dela, os **tons do mapa** são a “subpasta” que complementa a experiência, sem informação em cima da outra e com backend interligado.
