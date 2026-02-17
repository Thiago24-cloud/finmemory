-- ============================================
-- FIX: Supabase Storage bloqueando upload de notas
-- ============================================
-- O backend (API) usa SUPABASE_SERVICE_ROLE_KEY, então auth.uid() é null.
-- É preciso uma política que permita a service_role fazer upload no bucket receipts.
--
-- Execute no Supabase: SQL Editor → New query → Cole e rode.
-- ============================================

-- 1) Garantir que o bucket existe (e limites se quiser)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2) Remover políticas antigas do bucket receipts (evitar conflito)
DROP POLICY IF EXISTS "Users can upload receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Service role full access receipts" ON storage.objects;

-- 3) Backend (service_role) pode fazer tudo no bucket receipts
--    Isso desbloqueia o upload da API /api/ocr/process-receipt
CREATE POLICY "Service role full access receipts"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'receipts')
WITH CHECK (bucket_id = 'receipts');

-- 4) Usuários autenticados: upload só na pasta do próprio user_id
CREATE POLICY "Authenticated upload own receipts"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'receipts'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 5) Usuários autenticados: ver só os próprios arquivos
CREATE POLICY "Authenticated view own receipts"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'receipts'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 6) Usuários autenticados: deletar só os próprios arquivos
CREATE POLICY "Authenticated delete own receipts"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'receipts'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Verificação (opcional)
-- SELECT * FROM storage.buckets WHERE id = 'receipts';
-- SELECT policyname, roles, cmd FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE '%receipt%';
