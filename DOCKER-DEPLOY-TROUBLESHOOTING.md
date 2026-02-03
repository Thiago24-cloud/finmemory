# Dockerfile e Cloud Build - Troubleshooting Deploy

## ✅ Correções aplicadas

### 1. **cloudbuild.yaml**
- **Removidos** `--build-arg` desnecessários (Dockerfile já tem valores hardcoded)
- **Adicionado** `COMMIT_SHA: 'manual'` nas substitutions → build manual funciona sem erro de tag vazia

### 2. **O que pode impedir o deploy**

| Problema | Causa | Solução |
|----------|-------|---------|
| Tag inválida `finmemory:` | COMMIT_SHA vazio em build manual | ✅ Corrigido: default `manual` |
| Build falha no `npm run build` | Erro no Next.js ou dependência | Ver logs do Cloud Build |
| `verify-build.mjs` falha | Estrutura standalone diferente | Veja seção abaixo |
| Push da imagem falha | Permissões / projeto errado | Verifique IAM e PROJECT_ID |
| Deploy falha | Variáveis de ambiente no Cloud Run | Use CHECKLIST-CLOUD-RUN-ENV.md |

---

## Se o build falhar no Cloud Build

1. Acesse: **Cloud Build → Histórico** → clique no build que falhou
2. Expanda os logs de cada etapa
3. Procure a **primeira** mensagem de erro

### Erros comuns

**"npm ERR! code ELIFECYCLE"**
- Falha no `npm run build` ou `postbuild` (verify-build)
- Solução: rode `npm run build` localmente e veja o erro

**"❌ Verificação do build falhou!"**
- O script `verify-build.mjs` não encontrou `server.js` ou `standalone`
- Pode ser versão diferente do Next.js
- Solução temporária: comente a linha 29 do Dockerfile:
  ```
  # RUN node scripts/verify-build.mjs || ...
  ```

**"failed to solve: process did not complete successfully"**
- Falha genérica do Docker
- Veja o log completo da etapa "docker build"

**"Permission denied" ou "403"**
- Conta de serviço do Cloud Build sem permissão
- Verifique: Cloud Build precisa de roles: Cloud Build Editor, Storage Admin, Cloud Run Admin

---

## Build manual no Cloud Build

Ao clicar em **"Criar build"** ou **"Executar"**:

1. **Tipo:** Cloud Build configuration file (yaml or json)
2. **Localização:** Repository: conecte seu repo OU faça upload do código
3. **Arquivo de configuração:** `cloudbuild.yaml`
4. **Substitution variables** (opcional):
   - `COMMIT_SHA` = `manual` (ou deixe em branco para usar o default)

---

## Testar build localmente (Docker)

```bash
cd c:\Users\DELL\Downloads\Finmemory
docker build -t finmemory-test .
```

Se funcionar localmente mas falhar no Cloud Build, o problema é permissão ou configuração do projeto GCP.

---

## Resumo

- **Dockerfile:** OK para Next.js standalone + Cloud Run
- **cloudbuild.yaml:** Corrigido para builds manuais
- **Variáveis de ambiente:** Configure no Cloud Run (não no build) — veja CHECKLIST-CLOUD-RUN-ENV.md
