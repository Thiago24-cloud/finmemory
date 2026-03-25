-- URL opcional por loja (ex.: página DIA /lojas/... para tabloides por unidade no mapa)
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS promo_page_url TEXT;

COMMENT ON COLUMN public.stores.promo_page_url IS
  'Opcional: URL de ofertas da unidade (ex. https://www.dia.com.br/lojas/...). Usado pelo finmemory-agent.';
