-- Onboarding self-service de lojistas (multitenancy lógico: 1 user → 1 loja).

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES public.users (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.stores.owner_user_id IS
  'Utilizador varejista titular da loja (painel / ofertas isoladas).';

CREATE TABLE IF NOT EXISTS public.merchant_store_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.users (id) ON DELETE CASCADE,
  store_id uuid NOT NULL UNIQUE REFERENCES public.stores (id) ON DELETE CASCADE,
  responsible_name text NOT NULL,
  business_name text NOT NULL,
  document_tax_id text NOT NULL,
  onboarding_status text NOT NULL DEFAULT 'pending_review'
    CHECK (onboarding_status IN ('pending_review', 'active', 'suspended')),
  pickup_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_merchant_store_profiles_document_digits
  ON public.merchant_store_profiles ((regexp_replace(COALESCE(document_tax_id, ''), '\D', '', 'g')));

COMMENT ON TABLE public.merchant_store_profiles IS
  'Vínculo lojista ↔ loja no mapa FinMemory (tenant lógico por store_id).';

ALTER TABLE public.merchant_store_profiles ENABLE ROW LEVEL SECURITY;
-- Escrita/leitura via API Next.js (service role).
