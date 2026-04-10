-- Campos opcionais para painel estilo Google Maps no /mapa (hero, site, telefone, horário).
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS weekday_hours TEXT;

COMMENT ON COLUMN public.stores.photo_url IS 'URL da fachada ou imagem principal da loja (mapa / detalhe).';
COMMENT ON COLUMN public.stores.phone IS 'Telefone para tel: no painel da loja.';
COMMENT ON COLUMN public.stores.website IS 'Site oficial (se diferente de promo_page_url).';
COMMENT ON COLUMN public.stores.weekday_hours IS 'Texto curto de horário (ex.: Aberto · Fecha 22h).';
