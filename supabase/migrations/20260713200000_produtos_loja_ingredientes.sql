-- Ingredientes do cardápio (pratos do restaurante; separado do mapa de preços).
ALTER TABLE public.produtos_loja
  ADD COLUMN IF NOT EXISTS ingredientes text;

COMMENT ON COLUMN public.produtos_loja.ingredientes IS
  'Lista de ingredientes do prato (alergias / restrições). Não relacionado a oferta no mapa.';
