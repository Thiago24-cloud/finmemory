# 🔧 Criar Conta de Serviço do Cloud Build - Passo a Passo

## 📍 Passo 1: Página de Criação
A página de criação deve ter aberto. Se não, acesse:
👉 https://console.cloud.google.com/iam-admin/serviceaccounts/create?project=finmemory-836908221936

---

## 📍 Passo 2: Preencher Detalhes da Conta

### 2.1. Nome da Conta de Serviço
```
Cloud Build Service Account
```
ou
```
cloudbuild
```

### 2.2. ID da Conta de Serviço
Deixe o padrão gerado automaticamente, ou use:
```
cloudbuild
```

### 2.3. Descrição (opcional)
```
Conta de serviço para Cloud Build fazer deploy no Cloud Run
```

### 2.4. Clique em "CRIAR E CONTINUAR"

---

## 📍 Passo 3: Conceder Acesso ao Projeto

Na próxima tela, você verá "Conceder acesso a este projeto".

### Adicione as seguintes roles (uma por uma):

1. **Cloud Build Service Account**
   - Procure: `Cloud Build Service Account`
   - Role: `roles/cloudbuild.builds.editor`

2. **Cloud Run Admin**
   - Procure: `Cloud Run Admin`
   - Role: `roles/run.admin`

3. **Service Account User**
   - Procure: `Service Account User`
   - Role: `roles/iam.serviceAccountUser`

4. **Storage Admin**
   - Procure: `Storage Admin`
   - Role: `roles/storage.admin`

### Como adicionar:
- Clique em **"+ ADICIONAR OUTRO PAPEL"** ou **"+ ADD ANOTHER ROLE"**
- Digite o nome da role no campo de busca
- Selecione a role da lista
- Repita para cada role acima

### Depois de adicionar todas as 4 roles:
- Clique em **"CONTINUAR"**

---

## 📍 Passo 4: Conceder Acesso aos Usuários (Opcional)

Você pode pular esta etapa clicando em **"CONCLUÍDO"** ou **"DONE"**.

---

## 📍 Passo 5: Verificar Criação

Após criar, você verá:
- ✅ Email da conta de serviço (algo como: `cloudbuild@finmemory-836908221936.iam.gserviceaccount.com`)
- ✅ Lista de roles atribuídas

---

## 📍 Passo 6: Configurar Cloud Build para Usar Esta Conta

Agora você precisa configurar o Cloud Build para usar esta conta:

1. **Acesse:** https://console.cloud.google.com/cloud-build/settings?project=finmemory-836908221936
2. **Na seção "Service account permissions"**, selecione:
   - **"Use a service account"**
   - Selecione a conta que você acabou de criar: `cloudbuild@finmemory-836908221936.iam.gserviceaccount.com`
3. **Salve as alterações**

---

## ✅ Checklist Final

Após criar a conta de serviço, verifique:

- [ ] Conta de serviço criada com sucesso
- [ ] 4 roles adicionadas (Cloud Build, Cloud Run Admin, Service Account User, Storage Admin)
- [ ] Cloud Build configurado para usar esta conta
- [ ] Aguardou 1-2 minutos para propagação de permissões

---

## 🎯 Próximo Passo

Depois de criar e configurar:
1. Volte ao Cloud Build
2. Tente criar o build novamente
3. Deve funcionar agora! 🚀

---

## 🆘 Se Der Erro

### Erro: "Permission denied"
- Verifique se todas as 4 roles foram adicionadas
- Aguarde alguns minutos para propagação

### Erro: "Service account not found"
- Confirme que a conta foi criada corretamente
- Verifique o email da conta de serviço

### Erro: "Insufficient permissions"
- Adicione a role `Cloud Build Service Account` explicitamente
- Verifique se não há políticas bloqueando
