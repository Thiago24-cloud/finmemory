# 🐛 Troubleshooting: Erro 500 na Sincronização

## 🎯 Problema

Usuário recebe erro **"HTTP error status: 500"** ao tentar sincronizar.

## 🔍 Possíveis Causas

### 1. Token do Gmail Expirado ou Inválido
**Sintoma:** Erro 500 ao tentar sincronizar

**Solução:**
1. Peça para o usuário **desconectar** (botão "Sair")
2. Peça para **conectar novamente** com o Gmail
3. Isso renovará os tokens de acesso

### 2. Usuário Não Encontrado no Banco
**Sintoma:** Erro 500 ou 404

**Solução:**
1. Verifique se o usuário foi criado na tabela `users` do Supabase
2. Verifique se o `user_id` está correto
3. Peça para fazer login novamente

### 3. Permissões do Gmail Insuficientes (Insufficient Permission)
**Sintoma:** Erro 500 ou 403 com mensagem "Insufficient Permission" ou "insufficientPermissions"

**Solução:**
1. Peça para o usuário acessar: https://myaccount.google.com/permissions
2. Revogar acesso do app (se existir)
3. No app, clicar em "Sair"
4. Fazer login novamente e **autorizar o acesso aos e-mails**
5. Se persistir, verifique o OAuth Consent Screen no Google Cloud Console (veja `SOLUCAO-PERMISSOES-GMAIL.md`)

### 4. Variáveis de Ambiente Não Configuradas
**Sintoma:** Erro 500 logo no início

**Solução:**
1. Verifique as variáveis de ambiente no servidor (Vercel/Cloud Run)
2. Certifique-se de que todas estão configuradas:
   - `OPENAI_API_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI`
   - `NEXTAUTH_SECRET`

## ✅ Melhorias Implementadas

### 1. Tratamento de Erros Melhorado
- ✅ Mensagens de erro mais específicas
- ✅ Diferencia entre erros de autenticação e erros de servidor
- ✅ Indica quando precisa reautenticar

### 2. Validações Adicionadas
- ✅ Verifica se o usuário existe antes de processar
- ✅ Verifica se o usuário tem tokens válidos
- ✅ Testa conexão com Gmail antes de buscar e-mails
- ✅ Trata erros de renovação de token

### 3. Logs Melhorados
- ✅ Logs detalhados no servidor
- ✅ Mensagens claras no frontend
- ✅ Indicação quando precisa reautenticar

## 🔧 Como Diagnosticar

### Passo 1: Verificar Logs do Servidor
1. Acesse os logs do servidor (Vercel/Cloud Run)
2. Procure por erros relacionados ao `user_id` do usuário
3. Verifique mensagens de erro específicas

### Passo 2: Verificar no Supabase
1. Acesse o Supabase Dashboard
2. Vá em "Table Editor" → `users`
3. Procure pelo usuário pelo email
4. Verifique se:
   - O usuário existe
   - Tem `access_token`
   - Tem `refresh_token`
   - O `token_expiry` não está muito antigo

### Passo 3: Testar Manualmente
1. Use o botão "🔍 Debug" no dashboard
2. Verifique se consegue ler transações
3. Verifique se consegue ler usuários

## 📋 Checklist de Verificação

Para cada usuário com erro 500:

- [ ] O usuário existe na tabela `users`?
- [ ] O usuário tem `access_token`?
- [ ] O usuário tem `refresh_token`?
- [ ] O `token_expiry` não está muito antigo?
- [ ] As políticas RLS estão criadas?
- [ ] As variáveis de ambiente estão configuradas?

## 🚀 Solução Rápida

**Para o usuário:**
1. Clique em "Sair"
2. Faça login novamente com o Gmail
3. Tente sincronizar novamente

**Se ainda não funcionar:**
1. Verifique os logs do servidor
2. Verifique se o usuário existe no Supabase
3. Verifique as variáveis de ambiente

## 📞 Próximos Passos

Se o erro persistir após essas verificações:
1. Copie a mensagem de erro completa
2. Copie os logs do servidor
3. Verifique o `user_id` do usuário
4. Compartilhe essas informações para diagnóstico mais detalhado
