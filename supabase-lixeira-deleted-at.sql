-- Lixeira: exclusão reversível (soft delete)
-- Execute no SQL Editor do Supabase para habilitar a lixeira no dashboard.

ALTER TABLE transacoes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
COMMENT ON COLUMN transacoes.deleted_at IS 'Preenchido quando o usuário exclui a nota; null = visível no dashboard. Restaurar = setar null.';

-- Índice para listar rapidamente as excluídas (lixeira)
CREATE INDEX IF NOT EXISTS idx_transacoes_deleted_at ON transacoes(user_id, deleted_at) WHERE deleted_at IS NOT NULL;
