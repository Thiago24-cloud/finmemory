# Como saber se o deploy novo está no ar

## 1. O deploy da app **não mexe nas promoções do mapa**

`npm run deploy:cloud-run` publica só o **Next.js** no Cloud Run. As ofertas DIA / outras redes vêm do **`finmemory-agent`** (`npm run promo:dia`, etc.) e da base **Supabase**. Se esperavas **pins ou tablóides novos**, é preciso **correr o agente** (ou import DIA), não só fazer deploy da web.

## 2. Confirma a **revisão** do Cloud Run

O URL do serviço muda com o projeto GCP. Obtém o link canónico com:

```bash
gcloud run services describe finmemory --region=southamerica-east1 --project=exalted-entry-480904-s9 --format="value(status.url)"
```

Depois abre no browser: `SEU_URL/api/health`.

**Projeto de produção FinMemory:** `exalted-entry-480904-s9`. O projeto `finmemory-667c3` **não** deve ser usado para deploy.

Depois de um deploy com código recente, a resposta JSON inclui:

```json
"deploy": {
  "service": "finmemory",
  "revision": "finmemory-00008-l5x"
}
```

O número da revisão (`00008-l5x`, etc.) **sobe** quando há um deploy novo. Se não vês `deploy`, estás em local/dev ou num host que não é Cloud Run.

No terminal:

```bash
gcloud run services describe finmemory --region=southamerica-east1 --project=exalted-entry-480904-s9 --format="value(status.latestReadyRevisionName,status.url)"
```

## 3. Domínio customizado / Firebase Hosting

Se entras por **finmemory.com.br** ou **\*.web.app**, o tráfego vai ao **mesmo** serviço Cloud Run só se o Hosting / load balancer estiver bem configurado. Pode haver **cache** no browser ou na CDN: experimenta **Ctrl+F5** ou janela anónima.

Se aparecer **403 Forbidden** ao abrir o site, o Cloud Run pode estar sem **Invoker** público — ver [FIREBASE-HOSTING-CLOUD-RUN.md](../FIREBASE-HOSTING-CLOUD-RUN.md) e o script `scripts/fix-firebase-hosting-cloudrun-403.ps1`.

## 4. “Não vi mudança nenhuma” no aspeto da app

Muitos deploys só trazem **correções internas** ou dados iguais: a UI pode parecer idêntica. Usa `/api/health` + `revision` ou o comando `gcloud` acima para ter a certeza técnica de que o ambiente novo está a servir.
