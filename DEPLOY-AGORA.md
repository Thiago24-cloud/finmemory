# 🚀 Deploy Agora - Passo a Passo Visual

## 📍 Passo 1: Cloud Build Console
A página do Cloud Build deve ter aberto no seu navegador.

Se não abriu, acesse manualmente:
👉 https://console.cloud.google.com/cloud-build/builds?project=finmemory-836908221936

---

## 📍 Passo 2: Criar Build
1. **Clique no botão azul** "CRIAR BUILD" ou "TRIGGER BUILD" (canto superior direito)
2. Se aparecer um menu, escolha **"Executar build manualmente"** ou **"Manual build"**

---

## 📍 Passo 3: Configurar Build
Na tela que abrir, configure:

### 3.1. Tipo de Build
- ✅ Selecione: **"Cloud Build configuration file (yaml or json)"**
- ✅ Ou: **"Build configuration file"**

### 3.2. Localização do Arquivo
- **Arquivo de configuração:** `cloudbuild.yaml`
- **Localização:** Deixe como está (raiz do repositório)

### 3.3. Substituições (Substitutions)
Se houver campo para "Substitutions" ou "Substitution variables", adicione:
```
COMMIT_SHA=manual-20260129
```

**OU** deixe vazio - o Cloud Build pode gerar automaticamente.

---

## 📍 Passo 4: Executar
1. **Clique no botão "EXECUTAR"** ou "RUN" (canto inferior direito)
2. Aguarde o build iniciar (pode levar alguns segundos)

---

## 📍 Passo 5: Acompanhar Build
Você verá:
- ✅ **Status:** "Em execução" / "Running"
- ✅ **Logs em tempo real** (expanda a seção de logs)
- ✅ **Etapas:**
  1. Build da imagem Docker
  2. Push para Container Registry
  3. Deploy no Cloud Run

⏱️ **Tempo estimado:** 5-10 minutos

---

## 📍 Passo 6: Verificar Sucesso
Quando terminar, você verá:
- ✅ **Status:** "SUCESSO" / "SUCCESS" (verde)
- ✅ **Mensagem:** "Build completed successfully"

---

## 📍 Passo 7: Testar Aplicação
1. Acesse: https://finmemory-836908221936.southamerica-east1.run.app
2. Faça login
3. Teste o sync de emails
4. Verifique os logs se ainda houver erro 500

---

## 🆘 Se Algo Der Errado

### Erro: "File not found: cloudbuild.yaml"
- ✅ Verifique se você está no projeto correto
- ✅ Confirme que o arquivo `cloudbuild.yaml` existe no repositório

### Erro: "Permission denied"
- ✅ Verifique se você tem permissão de "Cloud Build Editor"
- ✅ Acesse: https://console.cloud.google.com/iam-admin/iam

### Erro: "Project not found"
- ✅ Verifique se o PROJECT_ID está correto: `finmemory-836908221936`
- ✅ Ou use o seletor de projeto no topo da página

### Build falha no Docker
- ✅ Verifique os logs completos
- ✅ Confirme que todas as variáveis estão no Cloud Run (não no build)

---

## ✅ Checklist Rápido

- [ ] Cloud Build Console aberto
- [ ] Botão "CRIAR BUILD" clicado
- [ ] Tipo: "Cloud Build configuration file"
- [ ] Arquivo: `cloudbuild.yaml`
- [ ] Botão "EXECUTAR" clicado
- [ ] Build em andamento (logs aparecendo)
- [ ] Aguardando conclusão (5-10 min)
- [ ] Status: SUCESSO ✅
- [ ] Aplicação testada

---

## 🎯 Próximo Passo Após Deploy

Quando o build terminar com sucesso:
1. ✅ A aplicação será atualizada automaticamente
2. ✅ Teste o sync de emails novamente
3. ✅ Os novos logs mostrarão exatamente onde está falhando (se ainda houver erro)

---

**💡 Dica:** Deixe esta página aberta para acompanhar os logs em tempo real!
