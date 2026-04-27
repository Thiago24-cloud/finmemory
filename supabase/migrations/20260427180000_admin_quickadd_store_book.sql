-- Catálogo manual do Quick Add: lembra CNPJ + endereço para evitar repetição e suportar franquias (vários endereços, mesmo CNPJ).

CREATE OR REPLACE FUNCTION public.admin_quickadd_norm_text(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(regexp_replace(trim(coalesce(t, '')), '\s+', ' ', 'g'));
$$;

CREATE TABLE IF NOT EXISTS public.admin_quickadd_store_book (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name text NOT NULL,
  store_name_norm text NOT NULL,
  address_raw text NOT NULL,
  address_norm text NOT NULL,
  cnpj_digits text NOT NULL CHECK (char_length(cnpj_digits) = 14),
  is_franchise boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_quickadd_store_book_cnpj_addr UNIQUE (cnpj_digits, address_norm)
);

CREATE INDEX IF NOT EXISTS idx_admin_quickadd_store_book_name_norm
  ON public.admin_quickadd_store_book (store_name_norm);

CREATE INDEX IF NOT EXISTS idx_admin_quickadd_store_book_cnpj
  ON public.admin_quickadd_store_book (cnpj_digits);

COMMENT ON TABLE public.admin_quickadd_store_book IS
  'Repositório curado pelo painel Quick Add: nome + endereço + CNPJ (14 dígitos). Franquia = mesmo CNPJ com vários endereços.';
