-- Pagamentos parciais na divisão de conta (histórico offline → sync).

ALTER TABLE public.pedidos_loja
  ADD COLUMN IF NOT EXISTS forma_pagamento text;

ALTER TABLE public.pedidos_loja
  ADD COLUMN IF NOT EXISTS pagamentos_json jsonb;

ALTER TABLE public.pedidos_loja
  DROP CONSTRAINT IF EXISTS pedidos_loja_forma_pagamento_check;

ALTER TABLE public.pedidos_loja
  ADD CONSTRAINT pedidos_loja_forma_pagamento_check
  CHECK (
    forma_pagamento IS NULL
    OR forma_pagamento IN ('debito', 'credito', 'pix', 'dinheiro', 'misto')
  );

COMMENT ON COLUMN public.pedidos_loja.forma_pagamento IS
  'Como a conta foi paga: debito | credito | pix | dinheiro | misto (vários meios).';

COMMENT ON COLUMN public.pedidos_loja.pagamentos_json IS
  'Lista de pagamentos parciais [{valor, forma, at}] da divisão de conta no caixa.';
