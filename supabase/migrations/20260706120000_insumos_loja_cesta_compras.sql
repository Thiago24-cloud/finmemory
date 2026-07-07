-- Cesta de compras do lojista: itens vinculados a insumos_loja + oferta escolhida no mapa.

ALTER TABLE public.insumos_loja
  ADD COLUMN IF NOT EXISTS na_cesta boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cesta_quantidade numeric(12, 3),
  ADD COLUMN IF NOT EXISTS cesta_oferta jsonb;

COMMENT ON COLUMN public.insumos_loja.na_cesta IS
  'Insumo incluído na cesta de compras (Minha compra).';

COMMENT ON COLUMN public.insumos_loja.cesta_quantidade IS
  'Quantidade desejada na próxima compra; se null, usa 1 ou gap até estoque mínimo.';

COMMENT ON COLUMN public.insumos_loja.cesta_oferta IS
  'Oferta selecionada no mapa: { lugar_id, nome_loja, produto_nome, preco, lat, lng }.';

CREATE INDEX IF NOT EXISTS idx_insumos_loja_cesta
  ON public.insumos_loja (loja_id, na_cesta)
  WHERE na_cesta = true AND ativo = true;
