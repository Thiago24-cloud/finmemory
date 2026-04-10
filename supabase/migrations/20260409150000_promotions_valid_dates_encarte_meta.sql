-- Validade por datas específicas (folhetos BR: segunda/sexta, só sábado e domingo, etc.)
-- Metadados extras na fila de encartes

ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS valid_days text[],
  ADD COLUMN IF NOT EXISTS valid_dates text[];

COMMENT ON COLUMN public.promotions.valid_days IS
  'Opcional: dias da semana em PT (ex.: Segunda, Sexta) — complemento a valid_dates.';
COMMENT ON COLUMN public.promotions.valid_dates IS
  'Datas YYYY-MM-DD em que a oferta vale (ex.: hortifruti só seg e sex). Se null, usar valid_from/valid_until.';

ALTER TABLE public.encarte_queue
  ADD COLUMN IF NOT EXISTS store_name_raw text,
  ADD COLUMN IF NOT EXISTS valid_from date,
  ADD COLUMN IF NOT EXISTS valid_until date,
  ADD COLUMN IF NOT EXISTS raw_extraction jsonb;

COMMENT ON COLUMN public.encarte_queue.store_name_raw IS 'Nome da loja como no encarte (antes de resolver store_id).';
COMMENT ON COLUMN public.encarte_queue.raw_extraction IS 'JSON bruto do Vision (debug/auditoria).';

-- Vista para relatórios / SQL; o app aplica o mesmo critério em JS (America/Sao_Paulo).
CREATE OR REPLACE VIEW public.promotions_active AS
WITH sp AS (
  SELECT (timezone('America/Sao_Paulo', now()))::date AS today_sp
)
SELECT
  p.*,
  s.name AS store_label,
  s.address AS store_address,
  s.lat AS store_lat,
  s.lng AS store_lng,
  s.photo_url AS store_photo_url
FROM public.promotions p
JOIN public.stores s ON s.id = p.store_id
CROSS JOIN sp
WHERE p.is_individual_product = true
  AND p.active = true
  AND (
    (
      (p.valid_dates IS NULL OR COALESCE(array_length(p.valid_dates, 1), 0) = 0)
      AND (p.valid_until IS NULL OR p.valid_until >= sp.today_sp)
      AND (p.valid_from IS NULL OR p.valid_from <= sp.today_sp)
    )
    OR (
      COALESCE(array_length(p.valid_dates, 1), 0) > 0
      AND to_char(sp.today_sp, 'YYYY-MM-DD') = ANY (p.valid_dates)
    )
  );

COMMENT ON VIEW public.promotions_active IS
  'Promoções ativas “hoje” em SP; alinhar com lib/promotionValidity.js no backend.';
