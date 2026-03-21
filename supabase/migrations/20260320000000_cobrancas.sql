-- Cobranças e check-in de pagamento (streaming, luz, celular etc.)

-- =========================
-- Tabela: public.cobrancas
-- =========================
CREATE TABLE IF NOT EXISTS public.cobrancas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  recorrencia TEXT NOT NULL DEFAULT 'mensal' CHECK (recorrencia IN ('mensal', 'unica')),
  dia_vencimento INT,
  competencia DATE,
  categoria TEXT NOT NULL DEFAULT 'Servicos',
  ativa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cobrancas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cobrancas"
  ON public.cobrancas FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cobrancas"
  ON public.cobrancas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cobrancas"
  ON public.cobrancas FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own cobrancas"
  ON public.cobrancas FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger updated_at (reaproveita a funcao ja existente)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'update_updated_at_column'
  ) THEN
    CREATE TRIGGER update_cobrancas_updated_at
      BEFORE UPDATE ON public.cobrancas
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END
$$;

-- ======================================
-- Tabela: public.cobrancas_pagamentos
-- ======================================
CREATE TABLE IF NOT EXISTS public.cobrancas_pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cobranca_id UUID NOT NULL REFERENCES public.cobrancas(id) ON DELETE CASCADE,
  competencia DATE NOT NULL,
  data_pagamento DATE NOT NULL,
  forma_pagamento TEXT,
  obs TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  -- Evita duplicar check-in do mesmo vencimento
  UNIQUE (cobranca_id, competencia)
);

ALTER TABLE public.cobrancas_pagamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cobrancas_pagamentos"
  ON public.cobrancas_pagamentos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cobrancas_pagamentos"
  ON public.cobrancas_pagamentos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cobrancas_pagamentos"
  ON public.cobrancas_pagamentos FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own cobrancas_pagamentos"
  ON public.cobrancas_pagamentos FOR DELETE
  USING (auth.uid() = user_id);

