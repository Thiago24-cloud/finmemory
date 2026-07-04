-- Cole no SQL Editor do Supabase (insumos + NF — Parceiros Sprint 1/2).
-- Equivalente a: supabase/migrations/20260529120000_insumos_loja_estoque.sql

CREATE TABLE IF NOT EXISTS public.insumos_loja (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.stores (id) ON DELETE CASCADE,
  nome text NOT NULL,
  ean text,
  unidade text NOT NULL DEFAULT 'un'
    CHECK (unidade IN ('un', 'kg', 'g', 'L', 'ml', 'cx', 'pct', 'dz')),
  estoque_minimo numeric(12, 3) NOT NULL DEFAULT 0 CHECK (estoque_minimo >= 0),
  quantidade_atual numeric(12, 3) NOT NULL DEFAULT 0 CHECK (quantidade_atual >= 0),
  custo_medio numeric(14, 2),
  recorrente boolean NOT NULL DEFAULT true,
  ativo boolean NOT NULL DEFAULT true,
  imagem_url text,
  imagem_source text,
  imagem_atualizada_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.insumos_loja
  ADD COLUMN IF NOT EXISTS imagem_url text,
  ADD COLUMN IF NOT EXISTS imagem_source text,
  ADD COLUMN IF NOT EXISTS imagem_atualizada_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_insumos_loja_loja_id
  ON public.insumos_loja (loja_id, ativo, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_insumos_loja_ean
  ON public.insumos_loja (loja_id, ean)
  WHERE ean IS NOT NULL AND ativo = true;

COMMENT ON TABLE public.insumos_loja IS
  'Insumos/matéria-prima da loja (compras, estoque). Distinto de produtos_loja (ofertas ao cliente).';

CREATE TABLE IF NOT EXISTS public.insumo_movimentacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insumo_id uuid NOT NULL REFERENCES public.insumos_loja (id) ON DELETE CASCADE,
  loja_id uuid NOT NULL REFERENCES public.stores (id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('entrada', 'saida', 'ajuste')),
  quantidade numeric(12, 3) NOT NULL CHECK (quantidade > 0),
  custo_unitario numeric(14, 2),
  origem text NOT NULL DEFAULT 'manual',
  nota_entrada_id uuid,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insumo_movimentacoes_insumo
  ON public.insumo_movimentacoes (insumo_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_insumo_movimentacoes_loja
  ON public.insumo_movimentacoes (loja_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.notas_entrada_loja (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.stores (id) ON DELETE CASCADE,
  fornecedor text,
  chave_nfe text,
  valor_total numeric(14, 2),
  imagem_url text,
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'confirmada', 'enviada_erp', 'erro')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notas_entrada_loja_loja
  ON public.notas_entrada_loja (loja_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.notas_entrada_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_id uuid NOT NULL REFERENCES public.notas_entrada_loja (id) ON DELETE CASCADE,
  insumo_id uuid REFERENCES public.insumos_loja (id) ON DELETE SET NULL,
  nome text NOT NULL,
  ean text,
  quantidade numeric(12, 3) NOT NULL DEFAULT 1,
  preco_unitario numeric(14, 2),
  sort_order integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_notas_entrada_itens_nota
  ON public.notas_entrada_itens (nota_id, sort_order);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'insumo_movimentacoes_nota_entrada_id_fkey'
  ) THEN
    ALTER TABLE public.insumo_movimentacoes
      ADD CONSTRAINT insumo_movimentacoes_nota_entrada_id_fkey
      FOREIGN KEY (nota_entrada_id) REFERENCES public.notas_entrada_loja (id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.insumos_loja ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insumo_movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas_entrada_loja ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas_entrada_itens ENABLE ROW LEVEL SECURITY;
