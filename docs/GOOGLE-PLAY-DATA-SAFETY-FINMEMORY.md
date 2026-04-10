# Google Play Console — Data safety e permissões (FinMemory)

Use este guia para preencher o formulário **Data safety** (Segurança dos dados), a **declaração de permissões** e campos relacionados. Ajuste apenas o que não se aplicar ao teu build (ex.: analytics se não usares).

**Política de privacidade:** o URL público da política tem de estar igual ao indicado na ficha da app e na Play Console.

**Alinhamento com o site:** a política publicada em `/privacidade` e os termos em `/termos` foram redigidos de forma consistente com este guia (localização opcional, alertas de proximidade, mapa, Open Finance/Pluggy, Supabase, notificações locais). Ao alterar funcionalidades, atualiza a página legal e depois a Data safety na Play Console.

**Código sugerido por assistentes (ex.: outro modelo):** se receberes snippets com `lista_compras`, `mapa_precos`, `supermercados`, RPC com PostGIS nessas tabelas ou plugin Swift `RegionMonitoring`, não correspondem ao schema FinMemory (`shopping_list_items`, `buscar_lojas_por_produtos_lista`). A implementação em `lib/proximity/` mantém um único fluxo JS + Capacitor; no iOS limita-se o número de alvos (`maxGeofencesIOS`) em vez de um plugin nativo extra, salvo futura decisão de produto.

---

## 1. Resumo executivo (o que a app faz com dados)

| Tema | Resposta sugerida |
|------|-------------------|
| **Venda de dados** | Não. O FinMemory não vende dados de localização nem de conta a terceiros para fins publicitários. |
| **Partilha de dados** | Declara apenas o que for verdade: normalmente **processadores** (ex.: alojamento Supabase, infraestrutura) para **operar** o serviço, não para publicidade — ver secção “Partilha”. |
| **Encriptação em trânsito** | Sim, para pedidos à API/backend (HTTPS). |
| **Conta a eliminar dados** | Se a política e o produto o permitirem: “Sim, mediante pedido” ou o fluxo que tiveres; caso contrário alinha com o texto legal. |

---

## 2. Data safety — tipos de dados (questionário)

Marca **Sim, dados recolhidos** apenas para tipos que a app realmente processa. Para cada tipo marcado, preenche os subcampos como abaixo.

### 2.1 Localização

- **Localização aproximada:** só marca se usares de facto (ex.: só rede/celular sem GPS). Para o mapa e alertas de proximidade costuma ser **localização precisa**.
- **Localização precisa:** **Sim**, se a funcionalidade de mapa / “alertas perto da loja” estiver ativa.

Para **localização precisa** (e aproximada, se aplicável):

| Campo | Sugestão |
|-------|----------|
| **Recolhido ou partilhado?** | Recolhido |
| **É obrigatório ou opcional?** | **Opcional** (o utilizador ativa alertas de proximidade e permissões) |
| **Finalidade** | **Funcionalidade da app** (mostrar mapa, sugerir lojas, notificação local quando está perto de um ponto do mapa alinhado à lista de compras) |
| **Encriptado em trânsito?** | **Sim** (tráfego para os teus servidores/API) |
| **Partilhado?** | **Não** com outros para publicidade. Se enviares para o teu backend/Supabase para **funcionar** a conta/lista/mapa, isso é processamento do serviço — na Play Console muitas vezes respondes **“Não partilhado”** no sentido de “não vendemos a anunciantes”; se a consola pedir “fornecedores de serviço”, indica o que for obrigatório segundo a definição do Google. |

**Texto curto para “Porque precisas deste dado?” (se o formulário pedir texto livre):**

> A localização é usada para mostrar o mapa de preços à volta do utilizador e, apenas se o utilizador ativar a opção, para calcular a distância a pontos do mapa e disparar uma notificação local quando estiver dentro do raio configurado (300–500 m) e existir correspondência com itens pendentes da lista de compras. Não é vendida a terceiros.

---

### 2.2 Informações pessoais (conta / identificação)

Se o login for por email ou ID de utilizador:

| Campo | Sugestão |
|-------|----------|
| **Endereço de email, nome, IDs de utilizador** | Marca o que aplicares |
| **Finalidade** | Funcionalidade da app, autenticação, gestão de conta |
| **Opcional / obrigatório** | Obrigatório para quem cria conta, se for o caso |

---

### 2.3 Informações financeiras (Open Finance / bancos)

Se o FinMemory ligar contas bancárias ou dados financeiros:

- Declara **Informações financeiras** conforme o que a API Pluggy (ou outro) processa.
- Indica finalidade: **funcionalidade da app** (agregação de saldos, histórico, etc.).
- Confirma na documentação do conector o que é armazenado no teu backend.

Se **não** existir ligação bancária nesse build, **não** marques estes tipos.

---

### 2.4 Fotos e vídeos / ficheiros

Se houver upload de comprovativos, fotos de produtos ou faturas:

- Declara **Fotos e vídeos** ou **Ficheiros e documentos** conforme o caso.
- Finalidade: funcionalidade da app (ex.: leitura de nota, partilha de preço no mapa).

---

### 2.5 Dados de diagnóstico

Se usares **Crashlytics**, **Sentry**, **Firebase Analytics**, etc.:

- Declara **Dados de diagnóstico** / **IDs do dispositivo** se aplicável.
- Finalidade: **Análise** e/ou **Resolução de problemas**.

Se **não** integrares nada disso, não marques.

---

## 3. Notificações (permissão no Android)

- As **notificações locais** dos alertas de proximidade são disparadas **no dispositivo**; não são “push” remotos da FinMemory para esse caso.
- Na Data safety, o foco costuma ser **dados** (localização, conta), não o canal de notificação em si. Mantém a descrição da localização clara (secção 2.1).

---

## 4. Declaração de permissões sensíveis (Play Console)

Quando a Play pedir justificação para **ACCESS_FINE_LOCATION** / **ACCESS_COARSE_LOCATION** (e, se no futuro usares, **ACCESS_BACKGROUND_LOCATION**), podes usar:

**Versão curta:**

> O FinMemory mostra preços num mapa e permite ativar alertas opcionais quando o utilizador se aproxima de uma loja que, segundo o mapa, tem produtos alinhados à lista de compras. A localização só é usada para esta funcionalidade e para o mapa; o raio é configurável (300–500 m).

**Versão longa (se pedirem mais detalhe):**

> A localização precisa é necessária para posicionar o utilizador no mapa de preços e para calcular a distância a pontos partilhados pela comunidade e por fontes de promoções. A funcionalidade “alertas perto da loja” é opcional: o utilizador ativa nas definições da lista de compras. Enquanto ativa, pode ser mostrada uma notificação persistente no Android (serviço em primeiro plano) exigida pelo sistema para atualizações de localização em segundo plano. Os dados de localização não são vendidos a terceiros.

---

## 5. Política de privacidade (checklist)

- URL público e acessível.
- Menciona: **localização** (finalidade, base legal se aplicável RGPD), **conta**, **dados no Supabase** (ou backend), **retention** se souberes.
- Menciona **notificações** como funcionalidade opcional e **local** quando for o caso.
- Atualiza a data da última revisão quando mudares funcionalidades.

---

## 6. Formulário “App content” (resumo)

- **Classificação etária:** conforme o questionário oficial (financeiro, etc.).
- **Anúncios:** se não houver anúncios, indica “Não”.
- **COVID-19 / apps sensíveis:** só se aplicável.

---

## 7. Notas importantes

1. **Veracidade:** tudo o que declarares tem de corresponder ao código e à política de privacidade. Se mudares funcionalidades, atualiza a Data safety.
2. **Background location:** se **não** pedires `ACCESS_BACKGROUND_LOCATION` no manifesto, não declares uso de localização em segundo plano além do que o sistema permitir com o teu manifesto atual (foreground service + notificação no Android).
3. **Revisão manual:** equipas de revisão podem testar o fluxo de permissões; mantém o texto das permissões no sistema (e no `Info.plist` no iOS) alinhado com este documento.

---

*Documento operacional para a equipa FinMemory. Não substitui aconselhamento jurídico.*
