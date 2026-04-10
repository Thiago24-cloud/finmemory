-- Alguns ambientes não têm updated_at em transacoes (schema antigo); o trigger do repo original espera a coluna.

ALTER TABLE public.transacoes
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
