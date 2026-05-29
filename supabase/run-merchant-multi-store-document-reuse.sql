-- Cole no SQL Editor do Supabase (Parceiros: várias lojas + CPF/CNPJ repetido com confirmação).

ALTER TABLE public.merchant_store_profiles
  DROP CONSTRAINT IF EXISTS merchant_store_profiles_user_id_key;

DROP INDEX IF EXISTS public.idx_merchant_store_profiles_document_digits;

CREATE INDEX IF NOT EXISTS idx_merchant_store_profiles_user_id
  ON public.merchant_store_profiles (user_id);

CREATE INDEX IF NOT EXISTS idx_merchant_store_profiles_document_digits
  ON public.merchant_store_profiles (
    (regexp_replace(COALESCE(document_tax_id, ''), '\D', '', 'g'))
  );

COMMENT ON TABLE public.merchant_store_profiles IS
  'Vínculo lojista ↔ loja. Um usuário pode ter vários perfis (várias lojas).';

CREATE TABLE IF NOT EXISTS public.merchant_document_reuse_acknowledgments (
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  document_digits text NOT NULL,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, document_digits)
);

COMMENT ON TABLE public.merchant_document_reuse_acknowledgments IS
  'Usuário confirmou uso legítimo de CPF/CNPJ já cadastrado em outra loja/conta.';

ALTER TABLE public.merchant_document_reuse_acknowledgments ENABLE ROW LEVEL SECURITY;
