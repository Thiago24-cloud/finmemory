# Desvincular Vercel — produção é só Cloud Run

**FinMemory em produção = Google Cloud Run** (`exalted-entry-480904-s9`, serviço `finmemory`).  
Não use Vercel para o app, mapa, scrapers nem Parceiros.

## Por que aparece o `vercel[bot]` no PR?

O GitHub tem o app **Vercel** instalado no repositório. Qualquer push/PR dispara preview no projeto `finmemory-2stb` — isso **não** é o deploy de produção e **não** atualiza o mapa em `finmemory.com.br` / Cloud Run.

## Desligar de vez (dashboard Vercel — 2 minutos)

1. Abra https://vercel.com/thiago-onwenu-empresas-projects/finmemory-2stb/settings/git  
2. Clique **Disconnect** no repositório GitHub.  
3. (Opcional) Em https://github.com/settings/installations → **Vercel** → remova acesso a `Thiago24-cloud/finmemory`.

## No repositório

Os `vercel.json` usam `"ignoreCommand": "exit 0"` para **pular** qualquer build automático se o app Vercel ainda estiver ligado.

## Deploy correto

```bash
# Consumer (mapa + scrapers)
npm run deploy:cloud-run

# Parceiros / Skip
npm run deploy:cloud-run:retailer
```

Guia: [DEPLOY-GOOGLE-CLOUD-RUN.md](./DEPLOY-GOOGLE-CLOUD-RUN.md)
