# 📸 Captura de Notas Fiscais com OCR

Funcionalidade de escanear notas fiscais usando a câmera do celular e extrair dados automaticamente com GPT-4 Vision.

---

## 🚀 Como Funciona

1. **Usuário clica no botão 📸** (flutuante no dashboard)
2. **Tira foto ou faz upload** da nota fiscal
3. **Imagem é comprimida** (max 2MB) e enviada para o servidor
4. **Upload para Supabase Storage** (bucket `receipts`)
5. **GPT-4 Vision extrai os dados** (estabelecimento, valor, itens, etc.)
6. **Usuário revisa e edita** os dados extraídos
7. **Salva a transação** no Supabase

---

## 📁 Arquivos Criados

### Backend
- `pages/api/ocr/process-receipt.js` – API de processamento OCR
- `pages/api/ocr/save-transaction.js` – API para salvar transação confirmada

### Frontend
- `pages/add-receipt.js` – Página de captura e edição

### SQL
- `SQL-OCR-NOTAS-FISCAIS.sql` – Schema para Supabase (bucket + campos)

### Configuração
- `cloudbuild.yaml` – Atualizado com memory=1Gi e timeout=60s

---

## 🔧 Configuração no Supabase

Execute o SQL no Supabase (SQL Editor):

```sql
-- 1. Adicionar campos na tabela transacoes
ALTER TABLE transacoes ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'email';
ALTER TABLE transacoes ADD COLUMN IF NOT EXISTS receipt_image_url TEXT;
ALTER TABLE transacoes ADD COLUMN IF NOT EXISTS items JSONB;
ALTER TABLE transacoes ADD COLUMN IF NOT EXISTS categoria TEXT;

-- 2. Criar bucket para imagens
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('receipts', 'receipts', false, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- 3. Políticas de acesso (ver SQL-OCR-NOTAS-FISCAIS.sql completo)
```

O arquivo `SQL-OCR-NOTAS-FISCAIS.sql` tem o script completo.

---

## 🔒 Segurança

- **Rate limiting**: 20 requisições por hora por usuário
- **Validação de tamanho**: max 2MB por imagem
- **Validação de formato**: JPG, PNG, WebP
- **Bucket privado**: só o próprio usuário vê suas notas
- **Supabase Service Role**: usado apenas no backend

---

## 🌐 Deploy no Cloud Run

O `cloudbuild.yaml` foi atualizado com:

```yaml
--memory 1Gi      # Memória para processar imagens
--timeout 60s     # Tempo para OCR (GPT-4 Vision pode demorar)
--max-instances 10
--cpu 1
```

### Variáveis de Ambiente Necessárias

Confirme que estão configuradas no Cloud Run:

- `OPENAI_API_KEY` – Chave da OpenAI (para GPT-4 Vision)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## 📱 UX/UI

- **Mobile-first**: Otimizado para celular
- **Botão flutuante** 📸 no dashboard
- **Estados claros**: Captura → Preview → Processando → Editar → Salvo
- **Mensagens em português**

---

## 📊 Dados Extraídos pelo OCR

O GPT-4 Vision extrai:

| Campo | Descrição |
|-------|-----------|
| `date` | Data da compra (YYYY-MM-DD) |
| `merchant_name` | Nome do estabelecimento |
| `merchant_cnpj` | CNPJ da loja |
| `total_amount` | Valor total |
| `items` | Array de {name, price} |
| `category` | Supermercado, Farmácia, etc. |
| `payment_method` | Cartão, Dinheiro, PIX |

---

## ⚠️ Mensagens de Erro

| Erro | Causa |
|------|-------|
| "Imagem muito grande" | Arquivo > 2MB após compressão |
| "Formato não suportado" | Use JPG, PNG ou WebP |
| "Não conseguimos identificar uma nota fiscal" | Imagem não é nota fiscal ou está ilegível |
| "Limite de processamento atingido" | 20 requisições/hora atingido |

---

## 🧪 Testando Localmente

```bash
# 1. Configurar variáveis
cp .env.example .env.local
# Editar .env.local com suas chaves

# 2. Rodar o app
npm run dev

# 3. Acessar
# http://localhost:3000/dashboard → Botão 📸 → Testar OCR
```

---

## 📝 Fluxo de Dados

```
[Celular/Browser]
      │
      ▼
[/add-receipt] ─────► Captura/Upload
      │
      ▼
[Comprimir imagem] ──► max 2MB, JPEG
      │
      ▼
[POST /api/ocr/process-receipt]
      │
      ├──► Upload Supabase Storage (receipts/{user_id}/{timestamp}.jpg)
      │
      └──► GPT-4 Vision API
              │
              ▼
      [JSON com dados extraídos]
              │
              ▼
[Formulário de edição]
              │
              ▼
[POST /api/ocr/save-transaction]
              │
              ▼
[Supabase: tabela transacoes + produtos]
```

---

## 🎯 Próximos Passos

1. **Executar o SQL** no Supabase (SQL-OCR-NOTAS-FISCAIS.sql)
2. **Fazer deploy** (Cloud Build ou manual)
3. **Testar** tirando foto de uma nota fiscal real
4. **Verificar logs** se houver erros

---

## 💰 Custo Estimado

- **GPT-4 Vision**: ~$0.01-0.03 por imagem (depende do tamanho)
- **Supabase Storage**: Incluído no plano free (até 1GB)
- **Cloud Run**: Depende do uso (tem free tier)

---

## 🆘 Troubleshooting

### Erro 500 no OCR
- Verifique `OPENAI_API_KEY` no Cloud Run
- Veja logs: Cloud Run → Logs

### Imagem não salva no Storage
- Verifique se o bucket `receipts` foi criado
- Verifique as políticas RLS

### GPT não extrai dados
- Melhore a iluminação da foto
- Tente uma foto mais nítida
- Verifique se é realmente uma nota fiscal brasileira
