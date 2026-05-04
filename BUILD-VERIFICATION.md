# 🔍 Verificação de Build

Este documento explica como verificar se o build standalone do Next.js está correto antes do deploy.

## Scripts Disponíveis

### 1. Verificação Automática (pós-build)

Após executar `npm run build`, o script `verify-build.mjs` é executado automaticamente via `postbuild` hook.

```bash
npm run build
# Automaticamente executa: node scripts/verify-build.mjs
```

### 2. Verificação Manual

Você pode executar a verificação manualmente a qualquer momento:

```bash
npm run verify-build
# ou
node scripts/verify-build.mjs
```

## O que é Verificado

O script verifica:

✅ **Estrutura do Build**
- Existência do diretório `.next/`
- Existência do diretório `.next/standalone/`
- Existência do arquivo `server.js` em `standalone/`
- Tamanho do `server.js` (deve ter conteúdo significativo)

✅ **Dependências**
- Diretório `node_modules` dentro de `standalone/`
- Diretório `.next` dentro de `standalone/`

✅ **Arquivos Estáticos**
- Diretório `.next/static/` (para assets estáticos)

✅ **Páginas**
- Páginas principais (`index`, `_app`) no build

✅ **Recursos Públicos**
- Diretório `public/` (opcional, mas recomendado)

## Saída do Script

### ✅ Sucesso
```
🎉 Verificação concluída com sucesso!
✅ Build standalone está pronto para deploy.
```

### ⚠️ Avisos
O build está funcional, mas há alguns avisos que podem ser investigados.

### ❌ Erros
O build falhou ou está incompleto. **Não faça deploy** até corrigir os erros.

## Verificação no Dockerfile

O Dockerfile também verifica:

1. **Após o build**: Executa `verify-build.mjs` para garantir que o build standalone foi criado
2. **Antes do deploy**: Verifica se `server.js` e `.next/static` foram copiados corretamente

Se qualquer verificação falhar, o build do Docker será interrompido.

## Troubleshooting

### Erro: "Diretório .next/standalone não encontrado"

**Causa**: O `next.config.ts` não tem `output: 'standalone'` configurado.

**Solução**: Adicione ao `next.config.ts`:
```javascript
const nextConfig = {
  output: 'standalone',
  // ... outras configurações
}
```

### Erro: "server.js não encontrado"

**Causa**: O build não foi executado ou falhou silenciosamente.

**Solução**: 
1. Execute `npm run build` novamente
2. Verifique se há erros no console
3. Verifique se todas as variáveis de ambiente necessárias estão configuradas

### Aviso: "Páginas principais não encontradas"

**Causa**: As páginas podem não ter sido incluídas no build standalone.

**Solução**:
1. Verifique se `pages/index.js` existe
2. Verifique se não há erros de sintaxe nas páginas
3. Tente fazer um build limpo: `rm -rf .next && npm run build`

## Integração com CI/CD

O script pode ser usado em pipelines de CI/CD:

```yaml
# Exemplo para GitHub Actions
- name: Build
  run: npm run build

- name: Verify Build
  run: npm run verify-build
  # Se falhar, o pipeline para aqui
```

## Próximos Passos

Após verificar o build:

1. ✅ Build verificado com sucesso
2. 🐳 Construir imagem Docker: `docker build -t finmemory .`
3. 🚀 Fazer deploy para Cloud Run
4. 🔍 Verificar logs após deploy para garantir que está funcionando
