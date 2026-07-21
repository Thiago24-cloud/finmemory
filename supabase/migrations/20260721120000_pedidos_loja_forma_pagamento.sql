-- Forma de pagamento registrada no caixa (maquininha física / Pix / dinheiro).
-- O valor é cobrado fora do app; o atendente só informa como o cliente pagou.

ALTER TABLE public.pedidos_loja
  ADD COLUMN IF NOT EXISTS forma_pagamento text;

ALTER TABLE public.pedidos_loja
  DROP CONSTRAINT IF EXISTS pedidos_loja_forma_pagamento_check;

ALTER TABLE public.pedidos_loja
  ADD CONSTRAINT pedidos_loja_forma_pagamento_check
  CHECK (
    forma_pagamento IS NULL
    OR forma_pagamento IN ('debito', 'credito', 'pix', 'dinheiro')
  );

COMMENT ON COLUMN public.pedidos_loja.forma_pagamento IS
  'Como o cliente pagou na loja: debito | credito | pix | dinheiro (cobrança na maquininha física / caixa).';
