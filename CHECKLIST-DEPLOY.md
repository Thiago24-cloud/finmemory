# Checklist — deploy FinMemory (Google Cloud Run)

Use este checklist **antes e depois** de publicar a app em produção. O hosting oficial é **Google Cloud Run** (não Vercel).

**Guia completo de infra:** [docs/DEPLOY-GOOGLE-CLOUD-RUN.md](docs/DEPLOY-GOOGLE-CLOUD-RUN.md)  
**Lista detalhada de variáveis:** [.env.example](.env.example) e [CONFIGURAR-VERCEL.md](CONFIGURAR-VERCEL.md) (nomes das chaves; ignore o painel da Vercel).

---

## Pré-requisitos

- [ ] Conta Google Cloud (projeto com faturamento ou créditos)
- [ ] `gcloud` instalado e autenticado (`gcloud auth login`)
- [ ] Conta Supabase
- [ ] Conta OpenAI (com créditos se for usar GPT)
- [ ] Repositório clonado e `npm install` na raiz (opcional para validar local)

---

## Google Cloud (build e serviço)

- [ ] Projeto de produção FinMemory: **`exalted-entry-480904-s9`** (não usar `finmemory-667c3`)
- [ ] `gcloud config set project exalted-entry-480904-s9` (recomendado; `npm run deploy:cloud-run` também fixa este projeto no submit)
- [ ] APIs ativadas: **Cloud Run**, **Cloud Build**, **Container Registry** (ou equivalente para push de imagem)
- [ ] Conta de serviço do **Cloud Build** com permissão para push da imagem e **deploy no Cloud Run** (ver guia em [docs/DEPLOY-GOOGLE-CLOUD-RUN.md](docs/DEPLOY-GOOGLE-CLOUD-RUN.md))
- [ ] Primeiro deploy da imagem: com `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` definido,
  ```bash
  npm run deploy:cloud-run
  ```
  ou `gcloud builds submit --config=cloudbuild.yaml --substitutions=...` (igual ao guia)

---

## Supabase

- [ ] Projeto criado
- [ ] Schema/tabelas necessárias aplicados (migrações em `supabase/migrations` ou SQL manual)
- [ ] `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` — no **build** já podem estar no `Dockerfile`; alinhar com o projeto certo
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — **só runtime / servidor** → configurar no **Cloud Run** (nunca no cliente)

---

## Google OAuth (Console Google Cloud)

- [ ] OAuth Client ID tipo **Aplicação Web**
- [ ] **Gmail API** (e APIs necessárias ao fluxo) habilitadas no mesmo projeto (ou projeto OAuth alinhado ao app)
- [ ] Tela de consentimento OAuth configurada
- [ ] Escopos usados pelo app (ex.: email, profile, `gmail.readonly` se aplicável)
- [ ] **Authorized redirect URIs** — incluir **todas** as URLs base em que o utilizador abre o site, cada uma com o path do NextAuth:
  - [ ] `http://localhost:3000/api/auth/callback/google` (dev)
  - [ ] `https://SEU-SERVICO-XXXXX-southamerica-east1.run.app/api/auth/callback/google` (URL do Cloud Run; obter em Cloud Run → serviço `finmemory`)
  - [ ] `https://www.finmemory.com.br/api/auth/callback/google` (se usar domínio próprio)
  - [ ] `https://finmemory.com.br/api/auth/callback/google` (sem `www`, se usar)
- [ ] **Authorized JavaScript origins** (se o Console pedir): mesmas bases (`https://...` sem path)
- [ ] `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` copiados para o **Cloud Run**

---

## Variáveis no Cloud Run (runtime)

No **Console → Cloud Run → serviço `finmemory` → Editar e implantar nova revisão → Variáveis e segredos**, conferir pelo menos:

### Obrigatórias (produção típica)

- [ ] `NEXTAUTH_URL` = URL **exata** que o utilizador usa (ex.: `https://www.finmemory.com.br` ou URL `*.run.app` do serviço)
- [ ] `NEXTAUTH_SECRET` (gerar com `openssl rand -base64 32`)
- [ ] `GOOGLE_CLIENT_ID`
- [ ] `GOOGLE_CLIENT_SECRET`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `OPENAI_API_KEY` (se usar processamento de NFs / IA no servidor)

### Públicas (se **não** estiverem só no build da imagem)

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` (também é passada no **build** do Docker; manter igual no Run evita surpresas se mudar revisão sem rebuild)

### Opcionais (conforme features)

- [ ] `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_GA_ALLOWED_HOSTS` (Analytics)
- [ ] `GOOGLE_PLACES_API_KEY` (só se jobs/scripts no Run precisarem)
- [ ] Pluggy, secrets de cron (`DIA_IMPORT_SECRET`, etc.) — ver [.env.example](.env.example)

Validação local (antes do push): `npm run validate-env` com `.env.local` preenchido.

---

## Build da imagem (lembrar)

- [ ] `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` passada na substituição do Cloud Build (`npm run deploy:cloud-run` ou comando equivalente)
- [ ] Build terminou sem erro; imagem com tag do commit em `gcr.io/$PROJECT_ID/finmemory:...`

---

## Pós-deploy — testes

Substitua `BASE` pela URL real (Run ou domínio):

- [ ] Site abre: `BASE/`
- [ ] Login com Google funciona (sem `redirect_uri_mismatch`)
- [ ] Após login, dashboard ou página inicial autenticada carrega
- [ ] Fluxo Gmail / sincronização (se ativo) funciona
- [ ] Mapa de preços carrega (token Mapbox válido no build **e** hosts permitidos, se usar GA)

---

## Segurança

- [ ] `.env.local` e `.env*` sensíveis no `.gitignore`
- [ ] Nenhum segredo commitado no Git
- [ ] Preferir **Secret Manager** no GCP para chaves longas (opcional; Cloud Run liga segredos à revisão)

---

## Monitorização

- [ ] **Cloud Run → finmemory → Registros** (erros 5xx, cold start, timeout)
- [ ] **Supabase** — logs e uso da API
- [ ] **OpenAI** — usage / limites
- [ ] **Google Cloud** — custos e quotas

---

## Troubleshooting

1. `npm run validate-env` (local)
2. No Cloud Run: revisão atual tem **todas** as variáveis necessárias?
3. `NEXTAUTH_URL` coincide com o URL no browser (inclui `https` e **sem** barra final extra se o NextAuth reclamar)?
4. Redirect URIs no Google Console = `NEXTAUTH_URL` + `/api/auth/callback/google` (exatamente)
5. Logs do Cloud Run para stack traces
6. [docs/DEPLOY-GOOGLE-CLOUD-RUN.md](docs/DEPLOY-GOOGLE-CLOUD-RUN.md) e [TROUBLESHOOTING-ERRO-500.md](TROUBLESHOOTING-ERRO-500.md)

---

## Recursos úteis

- [docs/DEPLOY-GOOGLE-CLOUD-RUN.md](docs/DEPLOY-GOOGLE-CLOUD-RUN.md)
- [.env.example](.env.example)
- [SETUP-ENV.md](SETUP-ENV.md)
- [lib/env-validator.mjs](lib/env-validator.mjs) / `npm run validate-env`

---

## Pronto

Com os itens acima alinhados ao **Cloud Run**, o FinMemory fica consistente com o deploy oficial. O agente de promoções (`finmemory-agent`) é um processo separado (job/cron/outro serviço); não faz parte do mesmo container da app Next salvo que configures isso à parte. Se o cron correr `npm run promo:dia` com listagem **SP capital** (~121 lojas), define **timeout do job** com folga (por exemplo **≥ 3600 s**); detalhes em [docs/DIA-MAPA-IMPORTAR-OUTRA-LOJA.md](docs/DIA-MAPA-IMPORTAR-OUTRA-LOJA.md).
