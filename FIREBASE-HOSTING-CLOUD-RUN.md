# Firebase Hosting + Cloud Run

**Projeto GCP / Firebase de produção:** `exalted-entry-480904-s9` (FinMemory).  
O projeto **`finmemory-667c3` está descontinuado** — não uses para deploy nem para documentação operacional.

## Erro: "Cloud Run service `finmemory` does not exist in region `southamerica-east1`"

O Firebase Hosting tenta vincular ao serviço Cloud Run **no mesmo projeto GCP**. Se o serviço ainda não existir nessa região, o `firebase deploy` falha ao finalizar.

## O que precisa bater

- **firebase.json** (se usares Hosting): rewrites para o Cloud Run com `serviceId`: **finmemory**, `region`: **southamerica-east1**.
- **.firebaserc**: deve apontar para o **mesmo** projeto onde está o Cloud Run (hoje: **exalted-entry-480904-s9**).

## Deploy da app (Cloud Run)

O script **`npm run deploy:cloud-run`** envia o build para o projeto **`exalted-entry-480904-s9`** por defeito (ver `scripts/deploy-cloud-run.mjs`). Não depende só do `gcloud config set project`.

```powershell
gcloud config set project exalted-entry-480904-s9
npm run deploy:cloud-run
```

Ou PowerShell: `.\deploy-cloud-run.ps1` (já usa `exalted-entry-480904-s9`).

## Erro 403 Forbidden (.web.app ou domínio customizado)

Se aparecer *"403 Forbidden - Your client does not have permission to get URL"*, o Hosting fala com o Cloud Run mas falta **Cloud Run Invoker** no serviço.

```powershell
.\scripts\fix-firebase-hosting-cloudrun-403.ps1
```

Ou manualmente:

```bash
gcloud config set project exalted-entry-480904-s9
gcloud run services add-iam-policy-binding finmemory --region=southamerica-east1 --project=exalted-entry-480904-s9 --member="allUsers" --role="roles/run.invoker"
```

Testa de novo **https://finmemory.com.br** (e o URL `*.run.app` do serviço, se usares).

## Erro "Authentication Error - Configuration" (login)

1. **Variáveis no Cloud Run** no projeto **exalted-entry-480904-s9**:
   ```powershell
   gcloud config set project exalted-entry-480904-s9
   .\scripts\set-cloud-run-env.ps1
   ```
   O script define `NEXTAUTH_URL` a partir do URL real do serviço `finmemory` (ou fallback conhecido).

2. **Google OAuth** — no projeto **exalted-entry-480904-s9**: [Credentials](https://console.cloud.google.com/apis/credentials?project=exalted-entry-480904-s9)  
   - Redirect: `https://finmemory.com.br/api/auth/callback/google` (e, se testares no Run direto, o URL `https://…run.app/api/auth/callback/google` correspondente).  
   - Origens JS: `https://finmemory.com.br` (e o host do Run, se aplicável).

3. Limpa cookies ou aba anónima e tenta de novo.

## Domínio finmemory.com.br

1. Cloud Run **finmemory** em **southamerica-east1** no projeto **exalted-entry-480904-s9**.  
2. `firebase deploy --only hosting` (ou `npm run deploy:firebase-hosting`) no mesmo projeto Firebase/GCP — ver `firebase.json` na raiz.  
3. No [Firebase Console](https://console.firebase.google.com) → projeto ligado a **exalted-entry-480904-s9** → **Hosting** → domínio customizado **finmemory.com.br** conectado.

## Ficheiros no repositório

- **`firebase.json`** — rewrite `**` → Cloud Run `finmemory` (`southamerica-east1`). Assim `/api/*` (ex.: `/api/pluggy/webhook`) chega ao Next.js no Run.  
- **`.firebaserc`** — projeto predefinido `exalted-entry-480904-s9`.

Ordem típica: `npm run deploy:cloud-run` (imagem nova) → `npm run deploy:firebase-hosting` (atualiza rewrites/domínio no Hosting).

## Cloudflare (DNS em frente ao Firebase)

1. No **Firebase Console** → Hosting → domínios, copia os registos que o Google pede (CNAME para `finmemory.web.app` ou equivalente).  
2. No **Cloudflare** → DNS do `finmemory.com.br`: cria/edita os registos **exatamente** como o Firebase indica (nome, destino, proxy).  
3. **SSL/TLS** → modo **Full (strict)** (o Firebase emite o certificado do domínio).  
4. Se algo falhar, testa com **proxy DNS só** (cinza) em vez de “proxied” (laranja) para isolar bloqueios.  
5. **Page Rules / Cache:** evita cache agressivo em `/api/*` (ou exclui API do cache), senão podes ver respostas antigas ou erros.

---

**Resumo:** Hosting e Cloud Run no **mesmo** projeto; serviço **finmemory**, região **southamerica-east1**; projeto alvo **exalted-entry-480904-s9**. Cloudflare só encaminha DNS para o destino que o **Firebase** define; o tráfego da app continua a ser servido pelo **Hosting → Cloud Run**.
