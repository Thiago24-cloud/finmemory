# 🔧 Corrigir Administrador com Email Inválido

## Problema
O Google Cloud está tentando usar um administrador com email que não existe mais, causando erros de permissão.

## ✅ Solução Passo a Passo

### 1. Identificar o Principal Problemático

Na página de IAM:
1. **Role a lista completa** de principais (pode ter mais de 2)
2. **Procure por:**
   - Emails que parecem inválidos
   - Contas de serviço deletadas
   - Usuários removidos

### 2. Remover o Principal Inválido

1. **Marque a checkbox** ao lado do principal problemático
2. Clique no botão **"- Remover acesso"**
3. Confirme a remoção

### 3. Verificar Sua Conta

Certifique-se de que:
- ✅ `thiagochimezie4@gmail.com` tem role **"Proprietário"** (Owner)
- ✅ Você está logado com esse email
- ✅ O email está ativo e acessível

### 4. Limpar Cache e Tentar Novamente

Após remover o principal inválido:
1. **Feche todas as abas** do Google Cloud Console
2. **Faça logout** e **login novamente**
3. Tente acessar o Cloud Build novamente

---

## 🔍 Como Encontrar Principais Ocultos

Se a lista parecer incompleta:

1. **Use o filtro:**
   - Digite no campo "Filtro": `role:roles/owner` ou `role:roles/editor`
   - Isso mostrará todos com roles administrativas

2. **Verifique contas de serviço:**
   - Vá em: **IAM e admin → Contas de serviço**
   - Veja se há contas deletadas ou inválidas

3. **Verifique histórico:**
   - Vá em: **IAM → Histórico de recomendações**
   - Pode mostrar mudanças recentes

---

## 🆘 Se Não Conseguir Remover

Se você não conseguir remover o principal (porque não tem permissão):

1. **Verifique se você é realmente Owner:**
   - Na lista de IAM, confirme que seu email tem role "Proprietário"

2. **Tente adicionar sua conta explicitamente:**
   - Clique em **"+ Permitir acesso"**
   - Adicione: `thiagochimezie4@gmail.com`
   - Role: **"Proprietário"** ou **"Cloud Build Editor"**

3. **Contate o suporte do Google Cloud:**
   - Se o problema persistir, pode ser necessário contatar o suporte

---

## ✅ Após Corrigir

1. Tente acessar o Cloud Build novamente
2. Se funcionar, prossiga com o deploy
3. Se ainda der erro, verifique os logs de erro específicos
