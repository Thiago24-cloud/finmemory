-- Campos extras para o agente Playwright (imagem, texto bruto do preço, validade)

ALTER TABLE public.promocoes_supermercados
  ADD COLUMN IF NOT EXISTS imagem_url TEXT,
  ADD COLUMN IF NOT EXISTS validade DATE,
  ADD COLUMN IF NOT EXISTS preco_original TEXT;
