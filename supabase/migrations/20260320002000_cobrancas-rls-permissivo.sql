-- Ajuste RLS para compatibilidade com o frontend atual
-- O app em `pages/dashboard.js` usa Supabase com anon key (não auth.uid do Supabase).
-- Então as políticas precisam permitir INSERT/UPDATE/SELECT via anon, igual ao que já existe para `transacoes`.

DROP POLICY IF EXISTS "Users can view own cobrancas" ON public.cobrancas;
DROP POLICY IF EXISTS "Users can insert own cobrancas" ON public.cobrancas;
DROP POLICY IF EXISTS "Users can update own cobrancas" ON public.cobrancas;
DROP POLICY IF EXISTS "Users can delete own cobrancas" ON public.cobrancas;

CREATE POLICY "Frontend can view cobrancas"
  ON public.cobrancas
  FOR SELECT
  USING (true);

CREATE POLICY "Frontend can insert cobrancas"
  ON public.cobrancas
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Frontend can update cobrancas"
  ON public.cobrancas
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Frontend can delete cobrancas"
  ON public.cobrancas
  FOR DELETE
  USING (true);

DROP POLICY IF EXISTS "Users can view own cobrancas_pagamentos" ON public.cobrancas_pagamentos;
DROP POLICY IF EXISTS "Users can insert own cobrancas_pagamentos" ON public.cobrancas_pagamentos;
DROP POLICY IF EXISTS "Users can update own cobrancas_pagamentos" ON public.cobrancas_pagamentos;
DROP POLICY IF EXISTS "Users can delete own cobrancas_pagamentos" ON public.cobrancas_pagamentos;

CREATE POLICY "Frontend can view cobrancas_pagamentos"
  ON public.cobrancas_pagamentos
  FOR SELECT
  USING (true);

CREATE POLICY "Frontend can insert cobrancas_pagamentos"
  ON public.cobrancas_pagamentos
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Frontend can update cobrancas_pagamentos"
  ON public.cobrancas_pagamentos
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Frontend can delete cobrancas_pagamentos"
  ON public.cobrancas_pagamentos
  FOR DELETE
  USING (true);

