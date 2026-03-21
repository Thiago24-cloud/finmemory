# Firebase Hosting + Cloud Run

## Erro: "Cloud Run service `finmemory` does not exist in region `southamerica-east1`"

O Firebase Hosting tenta vincular ao serviço Cloud Run **no mesmo projeto GCP**. Se o serviço ainda não existir nessa região, o `firebase deploy` falha ao finalizar.

## O que está configurado

- **firebase.json**: Hosting com `public` = pasta `public` e rewrites para o Cloud Run.
  - `serviceId`: **finmemory**
  - `region`: **southamerica-east1**
- **.firebaserc**: projeto padrão **finmemory-667c3** (projeto do Firebase onde o domínio finmemory.com.br está).

## Por que dá erro ao fazer `firebase deploy`?

O Firebase está configurado para o projeto **finmemory-667c3**. O Hosting tenta usar um serviço Cloud Run "finmemory" em **southamerica-east1** nesse mesmo projeto. Se esse serviço não existir em **finmemory-667c3**, o deploy falha. O comando `firebase use finmemory-836908221936` falha porque esse ID não é um projeto Firebase válido para a sua conta (pode ser outro projeto ou número de projeto).

## Passos para corrigir

### 1. Ter o Cloud Run no mesmo projeto do Firebase (finmemory-667c3)

O Cloud Run precisa existir **no projeto finmemory-667c3**. Se o seu app hoje está em outro projeto, é preciso fazer o deploy no **finmemory-667c3**.

### 2. Criar o serviço Cloud Run (se ainda não existir)

No projeto escolhido (finmemory-667c3 ou finmemory-836908221936), crie o serviço com **nome** `finmemory` e **região** `southamerica-east1`:

```powershell
# Definir o projeto (use o mesmo do .firebaserc)
gcloud config set project finmemory-667c3

# Deploy via script (usa cloudbuild.yaml: nome finmemory, região southamerica-east1)
.\deploy-cloud-run.ps1
```

Ou pelo Cloud Build no Console, garantindo que o serviço criado se chame **finmemory** e esteja em **southamerica-east1**.

### 3. Conferir nome e região no Console

No [Cloud Run](https://console.cloud.google.com/run): escolha o projeto → veja o **nome** do serviço e a **região**. Se for diferente (ex.: outro nome ou região), ajuste o **firebase.json**:

```json
"run": {
  "serviceId": "NOME_EXATO_DO_SERVICO",
  "region": "REGIAO_EXATA"
}
```

### 4. Rodar o deploy do Firebase

Depois que o serviço `finmemory` existir em `southamerica-east1` no mesmo projeto:

```bash
firebase deploy
```

---

**Resumo**: Firebase Hosting e Cloud Run precisam estar no **mesmo projeto**. O serviço deve se chamar **finmemory** e estar na região **southamerica-east1** (ou então altere `serviceId`/`region` no `firebase.json` para bater com o Console).

---

## Erro 403 Forbidden ao abrir .web.app ou o domínio customizado

Se ao acessar **finmemory-667c3.web.app** ou **finmemory.com.br** aparecer *"403 Forbidden - Your client does not have permission to get URL"*, o **Firebase Hosting** está conseguindo falar com o Cloud Run, mas o **agente do Firebase Hosting** não tem permissão para invocar o serviço.

**Solução:** conceder a função **Cloud Run Invoker** a **allUsers** no serviço `finmemory` (acesso público ao Cloud Run, necessário para o Hosting conseguir repassar as requisições):

```powershell
# Na pasta do projeto (Finmemory)
.\scripts\fix-firebase-hosting-cloudrun-403.ps1
```

Ou manualmente:

```bash
gcloud config set project finmemory-667c3
gcloud run services add-iam-policy-binding finmemory --region=southamerica-east1 --member="allUsers" --role="roles/run.invoker"
```

Depois de aplicar, teste de novo **finmemory-667c3.web.app** e **finmemory.com.br**.

---

## Erro "Authentication Error - Configuration" ao fazer login

Se ao clicar em login aparece **"Erro de Autenticação"** com código **Configuration**, o NextAuth está com a URL errada: o app está sendo acessado por **finmemory-667c3.web.app** (ou finmemory.com.br), mas as variáveis do Cloud Run ainda apontam para outra URL.

**Solução:**

1. **Definir variáveis no Cloud Run** (projeto **finmemory-667c3**) com a URL correta:
   ```powershell
   gcloud config set project finmemory-667c3
   .\scripts\set-cloud-run-env.ps1
   ```
   O script lê o `.env.local` e atualiza o serviço **finmemory**; em projeto **finmemory-667c3** ele já define `NEXTAUTH_URL=https://finmemory-667c3.web.app` e `GOOGLE_REDIRECT_URI` correspondente.

2. **Incluir a URL de callback no Google (OAuth):**
   - Abra [APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials?project=finmemory-667c3).
   - Clique no cliente OAuth 2.0 usado pelo app (tipo "Aplicativo da Web").
   - Em **"URIs de redirecionamento autorizados"**, adicione:
     - `https://finmemory-667c3.web.app/api/auth/callback/google`
     - Se usar o domínio customizado: `https://finmemory.com.br/api/auth/callback/google`
   - Em **"Origens JavaScript autorizadas"**, adicione:
     - `https://finmemory-667c3.web.app`
     - `https://finmemory.com.br` (se usar)
   - Salve.

3. Limpe os cookies do site (ou use uma aba anônima) e tente fazer login de novo.

---

## Usar o app no domínio finmemory.com.br (revisão Google)

Objetivo: acessar o app em **https://finmemory.com.br** para poder enviar à revisão do Google (Play Store, etc.).

### O que já está certo

1. **Cloud Run** precisa existir no projeto **finmemory-667c3** (serviço **finmemory**, região **southamerica-east1**). Se o app hoje está em outro projeto, faça o deploy no finmemory-667c3 (passo 1 abaixo).
2. **firebase.json** já aponta o Hosting para esse serviço (`serviceId`: finmemory, `region`: southamerica-east1).
3. **.firebaserc** está com o projeto **finmemory-667c3** (projeto do Firebase com o domínio).

### Ordem dos passos

1. **Criar o Cloud Run no projeto finmemory-667c3** (se ainda não existir): no terminal, `gcloud config set project finmemory-667c3` e depois `.\deploy-cloud-run.ps1`. No primeiro deploy pode ser preciso ativar Cloud Build e Cloud Run API nesse projeto no Console GCP.
2. **Deploy do Firebase Hosting** (para o Hosting “ligar” ao Cloud Run):
   ```bash
   firebase deploy
   ```
3. **Domínio customizado no Firebase**: você disse que o domínio já está conectado. Para o app ser servido em **finmemory.com.br**, o domínio precisa estar associado ao **Hosting** (não só ao projeto):
   - Abra: [Firebase Console](https://console.firebase.google.com) → projeto **finmemory-667c3** → **Hosting**.
   - Em **Domínios customizados**, veja se **finmemory.com.br** (e, se quiser, **www.finmemory.com.br**) está listado e com status **Conectado**.
   - Se não estiver: clique em **Adicionar domínio customizado**, informe **finmemory.com.br**, e siga as instruções de DNS (registro A ou CNAME conforme o Firebase indicar no seu provedor de domínio).

Depois que o DNS propagar e o domínio aparecer como conectado, **https://finmemory.com.br** passa a abrir o mesmo app que está no Cloud Run, e você pode usar essa URL na revisão do Google.
