# Deploy do Finmemory no Cloud Run (código atualizado – branch main)

Repositório principal: **https://github.com/Thiago24-cloud/finmemory** (branch `main`)

---

## Se o repositório já está conectado ao Cloud Run

Se você já usa a conta do repositório no Cloud Run e o serviço está funcionando:

1. O código atualizado já está no branch **main** (dashboard novo, Relatórios, Categorias, Ajustes, detalhe da transação).
2. Para **atualizar o serviço** com esse código:
   - **Opção 1:** No Console do Cloud Run, abra o serviço **finmemory** e clique em **EDIT & DEPLOY NEW REVISION** (ou **NOVO REVISÃO**). O Cloud Run fará um novo build a partir do **main** e publicará.
   - **Opção 2:** Se tiver um trigger no Cloud Build para o branch `main`, basta dar **push** no main (ou disparar o trigger manualmente em Cloud Build → Triggers → Run).
3. Aguarde o build terminar. A nova revisão ficará ativa na mesma URL.

---

## Opção A: Pelo Google Cloud Console (recomendado)

1. Acesse: **https://console.cloud.google.com/run**
2. Selecione o projeto (ex.: `finmemory-442417` ou o ID do seu projeto).
3. Clique em **CREATE SERVICE** (ou **NOVO SERVIÇO**).
4. Em **Deploy**, escolha **Continuously deploy from a repository**.
5. Conecte o GitHub (autorize se pedir) e selecione:
   - Repositório: **Thiago24-cloud/finmemory**
   - Branch: **main**
6. **Build type:** Dockerfile (caminho: `Dockerfile` na raiz).
7. **Region:** southamerica-east1 (São Paulo).
8. Marque **Allow unauthenticated invocations** para poder testar sem login.
9. Clique em **CREATE** e aguarde o build e o deploy (alguns minutos).
10. A URL do serviço aparecerá na tela (ex.: `https://finmemory-xxxxx-uc.a.run.app`).

---

## Opção B: Pelo terminal (com gcloud instalado)

1. Instale o Google Cloud SDK: https://cloud.google.com/sdk/docs/install
2. Faça login e defina o projeto:
   ```bash
   gcloud auth login
   gcloud config set project SEU_PROJECT_ID
   ```
3. Na pasta do projeto (clone do repo ou sua pasta local atualizada):
   ```bash
   cd c:\Users\DELL\Downloads\Finmemory
   gcloud run deploy finmemory --source . --region southamerica-east1 --allow-unauthenticated
   ```
4. Confirme quando pedir. O Cloud Run fará o build a partir do código local (que deve estar igual ao branch `main`) e fará o deploy.

---

## Opção C: Trigger do Cloud Build (deploy a cada push no main)

1. Acesse: **https://console.cloud.google.com/cloud-build/triggers**
2. **CREATE TRIGGER**.
3. Nome: ex. `finmemory-deploy`.
4. **Event:** Push to a branch → Branch: `^main$`.
5. **Source:** Conecte o repo **Thiago24-cloud/finmemory**.
6. **Configuration:** Cloud Build configuration file (YAML or JSON) → arquivo: `cloudbuild.yaml` (na raiz).
7. **Substitution variables** (opcional): defina `_NEXT_PUBLIC_SUPABASE_URL` e `_NEXT_PUBLIC_SUPABASE_ANON_KEY` se quiser injetar no build (o Dockerfile atual já tem valores em ENV).
8. Salve. A partir daí, cada **push em main** dispara o build e o deploy no Cloud Run.

---

## Verificar após o deploy

- URL do serviço: no Console do Cloud Run ou no output do `gcloud run deploy`.
- Teste: abra a URL no navegador (ex.: login, dashboard, Relatórios, Categorias, Ajustes, detalhe da transação).
