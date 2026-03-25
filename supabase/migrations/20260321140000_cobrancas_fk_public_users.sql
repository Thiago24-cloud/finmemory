-- O app usa public.users.id (session.user.supabaseId), não auth.users.
-- A migração inicial referenciava auth.users e quebrava insert via API NextAuth.

ALTER TABLE public.cobrancas DROP CONSTRAINT IF EXISTS cobrancas_user_id_fkey;
ALTER TABLE public.cobrancas
  ADD CONSTRAINT cobrancas_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.cobrancas_pagamentos DROP CONSTRAINT IF EXISTS cobrancas_pagamentos_user_id_fkey;
ALTER TABLE public.cobrancas_pagamentos
  ADD CONSTRAINT cobrancas_pagamentos_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
