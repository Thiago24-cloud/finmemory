-- Equipe do restaurante: garçom / cozinha / caixa com PIN (acesso exclusivo no celular).

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS codigo_equipe text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stores_codigo_equipe
  ON public.stores (codigo_equipe)
  WHERE codigo_equipe IS NOT NULL;

COMMENT ON COLUMN public.stores.codigo_equipe IS
  'Código curto da loja para login da equipe (garçom/cozinha) no celular.';

-- Gera código para lojas existentes
UPDATE public.stores
SET codigo_equipe = upper(substr(replace(id::text, '-', ''), 1, 6))
WHERE codigo_equipe IS NULL;

CREATE TABLE IF NOT EXISTS public.equipe_loja (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.stores (id) ON DELETE CASCADE,
  nome text NOT NULL,
  papel text NOT NULL
    CHECK (papel IN ('garcom', 'cozinha', 'caixa')),
  telefone text,
  pin_salt text NOT NULL,
  pin_hash text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ultimo_acesso_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_equipe_loja_loja_ativo
  ON public.equipe_loja (loja_id, ativo, papel);

COMMENT ON TABLE public.equipe_loja IS
  'Funcionários com acesso restrito (garçom/cozinha/caixa) via código da loja + PIN.';

ALTER TABLE public.equipe_loja ENABLE ROW LEVEL SECURITY;
