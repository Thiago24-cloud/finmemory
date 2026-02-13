# Setup do Mapa de Preços no Cursor (Finmemory Next.js)

O Mapa de Preços depende de variáveis de ambiente e do token Mapbox. No **Lovable Cloud** isso é automático; no **Cursor** (local ou deploy próprio) precisa de configuração manual.

---

## 1. Variáveis de ambiente

### Next.js (app principal – páginas `/mapa` e `/mapa-precos`)

Crie/edite **`.env.local`** na raiz:

```env
# Supabase (projeto Finmemory)
NEXT_PUBLIC_SUPABASE_URL=https://faxqrkxqfwjdavorxien.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Mapbox (obrigatório para o mapa)
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.eyJ1Ijoi...

# NextAuth, Google OAuth, etc. – veja .env.example
```

O token Mapbox é lido em **build time** e no **servidor** (`getServerSideProps` em `/mapa`). Não há Edge Function no projeto Next.js: o token vem do `.env.local` (local) ou das variáveis do Cloud Run (produção).

### Vite / Lovable (projeto em `src/` com React Router)

O arquivo **`.env`** na raiz já usa o projeto Supabase do Lovable:

```env
VITE_SUPABASE_URL=https://yvtlxlcnyzqcwglqwjap.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
```

No Lovable Cloud, o token Mapbox é obtido pela Edge Function `get-mapbox-token`. No Cursor, essa Edge Function continua rodando no Lovable Cloud; se o front Vite chamar essa função, ela deve funcionar desde que o `.env` (VITE_*) esteja correto.

---

## 2. Token Mapbox – diferença Lovable vs este repo

| Onde | Como o token é obtido |
|------|------------------------|
| **Lovable (Vite)** | Edge Function `get-mapbox-token` no Lovable Cloud |
| **Este repo (Next.js)** | Variável `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` no `.env.local` e no Cloud Run (build/deploy) |

Aqui **não** existe Edge Function para Mapbox: o token é variável de ambiente.

---

## 3. Dependências

```bash
npm install
```

Garante que `mapbox-gl` e o resto das dependências estejam instaladas (já estão no `package.json`).

---

## 4. Rodar o dev server

```bash
npm run dev
```

- **Next.js:** abra [http://localhost:3000/mapa-precos](http://localhost:3000/mapa-precos) ou [http://localhost:3000/mapa](http://localhost:3000/mapa) (esta exige login).
- O mapa usa o token de `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` em `.env.local`.

---

## 5. Se o mapa não carregar

1. Abra o **Console do navegador** (F12 → Console).
2. Verifique:
   - **Token:** mensagens como `Token Mapbox: undefined` → falta `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` no `.env.local` ou o servidor não foi reiniciado após alterar o arquivo.
   - **CORS:** erros de CORS costumam ser do Mapbox ou de outra API; o token em si é lido no build/servidor, não por chamada a Edge Function neste projeto.
3. Reinicie o dev server após mudar `.env.local` (`Ctrl+C` e `npm run dev` de novo).

---

## 6. Deploy (Cloud Run)

O script `.\deploy-cloud-run.ps1` lê o token do `.env.local` e envia para o Cloud Build. O token fica no **build** da imagem (Dockerfile ARG/ENV). As variáveis de runtime (NextAuth, Supabase, etc.) podem ser atualizadas com:

```powershell
.\scripts\set-cloud-run-env.ps1
```

Resumo: no Cursor, o mapa funciona com **`.env.local`** preenchido (incluindo `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`), **npm install**, **npm run dev** e acessando `/mapa-precos` ou `/mapa`.
