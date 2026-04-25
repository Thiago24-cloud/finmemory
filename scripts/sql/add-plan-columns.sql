-- ============================================================
-- FinMemory — Adicionar colunas de plano na tabela users
-- Execute ANTES de plan-defaults-rls.sql
-- ============================================================

-- Adiciona colunas se não existirem (seguro rodar mais de uma vez)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS plano text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS plano_ativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_status text,
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS stripe_current_period_end timestamptz;

-- Corrigir linhas existentes sem plano
UPDATE users
SET plano = 'free', plano_ativo = false
WHERE plano IS NULL OR plano = '';
