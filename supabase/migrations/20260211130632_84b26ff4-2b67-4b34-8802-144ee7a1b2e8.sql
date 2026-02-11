
-- Create price_points table for community-shared prices
CREATE TABLE public.price_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  store_name TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  category TEXT DEFAULT 'Outros',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.price_points ENABLE ROW LEVEL SECURITY;

-- Everyone can read price points (community data)
CREATE POLICY "Anyone can view price points"
ON public.price_points
FOR SELECT
USING (true);

-- Users can insert their own price points
CREATE POLICY "Users can insert own price points"
ON public.price_points
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own price points
CREATE POLICY "Users can update own price points"
ON public.price_points
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own price points
CREATE POLICY "Users can delete own price points"
ON public.price_points
FOR DELETE
USING (auth.uid() = user_id);

-- Index for geospatial queries
CREATE INDEX idx_price_points_location ON public.price_points (lat, lng);
CREATE INDEX idx_price_points_product ON public.price_points (product_name);
