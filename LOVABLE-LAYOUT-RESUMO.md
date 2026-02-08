# FinMemory - Resumo para Lovable (React/Vite)

Resumo do projeto para adaptar o layout no Lovable. O projeto atual usa **Next.js 14** com **estilos inline** (sem Tailwind nem CSS separado).

---

## 📁 Estrutura de Arquivos

```
pages/
├── index.js          → Landing + botão "Entrar com Google"
├── dashboard.js      → Dashboard principal (transações, sync Gmail, botão OCR)
├── add-receipt.js    → Captura de nota fiscal via foto (OCR)
├── login.js          → Mínimo (pouco usado)
├── _app.js           → SessionProvider (NextAuth)
├── auth-error.js
├── privacidade.js
├── termos.js
└── api/
    ├── auth/[...nextauth].js   → Google OAuth
    ├── gmail/sync.js           → Sincronizar emails do Gmail
    ├── health.js
    └── ocr/
        ├── process-receipt.js  → Processar imagem com GPT-4 Vision
        └── save-transaction.js → Salvar transação confirmada
```

**Não há pasta `components/`** - tudo está nas páginas.

---

## 🎨 Design System (para Lovable)

### Cores principais
- **Gradiente roxo:** `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`
- **Botão Google:** `#34A853` (verde)
- **Texto em gradiente:** `#667eea` → `#764ba2`
- **Background claro:** `#f8f9fa`
- **Bordas:** `#e5e7eb`, `#dee2e6`
- **Texto:** `#333`, `#666`, `#999`
- **Erro:** `#dc3545`
- **Sucesso:** `#28a745`, `#059669`

### Tipografia
- **Fonte:** `system-ui, -apple-system, sans-serif`
- **Títulos:** 24–48px, bold
- **Corpo:** 14–18px

### Componentes visuais
- **Cards:** `background: white`, `borderRadius: 16px`, `boxShadow: 0 4px 6px rgba(0,0,0,0.1)`
- **Botões primários:** gradiente roxo, `borderRadius: 8px`, `padding: 16px 24px`
- **Botão flutuante:** círculo 60px, gradiente roxo, canto inferior direito

---

## 📄 Páginas - Conteúdo e Layout

### 1. **index.js** (Landing)
- **Layout:** Centralizado, fundo gradiente roxo
- **Card branco:** padding 60px, borderRadius 20px, maxWidth 600px
- **Título:** "🚀 FinMemory" com gradiente no texto
- **Subtítulo:** "Seu assistente financeiro inteligente que organiza suas notas fiscais automaticamente do Gmail"
- **Botões:** 
  - "Entrar com Google" (verde, ícone SVG Google)
  - "Ver Dashboard" (outline roxo)
- **Seção "Como funciona":** Lista com ícones (📧 Conecte Gmail, 🤖 IA processa, 📊 Visualize gastos, 💰 Controle finanças)

### 2. **dashboard.js** (Principal)
- **Header:** Nome do usuário, botão "Desconectar"
- **Seção sync:** Botão "🔄 Buscar Notas Fiscais"
- **Lista de transações:** Cards com estabelecimento, data, valor total, produtos expansíveis
- **Botão flutuante:** 📸 (60px, canto inferior direito) → leva para /add-receipt
- **Estado vazio:** Mensagem "Nenhuma nota fiscal encontrada"
- **Logs:** Área colapsável com logs da sincronização

### 3. **add-receipt.js** (Captura OCR)
- **Fluxo em steps:** Captura → Preview → Processando → Editar → Salvo
- **Captura:** Botões "Tirar Foto" e "Escolher da Galeria"
- **Preview:** Imagem + botões "Processar Nota" / "Tirar Outra"
- **Processando:** Spinner + "Lendo sua nota fiscal..."
- **Editar:** Formulário (estabelecimento, CNPJ, data, valor, categoria, pagamento, itens)
- **Sucesso:** "Nota fiscal salva!" + redireciona para dashboard

---

## 🔌 APIs (para backend no Lovable)

O Lovable pode precisar de um backend separado. Resumo das rotas:

| Rota | Método | Body | Retorno |
|------|--------|------|---------|
| `/api/auth/[...nextauth]` | GET/POST | - | NextAuth (Google OAuth) |
| `/api/gmail/sync` | POST | `{ userId, firstSync }` | `{ success, processed, skipped, errors, total }` |
| `/api/ocr/process-receipt` | POST | `{ imageBase64, userId }` | `{ success, data: { date, merchant_name, total_amount, items, ... } }` |
| `/api/ocr/save-transaction` | POST | `{ userId, merchant_name, total_amount, ... }` | `{ success, transaction }` |

---

## 📊 Supabase - Schema

### Tabelas
- **users:** id, email, name, google_id, access_token, refresh_token, token_expiry, last_sync
- **transacoes:** id, user_id, estabelecimento, cnpj, data, hora, total, forma_pagamento, source, receipt_image_url, items (JSONB), categoria
- **produtos:** id, transacao_id, descricao, quantidade, valor_unitario, valor_total

### Storage
- **Bucket:** `receipts` (privado, imagens de notas fiscais)

---

## 🔑 Variáveis de Ambiente

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXTAUTH_URL
NEXTAUTH_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
OPENAI_API_KEY
```

---

## 📦 Dependências

- `@supabase/supabase-js`
- `next-auth`
- `openai`
- `googleapis` (apenas backend)
- `react`, `react-dom`

---

## 🎯 O que adaptar no Lovable

1. **Trocar Next.js por React/Vite** – rotas para React Router
2. **Trocar estilos inline por Tailwind/CSS** – usar as cores e espaçamentos acima
3. **Manter lógica de negócio** – fetch de transações, fluxo de OCR, etc.
4. **Backend:** Lovable pode precisar de APIs hospedadas separadamente (ou usar Supabase Edge Functions)

---

## 📎 Arquivos Completos para Copiar

Os arquivos principais estão em:
- `pages/index.js`
- `pages/dashboard.js`
- `pages/add-receipt.js`
- `pages/_app.js`
