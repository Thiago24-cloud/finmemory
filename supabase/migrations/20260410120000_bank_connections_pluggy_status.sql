-- Estado do item Pluggy para o webhook (item/error, waiting_user_input, etc.)

ALTER TABLE public.bank_connections
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS error_code TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.bank_connections.status IS 'Pluggy: connected, error, waiting_user_input, …';
COMMENT ON COLUMN public.bank_connections.error_code IS 'Último código em item/error (Pluggy)';
COMMENT ON COLUMN public.bank_connections.updated_at IS 'Último evento Pluggy relevante (webhook)';

UPDATE public.bank_connections
SET
  status = COALESCE(status, 'connected'),
  updated_at = COALESCE(updated_at, created_at)
WHERE updated_at IS NULL OR status IS NULL;
