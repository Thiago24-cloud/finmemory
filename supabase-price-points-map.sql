-- ============================================
-- Tabela price_points: pontos do mapa de preços (Fase 3)
-- Alimentada automaticamente ao salvar nota fiscal (OCR) ou sync e-mail.
-- ============================================

CREATE TABLE IF NOT EXISTS price_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transacao_id UUID REFERENCES transacoes(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  store_name TEXT NOT NULL,
  lat DECIMAL(10,7) NOT NULL,
  lng DECIMAL(10,7) NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_points_location ON price_points(lat, lng);
CREATE INDEX IF NOT EXISTS idx_price_points_created_at ON price_points(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_points_user_id ON price_points(user_id);

-- RLS: leitura pública (mapa), inserção via API (service_role)
ALTER TABLE price_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "price_points_select_all" ON price_points;
CREATE POLICY "price_points_select_all"
ON price_points FOR SELECT
USING (true);

DROP POLICY IF EXISTS "price_points_insert_all" ON price_points;
CREATE POLICY "price_points_insert_all"
ON price_points FOR INSERT
WITH CHECK (true);

-- Opcional: habilitar Realtime no dashboard Supabase em Database > Replication
-- para a tabela price_points (novos pins aparecem em tempo real no mapa).

COMMENT ON TABLE price_points IS 'Pontos do mapa de preços; alimentado ao processar nota fiscal ou e-mail';
