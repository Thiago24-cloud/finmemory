# Desvincular o app do Firebase e apontar finmemory.com.br ao Cloud Run

Seu app não usa mais Firebase Hosting. O domínio **finmemory.com.br** pode apontar direto para o Cloud Run usando **Cloudflare** como proxy (a região southamerica-east1 não tem domain mapping nativo no Cloud Run).

---

## Passo 1 — Remover o domínio do Firebase Hosting

1. Acesse o [Firebase Console](https://console.firebase.google.com/).
2. Selecione o projeto onde **finmemory.com.br** está conectado (produção: **exalted-entry-480904-s9**).
3. Vá em **Hosting** → **Custom domains**.
4. Remova **finmemory.com.br** (desconecte o domínio).

Assim o Firebase deixa de ser o “dono” do domínio para esse projeto.

---

## Passo 2 — Apontar o domínio para o Cloudflare

No seu **registrador de domínio** (ex.: Registro.br, GoDaddy, etc.):

- Altere os **nameservers** do domínio para os que o Cloudflare informar (conta gratuita em [cloudflare.com](https://www.cloudflare.com)).
- Crie uma conta no Cloudflare, adicione o site **finmemory.com.br** e siga o assistente; no final ele mostra os nameservers para você colocar no registrador.

---

## Passo 3 — No Cloudflare: CNAME para o Cloud Run

No painel do Cloudflare, em **DNS** do seu site:

1. Crie um registro **CNAME**:
   - **Nome:** `@` (ou o subdomínio que quiser, ex.: `www`).
   - **Alvo:** a URL do seu serviço no Cloud Run, por exemplo:
     - `finmemory-836908221936.southamerica-east1.run.app`
   - **Proxy status:** **Proxied** (nuvem laranja ativada), para o Cloudflare fazer proxy para o Cloud Run.

2. Se quiser **www.finmemory.com.br** também:
   - Outro CNAME: nome `www`, mesmo alvo, **Proxied**.

O Cloudflare passa a receber o tráfego de finmemory.com.br e encaminhar para o Cloud Run.

---

## Passo 4 — Cloud Run: aceitar o domínio customizado

O Cloud Run precisa aceitar requisições com **Host: finmemory.com.br**:

1. [Console Cloud Run](https://console.cloud.google.com/run?project=exalted-entry-480904-s9) → projeto **exalted-entry-480904-s9**.
2. Clique no serviço **finmemory**.
3. **Edit & Deploy New Revision** (ou **Manage custom domains**).
4. Em **Custom domains** (ou **Domain mapping**), adicione **finmemory.com.br** (e **www.finmemory.com.br** se usar).

Se a região southamerica-east1 não mostrar “Domain mapping” na interface, o uso do Cloudflare como proxy (passo 3) já faz o **Host** chegar como finmemory.com.br; o NextAuth e o app costumam funcionar com **NEXTAUTH_URL=https://finmemory.com.br** e **trustHost: true**. Pode testar após o DNS propagar.

---

## Resumo

| Onde              | Ação |
|-------------------|------|
| Firebase Console  | Remover finmemory.com.br de Custom domains (Hosting). |
| Registrador       | Trocar nameservers para os do Cloudflare. |
| Cloudflare        | CNAME `@` → finmemory-836908221936.southamerica-east1.run.app (Proxied). |
| Cloud Run         | Se a região permitir, mapear finmemory.com.br no serviço; senão, só Cloudflare + NEXTAUTH_URL. |

Depois disso o app **não** depende mais do Firebase Hosting; o domínio fica vinculado ao Cloud Run via Cloudflare.
