-- Referência leve ao comprovante (URL R2/CDN). Mantém receipt_image_url para compatibilidade.
ALTER TABLE public.transacoes
  ADD COLUMN IF NOT EXISTS url_comprovante TEXT;

COMMENT ON COLUMN public.transacoes.url_comprovante IS
  'URL pública do comprovante (ex. Cloudflare R2). Mesmo valor que receipt_image_url; sem imagem em base64 no banco.';

-- Backfill a partir da coluna já usada pelo app
UPDATE public.transacoes
SET url_comprovante = receipt_image_url
WHERE url_comprovante IS NULL
  AND receipt_image_url IS NOT NULL
  AND receipt_image_url ~ '^https?://';
