-- Bucket público para miniaturas das regras (upload via service role no painel).

INSERT INTO storage.buckets (id, name, public)
VALUES ('map-thumbnail-rules', 'map-thumbnail-rules', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "map_thumbnail_rules_public_read" ON storage.objects;
CREATE POLICY "map_thumbnail_rules_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'map-thumbnail-rules');
