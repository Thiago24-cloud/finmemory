# Instruções para Claude Code

## Permissões
- Pode ler, editar e criar qualquer arquivo do projeto sem pedir confirmação
- Pode rodar comandos bash (find, cat, grep, ls, git) sem pedir confirmação
- Nunca peça permissão antes de ler arquivos do repositório

## Comportamento
- Sempre mostre o plano antes de implementar mudanças grandes
- Após implementar, faça um resumo do que foi alterado
- Se houver dúvida entre duas abordagens, escolha a mais simples
- Prefira editar arquivos existentes a criar novos quando possível

## Regras de arquitetura

### Scrapers / bots
- Todo scraper DEVE usar `enqueuePromocoes()` de `lib/ingest` — nunca inserir direto em `price_points`
- `enqueuePromocoes()` está em `lib/ingest/enqueuePromocoes.js` e exportado por `lib/ingest/index.js`
- O campo `origem` deve identificar o scraper (ex: `'scraper_dia'`, `'scraper_assai'`)
- Fluxos manuais (usuário, OCR, Quick Add, admin) podem inserir em `price_points` diretamente
