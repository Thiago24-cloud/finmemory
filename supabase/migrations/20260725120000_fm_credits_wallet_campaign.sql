-- FinMemory Credits MVP — Wallet, Ledger, Campaigns, Purchase Validation
-- Blockchain-ready audit fields (mock hash via app layer)

CREATE TABLE IF NOT EXISTS public.fm_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  balance numeric(12,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  currency_code text NOT NULL DEFAULT 'FM_CREDIT',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fm_wallets_user ON public.fm_wallets (user_id);

CREATE TABLE IF NOT EXISTS public.fm_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  partner_name text NOT NULL,
  product_name text NOT NULL,
  product_brand text,
  product_identifier text,
  reward_amount numeric(12,2) NOT NULL CHECK (reward_amount > 0),
  budget_total numeric(12,2) NOT NULL CHECK (budget_total >= 0),
  budget_spent numeric(12,2) NOT NULL DEFAULT 0 CHECK (budget_spent >= 0),
  region text,
  starts_at timestamptz,
  ends_at timestamptz,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'ended')),
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (budget_spent <= budget_total)
);

CREATE INDEX IF NOT EXISTS idx_fm_campaigns_status ON public.fm_campaigns (status);
CREATE INDEX IF NOT EXISTS idx_fm_campaigns_region ON public.fm_campaigns (region);

CREATE TABLE IF NOT EXISTS public.fm_purchase_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.fm_campaigns(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  product_brand text,
  market_name text,
  purchase_amount numeric(12,2) CHECK (purchase_amount IS NULL OR purchase_amount >= 0),
  validation_status text NOT NULL DEFAULT 'pending'
    CHECK (validation_status IN ('pending', 'approved', 'rejected')),
  validation_source text NOT NULL DEFAULT 'manual'
    CHECK (validation_source IN ('manual', 'simulated', 'invoice', 'agent_price_match')),
  ledger_transaction_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fm_purchase_validations_user ON public.fm_purchase_validations (user_id);
CREATE INDEX IF NOT EXISTS idx_fm_purchase_validations_campaign ON public.fm_purchase_validations (campaign_id);
CREATE INDEX IF NOT EXISTS idx_fm_purchase_validations_status ON public.fm_purchase_validations (validation_status);

CREATE TABLE IF NOT EXISTS public.fm_ledger_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.fm_wallets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN (
    'credit_issued',
    'credit_redeemed',
    'credit_expired',
    'credit_reversed',
    'cashback_granted',
    'campaign_reward',
    'admin_adjustment'
  )),
  amount numeric(12,2) NOT NULL CHECK (amount <> 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'failed', 'reversed')),
  source_type text,
  source_id uuid,
  description text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  blockchain_tx_hash text,
  blockchain_network text,
  token_amount numeric(12,2),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fm_ledger_wallet ON public.fm_ledger_transactions (wallet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fm_ledger_user ON public.fm_ledger_transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fm_ledger_source ON public.fm_ledger_transactions (source_type, source_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fm_purchase_validations_ledger_fk'
  ) THEN
    ALTER TABLE public.fm_purchase_validations
      ADD CONSTRAINT fm_purchase_validations_ledger_fk
      FOREIGN KEY (ledger_transaction_id) REFERENCES public.fm_ledger_transactions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Carteira do usuário (idempotente)
CREATE OR REPLACE FUNCTION public.fm_ensure_wallet(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id uuid;
BEGIN
  SELECT id INTO v_wallet_id FROM fm_wallets WHERE user_id = p_user_id;
  IF v_wallet_id IS NOT NULL THEN
    RETURN v_wallet_id;
  END IF;
  INSERT INTO fm_wallets (user_id) VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING
  RETURNING id INTO v_wallet_id;
  IF v_wallet_id IS NULL THEN
    SELECT id INTO v_wallet_id FROM fm_wallets WHERE user_id = p_user_id;
  END IF;
  RETURN v_wallet_id;
END;
$$;

-- Posta transação confirmada e atualiza saldo atomicamente
CREATE OR REPLACE FUNCTION public.fm_post_ledger_transaction(
  p_user_id uuid,
  p_type text,
  p_amount numeric,
  p_status text,
  p_source_type text,
  p_source_id uuid,
  p_description text,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_blockchain_tx_hash text DEFAULT NULL,
  p_blockchain_network text DEFAULT NULL,
  p_token_amount numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id uuid;
  v_tx_id uuid;
  v_balance numeric(12,2);
  v_new_balance numeric(12,2);
BEGIN
  IF p_amount = 0 THEN
    RAISE EXCEPTION 'amount cannot be zero';
  END IF;

  v_wallet_id := fm_ensure_wallet(p_user_id);

  SELECT balance INTO v_balance FROM fm_wallets WHERE id = v_wallet_id FOR UPDATE;

  IF p_status = 'confirmed' THEN
    v_new_balance := v_balance + p_amount;
    IF v_new_balance < 0 THEN
      RAISE EXCEPTION 'insufficient balance';
    END IF;
  ELSE
    v_new_balance := v_balance;
  END IF;

  INSERT INTO fm_ledger_transactions (
    wallet_id, user_id, type, amount, status,
    source_type, source_id, description, metadata,
    blockchain_tx_hash, blockchain_network, token_amount
  ) VALUES (
    v_wallet_id, p_user_id, p_type, p_amount, p_status,
    p_source_type, p_source_id, p_description, COALESCE(p_metadata, '{}'::jsonb),
    p_blockchain_tx_hash, p_blockchain_network, p_token_amount
  )
  RETURNING id INTO v_tx_id;

  IF p_status = 'confirmed' THEN
    UPDATE fm_wallets
    SET balance = v_new_balance, updated_at = now()
    WHERE id = v_wallet_id;
  END IF;

  RETURN jsonb_build_object(
    'transaction_id', v_tx_id,
    'wallet_id', v_wallet_id,
    'balance', CASE WHEN p_status = 'confirmed' THEN v_new_balance ELSE v_balance END
  );
END;
$$;

COMMENT ON TABLE public.fm_wallets IS 'Carteira de créditos FinMemory (FM_CREDIT)';
COMMENT ON TABLE public.fm_ledger_transactions IS 'Ledger imutável de movimentações de crédito';
COMMENT ON TABLE public.fm_campaigns IS 'Campanhas de cashback/recompensa patrocinadas';
COMMENT ON TABLE public.fm_purchase_validations IS 'Validações de compra (manual/simulada/NF-e futura)';

GRANT EXECUTE ON FUNCTION public.fm_ensure_wallet(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fm_post_ledger_transaction(uuid, text, numeric, text, text, uuid, text, jsonb, text, text, numeric) TO service_role;
