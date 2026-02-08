# Troubleshooting: Tirar foto da nota fiscal não funciona

## 1. "Usuário não identificado" ou botão Processar desabilitado

**Causa:** Seu usuário não está na tabela `users` do Supabase.

**O que fazer:**
1. Vá ao **Dashboard** e clique em **"🔌 Conectar Gmail"**
2. Faça login com Google e aceite as permissões
3. Isso grava seu usuário no Supabase
4. Volte em **📸 Escanear Nota** e tente de novo

---

## 2. "Configuração do servidor incompleta (OpenAI)" ou erro ao processar

**Causa:** A variável `OPENAI_API_KEY` não está configurada no Cloud Run.

**O que fazer:**
1. Acesse [Cloud Run Console](https://console.cloud.google.com/run)
2. Projeto **FinMemory** → serviço **finmemory** → **Editar e implantar nova revisão**
3. Aba **Variáveis e segredos**
4. Adicione: `OPENAI_API_KEY` = `sk-proj-...` (sua chave da OpenAI)
5. Salve e aguarde o deploy

---

## 3. Câmera não abre ao clicar em "Tirar Foto"

**Possíveis causas:**
- **Desktop:** Em muitos navegadores, abre o seletor de arquivos em vez da câmera. Use **"Escolher da Galeria"** ou teste no celular.
- **HTTPS:** A câmera só funciona em HTTPS. O Cloud Run já usa HTTPS.
- **Permissões:** O navegador pediu permissão e você negou. Vá em Configurações do site e permita acesso à câmera.
- **iOS Safari:** Às vezes é preciso usar **"Escolher da Galeria"** e selecionar uma foto da câmera.

---

## 4. "Formato HEIC não suportado"

**Causa:** O iPhone grava fotos em HEIC por padrão e alguns navegadores não convertem.

**O que fazer:**
- Use **Escolher da Galeria** e selecione uma foto em JPG/PNG
- Ou altere em **Ajustes > Câmera > Formatos** para "Mais compatível" (JPEG)

---

## 5. "Erro ao salvar imagem" (Supabase Storage)

**Causa:** O bucket `receipts` não existe ou as políticas RLS estão incorretas.

**O que fazer:**
Execute o SQL `SQL-TABELAS-COMPLETO-FINMEMORY.sql` no Supabase (seção do bucket receipts). Verifique se o bucket existe em Storage.

---

## Checklist rápido

- [ ] Conectei o Gmail no dashboard
- [ ] `OPENAI_API_KEY` configurada no Cloud Run
- [ ] `SUPABASE_SERVICE_ROLE_KEY` configurada no Cloud Run
- [ ] Bucket `receipts` existe no Supabase Storage
- [ ] Testei no celular (câmera funciona melhor)
- [ ] Formato da foto: JPG, PNG ou WebP (evitar HEIC)
