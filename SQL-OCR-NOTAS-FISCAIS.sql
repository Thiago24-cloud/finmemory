-- ============================================
-- FINMEMORY - CAPTURA DE NOTAS FISCAIS (OCR)
-- ============================================
-- Execute no Supabase: SQL Editor → New query
-- ============================================

-- ============================================
-- 1. ADICIONAR CAMPOS NA TABELA TRANSACOES
-- ============================================

-- Campo para diferenciar origem (email ou foto)
ALTER TABLE transacoes 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'email';

-- URL da imagem da nota fiscal (quando capturada por foto)
ALTER TABLE transacoes 
ADD COLUMN IF NOT EXISTS receipt_image_url TEXT;

-- Itens da nota fiscal (array JSON)
ALTER TABLE transacoes 
ADD COLUMN IF NOT EXISTS items JSONB;

-- Categoria do estabelecimento
ALTER TABLE transacoes 
ADD COLUMN IF NOT EXISTS categoria TEXT;

-- Comentário para indexar buscas por source
COMMENT ON COLUMN transacoes.source IS 'Origem da transação: email, receipt_ocr';
COMMENT ON COLUMN transacoes.receipt_image_url IS 'URL da imagem no Supabase Storage';
COMMENT ON COLUMN transacoes.items IS 'Array JSON [{name, price}] dos itens';
COMMENT ON COLUMN transacoes.categoria IS 'Categoria: Supermercado, Restaurante, Farmácia, etc.';

-- ============================================
-- 2. CRIAR BUCKET PARA IMAGENS DE NOTAS
-- ============================================

-- Criar bucket (se não existir)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts', 
  'receipts', 
  false,  -- privado
  2097152, -- 2MB max
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 3. POLÍTICAS DE ACESSO AO BUCKET
-- ============================================

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Users can upload own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Service role full access receipts" ON storage.objects;

-- Política: Service Role pode fazer tudo (para o backend)
CREATE POLICY "Service role full access receipts"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'receipts')
WITH CHECK (bucket_id = 'receipts');

-- Política: Usuários podem fazer upload no próprio folder
-- Estrutura: receipts/{user_id}/arquivo.jpg
CREATE POLICY "Users can upload own receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'receipts' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Política: Usuários podem ver próprias notas
CREATE POLICY "Users can view own receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'receipts' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Política: Usuários podem deletar próprias notas
CREATE POLICY "Users can delete own receipts"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'receipts' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================
-- 4. VERIFICAR ALTERAÇÕES
-- ============================================

-- Verificar colunas da tabela transacoes
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'transacoes'
ORDER BY ordinal_position;

-- Verificar bucket criado
SELECT * FROM storage.buckets WHERE id = 'receipts';

-- Verificar políticas do bucket
SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage'
AND policyname LIKE '%receipts%';

-- ============================================
-- PRONTO! Bucket e campos configurados.
-- Próximo passo: fazer deploy do código.
-- ============================================
