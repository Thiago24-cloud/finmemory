-- Add image_url column to price_points
ALTER TABLE public.price_points ADD COLUMN image_url TEXT;

-- Create public storage bucket for price photos
INSERT INTO storage.buckets (id, name, public) VALUES ('price-photos', 'price-photos', true);

-- Storage policies for price-photos bucket
CREATE POLICY "Anyone can view price photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'price-photos');

CREATE POLICY "Authenticated users can upload price photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'price-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete own price photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'price-photos' AND auth.uid()::text = (storage.foldername(name))[1]);