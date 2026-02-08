# 🔐 Solução: Permissão para ler e-mails do Gmail

## ⚠️ "Está faltando a permissão para ler os e-mail"

Para o FinMemory **ler os e-mails** do Gmail, é obrigatório configurar no **Google Cloud Console**:

### 1. Habilitar a Gmail API
1. Acesse: **https://console.cloud.google.com/apis/library**
2. Selecione o projeto do FinMemory
3. Pesquise **"Gmail API"**
4. Clique em **Gmail API** → **Habilitar**

### 2. Adicionar o escopo de leitura no OAuth Consent Screen
1. Acesse: **https://console.cloud.google.com/apis/credentials/consent**
2. Selecione o projeto
3. Em **"Escopos"** (Scopes), clique em **"Adicionar ou remover escopos"**
4. Procure e marque:
   - **Gmail API** → `https://www.googleapis.com/auth/gmail.readonly`  
     (descrição: "Ver conteúdo de e-mails e metadados")
5. Salve

### 3. Autorized redirect URIs (incluir a URL do Cloud Run)
1. Acesse: **https://console.cloud.google.com/apis/credentials**
2. Clique no seu **OAuth 2.0 Client ID** (tipo Web application)
3. Em **"URIs de redirecionamento autorizados"**, inclua:
   - `https://finmemory-836908221936.southamerica-east1.run.app/api/auth/callback/google`
   - `http://localhost:3000/api/auth/callback/google` (desenvolvimento)
4. Salve

### 4. Revogar e autorizar de novo (se já logou antes)
1. Acesse: **https://myaccount.google.com/permissions**
2. Revogue o acesso do **FinMemory**
3. No app: **Sair** → **Entrar com Google** de novo  
4. Na tela do Google, **aceite** quando pedir acesso a "Ver conteúdo de e-mails e metadados"

---

## 🎯 Problema: "Insufficient Permission"

O erro **"Insufficient Permission"** ou **"insufficientPermissions"** ocorre quando o token do Gmail não tem as permissões necessárias para acessar os e-mails.

## 🔍 Causas Comuns

1. **Usuário não autorizou as permissões durante o login**
2. **Permissões foram revogadas pelo usuário**
3. **OAuth Consent Screen não configurado corretamente no Google Cloud Console**
4. **Escopo não foi concedido corretamente**

## ✅ Solução Rápida para o Usuário

### Passo 1: Revogar Acesso Anterior
1. Acesse: **https://myaccount.google.com/permissions**
2. Procure por **"FinMemory"** ou o nome do seu app
3. Clique em **"Revogar acesso"** ou **"Remove access"**

### Passo 2: Reautenticar no App
1. No app, clique em **"Sair"**
2. Faça login novamente com o Gmail
3. **IMPORTANTE:** Certifique-se de autorizar o acesso aos e-mails quando solicitado
4. Tente sincronizar novamente

## 🔧 Verificação no Google Cloud Console

Se o problema persistir, verifique a configuração no Google Cloud Console:

### 1. Verificar OAuth Consent Screen
1. Acesse: **https://console.cloud.google.com/apis/credentials/consent**
2. Selecione seu projeto
3. Verifique se está configurado como **"External"** (para usuários externos)
4. Verifique se os escopos estão adicionados:
   - ✅ `userinfo.email`
   - ✅ `userinfo.profile`
   - ✅ `https://www.googleapis.com/auth/gmail.readonly`

### 2. Verificar Escopos Solicitados
No arquivo `pages/api/auth/[...nextauth].js`, o escopo deve estar assim:

```javascript
scope: 'openid email profile https://www.googleapis.com/auth/gmail.readonly'
```

### 3. Verificar Gmail API Habilitada
1. Acesse: **https://console.cloud.google.com/apis/library**
2. Procure por **"Gmail API"**
3. Certifique-se de que está **habilitada**

### 4. Verificar Redirect URIs
1. Acesse: **https://console.cloud.google.com/apis/credentials**
2. Clique no seu **OAuth 2.0 Client ID**
3. Verifique se os Redirect URIs estão configurados:
   - ✅ `https://seu-dominio.com/api/auth/callback/google`
   - ✅ `http://localhost:3000/api/auth/callback/google` (para desenvolvimento)

## 🐛 Diagnóstico

### Verificar se o Token Tem Permissões
Execute este código no console do navegador (após fazer login):

```javascript
// Verificar escopos do token
const session = await fetch('/api/auth/session').then(r => r.json());
console.log('Token escopos:', session.accessToken);
```

### Verificar Logs do Servidor
Procure por estas mensagens nos logs:
- `❌ Erro ao conectar com Gmail: Insufficient Permission`
- `errorCode: 'INSUFFICIENT_PERMISSIONS'`

## 📋 Checklist de Verificação

Para resolver o problema, verifique:

- [ ] OAuth Consent Screen configurado no Google Cloud Console
- [ ] Escopo `gmail.readonly` adicionado no Consent Screen
- [ ] Gmail API habilitada no projeto
- [ ] Redirect URIs configurados corretamente
- [ ] Usuário revogou acesso anterior em https://myaccount.google.com/permissions
- [ ] Usuário fez login novamente e autorizou as permissões
- [ ] Token foi salvo corretamente no banco de dados

## 🚀 Solução Definitiva

Se nada funcionar, pode ser necessário:

1. **Recriar o OAuth Client ID** no Google Cloud Console
2. **Atualizar as variáveis de ambiente** com o novo Client ID e Secret
3. **Fazer redeploy** do app
4. **Pedir para todos os usuários reautenticarem**

## 📞 Próximos Passos

Se o erro persistir:
1. Verifique os logs do servidor para ver a mensagem de erro completa
2. Verifique se o OAuth Consent Screen está em modo "Testing" ou "In Production"
3. Se estiver em "Testing", adicione o email do usuário como test user
4. Se estiver em "Production", certifique-se de que passou pela verificação do Google
