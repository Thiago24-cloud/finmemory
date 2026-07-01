-- Vendas de terminal (maquininha / app Android) por loja — portado do Team-Task-Hub.

CREATE TABLE IF NOT EXISTS public.vendas_terminal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.stores (id) ON DELETE CASCADE,
  external_ref text,
  idempotency_key text,
  terminal text NOT NULL DEFAULT 'other'
    CHECK (terminal IN ('stone', 'cielo', 'pagseguro', 'mercadopago', 'rede', 'other')),
  bandeira text,
  valor_total numeric(14, 2) NOT NULL CHECK (valor_total >= 0),
  metodo text NOT NULL DEFAULT 'credito'
    CHECK (metodo IN ('credito', 'debito', 'pix', 'dinheiro')),
  status text NOT NULL DEFAULT 'aprovado'
    CHECK (status IN ('aprovado', 'rejeitado', 'cancelado')),
  raw_payload jsonb,
  vendido_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vendas_terminal_loja_external_ref
  ON public.vendas_terminal (loja_id, external_ref)
  WHERE external_ref IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vendas_terminal_loja_idempotency
  ON public.vendas_terminal (loja_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vendas_terminal_loja_created
  ON public.vendas_terminal (loja_id, created_at DESC);

COMMENT ON TABLE public.vendas_terminal IS
  'Vendas confirmadas no balcão (terminal Stone/Cielo etc.). Tenant = loja_id.';

CREATE TABLE IF NOT EXISTS public.venda_terminal_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id uuid NOT NULL REFERENCES public.vendas_terminal (id) ON DELETE CASCADE,
  produto_loja_id uuid REFERENCES public.produtos_loja (id) ON DELETE SET NULL,
  nome_produto text NOT NULL,
  preco_unitario numeric(14, 2) NOT NULL CHECK (preco_unitario >= 0),
  quantidade integer NOT NULL CHECK (quantidade > 0),
  subtotal numeric(14, 2) NOT NULL CHECK (subtotal >= 0)
);

CREATE INDEX IF NOT EXISTS idx_venda_terminal_itens_venda
  ON public.venda_terminal_itens (venda_id);

COMMENT ON TABLE public.venda_terminal_itens IS
  'Itens de cada venda_terminal (snapshot do nome/preço no momento da venda).';

-- ---------------------------------------------------------------------------
-- RLS (APIs usam service role; políticas para acesso direto autenticado)
-- ---------------------------------------------------------------------------
ALTER TABLE public.vendas_terminal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venda_terminal_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendas_terminal_select_tenant ON public.vendas_terminal;
CREATE POLICY vendas_terminal_select_tenant ON public.vendas_terminal
  FOR SELECT TO authenticated
  USING (loja_id = public.get_meu_loja_id());

DROP POLICY IF EXISTS venda_terminal_itens_select_via_venda ON public.venda_terminal_itens;
CREATE POLICY venda_terminal_itens_select_via_venda ON public.venda_terminal_itens
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vendas_terminal v
      WHERE v.id = venda_id AND v.loja_id = public.get_meu_loja_id()
    )
  );

GRANT SELECT ON public.vendas_terminal TO authenticated;
GRANT SELECT ON public.venda_terminal_itens TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC atômica: registra venda + itens + baixa estoque (produtos_loja)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_venda_terminal(
  p_loja_id uuid,
  p_external_ref text,
  p_idempotency_key text,
  p_terminal text,
  p_bandeira text,
  p_valor_total numeric,
  p_metodo text,
  p_status text,
  p_raw_payload jsonb,
  p_vendido_em timestamptz DEFAULT now(),
  p_itens jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id uuid;
  v_venda_id uuid;
  v_item jsonb;
  v_produto_id uuid;
  v_qty integer;
  v_nome text;
  v_preco numeric;
  v_subtotal numeric;
  v_stock_updated boolean := false;
BEGIN
  IF p_loja_id IS NULL THEN
    RAISE EXCEPTION 'loja_id obrigatório';
  END IF;

  IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
    SELECT id INTO v_existing_id
    FROM public.vendas_terminal
    WHERE loja_id = p_loja_id AND idempotency_key = p_idempotency_key
    LIMIT 1;
    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'ok', true, 'duplicate', true,
        'venda_id', v_existing_id, 'stock_updated', false
      );
    END IF;
  END IF;

  IF p_external_ref IS NOT NULL AND length(trim(p_external_ref)) > 0 THEN
    SELECT id INTO v_existing_id
    FROM public.vendas_terminal
    WHERE loja_id = p_loja_id AND external_ref = p_external_ref
    LIMIT 1;
    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'ok', true, 'duplicate', true,
        'venda_id', v_existing_id, 'stock_updated', false
      );
    END IF;
  END IF;

  INSERT INTO public.vendas_terminal (
    loja_id, external_ref, idempotency_key, terminal, bandeira,
    valor_total, metodo, status, raw_payload, vendido_em
  )
  VALUES (
    p_loja_id,
    NULLIF(trim(p_external_ref), ''),
    NULLIF(trim(p_idempotency_key), ''),
    COALESCE(NULLIF(trim(p_terminal), ''), 'other'),
    NULLIF(trim(p_bandeira), ''),
    p_valor_total,
    COALESCE(NULLIF(trim(p_metodo), ''), 'credito'),
    COALESCE(NULLIF(trim(p_status), ''), 'aprovado'),
    p_raw_payload,
    COALESCE(p_vendido_em, now())
  )
  RETURNING id INTO v_venda_id;

  IF COALESCE(p_status, 'aprovado') <> 'aprovado' THEN
    RETURN jsonb_build_object('ok', true, 'venda_id', v_venda_id, 'stock_updated', false);
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_itens, '[]'::jsonb))
  LOOP
    v_produto_id := NULLIF(v_item->>'produto_loja_id', '')::uuid;
    v_nome := COALESCE(NULLIF(trim(v_item->>'nome_produto'), ''), 'Item');
    v_qty := GREATEST(1, (v_item->>'quantidade')::integer);
    v_preco := (v_item->>'preco_unitario')::numeric;
    v_subtotal := COALESCE((v_item->>'subtotal')::numeric, v_qty * v_preco);

    INSERT INTO public.venda_terminal_itens (
      venda_id, produto_loja_id, nome_produto, preco_unitario, quantidade, subtotal
    )
    VALUES (v_venda_id, v_produto_id, v_nome, v_preco, v_qty, v_subtotal);

    IF v_produto_id IS NOT NULL THEN
      UPDATE public.produtos_loja
      SET
        quantidade_estoque = GREATEST(0, COALESCE(quantidade_estoque, 0) - v_qty),
        updated_at = now()
      WHERE id = v_produto_id AND loja_id = p_loja_id;
    END IF;
  END LOOP;

  v_stock_updated := true;
  RETURN jsonb_build_object('ok', true, 'venda_id', v_venda_id, 'stock_updated', v_stock_updated);
END;
$$;

COMMENT ON FUNCTION public.registrar_venda_terminal IS
  'Registra venda de terminal com idempotência e baixa estoque em produtos_loja.';

GRANT EXECUTE ON FUNCTION public.registrar_venda_terminal TO service_role;
