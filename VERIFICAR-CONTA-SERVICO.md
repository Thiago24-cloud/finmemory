# 🔧 Verificar e Configurar Conta de Serviço do Cloud Build

## 📍 Passo 1: Acessar Contas de Serviço
A página de Contas de Serviço deve ter aberto. Se não, acesse:
👉 https://console.cloud.google.com/iam-admin/serviceaccounts?project=finmemory-836908221936

---

## 📍 Passo 2: Encontrar a Conta de Serviço do Cloud Build

Procure por uma conta de serviço com um destes formatos:
- `PROJECT_NUMBER@cloudbuild.gserviceaccount.com`
- Ou algo como: `836908221936@cloudbuild.gserviceaccount.com`

**OU** procure por:
- Nome: "Cloud Build Service Account"
- Email que termina com `@cloudbuild.gserviceaccount.com`

---

## 📍 Passo 3: Verificar Permissões da Conta de Serviço

1. **Clique na conta de serviço** do Cloud Build
2. Vá na aba **"Permissões"** ou **"IAM"**
3. Verifique se ela tem as seguintes roles:
   - ✅ **Cloud Build Service Account** (obrigatório)
   - ✅ **Cloud Run Admin** ou **Cloud Run Developer** (para fazer deploy)
   - ✅ **Service Account User** (para usar outras contas de serviço)
   - ✅ **Storage Admin** ou **Storage Object Admin** (para push de imagens)

---

## 📍 Passo 4: Adicionar Permissões Necessárias

Se faltar alguma permissão:

1. **Na página da conta de serviço**, clique em **"Permissões"** ou **"Grant Access"**
2. Clique em **"+ Permitir acesso"** ou **"+ Grant Access"**
3. Adicione as seguintes roles:
   - `Cloud Build Service Account`
   - `Cloud Run Admin`
   - `Service Account User`
   - `Storage Admin` (ou `Storage Object Admin`)

---

## 📍 Passo 5: Verificar no IAM do Projeto

Também verifique no IAM geral do projeto:

1. Acesse: https://console.cloud.google.com/iam-admin/iam?project=finmemory-836908221936
2. Procure pela conta de serviço do Cloud Build
3. Verifique se ela tem as roles listadas acima

---

## 🔍 Se a Conta de Serviço Não Existir

O Cloud Build cria automaticamente uma conta de serviço quando você faz o primeiro build. Se não existir:

1. **Tente fazer um build simples** - isso criará a conta automaticamente
2. **OU crie manualmente:**
   - Vá em "Contas de serviço"
   - Clique em "+ Criar conta de serviço"
   - Nome: `cloudbuild`
   - Email: `cloudbuild@finmemory-836908221936.iam.gserviceaccount.com`
   - Adicione as roles necessárias

---

## ✅ Permissões Mínimas Necessárias

A conta de serviço do Cloud Build precisa de:

### No Projeto:
- ✅ `roles/cloudbuild.builds.editor` (Cloud Build Editor)
- ✅ `roles/run.admin` (Cloud Run Admin)
- ✅ `roles/iam.serviceAccountUser` (Service Account User)
- ✅ `roles/storage.admin` (Storage Admin) - para push de imagens

### Na Conta de Serviço do Cloud Run:
- ✅ `roles/iam.serviceAccountUser` (para usar a conta de serviço do Cloud Run)

---

## 🆘 Troubleshooting

### Erro: "Permission denied"
- Verifique se a conta de serviço tem todas as roles acima
- Pode levar alguns minutos para as permissões serem propagadas

### Erro: "Service account not found"
- A conta de serviço pode não ter sido criada ainda
- Tente fazer um build simples primeiro

### Erro: "Insufficient permissions"
- Adicione explicitamente a role `Cloud Build Service Account`
- Verifique se não há políticas de organização bloqueando

---

## 📝 Após Configurar

1. Aguarde 1-2 minutos para as permissões serem propagadas
2. Tente acessar o Cloud Build novamente
3. Se ainda não funcionar, faça logout/login do Google Cloud Console

---

## 🎯 Próximo Passo

Depois de verificar e configurar a conta de serviço:
1. Volte ao Cloud Build
2. Tente criar o build novamente
3. O deploy deve funcionar agora
