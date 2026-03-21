# Como ver os logs do app (erro de autenticação)

O app roda no **Cloud Run**, não no Firebase. O Firebase Hosting só encaminha as requisições. Por isso os logs do login e do NextAuth ficam no **Google Cloud Logging** (projeto do Cloud Run).

---

## 1. Logs do Cloud Run (projeto finmemory-667c3)

**Opção A – Pelo Logging (recomendado):**

1. Abra: **[Logging – projeto finmemory-667c3](https://console.cloud.google.com/logs/query?project=finmemory-667c3)**  
2. Na caixa de query (ou filtro), use algo como:  
   `resource.type="cloud_run_revision" resource.labels.service_name="finmemory"`  
   para ver só os logs do serviço **finmemory**.  
3. Ou deixe a query em branco e, nos filtros à direita, escolha **Resource type → Cloud Run Revision** e **Service name → finmemory**.

**Opção B – Pelo menu do Cloud Run:**

1. Abra: **[Cloud Run – Serviços](https://console.cloud.google.com/run?project=finmemory-667c3)**  
2. Clique no **nome do serviço** (**finmemory**) para abrir os detalhes.  
3. No topo da página do serviço, abra a aba **"LOGS"** ou **"Observabilidade" → "Registros"** (o nome pode variar conforme a interface).

Aí aparecem as requisições e as mensagens que o app (e o NextAuth) imprimem com `console.log` / `console.error`. Erros de OAuth costumam aparecer como `[next-auth][OAUTH_ERROR]` ou em linhas de erro do NextAuth.

---

## 2. Ativar logs mais detalhados do NextAuth (NEXTAUTH_DEBUG)

Para ver **no log** o erro exato que o Google devolve (ex.: `deleted_client`, `redirect_uri_mismatch`):

1. [Cloud Run](https://console.cloud.google.com/run?project=finmemory-667c3) → serviço **finmemory**.
2. **EDIT & DEPLOY NEW REVISION**.
3. Aba **Variables & Secrets** → **ADD VARIABLE**:
   - Nome: `NEXTAUTH_DEBUG`
   - Valor: `1`
4. **DEPLOY**.
5. Tente fazer login de novo e, em seguida, abra os **Logs** (link acima). Procure por linhas com `[next-auth]` ou mensagens de erro do OAuth.
6. Depois de debugar, **remova** a variável `NEXTAUTH_DEBUG` (nova revisão sem ela) para não encher o log.

---

## 3. Firebase tem logs?

O **Firebase Hosting** não executa seu código; ele só entrega arquivos estáticos e encaminha para o Cloud Run. Por isso **não** há logs de autenticação no console do Firebase. Toda a lógica (NextAuth, API, erros) está no **Cloud Run** e nos **Logs** do Google Cloud (link da seção 1).
