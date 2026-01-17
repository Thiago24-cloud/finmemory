# ✅ Checklist Rápido - Deploy FinMemory

Use este checklist antes de fazer deploy na Vercel.

## 📋 Pré-Requisitos

- [ ] Conta na Vercel criada
- [ ] Conta no Supabase criada
- [ ] Conta no Google Cloud criada
- [ ] Conta na OpenAI criada (com créditos disponíveis)

---

## 🗄️ Supabase

- [ ] Projeto criado no Supabase
- [ ] Tabelas criadas:
  - [ ] `users` (email, name, google_id, access_token, refresh_token, token_expiry, last_sync)
  - [ ] `transacoes` (user_id, data, hora, total, estabelecimento, etc.)
  - [ ] `produtos` (transaction_id, nome, quantidade, valor_unitario, valor_total)
- [ ] Copiado `NEXT_PUBLIC_SUPABASE_URL`
- [ ] Copiado `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Copiado `SUPABASE_SERVICE_ROLE_KEY` ⚠️ SECRETA

---

## 🔐 Google OAuth

- [ ] Projeto criado no Google Cloud Console
- [ ] APIs habilitadas:
  - [ ] Gmail API
  - [ ] Google+ API
- [ ] OAuth 2.0 Client ID criado
- [ ] OAuth Consent Screen configurada (External)
- [ ] Escopos adicionados:
  - [ ] `userinfo.email`
  - [ ] `userinfo.profile`
  - [ ] `gmail.readonly`
- [ ] Redirect URIs configurados:
  - [ ] `http://localhost:3000/api/auth/callback` (dev)
  - [ ] `https://finmemory.vercel.app/api/auth/callback` (prod)
- [ ] Copiado `GOOGLE_CLIENT_ID`
- [ ] Copiado `GOOGLE_CLIENT_SECRET` ⚠️ SECRETO

---

## 🤖 OpenAI

- [ ] Conta criada na OpenAI
- [ ] Créditos disponíveis verificados
- [ ] API Key criada
- [ ] Copiado `OPENAI_API_KEY` ⚠️ SECRETA

---

## 🚀 Vercel - Configuração

- [ ] Projeto importado do GitHub na Vercel
- [ ] Variáveis de ambiente adicionadas em **Settings → Environment Variables**:

### Supabase
- [ ] `NEXT_PUBLIC_SUPABASE_URL` (Production + Preview + Development)
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Production + Preview + Development)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (Production + Preview + Development)

### Google OAuth
- [ ] `GOOGLE_CLIENT_ID` (Production + Preview + Development)
- [ ] `GOOGLE_CLIENT_SECRET` (Production + Preview + Development)
- [ ] `GOOGLE_REDIRECT_URI` = `https://finmemory.vercel.app/api/auth/callback`

### OpenAI
- [ ] `OPENAI_API_KEY` (Production + Preview + Development)

---

## 🔄 Deploy

- [ ] Todas as 7 variáveis configuradas
- [ ] Deploy realizado (Deployments → Redeploy)
- [ ] Deploy completou sem erros
- [ ] Site abrindo sem erros

---

## ✅ Testes

- [ ] Site carrega: `https://finmemory.vercel.app`
- [ ] Botão "Conectar Gmail" funciona
- [ ] Login com Google funciona
- [ ] Redirecionamento após login funciona
- [ ] Dashboard carrega após login
- [ ] Botão "Sincronizar Emails" funciona
- [ ] Notas fiscais são processadas
- [ ] Transações aparecem na lista
- [ ] Produtos aparecem nos detalhes

---

## 🔧 Validação (Desenvolvimento Local)

Se estiver testando localmente:

- [ ] Arquivo `.env.local` criado (não `.env`)
- [ ] Todas as 7 variáveis configuradas no `.env.local`
- [ ] `GOOGLE_REDIRECT_URI` = `http://localhost:3000/api/auth/callback`
- [ ] Executado: `npm run validate-env` ✅
- [ ] Executado: `npm install`
- [ ] Executado: `npm run dev`
- [ ] Site local funciona: `http://localhost:3000`

---

## 🛡️ Segurança

- [ ] `.env.local` está no `.gitignore`
- [ ] NUNCA committei arquivos `.env*` no Git
- [ ] Chaves secretas não estão expostas no código
- [ ] Não compartilhei chaves publicamente

---

## 📊 Monitoramento

Após deploy, monitore:

- [ ] Vercel Analytics: https://vercel.com/[seu-projeto]/analytics
- [ ] Supabase Dashboard: https://supabase.com/dashboard
- [ ] OpenAI Usage: https://platform.openai.com/usage
- [ ] Logs da Vercel: Deployments → View Function Logs

---

## ❌ Troubleshooting

Se algo não funcionar:

1. **Execute:** `npm run validate-env`
2. **Verifique:** Todas as 7 variáveis na Vercel
3. **Confirme:** Redirect URI no Google Console
4. **Veja logs:** Vercel → Deployments → Function Logs
5. **Consulte:** [CONFIGURAR-VERCEL.md](CONFIGURAR-VERCEL.md)

---

## 📚 Recursos Úteis

- 📖 [Guia Completo Vercel](CONFIGURAR-VERCEL.md)
- 📖 [Setup de Ambiente](SETUP-ENV.md)
- 📖 [Melhorias Implementadas](MELHORIAS-IMPLEMENTADAS.md)
- 📝 [Exemplo .env](.env.example)
- 🔧 [Validador de Ambiente](lib/env-validator.js)

---

## ✨ Pronto!

Se todos os itens estão marcados ✅, seu FinMemory está pronto para uso! 🎉

**Próximos passos:**
1. Conecte seu Gmail
2. Sincronize seus emails
3. Veja suas transações sendo processadas automaticamente
4. Aproveite sua automação financeira! 💰
